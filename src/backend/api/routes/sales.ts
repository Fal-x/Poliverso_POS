import type { FastifyInstance } from 'fastify';
import { CustomerDocumentType, Prisma, SaleStatus } from '@prisma/client';
import { prisma } from '@/backend/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, fail } from '../utils/response';
import { buildReceiptTxt } from '@/backend/services/receiptService';

export async function salesRoutes(app: FastifyInstance) {
  app.get('/sales', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = (req.query as any).site_id as string;
    const limit = parseInt(((req.query as any).limit as string) ?? '50', 10);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');

    const sales = await prisma.sale.findMany({
      where: { siteId },
      include: { payments: true, lines: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });

    return ok(reply, sales.map(s => ({
      id: s.id,
      shift_id: s.shiftId,
      user_id: s.createdById,
      subtotal: s.subtotal.toFixed(2),
      total: s.total.toFixed(2),
      status: s.status,
      created_at: s.createdAt.toISOString(),
      payment_method: s.payments[0]?.method ?? null,
      items: s.lines.map(l => ({
        id: l.id,
        product_id: l.productId,
        product_name: l.product?.name ?? 'Producto',
        quantity: l.quantity,
        unit_price: l.unitPrice.toFixed(2),
        total: l.lineTotal.toFixed(2),
      })),
    })));
  });
  app.post('/sales', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      customer_id?: string;
      customer?: {
        document_type: CustomerDocumentType | string;
        document_number: string;
        full_name: string;
        phone: string;
        city: string;
        email?: string;
      };
      shift_id: string;
      terminal_id: string;
      cash_session_id: string;
      created_by_user_id: string;
      requires_invoice?: boolean;
      items: Array<{ product_id: string; quantity: number }>;
      payments: Array<{ method: string; amount: string; reference?: string }>;
    };

    if (!body?.items?.length || !body?.payments?.length || !body?.site_id) {
      return fail(reply, 'VALIDATION_ERROR', 'items y payments son requeridos');
    }

    const site = await prisma.site.findUnique({ where: { id: body.site_id } });
    if (!site) return fail(reply, 'NOT_FOUND', 'Sede no encontrada', 404);
    if (body.requires_invoice && !body.customer_id && !body.customer) {
      return fail(reply, 'VALIDATION_ERROR', 'Se requiere cliente para facturar');
    }

    let customerId = body.customer_id ?? site.defaultCustomerId;
    if (body.customer) {
      const docType = String(body.customer.document_type).toUpperCase() as CustomerDocumentType;
      const allowedTypes: CustomerDocumentType[] = ['CC', 'CE', 'NIT', 'TI', 'PAS'];
      if (!allowedTypes.includes(docType)) {
        return fail(reply, 'VALIDATION_ERROR', 'document_type inválido');
      }
      const documentNumber = body.customer.document_number?.trim();
      const fullName = body.customer.full_name?.trim();
      const phone = body.customer.phone?.trim();
      const city = body.customer.city?.trim();
      if (!documentNumber || !fullName || !phone || !city) {
        return fail(reply, 'VALIDATION_ERROR', 'Datos de cliente incompletos');
      }

      const customer = await prisma.customer.upsert({
        where: {
          siteId_documentType_documentNumber: {
            siteId: body.site_id,
            documentType: docType,
            documentNumber,
          },
        },
        create: {
          siteId: body.site_id,
          documentType: docType,
          documentNumber,
          fullName,
          phone,
          city,
          email: body.customer.email?.trim() || null,
        },
        update: {
          fullName,
          phone,
          city,
          email: body.customer.email?.trim() || null,
        },
      });

      customerId = customer.id;
    }

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
      return fail(reply, 'SHIFT_MISMATCH', 'La venta no coincide con el turno activo', 409);
    }

    const products = await prisma.product.findMany({
      where: { id: { in: body.items.map(i => i.product_id) } },
    });

    if (products.length !== body.items.length) {
      return fail(reply, 'PRODUCT_NOT_FOUND', 'Producto inválido', 404);
    }

    const lines = body.items.map((i) => {
      const product = products.find(p => p.id === i.product_id)!;
      return {
        productId: product.id,
        category: product.category,
        quantity: i.quantity,
        unitPrice: product.price,
        lineTotal: product.price.mul(i.quantity),
      };
    });

    const subtotal = lines.reduce((s, l) => s.add(l.lineTotal), new Prisma.Decimal(0));
    const tax = new Prisma.Decimal(0);
    const total = subtotal.add(tax);
    const totalPaid = body.payments.reduce((s, p) => s.add(new Prisma.Decimal(p.amount)), new Prisma.Decimal(0));
    const balanceDue = total.sub(totalPaid);
    const status = balanceDue.gt(0) ? SaleStatus.PARTIAL : SaleStatus.PAID;

    const sale = await prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          siteId: body.site_id,
          customerId,
          shiftId: body.shift_id,
          terminalId: body.terminal_id,
          cashSessionId: body.cash_session_id,
          createdById: body.created_by_user_id,
          status,
          subtotal,
          tax,
          total,
          totalPaid,
          balanceDue,
          requiresElectronicInvoice: body.requires_invoice ?? false,
          lines: { create: lines },
          payments: {
            create: body.payments.map(p => ({
              method: p.method as any,
              amount: new Prisma.Decimal(p.amount),
              reference: p.reference ?? null,
            })),
          },
        },
        include: { lines: true, payments: true },
      });

      await tx.auditLog.create({
        data: {
          siteId: body.site_id,
          actorId: body.created_by_user_id,
          action: 'CREATE',
          entityType: 'SALE',
          entityId: created.id,
          after: {
            total: created.total.toFixed(2),
            status: created.status,
            cashSessionId: created.cashSessionId,
            customerId: created.customerId,
            payments: created.payments.map(p => ({
              method: p.method,
              amount: p.amount.toFixed(2),
            })),
          },
        },
      });

      return created;
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
      id: sale.id,
      total: sale.total.toFixed(2),
      status: sale.status,
      receipt_number: receiptNumber,
      receipt_text: receiptText,
    });
  });
}
