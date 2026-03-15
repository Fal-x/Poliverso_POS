import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '@/backend/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { fail, ok } from '../utils/response';
import { appendCardBalanceEvent } from '@/backend/services/cardBalanceService';
import { sanitizeId, sanitizeText, sanitizeUuid } from '@/backend/utils/sanitize';

const D = (value: string | number | Prisma.Decimal) => new Prisma.Decimal(value);
const DEFAULT_POINTS_LEDGER_LIMIT = 50;

function parseOptionalDate(value: unknown): Date | null {
  const raw = sanitizeText(value, 32);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getRangeBounds(query: Record<string, unknown>) {
  const from = parseOptionalDate(query.from);
  const to = parseOptionalDate(query.to);
  const groupBy = sanitizeText(query.group_by, 12).toLowerCase() === 'month' ? 'month' : 'day';

  const start = from ?? new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
  const endInclusive = to ?? new Date();
  const end = new Date(endInclusive.getTime() + 24 * 60 * 60 * 1000);
  if (start >= end) return null;
  return { start, end, groupBy: groupBy as 'day' | 'month' };
}

function periodLabel(date: Date, groupBy: 'day' | 'month') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: groupBy === 'day' ? '2-digit' : undefined,
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  if (groupBy === 'month') return `${year}-${month}`;
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function buildPrizeReceipt(params: {
  receiptNumber: string;
  createdAt: Date;
  cardUid: string;
  prizeName: string;
  quantity: number;
  pointsUnitCost: number;
  pointsTotal: number;
  cashierName: string;
}) {
  const {
    receiptNumber,
    createdAt,
    cardUid,
    prizeName,
    quantity,
    pointsUnitCost,
    pointsTotal,
    cashierName,
  } = params;
  return [
    'POLIVERSE POS',
    'Recibo de Redencion de Premio',
    `No: ${receiptNumber}`,
    `Fecha: ${createdAt.toLocaleString('es-CO')}`,
    `Tarjeta: ${cardUid}`,
    `Premio: ${prizeName}`,
    `Cantidad: ${quantity}`,
    `Costo unitario (pts): ${pointsUnitCost}`,
    `Total puntos: ${pointsTotal}`,
    `Responsable: ${cashierName}`,
  ].join('\n');
}

export async function prizeRoutes(app: FastifyInstance) {
  app.get('/prizes/card-summary', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const cardUid = sanitizeId((req.query as any).card_uid, 60).toUpperCase();
    const includeHistory = sanitizeText((req.query as any).include_history, 10).toLowerCase() !== 'false';
    const historyLimit = Math.min(
      Math.max(Number.parseInt(sanitizeText((req.query as any).history_limit, 6) || String(DEFAULT_POINTS_LEDGER_LIMIT), 10) || DEFAULT_POINTS_LEDGER_LIMIT, 1),
      300,
    );
    if (!siteId || !cardUid) return fail(reply, 'VALIDATION_ERROR', 'site_id y card_uid requeridos');

    const card = await prisma.card.findFirst({
      where: { siteId, uid: cardUid },
      include: {
        ownerCustomer: {
          select: {
            id: true,
            fullName: true,
            documentType: true,
            documentNumber: true,
            phone: true,
            city: true,
          },
        },
      },
    });
    if (!card) return fail(reply, 'NOT_FOUND', 'Tarjeta no encontrada', 404);

    const pointsHistory = includeHistory
      ? await prisma.pointsLedgerEvent.findMany({
          where: { siteId, cardId: card.id },
          include: {
            createdBy: { select: { fullName: true, email: true } },
          },
          orderBy: { occurredAt: 'desc' },
          take: historyLimit,
        })
      : [];

    return ok(reply, {
      card: {
        id: card.id,
        uid: card.uid,
        status: card.status,
        balance: Number(card.creditBalance ?? 0),
        points_balance: Number(card.pointsBalance ?? 0),
        owner: card.ownerCustomer
          ? {
              id: card.ownerCustomer.id,
              full_name: card.ownerCustomer.fullName,
              document_type: card.ownerCustomer.documentType,
              document_number: card.ownerCustomer.documentNumber,
              phone: card.ownerCustomer.phone,
              city: card.ownerCustomer.city,
            }
          : null,
      },
      points_history: pointsHistory.map((event) => ({
        id: event.id,
        occurred_at: event.occurredAt.toISOString(),
        points_delta: event.pointsDelta,
        reason: event.reason,
        metadata: event.metadata ?? null,
        created_by: event.createdBy.fullName || event.createdBy.email,
      })),
    });
  });

  app.get('/prizes/points-ledger', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const cardUid = sanitizeId((req.query as any).card_uid, 60).toUpperCase();
    const limit = Math.min(
      Math.max(Number.parseInt(sanitizeText((req.query as any).limit, 6) || String(DEFAULT_POINTS_LEDGER_LIMIT), 10) || DEFAULT_POINTS_LEDGER_LIMIT, 1),
      500,
    );
    if (!siteId || !cardUid) return fail(reply, 'VALIDATION_ERROR', 'site_id y card_uid requeridos');

    const card = await prisma.card.findFirst({
      where: { siteId, uid: cardUid },
      select: { id: true, uid: true, pointsBalance: true, status: true },
    });
    if (!card) return fail(reply, 'NOT_FOUND', 'Tarjeta no encontrada', 404);

    const events = await prisma.pointsLedgerEvent.findMany({
      where: { siteId, cardId: card.id },
      include: {
        createdBy: { select: { fullName: true, email: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });

    return ok(reply, {
      card: {
        uid: card.uid,
        status: card.status,
        points_balance: card.pointsBalance,
      },
      data: events.map((event) => ({
        id: event.id,
        occurred_at: event.occurredAt.toISOString(),
        points_delta: event.pointsDelta,
        reason: event.reason,
        metadata: event.metadata ?? null,
        created_by: event.createdBy.fullName || event.createdBy.email,
      })),
    });
  });

  app.get('/prizes', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');

    const prizes = await prisma.inventoryItem.findMany({
      where: { siteId, category: 'PRIZE', isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, sku: true, pointsCost: true },
    });
    const stockRows = await prisma.inventoryMovement.groupBy({
      by: ['itemId'],
      where: {
        siteId,
        itemId: { in: prizes.map((prize) => prize.id) },
      },
      _sum: { quantity: true },
    });
    const stockByItemId = new Map(stockRows.map((row) => [row.itemId, Number(row._sum.quantity ?? 0)]));

    return ok(reply, prizes.map((prize) => ({
      id: prize.id,
      name: prize.name,
      sku: prize.sku,
      points_cost: prize.pointsCost,
      stock: stockByItemId.get(prize.id) ?? 0,
    })));
  });

  app.post('/prizes/redeem', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      card_uid: string;
      item_id: string;
      quantity: number;
      performed_by_user_id?: string;
      notes?: string;
    };
    const authUser = (req as any).authUser as { id: string } | undefined;
    const siteId = sanitizeUuid(body?.site_id);
    const cardUid = sanitizeId(body?.card_uid, 60).toUpperCase();
    const itemId = sanitizeUuid(body?.item_id);
    const quantity = Number(body?.quantity);
    const performedByUserId = body?.performed_by_user_id ? sanitizeUuid(body.performed_by_user_id) : (authUser?.id ?? '');
    const notes = sanitizeText(body?.notes, 240);
    if (!siteId || !cardUid || !itemId || !Number.isInteger(quantity) || quantity <= 0 || !performedByUserId) {
      return fail(reply, 'VALIDATION_ERROR', 'Datos de redención inválidos');
    }
    if (authUser?.id && authUser.id !== performedByUserId) {
      return fail(reply, 'FORBIDDEN', 'Usuario no autorizado', 403);
    }

    const [card, prize, cashier] = await Promise.all([
      prisma.card.findFirst({ where: { siteId, uid: cardUid } }),
      prisma.inventoryItem.findFirst({ where: { id: itemId, siteId, category: 'PRIZE', isActive: true } }),
      prisma.user.findUnique({ where: { id: performedByUserId }, select: { fullName: true, email: true } }),
    ]);
    if (!card) return fail(reply, 'NOT_FOUND', 'Tarjeta no encontrada', 404);
    if (card.status !== 'ACTIVE') return fail(reply, 'INVALID_CARD_STATUS', 'Tarjeta no activa', 409);
    if (!prize) return fail(reply, 'NOT_FOUND', 'Premio no encontrado', 404);
    if (prize.pointsCost <= 0) return fail(reply, 'VALIDATION_ERROR', 'Premio sin costo en puntos configurado', 409);
    if (!cashier) return fail(reply, 'NOT_FOUND', 'Usuario responsable no encontrado', 404);

    const [stockAgg] = await Promise.all([
      prisma.inventoryMovement.aggregate({
        where: { siteId, itemId: prize.id },
        _sum: { quantity: true },
      }),
    ]);
    const pointsAvailable = Number(card.pointsBalance ?? 0);
    const stockAvailable = Number(stockAgg._sum.quantity ?? 0);
    const pointsTotal = prize.pointsCost * quantity;
    if (pointsAvailable < pointsTotal) return fail(reply, 'INSUFFICIENT_POINTS', 'Puntos insuficientes', 409);
    if (stockAvailable < quantity) return fail(reply, 'INSUFFICIENT_STOCK', 'Stock insuficiente del premio', 409);

    const redemption = await prisma.$transaction(async (tx) => {
      const ledgerEvent = await tx.ledgerEvent.create({
        data: {
          siteId,
          eventType: 'PRIZE_REDEMPTION',
          description: `Redención premio ${prize.name} x${quantity}`,
          createdById: performedByUserId,
          entries: {
            create: [
              { account: 'POINTS_LIABILITY', side: 'DEBIT', amount: D(pointsTotal) },
              { account: 'PRIZE_REVENUE', side: 'CREDIT', amount: D(pointsTotal) },
            ],
          },
        },
      });

      await appendCardBalanceEvent({
        tx,
        cardId: card.id,
        siteId,
        ledgerEventId: ledgerEvent.id,
        moneyDelta: D(0),
        pointsDelta: pointsTotal * -1,
        reason: `PRIZE_REDEEM:${prize.sku ?? prize.id}`,
      });

      await tx.pointsLedgerEvent.create({
        data: {
          siteId,
          cardId: card.id,
          ledgerEventId: ledgerEvent.id,
          pointsDelta: pointsTotal * -1,
          reason: 'PREMIO_REDIMIDO',
          metadata: {
            itemId: prize.id,
            itemName: prize.name,
            quantity,
            pointsUnitCost: prize.pointsCost,
            notes,
          },
          createdById: performedByUserId,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          siteId,
          itemId: prize.id,
          performedById: performedByUserId,
          type: 'REDEMPTION',
          quantity: quantity * -1,
          notes: `Redención premio (${cardUid})${notes ? ` - ${notes}` : ''}`,
        },
      });

      const createdAt = new Date();
      const receiptNumber = `PR-${createdAt.getTime().toString().slice(-8)}`;
      const receiptText = buildPrizeReceipt({
        receiptNumber,
        createdAt,
        cardUid,
        prizeName: prize.name,
        quantity,
        pointsUnitCost: prize.pointsCost,
        pointsTotal,
        cashierName: cashier.fullName || cashier.email,
      });

      return tx.prizeRedemption.create({
        data: {
          siteId,
          cardId: card.id,
          itemId: prize.id,
          quantity,
          pointsUnitCost: prize.pointsCost,
          pointsTotal,
          receiptNumber,
          receiptText,
          performedById: performedByUserId,
          ledgerEventId: ledgerEvent.id,
        },
      });
    });

    const pointsAfter = pointsAvailable - pointsTotal;
    return ok(reply, {
      id: redemption.id,
      receipt_number: redemption.receiptNumber,
      receipt_text: redemption.receiptText,
      card_uid: cardUid,
      item_name: prize.name,
      quantity,
      points_total: pointsTotal,
      points_after: pointsAfter,
      performed_by_user_id: performedByUserId,
      created_at: redemption.createdAt.toISOString(),
    });
  });

  app.post('/prizes/points-adjust', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      card_uid: string;
      points_delta: number;
      reason: string;
      performed_by_user_id?: string;
      notes?: string;
    };
    const authUser = (req as any).authUser as { id: string } | undefined;
    const siteId = sanitizeUuid(body?.site_id);
    const cardUid = sanitizeId(body?.card_uid, 60).toUpperCase();
    const pointsDelta = Number(body?.points_delta);
    const reason = sanitizeText(body?.reason, 120);
    const notes = sanitizeText(body?.notes, 240);
    const performedByUserId = body?.performed_by_user_id ? sanitizeUuid(body.performed_by_user_id) : (authUser?.id ?? '');
    if (!siteId || !cardUid || !Number.isInteger(pointsDelta) || pointsDelta === 0 || !reason || !performedByUserId) {
      return fail(reply, 'VALIDATION_ERROR', 'site_id, card_uid, points_delta y reason son requeridos');
    }
    if (authUser?.id && authUser.id !== performedByUserId) {
      return fail(reply, 'FORBIDDEN', 'Usuario no autorizado', 403);
    }

    const [card, user] = await Promise.all([
      prisma.card.findFirst({ where: { siteId, uid: cardUid } }),
      prisma.user.findUnique({ where: { id: performedByUserId }, select: { id: true } }),
    ]);
    if (!card) return fail(reply, 'NOT_FOUND', 'Tarjeta no encontrada', 404);
    if (!user) return fail(reply, 'NOT_FOUND', 'Usuario responsable no encontrado', 404);
    if (pointsDelta < 0 && Number(card.pointsBalance ?? 0) < Math.abs(pointsDelta)) {
      return fail(reply, 'INSUFFICIENT_POINTS', 'La tarjeta no tiene puntos suficientes para el ajuste', 409);
    }

    const pointsAmount = Math.abs(pointsDelta);
    const adjustment = await prisma.$transaction(async (tx) => {
      const ledgerEvent = await tx.ledgerEvent.create({
        data: {
          siteId,
          eventType: 'MANUAL_ADJUSTMENT',
          description: `Ajuste manual de puntos ${pointsDelta > 0 ? '+' : ''}${pointsDelta} (${reason})`,
          createdById: performedByUserId,
          entries: {
            create: pointsDelta > 0
              ? [
                  { account: 'CASH_OVER_SHORT', side: 'DEBIT', amount: D(pointsAmount) },
                  { account: 'POINTS_LIABILITY', side: 'CREDIT', amount: D(pointsAmount) },
                ]
              : [
                  { account: 'POINTS_LIABILITY', side: 'DEBIT', amount: D(pointsAmount) },
                  { account: 'CASH_OVER_SHORT', side: 'CREDIT', amount: D(pointsAmount) },
                ],
          },
        },
      });

      await appendCardBalanceEvent({
        tx,
        cardId: card.id,
        siteId,
        ledgerEventId: ledgerEvent.id,
        moneyDelta: D(0),
        pointsDelta,
        reason: 'POINTS_ADJUSTMENT',
      });

      const pointsEvent = await tx.pointsLedgerEvent.create({
        data: {
          siteId,
          cardId: card.id,
          ledgerEventId: ledgerEvent.id,
          pointsDelta,
          reason: 'AJUSTE_MANUAL',
          metadata: {
            reason,
            notes,
          },
          createdById: performedByUserId,
        },
      });

      const cardAfter = await tx.card.findUnique({
        where: { id: card.id },
        select: { pointsBalance: true },
      });

      return {
        ledgerEventId: ledgerEvent.id,
        pointsEventId: pointsEvent.id,
        pointsBalance: Number(cardAfter?.pointsBalance ?? 0),
      };
    });

    return ok(reply, {
      card_uid: cardUid,
      points_delta: pointsDelta,
      points_after: adjustment.pointsBalance,
      reason,
      ledger_event_id: adjustment.ledgerEventId,
      points_event_id: adjustment.pointsEventId,
    });
  });

  app.post('/prizes/redemptions/:id/reverse', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const redemptionId = sanitizeUuid((req.params as any).id);
    const body = req.body as {
      site_id: string;
      reason: string;
      performed_by_user_id?: string;
      notes?: string;
    };
    const authUser = (req as any).authUser as { id: string } | undefined;
    const siteId = sanitizeUuid(body?.site_id);
    const reason = sanitizeText(body?.reason, 120);
    const notes = sanitizeText(body?.notes, 240);
    const performedByUserId = body?.performed_by_user_id ? sanitizeUuid(body.performed_by_user_id) : (authUser?.id ?? '');
    if (!redemptionId || !siteId || !reason || !performedByUserId) {
      return fail(reply, 'VALIDATION_ERROR', 'id, site_id y reason son requeridos');
    }
    if (authUser?.id && authUser.id !== performedByUserId) {
      return fail(reply, 'FORBIDDEN', 'Usuario no autorizado', 403);
    }

    const [redemption, alreadyReversed] = await Promise.all([
      prisma.prizeRedemption.findFirst({
        where: { id: redemptionId, siteId },
        include: {
          card: { select: { id: true, uid: true, status: true } },
          item: { select: { id: true, name: true, sku: true } },
        },
      }),
      prisma.pointsLedgerEvent.findFirst({
        where: {
          siteId,
          reason: 'REVERSO_REDENCION',
          metadata: { path: ['redemption_id'], equals: redemptionId },
        },
        select: { id: true },
      }),
    ]);
    if (!redemption) return fail(reply, 'NOT_FOUND', 'Redención no encontrada', 404);
    if (alreadyReversed) return fail(reply, 'CONFLICT', 'La redención ya fue reversada', 409);

    const reversal = await prisma.$transaction(async (tx) => {
      const reversalLedgerEvent = await tx.ledgerEvent.create({
        data: {
          siteId,
          eventType: 'REVERSAL',
          description: `Reverso redención ${redemption.receiptNumber} (${reason})`,
          createdById: performedByUserId,
          reversalOfId: redemption.ledgerEventId ?? undefined,
          entries: {
            create: [
              { account: 'PRIZE_REVENUE', side: 'DEBIT', amount: D(redemption.pointsTotal) },
              { account: 'POINTS_LIABILITY', side: 'CREDIT', amount: D(redemption.pointsTotal) },
            ],
          },
        },
      });

      await appendCardBalanceEvent({
        tx,
        cardId: redemption.cardId,
        siteId,
        ledgerEventId: reversalLedgerEvent.id,
        moneyDelta: D(0),
        pointsDelta: redemption.pointsTotal,
        reason: `PRIZE_REDEEM_REVERSAL:${redemption.id}`,
      });

      await tx.pointsLedgerEvent.create({
        data: {
          siteId,
          cardId: redemption.cardId,
          ledgerEventId: reversalLedgerEvent.id,
          pointsDelta: redemption.pointsTotal,
          reason: 'REVERSO_REDENCION',
          metadata: {
            redemption_id: redemption.id,
            original_receipt_number: redemption.receiptNumber,
            reason,
            notes,
          },
          createdById: performedByUserId,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          siteId,
          itemId: redemption.itemId,
          performedById: performedByUserId,
          type: 'ADJUSTMENT',
          quantity: redemption.quantity,
          notes: `Reverso redención ${redemption.receiptNumber} (${reason})${notes ? ` - ${notes}` : ''}`,
        },
      });

      const cardAfter = await tx.card.findUnique({
        where: { id: redemption.cardId },
        select: { pointsBalance: true },
      });
      return {
        reversalLedgerEventId: reversalLedgerEvent.id,
        pointsAfter: Number(cardAfter?.pointsBalance ?? 0),
      };
    });

    return ok(reply, {
      redemption_id: redemption.id,
      card_uid: redemption.card.uid,
      item_name: redemption.item.name,
      quantity: redemption.quantity,
      points_restored: redemption.pointsTotal,
      points_after: reversal.pointsAfter,
      reversal_ledger_event_id: reversal.reversalLedgerEventId,
    });
  });

  app.get('/prizes/inventory/kardex', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const itemId = sanitizeUuid((req.query as any).item_id);
    const limit = Math.min(Math.max(Number.parseInt(sanitizeText((req.query as any).limit, 6) || '300', 10) || 300, 1), 1000);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');

    const where: Record<string, unknown> = {
      siteId,
      item: { category: 'PRIZE' },
    };
    if (itemId) where.itemId = itemId;

    const movements = await prisma.inventoryMovement.findMany({
      where: where as any,
      include: {
        item: { select: { id: true, name: true, sku: true, pointsCost: true } },
        performedBy: { select: { fullName: true, email: true } },
      },
      orderBy: { occurredAt: 'asc' },
      take: limit,
    });

    const balanceByItem = new Map<string, number>();
    const rows = movements.map((movement) => {
      const previous = balanceByItem.get(movement.itemId) ?? 0;
      const current = previous + movement.quantity;
      balanceByItem.set(movement.itemId, current);
      return {
        id: movement.id,
        occurred_at: movement.occurredAt.toISOString(),
        item: {
          id: movement.item.id,
          name: movement.item.name,
          sku: movement.item.sku,
          points_cost: movement.item.pointsCost,
        },
        type: movement.type,
        quantity: movement.quantity,
        balance: current,
        notes: movement.notes ?? null,
        performed_by: movement.performedBy.fullName || movement.performedBy.email,
      };
    });

    return ok(reply, rows.reverse());
  });

  app.get('/prizes/reports', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const range = getRangeBounds(req.query as any);
    if (!range) return fail(reply, 'VALIDATION_ERROR', 'Rango de fechas inválido');

    const [pointsEvents, redemptions] = await Promise.all([
      prisma.pointsLedgerEvent.findMany({
        where: {
          siteId,
          occurredAt: { gte: range.start, lt: range.end },
        },
        select: {
          occurredAt: true,
          pointsDelta: true,
          reason: true,
        },
        take: 50000,
      }),
      prisma.prizeRedemption.findMany({
        where: {
          siteId,
          createdAt: { gte: range.start, lt: range.end },
        },
        include: {
          item: { select: { id: true, name: true, sku: true } },
          performedBy: { select: { id: true, fullName: true, email: true } },
        },
        take: 50000,
      }),
    ]);

    const grantedByPeriod = new Map<string, number>();
    const redeemedByPeriod = new Map<string, number>();
    let totalGranted = 0;
    let totalRedeemed = 0;
    for (const event of pointsEvents) {
      const period = periodLabel(event.occurredAt, range.groupBy);
      if (event.pointsDelta > 0) {
        totalGranted += event.pointsDelta;
        grantedByPeriod.set(period, (grantedByPeriod.get(period) ?? 0) + event.pointsDelta);
      } else if (event.pointsDelta < 0) {
        const redeemed = Math.abs(event.pointsDelta);
        totalRedeemed += redeemed;
        redeemedByPeriod.set(period, (redeemedByPeriod.get(period) ?? 0) + redeemed);
      }
    }

    const prizeUsage = new Map<string, {
      item_id: string;
      item_name: string;
      item_sku: string | null;
      redemptions: number;
      quantity: number;
      points: number;
    }>();
    const cashierUsage = new Map<string, {
      user_id: string;
      user_name: string;
      redemptions: number;
      quantity: number;
      points: number;
    }>();
    for (const redemption of redemptions) {
      const itemKey = redemption.itemId;
      const itemCurrent = prizeUsage.get(itemKey) ?? {
        item_id: redemption.item.id,
        item_name: redemption.item.name,
        item_sku: redemption.item.sku,
        redemptions: 0,
        quantity: 0,
        points: 0,
      };
      itemCurrent.redemptions += 1;
      itemCurrent.quantity += redemption.quantity;
      itemCurrent.points += redemption.pointsTotal;
      prizeUsage.set(itemKey, itemCurrent);

      const userKey = redemption.performedById;
      const userCurrent = cashierUsage.get(userKey) ?? {
        user_id: redemption.performedBy.id,
        user_name: redemption.performedBy.fullName || redemption.performedBy.email,
        redemptions: 0,
        quantity: 0,
        points: 0,
      };
      userCurrent.redemptions += 1;
      userCurrent.quantity += redemption.quantity;
      userCurrent.points += redemption.pointsTotal;
      cashierUsage.set(userKey, userCurrent);
    }

    return ok(reply, {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      group_by: range.groupBy,
      summary: {
        points_granted: totalGranted,
        points_redeemed: totalRedeemed,
        points_net: totalGranted - totalRedeemed,
        redemptions_total: redemptions.length,
      },
      points_granted_by_period: Array.from(grantedByPeriod.entries())
        .map(([period, points]) => ({ period, points }))
        .sort((a, b) => a.period.localeCompare(b.period)),
      points_redeemed_by_period: Array.from(redeemedByPeriod.entries())
        .map(([period, points]) => ({ period, points }))
        .sort((a, b) => a.period.localeCompare(b.period)),
      top_prizes: Array.from(prizeUsage.values()).sort((a, b) => b.redemptions - a.redemptions),
      redemptions_by_cashier: Array.from(cashierUsage.values()).sort((a, b) => b.redemptions - a.redemptions),
    });
  });
}
