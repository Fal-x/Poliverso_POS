import type { FastifyInstance } from 'fastify';
import { CustomerDocumentType, PaymentMethod, Prisma, ServiceStatus } from '@prisma/client';
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
const ALLOWED_DOCUMENT_TYPES: CustomerDocumentType[] = ['CC', 'CE', 'NIT', 'PAS', 'TI'];

function parseDateOnly(value: unknown) {
  const raw = sanitizeText(value, 20);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function calculateAge(birthDate: Date, reference = new Date()) {
  let age = reference.getFullYear() - birthDate.getFullYear();
  const monthDiff = reference.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < birthDate.getDate())) age -= 1;
  return Math.max(0, age);
}

async function enrollmentFinancials(enrollmentId: string) {
  const [enrollment, paymentAgg] = await Promise.all([
    prisma.programEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: true,
      },
    }),
    prisma.enrollmentPayment.aggregate({
      where: { enrollmentId },
      _sum: { amount: true },
    }),
  ]);
  if (!enrollment) return null;
  const totalPaid = paymentAgg._sum.amount ?? D(0);
  const pending = Prisma.Decimal.max(enrollment.finalAmount.sub(totalPaid), D(0));
  return {
    enrollment,
    totalPaid,
    pending,
  };
}

function serviceStatusByPending(pending: Prisma.Decimal): ServiceStatus {
  if (pending.lte(0)) return 'CLOSED';
  return 'PARTIAL';
}

function enrollmentToPayload(financial: Awaited<ReturnType<typeof enrollmentFinancials>>) {
  if (!financial) return null;
  const { enrollment, totalPaid, pending } = financial;
  return {
    id: enrollment.id,
    student_id: enrollment.studentId,
    program_name: enrollment.programName,
    group_name: enrollment.groupName,
    starts_at: enrollment.startsAt?.toISOString().slice(0, 10) ?? null,
    ends_at: enrollment.endsAt?.toISOString().slice(0, 10) ?? null,
    due_date: enrollment.dueDate?.toISOString().slice(0, 10) ?? null,
    total_amount: enrollment.totalAmount.toFixed(2),
    discount_amount: enrollment.discountAmount.toFixed(2),
    final_amount: enrollment.finalAmount.toFixed(2),
    total_paid: totalPaid.toFixed(2),
    pending_amount: pending.toFixed(2),
    status: enrollment.status,
    created_at: enrollment.createdAt.toISOString(),
  };
}

export async function programRoutes(app: FastifyInstance) {
  app.post('/programs/students', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      first_name: string;
      last_name: string;
      document_type: string;
      document_number: string;
      birth_date: string;
      phone?: string;
      email?: string;
      address?: string;
      guardian_name?: string;
      guardian_phone?: string;
      status?: string;
      notes?: string;
    };
    const siteId = sanitizeUuid(body?.site_id);
    const firstName = sanitizeText(body?.first_name, 80);
    const lastName = sanitizeText(body?.last_name, 80);
    const documentType = sanitizeText(body?.document_type, 10).toUpperCase() as CustomerDocumentType;
    const documentNumber = sanitizeText(body?.document_number, 40);
    const birthDate = parseDateOnly(body?.birth_date);
    const status = sanitizeText(body?.status, 20).toUpperCase();
    const normalizedStatus = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'WITHDRAWN'].includes(status) ? status : 'ACTIVE';
    if (!siteId || !firstName || !lastName || !documentType || !documentNumber || !birthDate) {
      return fail(reply, 'VALIDATION_ERROR', 'Datos de estudiante incompletos');
    }
    if (!ALLOWED_DOCUMENT_TYPES.includes(documentType)) {
      return fail(reply, 'VALIDATION_ERROR', 'document_type inválido');
    }

    const student = await prisma.polikidStudent.upsert({
      where: {
        siteId_documentType_documentNumber: {
          siteId,
          documentType,
          documentNumber,
        },
      },
      update: {
        firstName,
        lastName,
        birthDate,
        phone: sanitizeText(body?.phone, 40) || null,
        email: sanitizeText(body?.email, 120).toLowerCase() || null,
        address: sanitizeText(body?.address, 180) || null,
        guardianName: sanitizeText(body?.guardian_name, 120) || null,
        guardianPhone: sanitizeText(body?.guardian_phone, 40) || null,
        status: normalizedStatus as any,
        notes: sanitizeText(body?.notes, 240) || null,
      },
      create: {
        siteId,
        firstName,
        lastName,
        documentType,
        documentNumber,
        birthDate,
        phone: sanitizeText(body?.phone, 40) || null,
        email: sanitizeText(body?.email, 120).toLowerCase() || null,
        address: sanitizeText(body?.address, 180) || null,
        guardianName: sanitizeText(body?.guardian_name, 120) || null,
        guardianPhone: sanitizeText(body?.guardian_phone, 40) || null,
        status: normalizedStatus as any,
        notes: sanitizeText(body?.notes, 240) || null,
      },
      include: { enrollments: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });

    return ok(reply, {
      id: student.id,
      first_name: student.firstName,
      last_name: student.lastName,
      document_type: student.documentType,
      document_number: student.documentNumber,
      birth_date: student.birthDate.toISOString().slice(0, 10),
      age: calculateAge(student.birthDate),
      status: student.status,
      enrollments_count: student.enrollments.length,
    });
  });

  app.get('/programs/students', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const q = sanitizeText((req.query as any).q, 120).toLowerCase();
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const students = await prisma.polikidStudent.findMany({
      where: {
        siteId,
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
                { documentNumber: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      include: { enrollments: { orderBy: { createdAt: 'desc' }, take: 20 } },
      take: 200,
    });
    return ok(reply, students.map((student) => ({
      id: student.id,
      first_name: student.firstName,
      last_name: student.lastName,
      full_name: `${student.firstName} ${student.lastName}`.trim(),
      document_type: student.documentType,
      document_number: student.documentNumber,
      birth_date: student.birthDate.toISOString().slice(0, 10),
      age: calculateAge(student.birthDate),
      status: student.status,
      enrollments_count: student.enrollments.length,
    })));
  });

  app.post('/programs/enrollments', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      student_id: string;
      program_name: string;
      group_name?: string;
      starts_at?: string;
      ends_at?: string;
      due_date?: string;
      total_amount: string;
      discount_amount?: string;
    };
    const siteId = sanitizeUuid(body?.site_id);
    const studentId = sanitizeUuid(body?.student_id);
    const programName = sanitizeText(body?.program_name, 120);
    const groupName = sanitizeText(body?.group_name, 120);
    const totalAmountRaw = sanitizeMoney(body?.total_amount);
    const discountAmountRaw = sanitizeMoney(body?.discount_amount ?? '0') || '0';
    if (!siteId || !studentId || !programName || !totalAmountRaw) {
      return fail(reply, 'VALIDATION_ERROR', 'Datos de inscripción incompletos');
    }
    const totalAmount = D(totalAmountRaw);
    const discountAmount = D(discountAmountRaw);
    if (totalAmount.lte(0) || discountAmount.lt(0) || discountAmount.gt(totalAmount)) {
      return fail(reply, 'VALIDATION_ERROR', 'Valores de inscripción inválidos');
    }
    const finalAmount = totalAmount.sub(discountAmount);
    const student = await prisma.polikidStudent.findFirst({ where: { id: studentId, siteId } });
    if (!student) return fail(reply, 'NOT_FOUND', 'Estudiante no encontrado', 404);

    const enrollment = await prisma.programEnrollment.create({
      data: {
        siteId,
        studentId,
        programName,
        groupName: groupName || null,
        startsAt: parseDateOnly(body?.starts_at),
        endsAt: parseDateOnly(body?.ends_at),
        dueDate: parseDateOnly(body?.due_date),
        totalAmount,
        discountAmount,
        finalAmount,
        status: finalAmount.gt(0) ? 'OPEN' : 'CLOSED',
      },
    });
    const financial = await enrollmentFinancials(enrollment.id);
    return ok(reply, enrollmentToPayload(financial));
  });

  app.get('/programs/students/:id/enrollments', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const id = sanitizeUuid((req.params as any).id);
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!id || !siteId) return fail(reply, 'VALIDATION_ERROR', 'id y site_id requeridos');
    const student = await prisma.polikidStudent.findFirst({
      where: { id, siteId },
    });
    if (!student) return fail(reply, 'NOT_FOUND', 'Estudiante no encontrado', 404);
    const enrollments = await prisma.programEnrollment.findMany({
      where: { siteId, studentId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const rows = await Promise.all(enrollments.map(async (enrollment) => enrollmentToPayload(await enrollmentFinancials(enrollment.id))));
    return ok(reply, {
      student: {
        id: student.id,
        full_name: `${student.firstName} ${student.lastName}`.trim(),
        age: calculateAge(student.birthDate),
        status: student.status,
      },
      enrollments: rows.filter(Boolean),
    });
  });

  app.get('/programs/enrollments/:id', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const id = sanitizeUuid((req.params as any).id);
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!id || !siteId) return fail(reply, 'VALIDATION_ERROR', 'id y site_id requeridos');
    const financial = await enrollmentFinancials(id);
    if (!financial || financial.enrollment.siteId !== siteId) return fail(reply, 'NOT_FOUND', 'Inscripción no encontrada', 404);
    const payments = await prisma.enrollmentPayment.findMany({
      where: { enrollmentId: id },
      include: { createdBy: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(reply, {
      ...enrollmentToPayload(financial),
      student: {
        id: financial.enrollment.student.id,
        full_name: `${financial.enrollment.student.firstName} ${financial.enrollment.student.lastName}`.trim(),
        document_type: financial.enrollment.student.documentType,
        document_number: financial.enrollment.student.documentNumber,
        age: calculateAge(financial.enrollment.student.birthDate),
      },
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

  app.post('/programs/enrollments/:id/payments', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
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
    const createdByUserId = body?.created_by_user_id ? sanitizeUuid(body.created_by_user_id) : (authUser?.id ?? '');
    if (!id || !siteId || !amountRaw || !ALLOWED_PAYMENT_METHODS.has(method) || !createdByUserId) {
      return fail(reply, 'VALIDATION_ERROR', 'Datos de pago inválidos');
    }
    if (authUser?.id && authUser.id !== createdByUserId) {
      return fail(reply, 'FORBIDDEN', 'Usuario no autorizado', 403);
    }
    const amount = D(amountRaw);
    if (amount.lte(0)) return fail(reply, 'VALIDATION_ERROR', 'Monto inválido');

    const financial = await enrollmentFinancials(id);
    if (!financial || financial.enrollment.siteId !== siteId) return fail(reply, 'NOT_FOUND', 'Inscripción no encontrada', 404);
    if (financial.pending.lte(0)) return fail(reply, 'VALIDATION_ERROR', 'La inscripción ya está saldada');
    if (amount.gt(financial.pending)) return fail(reply, 'VALIDATION_ERROR', 'El abono supera el saldo pendiente');

    await prisma.$transaction(async (tx) => {
      await tx.enrollmentPayment.create({
        data: {
          siteId,
          enrollmentId: id,
          amount,
          method,
          notes: sanitizeText(body?.notes, 240) || null,
          createdById: createdByUserId,
        },
      });
      const updatedFinancial = await enrollmentFinancials(id);
      if (!updatedFinancial) return;
      await tx.programEnrollment.update({
        where: { id },
        data: { status: serviceStatusByPending(updatedFinancial.pending) },
      });
    });

    const refreshed = await enrollmentFinancials(id);
    return ok(reply, enrollmentToPayload(refreshed));
  });

  app.get('/programs/portfolio', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const withBalance = sanitizeText((req.query as any).with_balance, 5).toLowerCase();
    const program = sanitizeText((req.query as any).program, 120);
    const group = sanitizeText((req.query as any).group, 120);
    const overdueOnly = sanitizeText((req.query as any).overdue, 5).toLowerCase();
    const dateFrom = parseDateOnly((req.query as any).date_from);
    const dateTo = parseDateOnly((req.query as any).date_to);
    const exportFormat = sanitizeText((req.query as any).export, 10).toLowerCase();
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');

    const enrollments = await prisma.programEnrollment.findMany({
      where: {
        siteId,
        ...(program ? { programName: { equals: program, mode: 'insensitive' } } : {}),
        ...(group ? { groupName: { equals: group, mode: 'insensitive' } } : {}),
        ...(dateFrom || dateTo
          ? {
              createdAt: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
      },
      include: {
        student: true,
        payments: { select: { amount: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 3000,
    });

    const now = new Date();
    const rows = enrollments.map((enrollment) => {
      const totalPaid = enrollment.payments.reduce((acc, payment) => acc.add(payment.amount), D(0));
      const pending = Prisma.Decimal.max(enrollment.finalAmount.sub(totalPaid), D(0));
      const overdue = pending.gt(0) && !!enrollment.dueDate && enrollment.dueDate < now;
      return {
        enrollment_id: enrollment.id,
        student: `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim(),
        document: `${enrollment.student.documentType} ${enrollment.student.documentNumber}`,
        program_name: enrollment.programName,
        group_name: enrollment.groupName ?? '',
        total_amount: enrollment.totalAmount.toFixed(2),
        discount_amount: enrollment.discountAmount.toFixed(2),
        final_amount: enrollment.finalAmount.toFixed(2),
        total_paid: totalPaid.toFixed(2),
        pending_amount: pending.toFixed(2),
        due_date: enrollment.dueDate?.toISOString().slice(0, 10) ?? '',
        overdue,
        created_at: enrollment.createdAt.toISOString().slice(0, 10),
      };
    }).filter((row) => {
      if (withBalance === 'true' && Number(row.pending_amount) <= 0) return false;
      if (overdueOnly === 'true' && !row.overdue) return false;
      return true;
    });

    if (exportFormat === 'excel') {
      const headers = [
        'enrollment_id',
        'student',
        'document',
        'program_name',
        'group_name',
        'total_amount',
        'discount_amount',
        'final_amount',
        'total_paid',
        'pending_amount',
        'due_date',
        'overdue',
        'created_at',
      ];
      const csv = [
        headers.join(','),
        ...rows.map((row) => headers.map((header) => `"${String((row as any)[header] ?? '').replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      reply.header('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="cartera-programas-${new Date().toISOString().slice(0, 10)}.csv"`);
      return reply.send(csv);
    }

    return ok(reply, {
      total_count: rows.length,
      total_pending: rows.reduce((acc, row) => acc + Number(row.pending_amount), 0).toFixed(2),
      data: rows,
    });
  });
}
