import type { FastifyInstance } from 'fastify';
import { prisma } from '@/backend/prisma';
import { PaymentMethod, Prisma, SaleCategory, SaleStatus } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, fail } from '../utils/response';
import { buildReceiptTxt } from '@/backend/services/receiptService';

export async function cardRoutes(app: FastifyInstance) {
  app.post('/cards', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const body = req.body as { site_id: string; uid: string };
    if (!body?.site_id || !body?.uid) {
      return fail(reply, 'VALIDATION_ERROR', 'site_id y uid requeridos');
    }
    const card = await prisma.card.create({
      data: { siteId: body.site_id, uid: body.uid },
    });
    return ok(reply, { id: card.id, uid: card.uid });
  });

  app.get('/cards/:uid', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const uid = (req.params as any).uid as string;
    const card = await prisma.card.findUnique({ where: { uid } });
    if (!card) return fail(reply, 'NOT_FOUND', 'Tarjeta no encontrada', 404);
    const aggregates = await prisma.cardBalanceEvent.aggregate({
      where: { cardId: card.id },
      _sum: { moneyDelta: true, pointsDelta: true },
    });

    return ok(reply, {
      id: card.id,
      code: card.uid,
      balance: Number(aggregates._sum.moneyDelta ?? 0),
      bonusBalance: 0,
      points: Number(aggregates._sum.pointsDelta ?? 0),
      isActive: card.status === 'ACTIVE',
      createdAt: card.issuedAt,
      lastUsedAt: null,
    });
  });

  app.post('/cards/:uid/recharge', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const uid = (req.params as any).uid as string;
    const body = req.body as {
      site_id: string;
      customer_id?: string;
      amount: string;
      payment_method: string;
      terminal_id: string;
      shift_id: string;
      cash_session_id: string;
      created_by_user_id: string;
    };

    if (!body?.site_id || !body?.amount || !body?.payment_method || !body?.terminal_id || !body?.shift_id || !body?.cash_session_id || !body?.created_by_user_id) {
      return fail(reply, 'VALIDATION_ERROR', 'Campos requeridos incompletos');
    }

    const card = await prisma.card.findUnique({ where: { uid } });
    if (!card) return fail(reply, 'NOT_FOUND', 'Tarjeta no encontrada', 404);

    const amount = new Prisma.Decimal(body.amount);
    if (amount.lte(0)) return fail(reply, 'VALIDATION_ERROR', 'Monto inválido');

    const site = await prisma.site.findUnique({ where: { id: body.site_id } });
    if (!site) return fail(reply, 'NOT_FOUND', 'Sede no encontrada', 404);

    const siteConfig = await prisma.siteConfig.findUnique({ where: { siteId: body.site_id } });
    if (!siteConfig) return fail(reply, 'NOT_FOUND', 'Config no encontrada', 404);
    const customerId = body.customer_id ?? site.defaultCustomerId;
    if (!customerId) return fail(reply, 'VALIDATION_ERROR', 'customer_id requerido');

    const activeSession = await prisma.cashSession.findFirst({
      where: {
        id: body.cash_session_id,
        siteId: body.site_id,
        terminalId: body.terminal_id,
        status: 'OPEN',
      },
      select: { id: true, openedByUserId: true, shiftId: true },
    });

    if (!activeSession) {
      return fail(reply, 'CASH_SESSION_CLOSED', 'No hay caja abierta para esta terminal', 409);
    }

    if (activeSession.openedByUserId !== body.created_by_user_id) {
      return fail(reply, 'CASH_SESSION_OWNER_MISMATCH', 'El responsable de la caja no coincide', 403);
    }

    if (body.shift_id && activeSession.shiftId && body.shift_id !== activeSession.shiftId) {
      return fail(reply, 'SHIFT_MISMATCH', 'La recarga no coincide con el turno activo', 409);
    }

    const bonusScale = await prisma.bonusScale.findFirst({
      where: {
        siteId: body.site_id,
        minAmount: { lte: amount },
        OR: [{ maxAmount: null }, { maxAmount: { gte: amount } }],
      },
      orderBy: { minAmount: 'desc' },
    });

    const bonusAmount = bonusScale ? bonusScale.bonusAmount : new Prisma.Decimal(0);
    const points = Math.floor(amount.div(siteConfig.currencyUnit).toNumber()) * siteConfig.pointsPerCurrency;

    const sale = await prisma.$transaction(async (tx) => {
      const createdSale = await tx.sale.create({
        data: {
          siteId: body.site_id,
          customerId,
          shiftId: body.shift_id,
          terminalId: body.terminal_id,
          cashSessionId: body.cash_session_id,
          createdById: body.created_by_user_id,
          status: SaleStatus.PAID,
          subtotal: amount,
          tax: new Prisma.Decimal(0),
          total: amount,
          totalPaid: amount,
          balanceDue: new Prisma.Decimal(0),
          bonusTotal: bonusAmount,
          pointsEarned: points,
          requiresElectronicInvoice: false,
          lines: {
            create: [{
              cardId: card.id,
              category: SaleCategory.RECHARGE,
              quantity: 1,
              unitPrice: amount,
              lineTotal: amount,
              metadata: {
                bonusAmount: bonusAmount.toFixed(2),
                points,
              },
            }],
          },
          payments: {
            create: [{
              method: body.payment_method as PaymentMethod,
              amount,
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

      await tx.cardBalanceEvent.create({
        data: {
          cardId: card.id,
          siteId: body.site_id,
          moneyDelta: amount.add(bonusAmount),
          pointsDelta: points,
          reason: 'RECHARGE',
        },
      });

      await tx.auditLog.create({
        data: {
          siteId: body.site_id,
          actorId: body.created_by_user_id,
          action: 'CREATE',
          entityType: 'SALE',
          entityId: createdSale.id,
          after: {
            total: createdSale.total.toFixed(2),
            status: createdSale.status,
            cashSessionId: createdSale.cashSessionId,
            customerId: createdSale.customerId,
            category: 'RECHARGE',
            paymentMethod: body.payment_method,
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
        lines: { include: { product: true } },
      },
    });
    const receiptText = hydrated ? buildReceiptTxt({ sale: hydrated as any }) : null;
    if (receiptText) {
      await prisma.sale.update({
        where: { id: sale.id },
        data: { receiptNumber, receiptText },
      });
    }

    return ok(reply, {
      sale_id: sale.id,
      amount: amount.toFixed(2),
      bonus_amount: bonusAmount.toFixed(2),
      points,
      receipt_number: receiptNumber,
      receipt_text: receiptText,
    });
  });
}
