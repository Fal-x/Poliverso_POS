import type { FastifyInstance } from 'fastify';
import { CashMovementType, PaymentMethod, Prisma } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, fail } from '../utils/response';
import { openCashSession, closeCashSession, registerCashMovement } from '@/backend/services/cashSessionService';
import { prisma } from '@/backend/prisma';

export async function cashRoutes(app: FastifyInstance) {
  app.get('/cash-sessions/:id', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const id = (req.params as any).id as string;
    const session = await prisma.cashSession.findUnique({ where: { id } });
    if (!session) return fail(reply, 'NOT_FOUND', 'Caja no encontrada', 404);

    const paymentsByMethod = await prisma.salePayment.groupBy({
      by: ['method'],
      where: { sale: { cashSessionId: session.id, status: 'PAID' } },
      _sum: { amount: true },
    });

    const cashSales = paymentsByMethod
      .filter(p => p.method === PaymentMethod.CASH)
      .reduce((sum, p) => sum.add(p._sum.amount ?? new Prisma.Decimal(0)), new Prisma.Decimal(0));

    const withdrawals = await prisma.cashMovement.aggregate({
      where: { cashSessionId: session.id, type: CashMovementType.WITHDRAWAL },
      _sum: { amount: true },
    });

    const adjustments = await prisma.cashMovement.aggregate({
      where: { cashSessionId: session.id, type: CashMovementType.ADJUSTMENT },
      _sum: { amount: true },
    });

    const expected = session.openingCashAmount
      .add(cashSales)
      .minus(withdrawals._sum.amount ?? new Prisma.Decimal(0))
      .add(adjustments._sum.amount ?? new Prisma.Decimal(0));

    return ok(reply, {
      id: session.id,
      status: session.status,
      opening_cash_amount: session.openingCashAmount.toFixed(2),
      expected_cash_amount: expected.toFixed(2),
      cash_sales: cashSales.toFixed(2),
      closing_cash_amount: session.closingCashAmount?.toFixed(2) ?? null,
      cash_difference: session.cashDifference?.toFixed(2) ?? null,
    });
  });

  app.post('/cash-sessions/open', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      terminal_id: string;
      cash_register_id: string;
      shift_id?: string;
      opened_by_user_id: string;
      opening_cash_amount: string;
      denominations: Record<string, number>;
      approval_id?: string | null;
    };

    if (!body?.site_id || !body?.terminal_id || !body?.cash_register_id || !body?.opened_by_user_id) {
      return fail(reply, 'VALIDATION_ERROR', 'Campos requeridos incompletos');
    }

    (req.log ?? app.log).info({
      opening_cash_amount: body.opening_cash_amount,
      approval_id: body.approval_id ?? null,
      terminal_id: body.terminal_id,
      cash_register_id: body.cash_register_id,
    }, 'cash open request');

    const session = await openCashSession({
      siteId: body.site_id,
      terminalId: body.terminal_id,
      cashRegisterId: body.cash_register_id,
      shiftId: body.shift_id ?? null,
      openedByUserId: body.opened_by_user_id,
      openingCashAmount: new Prisma.Decimal(body.opening_cash_amount),
      denominations: body.denominations ?? {},
      approvalId: body.approval_id ?? null,
    });

    return ok(reply, { id: session.id, status: session.status });
  });

  app.post('/cash-sessions/:id/movements', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const body = req.body as {
      type: 'WITHDRAWAL' | 'ADJUSTMENT';
      amount: string;
      reason: string;
      created_by_user_id: string;
      authorized_by_user_id: string;
      approval_id: string;
      site_id: string;
    };

    const movement = await registerCashMovement({
      siteId: body.site_id,
      cashSessionId: (req.params as any).id,
      type: body.type as any,
      amount: new Prisma.Decimal(body.amount),
      reason: body.reason,
      createdByUserId: body.created_by_user_id,
      authorizedByUserId: body.authorized_by_user_id,
      approvalId: body.approval_id,
    });

    return ok(reply, { id: movement.id });
  });

  app.post('/cash-sessions/:id/close', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      closed_by_user_id: string;
      closing_cash_amount: string;
      denominations: Record<string, number>;
      close_reason?: string;
      approval_id?: string | null;
    };

    const result = await closeCashSession({
      siteId: body.site_id,
      cashSessionId: (req.params as any).id,
      closedByUserId: body.closed_by_user_id,
      closingCashAmount: new Prisma.Decimal(body.closing_cash_amount),
      denominations: body.denominations ?? {},
      closeReason: body.close_reason ?? null,
      approvalId: body.approval_id ?? null,
    });

    return ok(reply, result);
  });
}
