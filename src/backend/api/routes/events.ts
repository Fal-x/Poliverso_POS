import type { FastifyInstance } from 'fastify';
import { EventBookingType, PaymentMethod, Prisma, ServiceStatus } from '@prisma/client';
import { prisma } from '@/backend/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { fail, ok } from '../utils/response';
import { sanitizeMoney, sanitizeText, sanitizeUuid } from '@/backend/utils/sanitize';

const D = (value: string | number | Prisma.Decimal) => new Prisma.Decimal(value);
const ALLOWED_PAYMENT_METHODS = new Set<PaymentMethod>([
  'CASH',
  'TRANSFER',
  'TRANSFER_ACCOUNT_1',
  'TRANSFER_ACCOUNT_2',
  'NEQUI',
  'QR',
  'CARD',
  'CREDIT_CARD',
  'CREDIT',
  'MIXED',
]);

function parseDateOnly(value: unknown) {
  const raw = sanitizeText(value, 20);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseBookingStatus(value: unknown): ServiceStatus | null {
  const status = sanitizeText(value, 20).toUpperCase();
  if (status === 'OPEN') return 'OPEN';
  if (status === 'PARTIAL') return 'PARTIAL';
  if (status === 'CLOSED') return 'CLOSED';
  if (status === 'CANCELLED') return 'CANCELLED';
  return null;
}

async function bookingFinancials(bookingId: string) {
  const [booking, paymentAgg] = await Promise.all([
    prisma.eventBooking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        basePlan: true,
      },
    }),
    prisma.eventBookingPayment.aggregate({
      where: { bookingId },
      _sum: { amount: true },
    }),
  ]);
  if (!booking) return null;
  const totalPaid = paymentAgg._sum.amount ?? D(0);
  const pending = Prisma.Decimal.max(booking.totalValue.sub(totalPaid), D(0));
  const paymentState = pending.lte(0) ? 'PAID' : totalPaid.gt(0) ? 'PARTIAL' : 'PENDING';
  return { booking, totalPaid, pending, paymentState };
}

function statusByPending(current: ServiceStatus, pending: Prisma.Decimal): ServiceStatus {
  if (current === 'CANCELLED') return current;
  if (pending.lte(0)) return 'CLOSED';
  return 'PARTIAL';
}

function bookingPayload(financial: Awaited<ReturnType<typeof bookingFinancials>>) {
  if (!financial) return null;
  const { booking, totalPaid, pending, paymentState } = financial;
  return {
    id: booking.id,
    booking_type: booking.bookingType,
    plan_name: booking.basePlan?.name ?? booking.customPlanName ?? 'Evento',
    customer: {
      id: booking.customer.id,
      full_name: booking.customer.fullName,
      document_type: booking.customer.documentType,
      document_number: booking.customer.documentNumber,
    },
    event_date: booking.eventDate.toISOString().slice(0, 10),
    status: booking.status,
    total_value: booking.totalValue.toFixed(2),
    total_paid: totalPaid.toFixed(2),
    pending_amount: pending.toFixed(2),
    payment_state: paymentState,
    created_at: booking.createdAt.toISOString(),
  };
}

export async function eventRoutes(app: FastifyInstance) {
  app.post('/events/base-plans', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      name: string;
      description?: string;
      default_value: string;
      is_active?: boolean;
    };
    const siteId = sanitizeUuid(body?.site_id);
    const name = sanitizeText(body?.name, 120);
    const description = sanitizeText(body?.description, 240);
    const defaultValueRaw = sanitizeMoney(body?.default_value);
    if (!siteId || !name || !defaultValueRaw) return fail(reply, 'VALIDATION_ERROR', 'Datos de plan incompletos');
    const defaultValue = D(defaultValueRaw);
    if (defaultValue.lte(0)) return fail(reply, 'VALIDATION_ERROR', 'default_value inválido');

    const plan = await prisma.eventBasePlan.upsert({
      where: { siteId_name: { siteId, name } },
      update: {
        description: description || null,
        defaultValue,
        isActive: body?.is_active ?? true,
      },
      create: {
        siteId,
        name,
        description: description || null,
        defaultValue,
        isActive: body?.is_active ?? true,
      },
    });
    return ok(reply, {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      default_value: plan.defaultValue.toFixed(2),
      is_active: plan.isActive,
    });
  });

  app.get('/events/base-plans', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const includeInactive = sanitizeText((req.query as any).include_inactive, 5).toLowerCase() === 'true';
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const plans = await prisma.eventBasePlan.findMany({
      where: {
        siteId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });
    return ok(reply, plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      default_value: plan.defaultValue.toFixed(2),
      is_active: plan.isActive,
    })));
  });

  app.post('/events/bookings', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      customer_id: string;
      base_plan_id?: string;
      custom_plan_name?: string;
      event_date: string;
      value?: string;
      notes?: string;
    };
    const siteId = sanitizeUuid(body?.site_id);
    const customerId = sanitizeUuid(body?.customer_id);
    const basePlanId = sanitizeUuid(body?.base_plan_id);
    const customPlanName = sanitizeText(body?.custom_plan_name, 120);
    const eventDate = parseDateOnly(body?.event_date);
    const valueRaw = sanitizeMoney(body?.value ?? '');
    if (!siteId || !customerId || !eventDate) return fail(reply, 'VALIDATION_ERROR', 'Datos de evento incompletos');
    const customer = await prisma.customer.findFirst({ where: { id: customerId, siteId } });
    if (!customer) return fail(reply, 'NOT_FOUND', 'Cliente no encontrado', 404);

    let bookingType: EventBookingType;
    let totalValue: Prisma.Decimal;
    let planId: string | null = null;
    let customName: string | null = null;
    if (basePlanId) {
      const plan = await prisma.eventBasePlan.findFirst({ where: { id: basePlanId, siteId, isActive: true } });
      if (!plan) return fail(reply, 'NOT_FOUND', 'Plan base no encontrado', 404);
      bookingType = 'PREDEFINED_PLAN';
      planId = plan.id;
      totalValue = valueRaw ? D(valueRaw) : plan.defaultValue;
    } else {
      if (!customPlanName) return fail(reply, 'VALIDATION_ERROR', 'custom_plan_name requerido para evento personalizado');
      bookingType = 'CUSTOM_EVENT';
      customName = customPlanName;
      totalValue = D(valueRaw || '0');
    }
    if (totalValue.lte(0)) return fail(reply, 'VALIDATION_ERROR', 'value inválido');

    const booking = await prisma.eventBooking.create({
      data: {
        siteId,
        customerId,
        basePlanId: planId,
        bookingType,
        customPlanName: customName,
        eventDate,
        totalValue,
        notes: sanitizeText(body?.notes, 240) || null,
        status: 'OPEN',
      },
    });

    const financial = await bookingFinancials(booking.id);
    return ok(reply, bookingPayload(financial));
  });

  app.get('/events/bookings/:id', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const id = sanitizeUuid((req.params as any).id);
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!id || !siteId) return fail(reply, 'VALIDATION_ERROR', 'id y site_id requeridos');
    const financial = await bookingFinancials(id);
    if (!financial || financial.booking.siteId !== siteId) return fail(reply, 'NOT_FOUND', 'Evento no encontrado', 404);
    const payments = await prisma.eventBookingPayment.findMany({
      where: { bookingId: id },
      include: { createdBy: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(reply, {
      ...bookingPayload(financial),
      payments: payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount.toFixed(2),
        method: payment.method,
        notes: payment.notes,
        created_by: payment.createdBy.fullName || payment.createdBy.email,
        created_at: payment.createdAt.toISOString(),
      })),
    });
  });

  app.post('/events/bookings/:id/payments', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const id = sanitizeUuid((req.params as any).id);
    const body = req.body as {
      site_id: string;
      amount: string;
      method: string;
      notes?: string;
      created_by_user_id?: string;
    };
    const authUser = (req as any).authUser as { id: string } | undefined;
    const siteId = sanitizeUuid(body?.site_id);
    const amountRaw = sanitizeMoney(body?.amount);
    const method = sanitizeText(body?.method, 24).toUpperCase() as PaymentMethod;
    const createdByUserId = body?.created_by_user_id ? sanitizeUuid(body.created_by_user_id) : authUser?.id ?? '';
    if (!id || !siteId || !amountRaw || !ALLOWED_PAYMENT_METHODS.has(method) || !createdByUserId) {
      return fail(reply, 'VALIDATION_ERROR', 'Datos de abono inválidos');
    }
    if (authUser?.id && authUser.id !== createdByUserId) return fail(reply, 'FORBIDDEN', 'Usuario no autorizado', 403);

    const amount = D(amountRaw);
    if (amount.lte(0)) return fail(reply, 'VALIDATION_ERROR', 'Monto inválido');
    const financial = await bookingFinancials(id);
    if (!financial || financial.booking.siteId !== siteId) return fail(reply, 'NOT_FOUND', 'Evento no encontrado', 404);
    if (financial.booking.status === 'CANCELLED') return fail(reply, 'VALIDATION_ERROR', 'Evento cancelado');
    if (amount.gt(financial.pending)) return fail(reply, 'VALIDATION_ERROR', 'El abono supera el saldo');

    await prisma.$transaction(async (tx) => {
      await tx.eventBookingPayment.create({
        data: {
          siteId,
          bookingId: id,
          amount,
          method,
          notes: sanitizeText(body?.notes, 240) || null,
          createdById: createdByUserId,
        },
      });
      const updated = await bookingFinancials(id);
      if (!updated) return;
      await tx.eventBooking.update({
        where: { id },
        data: { status: statusByPending(updated.booking.status, updated.pending) },
      });
    });

    const refreshed = await bookingFinancials(id);
    return ok(reply, bookingPayload(refreshed));
  });

  app.get('/events/calendar', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const month = sanitizeText((req.query as any).month, 7); // YYYY-MM
    const date = sanitizeText((req.query as any).date, 10); // YYYY-MM-DD
    const status = parseBookingStatus((req.query as any).status);
    const paymentState = sanitizeText((req.query as any).payment_state, 12).toUpperCase(); // PAID/PENDING/PARTIAL
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');

    let from: Date | null = null;
    let to: Date | null = null;
    if (date) {
      const d = parseDateOnly(date);
      if (!d) return fail(reply, 'VALIDATION_ERROR', 'date inválida');
      from = d;
      to = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    } else if (month) {
      const monthDate = parseDateOnly(`${month}-01`);
      if (!monthDate) return fail(reply, 'VALIDATION_ERROR', 'month inválido');
      from = monthDate;
      to = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
    }

    const bookings = await prisma.eventBooking.findMany({
      where: {
        siteId,
        ...(status ? { status } : {}),
        ...(from && to ? { eventDate: { gte: from, lt: to } } : {}),
      },
      include: {
        customer: true,
        basePlan: true,
        payments: { select: { amount: true } },
      },
      orderBy: [{ eventDate: 'asc' }, { createdAt: 'asc' }],
      take: 2000,
    });

    const rows = bookings.map((booking) => {
      const totalPaid = booking.payments.reduce((acc, payment) => acc.add(payment.amount), D(0));
      const pending = Prisma.Decimal.max(booking.totalValue.sub(totalPaid), D(0));
      const pState = pending.lte(0) ? 'PAID' : totalPaid.gt(0) ? 'PARTIAL' : 'PENDING';
      return {
        id: booking.id,
        event_date: booking.eventDate.toISOString().slice(0, 10),
        status: booking.status,
        payment_state: pState,
        customer: booking.customer.fullName,
        plan_name: booking.basePlan?.name ?? booking.customPlanName ?? 'Evento',
        total_value: booking.totalValue.toFixed(2),
        paid: totalPaid.toFixed(2),
        pending: pending.toFixed(2),
      };
    }).filter((row) => (paymentState ? row.payment_state === paymentState : true));

    return ok(reply, { data: rows });
  });
}
