import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, fail } from '../utils/response';
import {
  openCashSession,
  closeCashSession,
  registerCashMovement,
  voidCashMovement,
  getOpeningReference,
  getCashSessionFinancials,
} from '@/backend/services/cashSessionService';
import { prisma } from '@/backend/prisma';
import { sanitizeMoney, sanitizeText, sanitizeUuid } from '@/backend/utils/sanitize';
import { publishSiteNotification } from '../realtime/notificationHub';

export async function cashRoutes(app: FastifyInstance) {
  app.get('/cash-sessions/open/reference', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const query = req.query as {
      site_id?: string;
      terminal_id?: string;
      cash_register_id?: string;
    };

    const siteId = sanitizeUuid(query.site_id);
    const terminalId = sanitizeUuid(query.terminal_id);
    const cashRegisterId = sanitizeUuid(query.cash_register_id);
    if (!siteId || !terminalId || !cashRegisterId) {
      return fail(reply, 'VALIDATION_ERROR', 'site_id, terminal_id y cash_register_id son requeridos');
    }

    const reference = await getOpeningReference({
      siteId,
      terminalId,
      cashRegisterId,
    });

    return ok(reply, {
      suggested_opening_cash: reference.suggestedOpeningCash.toFixed(2),
      last_closed_cash: reference.lastClosedCash.toFixed(2),
      last_closed_at: reference.lastClosedAt?.toISOString() ?? null,
      last_session_id: reference.lastSessionId,
    });
  });

  app.get('/cash-sessions/:id', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const id = sanitizeUuid((req.params as any).id as string);
    if (!id) return fail(reply, 'VALIDATION_ERROR', 'id inválido');
    const session = await prisma.cashSession.findUnique({
      where: { id },
      select: { id: true, siteId: true },
    });
    if (!session) return fail(reply, 'NOT_FOUND', 'Caja no encontrada', 404);

    const financials = await getCashSessionFinancials({
      siteId: session.siteId,
      cashSessionId: session.id,
    });
    const expected = financials.expectedCash;
    const cashSales = financials.cashSales;

    return ok(reply, {
      id: financials.session.id,
      status: financials.session.status,
      opening_cash_amount: financials.session.openingCashAmount.toFixed(2),
      expected_cash_amount: expected.toFixed(2),
      cash_sales: cashSales.toFixed(2),
      withdrawals_amount: financials.withdrawals.toFixed(2),
      adjustments_amount: financials.adjustments.toFixed(2),
      closing_cash_amount: financials.session.closingCashAmount?.toFixed(2) ?? null,
      cash_difference: financials.session.cashDifference?.toFixed(2) ?? null,
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
      approval_id?: string | null;
    };

    const siteId = sanitizeUuid(body?.site_id);
    const terminalId = sanitizeUuid(body?.terminal_id);
    const cashRegisterId = sanitizeUuid(body?.cash_register_id);
    const openedByUserId = sanitizeUuid(body?.opened_by_user_id);
    const shiftId = body?.shift_id ? sanitizeUuid(body.shift_id) : '';
    const openingCashAmount = sanitizeMoney(body?.opening_cash_amount);
    const approvalId = body?.approval_id ? sanitizeUuid(body.approval_id) : '';

    if (!siteId || !terminalId || !cashRegisterId || !openedByUserId || !openingCashAmount) {
      return fail(reply, 'VALIDATION_ERROR', 'Campos requeridos incompletos');
    }
    const authUser = (req as any).authUser as { id: string } | undefined;
    if (authUser?.id && authUser.id !== openedByUserId) {
      return fail(reply, 'FORBIDDEN', 'Usuario no autorizado', 403);
    }

    (req.log ?? app.log).info({
      opening_cash_amount: openingCashAmount,
      approval_id: approvalId || null,
      terminal_id: terminalId,
      cash_register_id: cashRegisterId,
    }, 'cash open request');

    const session = await openCashSession({
      siteId,
      terminalId,
      cashRegisterId,
      shiftId: shiftId || null,
      openedByUserId,
      openingCashAmount: new Prisma.Decimal(openingCashAmount),
      approvalId: approvalId || null,
    });

    const openedBy = await prisma.user.findUnique({
      where: { id: openedByUserId },
      select: { fullName: true },
    });

    publishSiteNotification(siteId, {
      type: 'cash_session_opened',
      site_id: siteId,
      created_at: new Date().toISOString(),
      message: `${openedBy?.fullName ?? 'Usuario'} abrió caja en terminal`,
      data: {
        cash_session_id: session.id,
        terminal_id: terminalId,
        cash_register_id: cashRegisterId,
        opened_by_user_id: openedByUserId,
        opened_by_name: openedBy?.fullName ?? null,
        opening_cash_amount: session.openingCashAmount.toFixed(2),
      },
    });

    if (session.expectedCashAmount.greaterThanOrEqualTo(new Prisma.Decimal(500000))) {
      publishSiteNotification(siteId, {
        type: 'cash_threshold_alert',
        site_id: siteId,
        created_at: new Date().toISOString(),
        message: 'La caja abrió con un monto alto en efectivo.',
        data: {
          cash_session_id: session.id,
          expected_cash_amount: session.expectedCashAmount.toFixed(2),
          threshold_amount: '500000.00',
        },
      });
    }

    return ok(reply, {
      id: session.id,
      status: session.status,
      opening_cash_amount: session.openingCashAmount.toFixed(2),
      expected_cash_amount: session.expectedCashAmount.toFixed(2),
    });
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

    const siteId = sanitizeUuid(body?.site_id);
    const cashSessionId = sanitizeUuid((req.params as any).id);
    const createdByUserId = sanitizeUuid(body?.created_by_user_id);
    const authorizedByUserId = sanitizeUuid(body?.authorized_by_user_id);
    const approvalId = sanitizeUuid(body?.approval_id);
    const amount = sanitizeMoney(body?.amount);
    const reason = sanitizeText(body?.reason, 400);

    if (!siteId || !cashSessionId || !createdByUserId || !authorizedByUserId || !approvalId || !amount || !reason) {
      return fail(reply, 'VALIDATION_ERROR', 'Campos requeridos incompletos');
    }

    const authUser = (req as any).authUser as { id: string; role?: string } | undefined;
    if (authUser?.id && authUser.id !== createdByUserId) {
      return fail(reply, 'FORBIDDEN', 'Usuario no autorizado', 403);
    }

    const movementType = body.type === 'WITHDRAWAL' || body.type === 'ADJUSTMENT' ? body.type : '';
    if (!movementType) {
      return fail(reply, 'VALIDATION_ERROR', 'type inválido');
    }
    if (movementType === 'ADJUSTMENT' && authUser?.role !== 'supervisor') {
      return fail(reply, 'FORBIDDEN', 'El ajuste manual de caja solo puede hacerlo un supervisor', 403);
    }

    const movement = await registerCashMovement({
      siteId,
      cashSessionId,
      type: movementType as any,
      amount: new Prisma.Decimal(amount),
      reason,
      createdByUserId,
      authorizedByUserId,
      approvalId,
    });

    return ok(reply, { id: movement.id });
  });

  app.post('/cash-sessions/:id/movements/:movementId/void', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      reason: string;
      voided_by_user_id: string;
      approval_id: string;
    };

    const siteId = sanitizeUuid(body?.site_id);
    const cashSessionId = sanitizeUuid((req.params as any).id);
    const movementId = sanitizeUuid((req.params as any).movementId);
    const voidedByUserId = sanitizeUuid(body?.voided_by_user_id);
    const approvalId = sanitizeUuid(body?.approval_id);
    const reason = sanitizeText(body?.reason, 400);

    if (!siteId || !cashSessionId || !movementId || !voidedByUserId || !approvalId || !reason) {
      return fail(reply, 'VALIDATION_ERROR', 'Campos requeridos incompletos');
    }

    const authUser = (req as any).authUser as { id: string } | undefined;
    if (authUser?.id && authUser.id !== voidedByUserId) {
      return fail(reply, 'FORBIDDEN', 'Usuario no autorizado', 403);
    }

    const movement = await voidCashMovement({
      siteId,
      cashSessionId,
      movementId,
      voidedByUserId,
      approvalId,
      reason,
    });

    return ok(reply, { id: movement.id, voided_at: movement.voidedAt });
  });

  app.post('/cash-sessions/:id/close', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      closed_by_user_id: string;
      closing_cash_amount: string;
      close_reason?: string;
      approval_id?: string | null;
    };

    const siteId = sanitizeUuid(body?.site_id);
    const cashSessionId = sanitizeUuid((req.params as any).id);
    const closedByUserId = sanitizeUuid(body?.closed_by_user_id);
    const closingCashAmount = sanitizeMoney(body?.closing_cash_amount);
    const closeReason = body?.close_reason ? sanitizeText(body.close_reason, 400) : '';
    const approvalId = body?.approval_id ? sanitizeUuid(body.approval_id) : '';

    if (!siteId || !cashSessionId || !closedByUserId || !closingCashAmount) {
      return fail(reply, 'VALIDATION_ERROR', 'Campos requeridos incompletos');
    }

    const authUser = (req as any).authUser as { id: string } | undefined;
    if (authUser?.id && authUser.id !== closedByUserId) {
      return fail(reply, 'FORBIDDEN', 'Usuario no autorizado', 403);
    }

    const result = await closeCashSession({
      siteId,
      cashSessionId,
      closedByUserId,
      closingCashAmount: new Prisma.Decimal(closingCashAmount),
      closeReason: closeReason || null,
      approvalId: approvalId || null,
    });

    return ok(reply, result);
  });
}
