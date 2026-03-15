import type { FastifyInstance } from 'fastify';
import { prisma } from '@/backend/prisma';
import {
  CardStatus,
  CustomerDocumentType,
  LedgerAccount,
  LedgerEntrySide,
  PaymentMethod,
  Prisma,
  SaleCategory,
  SaleStatus,
} from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, fail } from '../utils/response';
import { buildReceiptTxt } from '@/backend/services/receiptService';
import { syncExpectedCashAmount } from '@/backend/services/cashSessionService';
import { sanitizeId, sanitizeMoney, sanitizeText, sanitizeUuid } from '@/backend/utils/sanitize';
import { assertValidCardStatusTransition } from '@/backend/domain/cardStateMachine';
import { evaluateRechargePromotion } from '@/backend/services/promotionEngine';
import { appendCardBalanceEvent } from '@/backend/services/cardBalanceService';

const latestReaderUidBySite = new Map<string, { uid: string; timestamp: number }>();

function parseCardStatus(value: unknown): CardStatus | null {
  const status = sanitizeText(value, 20).toUpperCase();
  if (status === 'ACTIVE') return 'ACTIVE';
  if (status === 'BLOCKED') return 'BLOCKED';
  if (status === 'LOST') return 'LOST';
  if (status === 'REPLACED') return 'REPLACED';
  if (status === 'INACTIVE') return 'INACTIVE';
  return null;
}

function paymentMethodToLedgerAccount(method: string): LedgerAccount {
  if (method === 'CASH') return 'CASH_ON_HAND';
  if (['TRANSFER', 'TRANSFER_ACCOUNT_1', 'TRANSFER_ACCOUNT_2', 'NEQUI'].includes(method)) return 'BANK_TRANSFER';
  if (method === 'QR') return 'QR_PROVIDER';
  if (['CARD', 'CREDIT_CARD'].includes(method)) return 'CARD_PROCESSOR';
  return 'POS_REVENUE';
}

type OwnerCustomerPayload = {
  document_type?: string;
  document_number?: string;
  full_name?: string;
  phone?: string;
  email?: string;
  city?: string;
};

const ALLOWED_DOC_TYPES: CustomerDocumentType[] = ['CC', 'CE', 'NIT', 'PAS', 'TI'];

function normalizeOwnerPayload(payload: OwnerCustomerPayload | undefined) {
  const documentType = sanitizeText(payload?.document_type, 10).toUpperCase() as CustomerDocumentType;
  const documentNumber = sanitizeText(payload?.document_number, 60);
  const fullName = sanitizeText(payload?.full_name, 120);
  const phone = sanitizeText(payload?.phone, 40);
  const email = sanitizeText(payload?.email, 160).toLowerCase();
  const city = sanitizeText(payload?.city, 80);
  return {
    documentType,
    documentNumber,
    fullName,
    phone,
    email,
    city,
  };
}

function mapCardToDto(card: {
  id: string;
  uid: string;
  label: string | null;
  creditBalance: Prisma.Decimal;
  pointsBalance: number;
  status: CardStatus;
  issuedAt: Date;
  ownerCustomer: null | {
    id: string;
    documentType: CustomerDocumentType;
    documentNumber: string;
    fullName: string;
    phone: string;
    email: string | null;
    city: string;
  };
}) {
  return {
    id: card.id,
    code: card.uid,
    label: card.label,
    balance: Number(card.creditBalance ?? 0),
    bonusBalance: 0,
    points: Number(card.pointsBalance ?? 0),
    isActive: card.status === 'ACTIVE',
    status: card.status,
    createdAt: card.issuedAt,
    lastUsedAt: null,
    owner: card.ownerCustomer
      ? {
          id: card.ownerCustomer.id,
          document_type: card.ownerCustomer.documentType,
          document_number: card.ownerCustomer.documentNumber,
          full_name: card.ownerCustomer.fullName,
          phone: card.ownerCustomer.phone,
          email: card.ownerCustomer.email,
          city: card.ownerCustomer.city,
        }
      : null,
  };
}

export async function cardRoutes(app: FastifyInstance) {
  app.post('/cards/reader/uid', async (req, reply) => {
    const body = req.body as { site_id: string; uid: string };
    const siteId = sanitizeUuid(body?.site_id);
    const uid = sanitizeId(body?.uid, 60).toUpperCase();
    if (!siteId || !uid) {
      return fail(reply, 'VALIDATION_ERROR', 'site_id y uid requeridos');
    }
    const timestamp = Date.now();
    latestReaderUidBySite.set(siteId, { uid, timestamp });
    return ok(reply, { received: true, uid, timestamp });
  });

  app.get('/cards/reader/wait-uid', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const afterRaw = sanitizeText((req.query as any).after, 32);
    const after = Number(afterRaw || '0');
    if (!siteId) {
      return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    }
    const event = latestReaderUidBySite.get(siteId);
    if (!event) {
      return ok(reply, { uid: null, timestamp: null });
    }
    if (Number.isFinite(after) && after > 0 && event.timestamp <= after) {
      return ok(reply, { uid: null, timestamp: null });
    }
    return ok(reply, { uid: event.uid, timestamp: event.timestamp });
  });

  app.post('/cards', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const body = req.body as { site_id: string; uid: string; label?: string; owner_customer?: OwnerCustomerPayload };
    const siteId = sanitizeUuid(body?.site_id);
    const uid = sanitizeId(body?.uid, 60).toUpperCase();
    const label = sanitizeText(body?.label, 120);
    const ownerPayload = normalizeOwnerPayload(body?.owner_customer);
    const authUser = (req as any).authUser as { id: string } | undefined;
    if (!siteId || !uid) {
      return fail(reply, 'VALIDATION_ERROR', 'site_id y uid requeridos');
    }
    if (!authUser?.id) {
      return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);
    }

    const hasOwnerData = Boolean(ownerPayload.documentType || ownerPayload.documentNumber || ownerPayload.fullName);
    if (hasOwnerData) {
      if (!ALLOWED_DOC_TYPES.includes(ownerPayload.documentType)) {
        return fail(reply, 'VALIDATION_ERROR', 'document_type inválido para propietario');
      }
      if (!ownerPayload.documentNumber || !ownerPayload.fullName) {
        return fail(reply, 'VALIDATION_ERROR', 'document_number y full_name son requeridos para propietario');
      }
    }

    const card = await prisma.$transaction(async (tx) => {
      let ownerCustomerId: string | undefined;
      if (hasOwnerData) {
        const existingOwner = await tx.customer.findFirst({
          where: {
            siteId,
            documentType: ownerPayload.documentType,
            documentNumber: ownerPayload.documentNumber,
          },
        });
        if (existingOwner) {
          const updated = await tx.customer.update({
            where: { id: existingOwner.id },
            data: {
              fullName: ownerPayload.fullName || existingOwner.fullName,
              phone: ownerPayload.phone || existingOwner.phone,
              email: ownerPayload.email || existingOwner.email,
              city: ownerPayload.city || existingOwner.city,
            },
          });
          ownerCustomerId = updated.id;
        } else {
          const createdOwner = await tx.customer.create({
            data: {
              siteId,
              documentType: ownerPayload.documentType,
              documentNumber: ownerPayload.documentNumber,
              fullName: ownerPayload.fullName,
              phone: ownerPayload.phone || 'N/D',
              city: ownerPayload.city || 'N/D',
              email: ownerPayload.email || null,
            },
          });
          ownerCustomerId = createdOwner.id;
        }
      }

      const created = await tx.card.create({
        data: { siteId, uid, label: label || null, ownerCustomerId },
      });
      await tx.cardStatusHistory.create({
        data: {
          siteId,
          cardId: created.id,
          fromStatus: null,
          toStatus: created.status,
          reason: 'Emisión de tarjeta',
          changedByUserId: authUser.id,
        },
      });
      return created;
    });
    return ok(reply, { id: card.id, uid: card.uid });
  });

  app.post('/cards/read', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      uid: string;
      card_name?: string;
      create_if_missing?: boolean;
      owner_customer?: OwnerCustomerPayload;
    };
    const siteId = sanitizeUuid(body?.site_id);
    const uid = sanitizeId(body?.uid, 60).toUpperCase();
    const cardName = sanitizeText(body?.card_name, 120);
    const createIfMissing = Boolean(body?.create_if_missing);
    const ownerPayload = normalizeOwnerPayload(body?.owner_customer);
    const authUser = (req as any).authUser as { id: string } | undefined;

    if (!siteId || !uid) {
      return fail(reply, 'VALIDATION_ERROR', 'site_id y uid requeridos');
    }
    if (!authUser?.id) {
      return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);
    }

    const hasOwnerData = Boolean(ownerPayload.documentType || ownerPayload.documentNumber || ownerPayload.fullName);
    if (hasOwnerData) {
      if (!ALLOWED_DOC_TYPES.includes(ownerPayload.documentType)) {
        return fail(reply, 'VALIDATION_ERROR', 'document_type inválido para propietario');
      }
      if (!ownerPayload.documentNumber || !ownerPayload.fullName) {
        return fail(reply, 'VALIDATION_ERROR', 'document_number y full_name son requeridos para propietario');
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let card = await tx.card.findFirst({
        where: { siteId, uid },
        include: { ownerCustomer: true },
      });

      if (!card && createIfMissing) {
        let ownerCustomerId: string | undefined;
        if (hasOwnerData) {
          const existingOwner = await tx.customer.findFirst({
            where: {
              siteId,
              documentType: ownerPayload.documentType,
              documentNumber: ownerPayload.documentNumber,
            },
          });
          if (existingOwner) {
            const updated = await tx.customer.update({
              where: { id: existingOwner.id },
              data: {
                fullName: ownerPayload.fullName || existingOwner.fullName,
                phone: ownerPayload.phone || existingOwner.phone,
                email: ownerPayload.email || existingOwner.email,
                city: ownerPayload.city || existingOwner.city,
              },
            });
            ownerCustomerId = updated.id;
          } else {
            const createdOwner = await tx.customer.create({
              data: {
                siteId,
                documentType: ownerPayload.documentType,
                documentNumber: ownerPayload.documentNumber,
                fullName: ownerPayload.fullName,
                phone: ownerPayload.phone || 'N/D',
                city: ownerPayload.city || 'N/D',
                email: ownerPayload.email || null,
              },
            });
            ownerCustomerId = createdOwner.id;
          }
        }

        const created = await tx.card.create({
          data: { siteId, uid, label: cardName || null, ownerCustomerId },
        });
        await tx.cardStatusHistory.create({
          data: {
            siteId,
            cardId: created.id,
            fromStatus: null,
            toStatus: created.status,
            reason: 'Emisión de tarjeta',
            changedByUserId: authUser.id,
          },
        });
        card = await tx.card.findUnique({
          where: { id: created.id },
          include: { ownerCustomer: true },
        });
      }

      if (!card) return null;

      return mapCardToDto(card);
    });

    if (!result) {
      return fail(reply, 'NOT_FOUND', 'Tarjeta no encontrada', 404);
    }

    return ok(reply, result);
  });

  app.get('/cards/by-owner', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const docType = sanitizeText((req.query as any).document_type, 10).toUpperCase() as CustomerDocumentType;
    const documentNumber = sanitizeText((req.query as any).document_number, 60);
    if (!siteId || !documentNumber || !ALLOWED_DOC_TYPES.includes(docType)) {
      return fail(reply, 'VALIDATION_ERROR', 'site_id, document_type y document_number son requeridos');
    }

    const owner = await prisma.customer.findFirst({
      where: { siteId, documentType: docType, documentNumber },
      select: { id: true },
    });
    if (!owner) return ok(reply, []);

    const cards = await prisma.card.findMany({
      where: {
        siteId,
        ownerCustomerId: owner.id,
        status: { in: ['ACTIVE', 'LOST', 'BLOCKED'] },
      },
      orderBy: { issuedAt: 'desc' },
      select: {
        id: true,
        uid: true,
        label: true,
        creditBalance: true,
        pointsBalance: true,
        status: true,
        issuedAt: true,
      },
    });

    const balances = cards.map((card) => ({
      uid: card.uid,
      label: card.label,
      status: card.status,
      issued_at: card.issuedAt.toISOString(),
      balance: Number(card.creditBalance ?? 0),
      points: Number(card.pointsBalance ?? 0),
    }));

    return ok(reply, balances);
  });

  app.get('/cards/:uid', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const uid = sanitizeId((req.params as any).uid, 60).toUpperCase();
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!uid || !siteId) return fail(reply, 'VALIDATION_ERROR', 'uid y site_id requeridos');
    const card = await prisma.card.findFirst({
      where: { uid, siteId },
      include: { ownerCustomer: true },
    });
    if (!card) return fail(reply, 'NOT_FOUND', 'Tarjeta no encontrada', 404);
    return ok(reply, mapCardToDto(card));
  });

  app.get('/cards/:uid/status-history', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const uid = sanitizeId((req.params as any).uid, 60).toUpperCase();
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!uid || !siteId) return fail(reply, 'VALIDATION_ERROR', 'uid y site_id requeridos');

    const card = await prisma.card.findFirst({ where: { uid, siteId }, select: { id: true, uid: true, status: true } });
    if (!card) return fail(reply, 'NOT_FOUND', 'Tarjeta no encontrada', 404);

    const history = await prisma.cardStatusHistory.findMany({
      where: { siteId, cardId: card.id },
      include: {
        changedBy: { select: { fullName: true, email: true } },
      },
      orderBy: { occurredAt: 'asc' },
    });

    return ok(reply, {
      card: {
        uid: card.uid,
        status: card.status,
      },
      history: history.map((entry) => ({
        id: entry.id,
        from_status: entry.fromStatus,
        to_status: entry.toStatus,
        reason: entry.reason,
        changed_by: entry.changedBy.fullName || entry.changedBy.email,
        occurred_at: entry.occurredAt.toISOString(),
        metadata: entry.metadata ?? null,
      })),
    });
  });

  app.post('/cards/:uid/status', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const uid = sanitizeId((req.params as any).uid, 60).toUpperCase();
    const body = req.body as {
      site_id: string;
      to_status: string;
      reason: string;
      changed_by_user_id?: string;
      metadata?: Record<string, unknown>;
    };
    const authUser = (req as any).authUser as { id: string } | undefined;
    const siteId = sanitizeUuid(body?.site_id);
    const toStatus = parseCardStatus(body?.to_status);
    const reason = sanitizeText(body?.reason, 240);
    const changedByUserId = body?.changed_by_user_id ? sanitizeUuid(body.changed_by_user_id) : authUser?.id ?? '';
    if (!uid || !siteId || !toStatus || !reason || !changedByUserId) {
      return fail(reply, 'VALIDATION_ERROR', 'uid, site_id, to_status y reason son requeridos');
    }
    if (authUser?.id && authUser.id !== changedByUserId) {
      return fail(reply, 'FORBIDDEN', 'Usuario no autorizado', 403);
    }

    const card = await prisma.card.findFirst({ where: { uid, siteId } });
    if (!card) return fail(reply, 'NOT_FOUND', 'Tarjeta no encontrada', 404);

    try {
      assertValidCardStatusTransition(card.status, toStatus);
    } catch (error: any) {
      return fail(reply, 'INVALID_CARD_STATUS_TRANSITION', error?.message || 'Transición inválida', 409);
    }
    if (card.status === toStatus) {
      return ok(reply, { uid: card.uid, status: card.status });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const cardUpdated = await tx.card.update({
        where: { id: card.id },
        data: { status: toStatus },
      });
      await tx.cardStatusHistory.create({
        data: {
          siteId,
          cardId: card.id,
          fromStatus: card.status,
          toStatus,
          reason,
          changedByUserId,
          metadata: body?.metadata ?? null,
        },
      });
      return cardUpdated;
    });

    return ok(reply, { uid: updated.uid, status: updated.status });
  });

  app.post('/cards/:uid/migrate-balance', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const sourceUid = sanitizeId((req.params as any).uid, 60).toUpperCase();
    const body = req.body as {
      site_id: string;
      target_uid: string;
      document_type?: string;
      document_number?: string;
      reason: string;
      changed_by_user_id?: string;
    };
    const authUser = (req as any).authUser as { id: string } | undefined;
    const siteId = sanitizeUuid(body?.site_id);
    const targetUid = sanitizeId(body?.target_uid, 60).toUpperCase();
    const docType = sanitizeText(body?.document_type, 10).toUpperCase() as CustomerDocumentType;
    const documentNumber = sanitizeText(body?.document_number, 60);
    const reason = sanitizeText(body?.reason, 240);
    const changedByUserId = body?.changed_by_user_id ? sanitizeUuid(body.changed_by_user_id) : authUser?.id ?? '';
    if (!sourceUid || !targetUid || !siteId || !reason) {
      return fail(reply, 'VALIDATION_ERROR', 'source uid, target_uid, site_id y reason son requeridos');
    }
    if (sourceUid === targetUid) {
      return fail(reply, 'VALIDATION_ERROR', 'source y target no pueden ser la misma tarjeta');
    }
    if (authUser?.id && authUser.id !== changedByUserId) {
      return fail(reply, 'FORBIDDEN', 'Usuario no autorizado', 403);
    }

    const sourceCard = await prisma.card.findFirst({
      where: { uid: sourceUid, siteId },
      include: { ownerCustomer: true },
    });
    if (!sourceCard) return fail(reply, 'NOT_FOUND', 'Tarjeta origen no encontrada', 404);
    if (sourceCard.status === 'REPLACED' || sourceCard.status === 'INACTIVE') {
      return fail(reply, 'INVALID_CARD_STATUS', 'La tarjeta origen no permite migración de saldo', 409);
    }

    if (!sourceCard.ownerCustomerId) {
      if (!documentNumber || !ALLOWED_DOC_TYPES.includes(docType)) {
        return fail(reply, 'VALIDATION_ERROR', 'document_type y document_number requeridos para tarjetas sin propietario registrado');
      }
      const ownershipCheck = await prisma.saleLine.findFirst({
        where: {
          cardId: sourceCard.id,
          sale: {
            siteId,
            customer: {
              documentType: docType,
              documentNumber,
            },
          },
        },
        select: { id: true },
      });
      if (!ownershipCheck) {
        return fail(reply, 'DOCUMENT_VERIFICATION_FAILED', 'No se pudo verificar el documento para migrar saldo', 403);
      }
    }

    const existingTarget = await prisma.card.findFirst({ where: { uid: targetUid, siteId } });
    if (existingTarget && existingTarget.status !== 'ACTIVE') {
      return fail(reply, 'TARGET_CARD_NOT_ACTIVE', 'La tarjeta destino debe estar ACTIVA', 409);
    }
    try {
      assertValidCardStatusTransition(sourceCard.status, 'REPLACED');
    } catch (error: any) {
      return fail(reply, 'INVALID_CARD_STATUS_TRANSITION', error?.message || 'Transición inválida', 409);
    }

    const result = await prisma.$transaction(async (tx) => {
      let targetCard = existingTarget;
      if (!targetCard) {
        targetCard = await tx.card.create({
          data: {
            siteId,
            uid: targetUid,
            status: 'ACTIVE',
            ownerCustomerId: sourceCard.ownerCustomerId ?? undefined,
          },
        });
        await tx.cardStatusHistory.create({
          data: {
            siteId,
            cardId: targetCard.id,
            fromStatus: null,
            toStatus: 'ACTIVE',
            reason: `Emisión por reemplazo de ${sourceUid}`,
            changedByUserId,
          },
        });
      }
      if (targetCard.ownerCustomerId !== sourceCard.ownerCustomerId) {
        targetCard = await tx.card.update({
          where: { id: targetCard.id },
          data: { ownerCustomerId: sourceCard.ownerCustomerId ?? null },
        });
      }

      const money = new Prisma.Decimal(sourceCard.creditBalance ?? 0);
      const points = Number(sourceCard.pointsBalance ?? 0);

      if (!money.isZero() || points !== 0) {
        await appendCardBalanceEvent({
          tx,
          cardId: sourceCard.id,
          siteId,
          moneyDelta: money.mul(-1),
          pointsDelta: -points,
          reason: `BALANCE_MIGRATION_OUT:${targetUid}`,
        });
        await appendCardBalanceEvent({
          tx,
          cardId: targetCard.id,
          siteId,
          moneyDelta: money,
          pointsDelta: points,
          reason: `BALANCE_MIGRATION_IN:${sourceUid}`,
        });
      }

      await tx.card.update({
        where: { id: sourceCard.id },
        data: { status: 'REPLACED' },
      });
      await tx.cardStatusHistory.create({
        data: {
          siteId,
          cardId: sourceCard.id,
          fromStatus: sourceCard.status,
          toStatus: 'REPLACED',
          reason,
          changedByUserId,
          metadata: {
            target_uid: targetUid,
            document_type: docType || null,
            document_number: documentNumber || null,
            owner_customer_id: sourceCard.ownerCustomerId,
          },
        },
      });

      return {
        sourceUid,
        sourceStatus: 'REPLACED' as CardStatus,
        targetUid: targetCard.uid,
        ownerTransferred: Boolean(sourceCard.ownerCustomerId),
      };
    });

    return ok(reply, {
      source_uid: result.sourceUid,
      source_status: result.sourceStatus,
      target_uid: result.targetUid,
      owner_transferred: result.ownerTransferred,
    });
  });

  app.post('/cards/:uid/recharge', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const uid = sanitizeId((req.params as any).uid, 60).toUpperCase();
    const body = req.body as {
      site_id: string;
      customer_id?: string;
      amount: string;
      payment_method: string;
      terminal_id: string;
      shift_id: string;
      cash_session_id: string;
      created_by_user_id: string;
      include_card_issue_fee?: boolean;
      promotion_code?: string;
    };

    const siteId = sanitizeUuid(body?.site_id);
    const amountStr = sanitizeMoney(body?.amount);
    const paymentMethod = sanitizeText(body?.payment_method, 20).toUpperCase();
    const terminalId = sanitizeUuid(body?.terminal_id);
    const shiftId = sanitizeUuid(body?.shift_id);
    const cashSessionId = sanitizeUuid(body?.cash_session_id);
    const createdByUserId = sanitizeUuid(body?.created_by_user_id);
    const customerId = body?.customer_id ? sanitizeUuid(body.customer_id) : '';
    const promotionCode = sanitizeText(body?.promotion_code, 20).toUpperCase();

    if (!uid || !siteId || !amountStr || !paymentMethod || !terminalId || !shiftId || !cashSessionId || !createdByUserId) {
      return fail(reply, 'VALIDATION_ERROR', 'Campos requeridos incompletos');
    }
    if (!['CASH', 'TRANSFER', 'TRANSFER_ACCOUNT_1', 'TRANSFER_ACCOUNT_2', 'NEQUI', 'QR', 'CARD', 'CREDIT_CARD', 'CREDIT', 'MIXED'].includes(paymentMethod)) {
      return fail(reply, 'VALIDATION_ERROR', 'payment_method inválido');
    }

    const card = await prisma.card.findUnique({ where: { uid } });
    if (!card) return fail(reply, 'NOT_FOUND', 'Tarjeta no encontrada', 404);
    if (card.status !== 'ACTIVE') return fail(reply, 'INVALID_CARD_STATUS', 'La tarjeta no está activa', 409);

    const amount = new Prisma.Decimal(amountStr);
    if (amount.lte(0)) return fail(reply, 'VALIDATION_ERROR', 'Monto inválido');

    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) return fail(reply, 'NOT_FOUND', 'Sede no encontrada', 404);

    const siteConfig = await prisma.siteConfig.findUnique({ where: { siteId } });
    if (!siteConfig) return fail(reply, 'NOT_FOUND', 'Config no encontrada', 404);
    if (amount.lt(siteConfig.minRechargeAmount)) {
      return fail(reply, 'VALIDATION_ERROR', `La recarga mínima es ${siteConfig.minRechargeAmount.toFixed(2)}`, 409);
    }
    const resolvedCustomerId = customerId || site.defaultCustomerId;
    if (!resolvedCustomerId) return fail(reply, 'VALIDATION_ERROR', 'customer_id requerido');

    const activeSession = await prisma.cashSession.findFirst({
      where: {
        id: cashSessionId,
        siteId,
        terminalId,
        status: 'OPEN',
      },
      select: { id: true, openedByUserId: true, shiftId: true },
    });

    if (!activeSession) {
      return fail(reply, 'CASH_SESSION_CLOSED', 'No hay caja abierta para esta terminal', 409);
    }

    if (activeSession.openedByUserId !== createdByUserId) {
      return fail(reply, 'CASH_SESSION_OWNER_MISMATCH', 'El responsable de la caja no coincide', 403);
    }

    if (shiftId && activeSession.shiftId && shiftId !== activeSession.shiftId) {
      return fail(reply, 'SHIFT_MISMATCH', 'La recarga no coincide con el turno activo', 409);
    }

    const bonusScale = await prisma.bonusScale.findFirst({
      where: {
        siteId,
        minAmount: { lte: amount },
        OR: [{ maxAmount: null }, { maxAmount: { gte: amount } }],
      },
      orderBy: { minAmount: 'desc' },
    });

    const bonusAmount = bonusScale ? bonusScale.bonusAmount : new Prisma.Decimal(0);
    const points = Math.floor(amount.div(siteConfig.currencyUnit).toNumber()) * Math.max(0, siteConfig.pointsPerCurrency);
    let promoCredit = new Prisma.Decimal(0);
    let promoAppliedCode: string | null = null;
    if (promotionCode) {
      const promotionResult = await evaluateRechargePromotion({
        siteId,
        amount,
        promotionCode,
      });
      if (!promotionResult) {
        return fail(reply, 'INVALID_PROMOTION_CODE', 'Código de promoción de recarga inválido', 409);
      }
      promoCredit = promotionResult.additionalCredit;
      promoAppliedCode = promotionResult.promotion.code;
    }
    let cardIssueFee = new Prisma.Decimal(0);
    let cardIssueProductId: string | null = null;

    if (body.include_card_issue_fee) {
      const cardProduct = await prisma.product.findFirst({
        where: {
          siteId,
          category: SaleCategory.CARD_PLASTIC,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (!cardProduct) {
        return fail(reply, 'PRODUCT_NOT_FOUND', 'No hay producto de tarjeta configurado', 404);
      }

      cardIssueFee = cardProduct.price;
      cardIssueProductId = cardProduct.id;
    }

    const saleSubtotal = amount.add(cardIssueFee);
    const creditedBalance = amount.add(bonusAmount).add(promoCredit);
    const accountedBalance = amount.add(bonusAmount);
    const bonusCredit = bonusAmount;
    const cashAccount = paymentMethodToLedgerAccount(paymentMethod);

    const sale = await prisma.$transaction(async (tx) => {
      const createdSale = await tx.sale.create({
        data: {
          siteId,
          customerId: resolvedCustomerId,
          shiftId,
          terminalId,
          cashSessionId,
          createdById: createdByUserId,
          status: SaleStatus.PAID,
          subtotal: saleSubtotal,
          tax: new Prisma.Decimal(0),
          total: saleSubtotal,
          totalPaid: saleSubtotal,
          balanceDue: new Prisma.Decimal(0),
          bonusTotal: bonusAmount,
          pointsEarned: points,
          requiresElectronicInvoice: false,
          lines: {
            create: [
              {
                cardId: card.id,
                category: SaleCategory.RECHARGE,
                quantity: 1,
                unitPrice: amount,
                lineTotal: amount,
                metadata: {
                  bonusAmount: bonusAmount.toFixed(2),
                  promoCode: promoAppliedCode,
                  promoAmount: promoCredit.toFixed(2),
                  points,
                },
              },
              ...(cardIssueProductId
                ? [{
                    productId: cardIssueProductId,
                    category: SaleCategory.CARD_PLASTIC,
                    quantity: 1,
                    unitPrice: cardIssueFee,
                    lineTotal: cardIssueFee,
                  }]
                : []),
            ],
          },
          payments: {
            create: [{
              method: paymentMethod as PaymentMethod,
              amount: saleSubtotal,
            }],
          },
        },
      });

      if (bonusAmount.gt(0) && bonusScale) {
        await tx.bonusApplied.create({
          data: {
            cardId: card.id,
            saleId: createdSale.id,
            bonusScaleId: bonusScale.id,
            bonusAmount,
          },
        });
      }

      const ledgerEvent = await tx.ledgerEvent.create({
        data: {
          siteId,
          shiftId,
          saleId: createdSale.id,
          eventType: 'RECHARGE',
          description: `Recarga ${card.uid}${promoAppliedCode ? ` con promoción ${promoAppliedCode}` : ''}`,
          createdById: createdByUserId,
          entries: {
            create: [
              {
                account: cashAccount,
                side: 'DEBIT' as LedgerEntrySide,
                amount: saleSubtotal,
              },
              ...(bonusCredit.gt(0)
                ? [{
                    account: 'POS_REVENUE' as LedgerAccount,
                    side: 'DEBIT' as LedgerEntrySide,
                    amount: bonusCredit,
                  }]
                : []),
              {
                account: 'CARD_FLOAT_LIABILITY' as LedgerAccount,
                side: 'CREDIT' as LedgerEntrySide,
                amount: accountedBalance,
              },
              ...(cardIssueFee.gt(0)
                ? [{
                    account: 'CARD_PLASTIC_REVENUE' as LedgerAccount,
                    side: 'CREDIT' as LedgerEntrySide,
                    amount: cardIssueFee,
                  }]
                : []),
            ],
          },
        },
      });

      await appendCardBalanceEvent({
        tx,
        cardId: card.id,
        siteId,
        ledgerEventId: ledgerEvent.id,
        moneyDelta: amount.add(bonusAmount),
        pointsDelta: points,
        reason: 'RECHARGE',
      });

      if (promoCredit.gt(0) && promoAppliedCode) {
        // RECA additional credit is independent from accounting income.
        await appendCardBalanceEvent({
          tx,
          cardId: card.id,
          siteId,
          moneyDelta: promoCredit,
          pointsDelta: 0,
          reason: `RECHARGE_ADDITIONAL:${promoAppliedCode}`,
        });
      }

      await tx.pointsLedgerEvent.create({
        data: {
          siteId,
          cardId: card.id,
          saleId: createdSale.id,
          ledgerEventId: ledgerEvent.id,
          pointsDelta: points,
          reason: 'PUNTOS_ACUMULADOS',
          metadata: {
            amount: amount.toFixed(2),
            bonusAmount: bonusAmount.toFixed(2),
            promoAmount: promoCredit.toFixed(2),
            promotionCode: promoAppliedCode,
          },
          createdById: createdByUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          siteId,
          actorId: createdByUserId,
          action: 'CREATE',
          entityType: 'SALE',
          entityId: createdSale.id,
          after: {
            total: createdSale.total.toFixed(2),
            status: createdSale.status,
            cashSessionId: createdSale.cashSessionId,
            customerId: createdSale.customerId,
            category: 'RECHARGE',
            paymentMethod,
            promoCode: promoAppliedCode,
          },
        },
      });

      return createdSale;
    });

    const receiptNumber = sale.receiptNumber ?? `RC-${sale.createdAt.getTime().toString().slice(-8)}`;
    const hydrated = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: {
        site: { include: { organization: true } },
        customer: true,
        createdBy: true,
        payments: true,
        lines: { include: { product: true, card: true } },
      },
    });
    const receiptText = hydrated ? buildReceiptTxt({ sale: hydrated as any }) : null;
    if (receiptText) {
      await prisma.sale.update({
        where: { id: sale.id },
        data: { receiptNumber, receiptText },
      });
    }

    await syncExpectedCashAmount({
      siteId,
      cashSessionId,
    });

    return ok(reply, {
      sale_id: sale.id,
      amount: amount.toFixed(2),
      card_issue_fee: cardIssueFee.toFixed(2),
      bonus_amount: bonusAmount.toFixed(2),
      promo_code: promoAppliedCode,
      promo_amount: promoCredit.toFixed(2),
      credited_balance: creditedBalance.toFixed(2),
      points,
      receipt_number: receiptNumber,
      receipt_text: receiptText,
    });
  });
}
