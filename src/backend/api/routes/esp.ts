import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/backend/prisma';
import { fail, ok } from '../utils/response';
import { appendCardBalanceEvent } from '@/backend/services/cardBalanceService';

type EspContext = {
  readerId: string;
  siteId: string;
  attractionId: string;
};

const hashBody = (body: any) =>
  crypto.createHash('sha256').update(body ?? '').digest('hex');

const buildSignature = (payload: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(payload).digest('base64');

function secureEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function asNumberArray(value: unknown) {
  if (!Array.isArray(value)) return [] as number[];
  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((entry) => String(entry).trim())
    .filter(Boolean);
}

function isDateInWindow(reference: Date, startsAt: Date | null, endsAt: Date | null) {
  if (startsAt && reference < startsAt) return false;
  if (endsAt && reference > endsAt) return false;
  return true;
}

function isDayAllowed(reference: Date, dayRestrictions: unknown) {
  const days = asNumberArray(dayRestrictions);
  if (days.length === 0) return true;
  return days.includes(reference.getDay());
}

async function calculateReaderPrice(params: {
  tx: Prisma.TransactionClient;
  siteId: string;
  attractionCode: string;
  attractionType: 'TIME' | 'SKILL';
  basePrice: Prisma.Decimal;
  now: Date;
}) {
  const { tx, siteId, attractionCode, attractionType, basePrice, now } = params;
  const promotions = await tx.promotion.findMany({
    where: { siteId, scope: 'SALE', isActive: true },
    orderBy: { priority: 'asc' },
  });

  let finalPrice = new Prisma.Decimal(basePrice);
  const appliedCodes: string[] = [];
  for (const promo of promotions) {
    if (!isDateInWindow(now, promo.startsAt, promo.endsAt)) continue;
    if (!isDayAllowed(now, promo.dayRestrictions)) continue;
    const restrictedCodes = asStringArray(promo.productRestrictions);
    if (restrictedCodes.length > 0 && !restrictedCodes.includes(attractionCode)) continue;
    const exclusionRules = asStringArray(promo.exceptions).map((rule) => rule.toUpperCase());
    const hasExcludedCode = exclusionRules.includes(attractionCode.toUpperCase());
    const hasExcludedType = exclusionRules.includes(`TYPE:${attractionType}`) || exclusionRules.includes(attractionType);
    const hasExcludedSalon = exclusionRules.includes('JUEGOS_DE_SALON') && attractionType === 'SKILL';
    if (hasExcludedCode || hasExcludedType || hasExcludedSalon) continue;

    if (promo.type === 'PERCENT_DISCOUNT' && promo.percentValue) {
      const percent = Number(promo.percentValue);
      if (!Number.isFinite(percent) || percent <= 0) continue;
      const ratio = percent > 1 ? percent / 100 : percent;
      if (ratio <= 0 || ratio >= 1) continue;
      finalPrice = finalPrice.mul(new Prisma.Decimal(1 - ratio));
      appliedCodes.push(promo.code);
      continue;
    }

    if ((promo.type === 'BONUS' || promo.type === 'COMBO') && promo.fixedValue && promo.fixedValue.gt(0)) {
      finalPrice = finalPrice.sub(promo.fixedValue);
      appliedCodes.push(promo.code);
    }
  }

  if (finalPrice.lt(0)) finalPrice = new Prisma.Decimal(0);
  finalPrice = new Prisma.Decimal(finalPrice.toFixed(2));
  return { finalPrice, appliedCodes };
}

async function verifyEspRequest(req: any, reply: any): Promise<EspContext | null> {
  const readerCode = req.headers['x-reader-id'] as string | undefined;
  const apiToken = req.headers['x-api-token'] as string | undefined;
  const signature = req.headers['x-signature'] as string | undefined;

  if (!readerCode) {
    fail(reply, 'VALIDATION_ERROR', 'X-Reader-ID requerido', 400);
    return null;
  }
  if (!apiToken) {
    fail(reply, 'VALIDATION_ERROR', 'X-API-Token requerido', 400);
    return null;
  }
  if (!signature) {
    fail(reply, 'VALIDATION_ERROR', 'X-Signature requerido', 400);
    return null;
  }

  const reader = await prisma.reader.findFirst({
    where: { code: readerCode, isActive: true, attraction: { status: 'ACTIVE' } },
    include: { attraction: true },
  });
  if (!reader) {
    fail(reply, 'NOT_FOUND', 'Reader no encontrado', 404);
    return null;
  }

  if (!reader.apiTokenHash) {
    fail(reply, 'UNAUTHORIZED', 'Token no configurado', 401);
    return null;
  }

  const validToken = await bcrypt.compare(apiToken, reader.apiTokenHash);
  if (!validToken) {
    fail(reply, 'UNAUTHORIZED', 'Token inválido', 401);
    return null;
  }

  if (!reader.hmacSecret) {
    fail(reply, 'UNAUTHORIZED', 'HMAC no configurado', 401);
    return null;
  }

  const payload = req.method === 'GET' ? '' : JSON.stringify(req.body ?? {});
  const bodyHash = hashBody(payload);
  const expected = buildSignature(bodyHash, reader.hmacSecret);
  if (!secureEqual(expected, signature)) {
    fail(reply, 'UNAUTHORIZED', 'Firma inválida', 401);
    return null;
  }

  await prisma.reader.update({
    where: { id: reader.id },
    data: { lastSeenAt: new Date() },
  });

  return { readerId: reader.id, siteId: reader.siteId, attractionId: reader.attractionId };
}

export async function espRoutes(app: FastifyInstance) {
  app.post('/reader/validate', async (req, reply) => {
    const startedAt = Date.now();
    const body = req.body as { uid?: string; timestamp?: number; requestId?: string };
    const readerCode = (req.headers['x-reader-id'] as string | undefined)?.trim();
    const apiToken = (req.headers['x-api-token'] as string | undefined)?.trim();
    const signature = (req.headers['x-signature'] as string | undefined)?.trim();
    if (!readerCode || !apiToken || !signature) {
      return fail(reply, 'VALIDATION_ERROR', 'Headers requeridos: x-reader-id, x-api-token, x-signature', 400);
    }
    if (!body?.uid || !body?.requestId || !Number.isInteger(body?.timestamp)) {
      return fail(reply, 'VALIDATION_ERROR', 'Payload inválido', 400);
    }

    const response = await prisma.$transaction(async (tx) => {
      // 1) Validar token lector
      const reader = await tx.reader.findFirst({
        where: { code: readerCode },
        include: { attraction: true },
      });
      if (!reader || !reader.apiTokenHash) {
        return { httpStatus: 401, error: 'UNAUTHORIZED', message: 'Lector no autorizado' } as const;
      }
      const tokenOk = await bcrypt.compare(apiToken, reader.apiTokenHash);
      if (!tokenOk) {
        return { httpStatus: 401, error: 'UNAUTHORIZED', message: 'Token inválido' } as const;
      }

      // 2) Validar firma HMAC
      if (!reader.hmacSecret) {
        return { httpStatus: 401, error: 'UNAUTHORIZED', message: 'HMAC no configurado' } as const;
      }
      const canonicalPayload = JSON.stringify({
        uid: body.uid,
        timestamp: body.timestamp,
        requestId: body.requestId,
      });
      const expectedSignature = buildSignature(hashBody(canonicalPayload), reader.hmacSecret);
      if (!secureEqual(expectedSignature, signature)) {
        return { httpStatus: 401, error: 'UNAUTHORIZED', message: 'Firma inválida' } as const;
      }
      const nowTs = Math.floor(Date.now() / 1000);
      if (Math.abs(nowTs - Number(body.timestamp)) > 300) {
        return { httpStatus: 401, error: 'UNAUTHORIZED', message: 'Timestamp fuera de ventana' } as const;
      }

      // 3) Verificar lector activo
      if (!reader.isActive) {
        return { httpStatus: 200, allowed: false, reason: 'READER_INACTIVE' } as const;
      }

      // 4) Verificar máquina activa
      if (reader.attraction.status === 'MAINTENANCE') {
        await tx.deviceLog.create({
          data: {
            siteId: reader.siteId,
            readerId: reader.id,
            uid: body.uid,
            requestId: body.requestId!,
            eventType: 'READER_VALIDATE',
            allowed: false,
            reason: 'MACHINE_MAINTENANCE',
            latency: Date.now() - startedAt,
            payload: {
              ...body,
              maintenanceMessage: reader.attraction.maintenanceMessage || 'Máquina en mantenimiento',
            },
          },
        });
        return {
          httpStatus: 200,
          allowed: false,
          reason: 'MACHINE_MAINTENANCE',
          message: reader.attraction.maintenanceMessage || 'Máquina en mantenimiento',
        } as const;
      }
      if (reader.attraction.status !== 'ACTIVE') {
        return { httpStatus: 200, allowed: false, reason: 'MACHINE_INACTIVE' } as const;
      }

      // 5) Buscar tarjeta por UID
      const card = await tx.card.findFirst({
        where: { uid: body.uid, siteId: reader.siteId },
      });
      if (!card) {
        return { httpStatus: 200, allowed: false, reason: 'CARD_NOT_FOUND' } as const;
      }

      // 6) Verificar estado tarjeta
      if (card.status !== 'ACTIVE') {
        return { httpStatus: 200, allowed: false, reason: 'CARD_INACTIVE' } as const;
      }

      // 8) Calcular precio aplicando promociones
      const pricing = await calculateReaderPrice({
        tx,
        siteId: reader.siteId,
        attractionCode: reader.attraction.code,
        attractionType: reader.attraction.type,
        basePrice: reader.attraction.price,
        now: new Date(),
      });
      const priceToCharge = pricing.finalPrice;

      // 9) Débito atómico por saldo materializado
      const updatedRows = await tx.card.updateMany({
        where: {
          id: card.id,
          status: 'ACTIVE',
          creditBalance: { gte: priceToCharge },
        },
        data: {
          creditBalance: { decrement: priceToCharge },
        },
      });
      if (updatedRows.count !== 1) {
        const current = await tx.card.findUnique({
          where: { id: card.id },
          select: { status: true, creditBalance: true },
        });
        if (!current || current.status !== 'ACTIVE') {
          return { httpStatus: 200, allowed: false, reason: 'CARD_INACTIVE' } as const;
        }
        await tx.deviceLog.create({
          data: {
            siteId: reader.siteId,
            readerId: reader.id,
            uid: body.uid,
            cardId: card.id,
            requestId: body.requestId!,
            eventType: 'READER_VALIDATE',
            allowed: false,
            reason: 'INSUFFICIENT_FUNDS',
            latency: Date.now() - startedAt,
            creditBefore: current.creditBalance,
            creditAfter: current.creditBalance,
            payload: body as any,
          },
        });
        return {
          httpStatus: 200,
          allowed: false,
          reason: 'INSUFFICIENT_FUNDS',
        } as const;
      }
      const updatedCard = await tx.card.findUnique({
        where: { id: card.id },
        select: { creditBalance: true },
      });
      if (!updatedCard) return { httpStatus: 404, error: 'NOT_FOUND', message: 'Tarjeta no encontrada' } as const;
      const currentBalance = updatedCard.creditBalance.add(priceToCharge);

      const systemActor = await tx.userAssignment.findFirst({
        where: {
          siteId: reader.siteId,
          isActive: true,
          user: { status: 'ACTIVE' },
        },
        orderBy: { createdAt: 'asc' },
        select: { userId: true },
      });
      if (!systemActor) {
        return { httpStatus: 409, error: 'CONFIG_ERROR', message: 'No hay usuario activo para registrar ledger' } as const;
      }

      // 10) Crear LedgerEvent
      const ledgerEvent = await tx.ledgerEvent.create({
        data: {
          siteId: reader.siteId,
          eventType: 'ATTRACTION_USAGE',
          description: `Reader validate ${reader.attraction.code} (${pricing.appliedCodes.join(',') || 'NO_PROMO'})`,
          createdById: systemActor.userId,
          entries: {
            create: [
              { account: 'CARD_FLOAT_LIABILITY', side: 'DEBIT', amount: priceToCharge },
              { account: 'SERVICE_REVENUE', side: 'CREDIT', amount: priceToCharge },
            ],
          },
        },
      });

      // 11) Crear CardBalanceEvent
      await appendCardBalanceEvent({
        tx,
        siteId: reader.siteId,
        cardId: card.id,
        ledgerEventId: ledgerEvent.id,
        moneyDelta: priceToCharge.mul(-1),
        pointsDelta: 0,
        reason: 'READER_VALIDATE',
        updateCardBalances: false,
      });

      await tx.deviceLog.create({
        data: {
          siteId: reader.siteId,
          readerId: reader.id,
          uid: body.uid,
          cardId: card.id,
          activityId: reader.attraction.id,
          requestId: body.requestId!,
          eventType: 'READER_VALIDATE',
          allowed: true,
          reason: pricing.appliedCodes.length ? `PROMO:${pricing.appliedCodes.join(',')}` : 'OK',
          latency: Date.now() - startedAt,
          creditBefore: currentBalance,
          creditAfter: updatedCard.creditBalance,
          payload: body as any,
        },
      });

      // 12) Responder
      return {
        httpStatus: 200,
        allowed: true,
        reason: null,
        price: Number(priceToCharge),
        balanceBefore: Number(currentBalance),
        balanceAfter: Number(updatedCard.creditBalance),
        machine: reader.attraction.name,
        transactionId: ledgerEvent.id,
      } as const;
    });

    if ('error' in response) {
      return fail(reply, response.error, response.message, response.httpStatus);
    }
    if (response.allowed === false) {
      return reply.send({
        allowed: false,
        reason: response.reason,
        ...(response.message ? { message: response.message } : {}),
      });
    }
    return reply.send({
      allowed: true,
      reason: null,
      price: response.price,
      balanceBefore: response.balanceBefore,
      balanceAfter: response.balanceAfter,
      machine: response.machine,
      transactionId: response.transactionId,
    });
  });

  app.get('/esp/cards/:uid', async (req, reply) => {
    const startedAt = Date.now();
    const ctx = await verifyEspRequest(req, reply);
    if (!ctx) return;
    const uid = (req.params as any).uid as string;
    const card = await prisma.card.findUnique({ where: { uid } });
    if (!card) return fail(reply, 'NOT_FOUND', 'Tarjeta no encontrada', 404);

    await prisma.deviceLog.create({
      data: {
        siteId: ctx.siteId,
        readerId: ctx.readerId,
        uid,
        cardId: card.id,
        requestId: (req.headers['x-request-id'] as string) ?? crypto.randomUUID(),
        eventType: 'CARD_QUERY',
        latency: Date.now() - startedAt,
        pointsBefore: card.pointsBalance ?? 0,
        creditBefore: card.creditBalance ?? new Prisma.Decimal(0),
        payload: { uid },
      },
    });

    return ok(reply, {
      uid: card.uid,
      points: Number(card.pointsBalance ?? 0),
      credit: Number(card.creditBalance ?? 0),
      status: card.status,
    });
  });

  app.get('/esp/activities/:activityId', async (req, reply) => {
    const startedAt = Date.now();
    const ctx = await verifyEspRequest(req, reply);
    if (!ctx) return;
    const activityId = (req.params as any).activityId as string;
    const attraction = await prisma.attraction.findFirst({
      where: {
        OR: [{ id: activityId }, { code: activityId }],
        siteId: ctx.siteId,
      },
    });
    if (!attraction) return fail(reply, 'NOT_FOUND', 'Actividad no encontrada', 404);

    await prisma.deviceLog.create({
      data: {
        siteId: ctx.siteId,
        readerId: ctx.readerId,
        uid: null,
        cardId: null,
        activityId: attraction.id,
        requestId: (req.headers['x-request-id'] as string) ?? crypto.randomUUID(),
        eventType: 'ACTIVITY_QUERY',
        allowed: true,
        reason: 'OK',
        latency: Date.now() - startedAt,
        payload: { activityId },
      },
    });

    return ok(reply, {
      activityId: attraction.code,
      costPoints: attraction.costPoints ?? 0,
      pointsReward: attraction.pointsReward ?? 0,
      costCredit: Number(attraction.price),
      type: 'ATTRACTION',
      machineType: attraction.type,
      machineStatus: attraction.status,
      maintenanceMessage: attraction.maintenanceMessage,
      duration: attraction.duration,
    });
  });

  app.post('/esp/activities/validate-and-use', async (req, reply) => {
    const startedAt = Date.now();
    const ctx = await verifyEspRequest(req, reply);
    if (!ctx) return;
    const body = req.body as { uid: string; activityId: string; terminalId: string; requestId: string };
    if (!body?.uid || !body?.activityId || !body?.terminalId || !body?.requestId) {
      return fail(reply, 'VALIDATION_ERROR', 'Campos requeridos incompletos');
    }

    const existing = await prisma.deviceLog.findFirst({
      where: { readerId: ctx.readerId, requestId: body.requestId },
    });
    if (existing) {
      return ok(reply, {
        allowed: existing.allowed ?? false,
        reason: existing.reason ?? 'DUPLICATE',
        points_before: existing.pointsBefore ?? 0,
        points_after: existing.pointsAfter ?? 0,
        credit_before: Number(existing.creditBefore ?? 0),
        credit_after: Number(existing.creditAfter ?? 0),
        transaction_id: null,
        server_time: new Date().toISOString(),
      });
    }

    const card = await prisma.card.findUnique({ where: { uid: body.uid } });
    if (!card) return fail(reply, 'NOT_FOUND', 'Tarjeta no encontrada', 404);
    if (card.status !== 'ACTIVE') {
      await prisma.deviceLog.create({
        data: {
          siteId: ctx.siteId,
          readerId: ctx.readerId,
          uid: body.uid,
          cardId: card.id,
          activityId: null,
          requestId: body.requestId,
          eventType: 'VALIDATE',
          allowed: false,
          reason: 'CARD_BLOCKED',
          latency: Date.now() - startedAt,
          payload: body as any,
        },
      });
      return ok(reply, { allowed: false, reason: 'CARD_BLOCKED' });
    }

    const attraction = await prisma.attraction.findFirst({
      where: { OR: [{ id: body.activityId }, { code: body.activityId }], siteId: ctx.siteId },
    });
    if (!attraction) return fail(reply, 'NOT_FOUND', 'Actividad no encontrada', 404);
    if (attraction.status === 'MAINTENANCE') {
      await prisma.deviceLog.create({
        data: {
          siteId: ctx.siteId,
          readerId: ctx.readerId,
          uid: body.uid,
          cardId: card.id,
          activityId: attraction.id,
          requestId: body.requestId,
          eventType: 'VALIDATE',
          allowed: false,
          reason: 'MACHINE_MAINTENANCE',
          latency: Date.now() - startedAt,
          payload: {
            ...body,
            maintenanceMessage: attraction.maintenanceMessage || 'Máquina en mantenimiento',
          },
        },
      });
      return ok(reply, {
        allowed: false,
        reason: 'MACHINE_MAINTENANCE',
        message: attraction.maintenanceMessage || 'Máquina en mantenimiento',
      });
    }
    if (attraction.status !== 'ACTIVE') {
      await prisma.deviceLog.create({
        data: {
          siteId: ctx.siteId,
          readerId: ctx.readerId,
          uid: body.uid,
          cardId: card.id,
          activityId: attraction.id,
          requestId: body.requestId,
          eventType: 'VALIDATE',
          allowed: false,
          reason: 'MACHINE_INACTIVE',
          latency: Date.now() - startedAt,
          payload: body as any,
        },
      });
      return ok(reply, { allowed: false, reason: 'MACHINE_INACTIVE' });
    }
    if (attraction.id !== ctx.attractionId) {
      await prisma.deviceLog.create({
        data: {
          siteId: ctx.siteId,
          readerId: ctx.readerId,
          uid: body.uid,
          cardId: card.id,
          activityId: attraction.id,
          requestId: body.requestId,
          eventType: 'VALIDATE',
          allowed: false,
          reason: 'READER_MACHINE_MISMATCH',
          latency: Date.now() - startedAt,
          payload: body as any,
        },
      });
      return ok(reply, { allowed: false, reason: 'READER_MACHINE_MISMATCH', message: 'Lectora no asociada a la máquina solicitada' });
    }

    const systemActor = await prisma.userAssignment.findFirst({
      where: {
        siteId: ctx.siteId,
        isActive: true,
        user: { status: 'ACTIVE' },
      },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    });
    if (!systemActor) return fail(reply, 'CONFIG_ERROR', 'No hay usuario activo para registrar eventos de ledger', 409);
    const result = await prisma.$transaction(async (tx) => {
      const currentCard = await tx.card.findUnique({
        where: { id: card.id },
        select: { status: true },
      });
      if (!currentCard || currentCard.status !== 'ACTIVE') {
        await tx.deviceLog.create({
          data: {
            siteId: ctx.siteId,
            readerId: ctx.readerId,
            uid: body.uid,
            cardId: card.id,
            activityId: attraction.id,
            requestId: body.requestId,
            eventType: 'VALIDATE',
            allowed: false,
            reason: 'CARD_BLOCKED',
            latency: Date.now() - startedAt,
            payload: body as any,
          },
        });
        return {
          allowed: false as const,
          reason: 'CARD_BLOCKED',
          pointsBefore: 0,
          pointsAfter: 0,
          creditBefore: new Prisma.Decimal(0),
          creditAfter: new Prisma.Decimal(0),
          transactionId: null,
        };
      }

      const costCredit = attraction.price;
      const costPoints = attraction.costPoints ?? 0;
      const pointsReward = attraction.pointsReward ?? 0;
      const pointsDeltaWhenPayingWithPoints = pointsReward - costPoints;

      if (costPoints > 0) {
        const pointsDebitApplied = await tx.card.updateMany({
          where: {
            id: card.id,
            status: 'ACTIVE',
            pointsBalance: { gte: costPoints },
          },
          data: {
            pointsBalance: { increment: pointsDeltaWhenPayingWithPoints },
          },
        });
        if (pointsDebitApplied.count === 1) {
          const updatedCard = await tx.card.findUnique({
            where: { id: card.id },
            select: { creditBalance: true, pointsBalance: true },
          });
          if (!updatedCard) {
            return {
              allowed: false as const,
              reason: 'CARD_BLOCKED',
              pointsBefore: 0,
              pointsAfter: 0,
              creditBefore: new Prisma.Decimal(0),
              creditAfter: new Prisma.Decimal(0),
              transactionId: null,
            };
          }
          const creditBefore = updatedCard.creditBalance;
          const pointsAfter = updatedCard.pointsBalance;
          const pointsBefore = pointsAfter - pointsDeltaWhenPayingWithPoints;

          const ledgerEvent = await tx.ledgerEvent.create({
            data: {
              siteId: ctx.siteId,
              eventType: 'ATTRACTION_USAGE',
              description: `Uso de atracción ${attraction.code} con puntos`,
              createdById: systemActor.userId,
            },
          });

          const usageRow = await tx.attractionUsage.create({
            data: {
              siteId: ctx.siteId,
              cardId: card.id,
              attractionId: attraction.id,
              readerId: ctx.readerId,
              cost: costCredit,
              ledgerEventId: ledgerEvent.id,
            },
          });

          await appendCardBalanceEvent({
            tx,
            cardId: card.id,
            siteId: ctx.siteId,
            ledgerEventId: ledgerEvent.id,
            moneyDelta: new Prisma.Decimal(0),
            pointsDelta: pointsDeltaWhenPayingWithPoints,
            reason: 'ATTRACTION_USE',
            updateCardBalances: false,
          });

          await tx.deviceLog.create({
            data: {
              siteId: ctx.siteId,
              readerId: ctx.readerId,
              uid: body.uid,
              cardId: card.id,
              activityId: attraction.id,
              requestId: body.requestId,
              eventType: 'USE',
              allowed: true,
              reason: 'OK_POINTS',
              latency: Date.now() - startedAt,
              pointsBefore,
              pointsAfter,
              creditBefore,
              creditAfter: creditBefore,
              payload: body as any,
            },
          });

          return {
            allowed: true as const,
            reason: 'OK_POINTS',
            pointsBefore,
            pointsAfter,
            creditBefore,
            creditAfter: creditBefore,
            transactionId: usageRow.id.toString(),
          };
        }
      }

      const creditDebitApplied = await tx.card.updateMany({
        where: {
          id: card.id,
          status: 'ACTIVE',
          creditBalance: { gte: costCredit },
        },
        data: {
          creditBalance: { decrement: costCredit },
          pointsBalance: { increment: pointsReward },
        },
      });
      if (creditDebitApplied.count !== 1) {
        const snapshot = await tx.card.findUnique({
          where: { id: card.id },
          select: { status: true, pointsBalance: true, creditBalance: true },
        });
        if (!snapshot || snapshot.status !== 'ACTIVE') {
          await tx.deviceLog.create({
            data: {
              siteId: ctx.siteId,
              readerId: ctx.readerId,
              uid: body.uid,
              cardId: card.id,
              activityId: attraction.id,
              requestId: body.requestId,
              eventType: 'VALIDATE',
              allowed: false,
              reason: 'CARD_BLOCKED',
              latency: Date.now() - startedAt,
              payload: body as any,
            },
          });
          return {
            allowed: false as const,
            reason: 'CARD_BLOCKED',
            pointsBefore: snapshot?.pointsBalance ?? 0,
            pointsAfter: snapshot?.pointsBalance ?? 0,
            creditBefore: snapshot?.creditBalance ?? new Prisma.Decimal(0),
            creditAfter: snapshot?.creditBalance ?? new Prisma.Decimal(0),
            transactionId: null,
          };
        }

        await tx.deviceLog.create({
          data: {
            siteId: ctx.siteId,
            readerId: ctx.readerId,
            uid: body.uid,
            cardId: card.id,
            activityId: attraction.id,
            requestId: body.requestId,
            eventType: 'VALIDATE',
            allowed: false,
            reason: 'INSUFFICIENT_CREDIT',
            latency: Date.now() - startedAt,
            pointsBefore: snapshot.pointsBalance,
            pointsAfter: snapshot.pointsBalance,
            creditBefore: snapshot.creditBalance,
            creditAfter: snapshot.creditBalance,
            payload: body as any,
          },
        });
        return {
          allowed: false as const,
          reason: 'INSUFFICIENT_CREDIT',
          pointsBefore: snapshot.pointsBalance,
          pointsAfter: snapshot.pointsBalance,
          creditBefore: snapshot.creditBalance,
          creditAfter: snapshot.creditBalance,
          transactionId: null,
        };
      }

      const updatedCard = await tx.card.findUnique({
        where: { id: card.id },
        select: { creditBalance: true, pointsBalance: true },
      });
      if (!updatedCard) {
        return {
          allowed: false as const,
          reason: 'CARD_BLOCKED',
          pointsBefore: 0,
          pointsAfter: 0,
          creditBefore: new Prisma.Decimal(0),
          creditAfter: new Prisma.Decimal(0),
          transactionId: null,
        };
      }
      const creditAfter = updatedCard.creditBalance;
      const creditBefore = updatedCard.creditBalance.add(costCredit);
      const pointsAfter = updatedCard.pointsBalance;
      const pointsBefore = updatedCard.pointsBalance - pointsReward;

      const ledgerEvent = await tx.ledgerEvent.create({
        data: {
          siteId: ctx.siteId,
          eventType: 'ATTRACTION_USAGE',
          description: `Uso de atracción ${attraction.code} por saldo`,
          createdById: systemActor.userId,
          entries: {
            create: [
              {
                account: 'CARD_FLOAT_LIABILITY',
                side: 'DEBIT',
                amount: costCredit,
              },
              {
                account: 'SERVICE_REVENUE',
                side: 'CREDIT',
                amount: costCredit,
              },
            ],
          },
        },
      });

      const usageRow = await tx.attractionUsage.create({
        data: {
          siteId: ctx.siteId,
          cardId: card.id,
          attractionId: attraction.id,
          readerId: ctx.readerId,
          cost: costCredit,
          ledgerEventId: ledgerEvent.id,
        },
      });

      await appendCardBalanceEvent({
        tx,
        cardId: card.id,
        siteId: ctx.siteId,
        ledgerEventId: ledgerEvent.id,
        moneyDelta: costCredit.mul(-1),
        pointsDelta: pointsReward,
        reason: 'ATTRACTION_USE',
        updateCardBalances: false,
      });

      await tx.deviceLog.create({
        data: {
          siteId: ctx.siteId,
          readerId: ctx.readerId,
          uid: body.uid,
          cardId: card.id,
          activityId: attraction.id,
          requestId: body.requestId,
          eventType: 'USE',
          allowed: true,
          reason: 'OK',
          latency: Date.now() - startedAt,
          pointsBefore,
          pointsAfter,
          creditBefore,
          creditAfter,
          payload: body as any,
        },
      });

      return {
        allowed: true as const,
        reason: 'OK',
        pointsBefore,
        pointsAfter,
        creditBefore,
        creditAfter,
        transactionId: usageRow.id.toString(),
      };
    });

    return ok(reply, {
      allowed: result.allowed,
      reason: result.reason,
      points_before: result.pointsBefore,
      points_after: result.pointsAfter,
      credit_before: Number(result.creditBefore),
      credit_after: Number(result.creditAfter),
      transaction_id: result.transactionId,
      server_time: new Date().toISOString(),
    });
  });
}
