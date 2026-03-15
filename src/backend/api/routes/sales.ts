import type { FastifyInstance } from 'fastify';
import { CustomerDocumentType, Prisma, SaleStatus } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { prisma } from '@/backend/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, fail } from '../utils/response';
import { buildReceiptTxt } from '@/backend/services/receiptService';
import { assertReason, assertSupervisorApproval } from '@/backend/validation/cashSessionValidators';
import { syncExpectedCashAmount } from '@/backend/services/cashSessionService';
import { sanitizeEmail, sanitizeId, sanitizeMoney, sanitizeText, sanitizeUuid } from '@/backend/utils/sanitize';

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

  app.get('/sales/recent', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const siteId = (req.query as any).site_id as string;
    const createdByUserId = (req.query as any).created_by_user_id as string;
    const limit = parseInt(((req.query as any).limit as string) ?? '15', 10);
    const rawSaleDate = ((req.query as any).sale_date as string | undefined)?.trim() ?? '';
    const authUser = (req as any).authUser as { id: string } | undefined;

    if (!siteId || !createdByUserId) {
      return fail(reply, 'VALIDATION_ERROR', 'site_id y created_by_user_id requeridos');
    }

    if (authUser?.id && authUser.id !== createdByUserId) {
      return fail(reply, 'FORBIDDEN', 'No autorizado para ver estas ventas', 403);
    }

    const parsedDate = rawSaleDate && /^\d{4}-\d{2}-\d{2}$/.test(rawSaleDate)
      ? new Date(`${rawSaleDate}T00:00:00`)
      : null;
    if (rawSaleDate && (!parsedDate || Number.isNaN(parsedDate.getTime()))) {
      return fail(reply, 'VALIDATION_ERROR', 'sale_date inválida. Formato esperado: YYYY-MM-DD');
    }

    const role = (req as any).authUser?.role as 'cashier' | 'supervisor' | 'admin' | undefined;
    const today = new Date();
    const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const effectiveSaleDate = role === 'cashier' ? todayDate : (rawSaleDate || todayDate);
    const dateStart = new Date(`${effectiveSaleDate}T00:00:00`);
    const dateEnd = new Date(`${effectiveSaleDate}T00:00:00`);
    dateEnd.setDate(dateEnd.getDate() + 1);

    const sales = await prisma.sale.findMany({
      where: {
        siteId,
        createdById: createdByUserId,
        createdAt: {
          gte: dateStart,
          lt: dateEnd,
        },
      },
      include: { payments: true, lines: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    });

    return ok(reply, sales.map(s => ({
      id: s.id,
      created_at: s.createdAt.toISOString(),
      total: s.total.toFixed(2),
      payment_method: s.payments[0]?.method ?? null,
      requires_invoice: s.requiresElectronicInvoice,
      customer: s.customerId ? {
        id: s.customer.id,
        document_type: s.customer.documentType,
        document_number: s.customer.documentNumber,
        full_name: s.customer.fullName,
        phone: s.customer.phone,
        email: s.customer.email,
        city: s.customer.city,
        address: s.customer.notes?.match(/direccion=([^;]+)/)?.[1] ?? '',
        person_type: s.customer.notes?.match(/tipo_persona=([^;]+)/)?.[1] ?? 'natural',
      } : null,
      items: s.lines.map(l => ({
        product_id: l.productId,
        product_name: l.product?.name ?? 'Producto',
        quantity: l.quantity,
        unit_price: l.unitPrice.toFixed(2),
      })),
    })));
  });

  app.patch('/sales/:id/metadata', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const id = sanitizeUuid((req.params as any).id as string);
    const body = req.body as {
      site_id: string;
      managed_by_user_id: string;
      payment_method: string;
      requires_invoice: boolean;
      customer?: {
        document_type: CustomerDocumentType | string;
        document_number: string;
        full_name: string;
        phone: string;
        address?: string;
        city: string;
        email?: string;
        person_type?: 'natural' | 'juridica' | string;
      };
    };

    const siteId = sanitizeUuid(body?.site_id);
    const managedByUserId = sanitizeUuid(body?.managed_by_user_id);
    const paymentMethod = sanitizeText(body?.payment_method, 20).toUpperCase();
    const requiresInvoice = Boolean(body?.requires_invoice);
    const allowedPaymentMethods = new Set([
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

    if (!id || !siteId || !managedByUserId || !paymentMethod || !allowedPaymentMethods.has(paymentMethod)) {
      return fail(reply, 'VALIDATION_ERROR', 'Datos inválidos para actualizar la venta');
    }

    if (requiresInvoice && !body.customer) {
      return fail(reply, 'VALIDATION_ERROR', 'Los datos de facturación son requeridos');
    }

    const authUser = (req as any).authUser as { id: string; role: string } | undefined;
    if (authUser?.id && authUser.id !== managedByUserId) {
      return fail(reply, 'FORBIDDEN', 'Usuario no autorizado', 403);
    }

    const sale = await prisma.sale.findFirst({
      where: { id, siteId },
      include: {
        customer: true,
        payments: true,
      },
    });
    if (!sale) return fail(reply, 'NOT_FOUND', 'Venta no encontrada', 404);
    if (sale.status === SaleStatus.VOIDED) {
      return fail(reply, 'VALIDATION_ERROR', 'No se puede editar una venta anulada');
    }
    if (authUser?.role === 'cashier' && sale.createdById !== managedByUserId) {
      return fail(reply, 'FORBIDDEN', 'Solo puedes editar tus propias ventas', 403);
    }

    let nextCustomerId = sale.customerId;
    if (body.customer) {
      const docType = String(body.customer.document_type).toUpperCase() as CustomerDocumentType;
      const allowedTypes: CustomerDocumentType[] = ['CC', 'CE', 'NIT', 'PAS'];
      if (!allowedTypes.includes(docType)) {
        return fail(reply, 'VALIDATION_ERROR', 'document_type inválido');
      }
      const documentNumber = sanitizeText(body.customer.document_number, 60);
      const fullName = sanitizeText(body.customer.full_name, 120);
      const phone = sanitizeText(body.customer.phone, 40);
      const email = sanitizeEmail(body.customer.email);
      const address = sanitizeText(body.customer.address, 160);
      const city = sanitizeText(body.customer.city, 80);
      const personType = String(body.customer.person_type ?? '').toLowerCase();
      if (!documentNumber || !fullName || !phone || !email || !address || !city) {
        return fail(reply, 'VALIDATION_ERROR', 'Datos de cliente incompletos');
      }
      if (!email.includes('@')) {
        return fail(reply, 'VALIDATION_ERROR', 'Correo inválido');
      }
      if (personType && personType !== 'natural' && personType !== 'juridica') {
        return fail(reply, 'VALIDATION_ERROR', 'person_type inválido');
      }

      const customerNotes = `direccion=${address}; tipo_persona=${personType || 'no_definido'}`;
      const customer = await prisma.customer.upsert({
        where: {
          siteId_documentType_documentNumber: {
            siteId,
            documentType: docType,
            documentNumber,
          },
        },
        create: {
          siteId,
          documentType: docType,
          documentNumber,
          fullName,
          phone,
          city,
          email,
          notes: customerNotes,
        },
        update: {
          fullName,
          phone,
          city,
          email,
          notes: customerNotes,
        },
      });
      nextCustomerId = customer.id;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          requiresElectronicInvoice: requiresInvoice,
          customerId: nextCustomerId,
        },
      });

      await tx.salePayment.updateMany({
        where: { saleId: sale.id },
        data: { method: paymentMethod as any },
      });

      await tx.auditLog.create({
        data: {
          siteId,
          actorId: managedByUserId,
          action: 'ADJUST',
          entityType: 'SALE',
          entityId: sale.id,
          after: {
            paymentMethod,
            requiresInvoice,
            customerId: nextCustomerId,
          },
        },
      });

      return tx.sale.findUniqueOrThrow({
        where: { id: sale.id },
        include: {
          customer: true,
          payments: true,
        },
      });
    });

    return ok(reply, {
      id: updated.id,
      payment_method: updated.payments[0]?.method ?? paymentMethod,
      requires_invoice: updated.requiresElectronicInvoice,
      customer: {
        id: updated.customer.id,
        document_type: updated.customer.documentType,
        document_number: updated.customer.documentNumber,
        full_name: updated.customer.fullName,
        phone: updated.customer.phone,
        email: updated.customer.email,
        city: updated.customer.city,
        address: updated.customer.notes?.match(/direccion=([^;]+)/)?.[1] ?? '',
        person_type: updated.customer.notes?.match(/tipo_persona=([^;]+)/)?.[1] ?? 'natural',
      },
    });
  });

  app.get('/sales/:id/receipt.pdf', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const id = sanitizeUuid((req.params as any).id as string);
    const siteId = sanitizeUuid((req.query as any).site_id as string);
    if (!id || !siteId) {
      return fail(reply, 'VALIDATION_ERROR', 'id y site_id requeridos');
    }

    const sale = await prisma.sale.findFirst({
      where: { id, siteId },
      include: {
        site: { include: { organization: true } },
        customer: true,
        createdBy: true,
        payments: true,
        lines: { include: { product: true, card: true } },
      },
    });
    if (!sale) {
      return fail(reply, 'NOT_FOUND', 'Venta no encontrada', 404);
    }

    const receiptNumber = sale.receiptNumber ?? `RC-${sale.createdAt.getTime().toString().slice(-8)}`;
    const receiptText = sale.receiptText ?? buildReceiptTxt({ sale: sale as any });
    if (!sale.receiptText) {
      await prisma.sale.update({
        where: { id: sale.id },
        data: { receiptNumber, receiptText },
      });
    }

    reply.hijack();
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    reply.raw.setHeader('Content-Type', 'application/pdf');
    reply.raw.setHeader('Content-Disposition', `attachment; filename="factura-${receiptNumber}.pdf"`);
    doc.pipe(reply.raw);

    doc.fontSize(14).text('POLIVERSO - FACTURA / RECIBO', { align: 'center' });
    doc.moveDown(0.8);
    doc.fontSize(10);
    receiptText.split('\n').forEach((line) => {
      doc.text(line);
    });

    doc.end();
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
        address?: string;
        city: string;
        email?: string;
        person_type?: 'natural' | 'juridica' | string;
      };
      shift_id?: string;
      terminal_id: string;
      cash_session_id: string;
      created_by_user_id: string;
      requires_invoice?: boolean;
      items: Array<{ product_id: string; quantity: number }>;
      issued_cards?: Array<{ product_id: string; uid: string }>;
      payments: Array<{ method: string; amount: string; reference?: string }>;
    };

    if (!body?.items?.length || !body?.payments?.length || !body?.site_id) {
      return fail(reply, 'VALIDATION_ERROR', 'items y payments son requeridos');
    }
    const siteId = sanitizeUuid(body.site_id);
    const terminalId = sanitizeUuid(body.terminal_id);
    const cashSessionId = sanitizeUuid(body.cash_session_id);
    const createdByUserId = sanitizeUuid(body.created_by_user_id);
    const normalizedShiftId = body.shift_id ? sanitizeUuid(body.shift_id) : '';
    if (!siteId || !terminalId || !cashSessionId || !createdByUserId) {
      return fail(reply, 'VALIDATION_ERROR', 'Contexto de venta inválido');
    }

    const sanitizedItems = body.items
      .map((item) => ({
        product_id: sanitizeUuid(item.product_id),
        quantity: Number(item.quantity),
      }))
      .filter((item) => Boolean(item.product_id) && Number.isInteger(item.quantity) && item.quantity > 0);
    if (sanitizedItems.length !== body.items.length) {
      return fail(reply, 'VALIDATION_ERROR', 'Items inválidos');
    }

    const sanitizedPayments = body.payments
      .map((payment) => ({
        method: sanitizeText(payment.method, 20).toUpperCase(),
        amount: sanitizeMoney(payment.amount),
        reference: sanitizeText(payment.reference, 120),
      }))
      .filter((payment) => Boolean(payment.method) && Boolean(payment.amount));
    const allowedPaymentMethods = new Set([
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
    if (sanitizedPayments.length !== body.payments.length) {
      return fail(reply, 'VALIDATION_ERROR', 'Pagos inválidos');
    }
    if (sanitizedPayments.some((payment) => !allowedPaymentMethods.has(payment.method))) {
      return fail(reply, 'VALIDATION_ERROR', 'Método de pago inválido');
    }

    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) return fail(reply, 'NOT_FOUND', 'Sede no encontrada', 404);
    if (body.requires_invoice && !body.customer_id && !body.customer) {
      return fail(reply, 'VALIDATION_ERROR', 'Se requiere cliente para facturar');
    }

    let customerId = body.customer_id ? sanitizeUuid(body.customer_id) : (site.defaultCustomerId ?? null);
    const hasExplicitSaleCustomer = Boolean(body.customer_id || body.customer);
    if (body.customer) {
      const docType = String(body.customer.document_type).toUpperCase() as CustomerDocumentType;
      const allowedTypes: CustomerDocumentType[] = ['CC', 'CE', 'NIT', 'PAS'];
      if (!allowedTypes.includes(docType)) {
        return fail(reply, 'VALIDATION_ERROR', 'document_type inválido');
      }
      const documentNumber = sanitizeText(body.customer.document_number, 60);
      const fullName = sanitizeText(body.customer.full_name, 120);
      const phone = sanitizeText(body.customer.phone, 40);
      const email = sanitizeEmail(body.customer.email);
      const address = sanitizeText(body.customer.address, 160);
      const city = sanitizeText(body.customer.city, 80);
      const personType = String(body.customer.person_type ?? '').toLowerCase();
      if (!documentNumber || !fullName || !phone || !email || !address || !city) {
        return fail(reply, 'VALIDATION_ERROR', 'Datos de cliente incompletos');
      }
      if (!email.includes('@')) {
        return fail(reply, 'VALIDATION_ERROR', 'Correo inválido');
      }
      if (personType && personType !== 'natural' && personType !== 'juridica') {
        return fail(reply, 'VALIDATION_ERROR', 'person_type inválido');
      }
      const customerNotes = `direccion=${address}; tipo_persona=${personType || 'no_definido'}`;

      const customer = await prisma.customer.upsert({
        where: {
          siteId_documentType_documentNumber: {
            siteId,
            documentType: docType,
            documentNumber,
          },
        },
        create: {
          siteId,
          documentType: docType,
          documentNumber,
          fullName,
          phone,
          city,
          email,
          notes: customerNotes,
        },
        update: {
          fullName,
          phone,
          city,
          email,
          notes: customerNotes,
        },
      });

      customerId = customer.id;
    }

    if (!customerId) return fail(reply, 'VALIDATION_ERROR', 'customer_id requerido');
    const ownerCustomerIdForIssuedCards = hasExplicitSaleCustomer ? customerId : null;

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

    if (normalizedShiftId && activeSession.shiftId && normalizedShiftId !== activeSession.shiftId) {
      return fail(reply, 'SHIFT_MISMATCH', 'La venta no coincide con el turno activo', 409);
    }
    const shiftId = normalizedShiftId || activeSession.shiftId || null;
    if (!shiftId) {
      return fail(reply, 'SHIFT_REQUIRED', 'No hay turno activo para registrar la venta', 409);
    }

    const products = await prisma.product.findMany({
      where: { id: { in: sanitizedItems.map(i => i.product_id) } },
    });

    if (products.length !== sanitizedItems.length) {
      return fail(reply, 'PRODUCT_NOT_FOUND', 'Producto inválido', 404);
    }

    const issuedCardsInput = (body.issued_cards ?? [])
      .map((entry) => ({
        productId: sanitizeUuid(entry?.product_id),
        uid: sanitizeId(entry?.uid, 60).toUpperCase(),
      }))
      .filter((entry) => Boolean(entry.productId) && Boolean(entry.uid));
    if (issuedCardsInput.length !== (body.issued_cards ?? []).length) {
      return fail(reply, 'VALIDATION_ERROR', 'issued_cards inválido');
    }
    const issuedUidSet = new Set(issuedCardsInput.map((entry) => entry.uid));
    if (issuedUidSet.size !== issuedCardsInput.length) {
      return fail(reply, 'VALIDATION_ERROR', 'UID repetido en issued_cards');
    }

    const cardProductIds = new Set(
      products
        .filter((product) => product.category === 'CARD_PLASTIC')
        .map((product) => product.id),
    );
    const requiredCardsByProductId = new Map<string, number>();
    let totalRequiredCards = 0;
    for (const item of sanitizedItems) {
      if (!cardProductIds.has(item.product_id)) continue;
      requiredCardsByProductId.set(item.product_id, (requiredCardsByProductId.get(item.product_id) ?? 0) + item.quantity);
      totalRequiredCards += item.quantity;
    }
    if (totalRequiredCards > 0 && issuedCardsInput.length !== totalRequiredCards) {
      return fail(reply, 'CARD_UID_REQUIRED', 'Debes leer UID para cada tarjeta física vendida', 409);
    }
    const providedCardsByProductId = new Map<string, string[]>();
    for (const entry of issuedCardsInput) {
      if (!requiredCardsByProductId.has(entry.productId)) {
        return fail(reply, 'VALIDATION_ERROR', 'issued_cards contiene producto inválido');
      }
      const bucket = providedCardsByProductId.get(entry.productId) ?? [];
      bucket.push(entry.uid);
      providedCardsByProductId.set(entry.productId, bucket);
    }
    for (const [productId, requiredQty] of requiredCardsByProductId.entries()) {
      const providedQty = (providedCardsByProductId.get(productId) ?? []).length;
      if (providedQty !== requiredQty) {
        return fail(reply, 'CARD_UID_REQUIRED', 'Cantidad de UID no coincide con tarjetas vendidas', 409);
      }
    }
    if (issuedUidSet.size > 0) {
      const existingCards = await prisma.card.findMany({
        where: { uid: { in: Array.from(issuedUidSet) } },
        select: { uid: true },
      });
      if (existingCards.length > 0) {
        return fail(reply, 'CARD_UID_ALREADY_EXISTS', `UID ya registrado: ${existingCards[0].uid}`, 409);
      }
    }

    const inventorySkuByProductId = new Map<string, string>();
    const inventoryNeedBySku = new Map<string, number>();
    for (const item of sanitizedItems) {
      const product = products.find((p) => p.id === item.product_id)!;
      if (!product.sku) continue;
      const inventorySku = `INV-${product.sku}`;
      inventorySkuByProductId.set(product.id, inventorySku);
      inventoryNeedBySku.set(inventorySku, (inventoryNeedBySku.get(inventorySku) ?? 0) + item.quantity);
    }

    const inventoryItems = inventoryNeedBySku.size > 0
      ? await prisma.inventoryItem.findMany({
          where: {
            siteId,
            sku: { in: Array.from(inventoryNeedBySku.keys()) },
          },
          select: { id: true, sku: true, name: true },
        })
      : [];
    const inventoryBySku = new Map(inventoryItems.map((item) => [item.sku ?? '', item]));
    const missingCardInventory = Array.from(requiredCardsByProductId.keys()).find((productId) => {
      const sku = inventorySkuByProductId.get(productId);
      return !sku || !inventoryBySku.has(sku);
    });
    if (missingCardInventory) {
      return fail(reply, 'INVENTORY_ITEM_REQUIRED', 'Producto de tarjeta física sin ítem de inventario', 409);
    }

    const stockRows = inventoryItems.length > 0
      ? await prisma.inventoryMovement.groupBy({
          by: ['itemId'],
          where: { siteId, itemId: { in: inventoryItems.map((item) => item.id) } },
          _sum: { quantity: true },
        })
      : [];
    const stockByItemId = new Map(stockRows.map((row) => [row.itemId, Number(row._sum.quantity ?? 0)]));
    for (const [inventorySku, requiredQty] of inventoryNeedBySku.entries()) {
      const inventoryItem = inventoryBySku.get(inventorySku);
      if (!inventoryItem) continue;
      const available = stockByItemId.get(inventoryItem.id) ?? 0;
      if (available < requiredQty) {
        return fail(reply, 'INSUFFICIENT_STOCK', `Stock insuficiente para ${inventoryItem.name}`, 409);
      }
    }

    const lines = sanitizedItems.map((i) => {
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
    const totalPaid = sanitizedPayments.reduce((s, p) => s.add(new Prisma.Decimal(p.amount)), new Prisma.Decimal(0));
    const balanceDue = total.sub(totalPaid);
    const status = balanceDue.gt(0) ? SaleStatus.PARTIAL : SaleStatus.PAID;

    const sale = await prisma.$transaction(async (tx) => {
      const createdCardsByUid = new Map<string, string>();
      if (issuedCardsInput.length > 0) {
        for (const entry of issuedCardsInput) {
          const createdCard = await tx.card.create({
            data: {
              siteId,
              uid: entry.uid,
              ownerCustomerId: ownerCustomerIdForIssuedCards ?? undefined,
            },
          });
          await tx.cardStatusHistory.create({
            data: {
              siteId,
              cardId: createdCard.id,
              fromStatus: null,
              toStatus: createdCard.status,
              reason: `Emisión por venta ${entry.productId}`,
              changedByUserId: createdByUserId,
            },
          });
          createdCardsByUid.set(entry.uid, createdCard.id);
        }
      }

      const saleLineCreates: Array<{
        productId: string;
        cardId?: string;
        category: any;
        quantity: number;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
      }> = [];
      const cardQueueByProductId = new Map<string, string[]>(
        Array.from(providedCardsByProductId.entries()).map(([productId, uids]) => [productId, [...uids]]),
      );
      for (const line of lines) {
        if (line.category === 'CARD_PLASTIC') {
          const queue = cardQueueByProductId.get(line.productId) ?? [];
          for (let idx = 0; idx < line.quantity; idx += 1) {
            const uid = queue.shift();
            const cardId = uid ? createdCardsByUid.get(uid) : undefined;
            if (!cardId) {
              throw new Error('CARD_UID_REQUIRED');
            }
            saleLineCreates.push({
              productId: line.productId,
              cardId,
              category: line.category,
              quantity: 1,
              unitPrice: line.unitPrice,
              lineTotal: line.unitPrice,
            });
          }
          cardQueueByProductId.set(line.productId, queue);
          continue;
        }
        saleLineCreates.push({
          productId: line.productId,
          category: line.category,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
        });
      }

      const created = await tx.sale.create({
        data: {
          site: { connect: { id: siteId } },
          customer: { connect: { id: customerId } },
          shift: { connect: { id: shiftId } },
          terminal: { connect: { id: terminalId } },
          cashSession: { connect: { id: cashSessionId } },
          createdBy: { connect: { id: createdByUserId } },
          status,
          subtotal,
          tax,
          total,
          totalPaid,
          balanceDue,
          requiresElectronicInvoice: body.requires_invoice ?? false,
          lines: { create: saleLineCreates },
          payments: {
            create: sanitizedPayments.map(p => ({
              method: p.method as any,
              amount: new Prisma.Decimal(p.amount),
              reference: p.reference || null,
            })),
          },
        },
        include: { lines: true, payments: true },
      });

      for (const [inventorySku, requiredQty] of inventoryNeedBySku.entries()) {
        const inventoryItem = inventoryBySku.get(inventorySku);
        if (!inventoryItem) continue;
        await tx.inventoryMovement.create({
          data: {
            siteId,
            itemId: inventoryItem.id,
            performedById: createdByUserId,
            type: 'SALE',
            quantity: -requiredQty,
            notes: `Salida por venta ${created.id}`,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          siteId,
          actorId: createdByUserId,
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
      id: sale.id,
      total: sale.total.toFixed(2),
      status: sale.status,
      receipt_number: receiptNumber,
      receipt_text: receiptText,
    });
  });

  app.post('/sales/:id/void', { preHandler: [requireAuth] }, async (req, reply) => {
    const id = sanitizeUuid((req.params as any).id as string);
    const body = req.body as {
      site_id: string;
      voided_by_user_id: string;
      reason: string;
      approval_id?: string | null;
    };

    const siteId = sanitizeUuid(body?.site_id);
    const voidedByUserId = sanitizeUuid(body?.voided_by_user_id);
    const reason = sanitizeText(body?.reason, 400);
    const approvalId = body?.approval_id ? sanitizeUuid(body.approval_id) : '';

    if (!id || !siteId || !voidedByUserId || !reason) {
      return fail(reply, 'VALIDATION_ERROR', 'Campos requeridos incompletos');
    }

    const authUser = (req as any).authUser as { id: string; role: string } | undefined;
    if (authUser?.id && authUser.id !== voidedByUserId) {
      return fail(reply, 'FORBIDDEN', 'Usuario no autorizado', 403);
    }

    assertReason(reason);

    if (authUser?.role === 'cashier') {
      if (!approvalId) {
        return fail(reply, 'SUPERVISOR_REQUIRED', 'Se requiere autorización de supervisor', 403);
      }
      await assertSupervisorApproval({ approvalId, siteId });
    }

    const sale = await prisma.sale.findFirst({ where: { id, siteId } });
    if (!sale) return fail(reply, 'NOT_FOUND', 'Venta no encontrada', 404);
    if (sale.status === SaleStatus.VOIDED) {
      return ok(reply, { id: sale.id, status: sale.status });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const voided = await tx.sale.update({
        where: { id: sale.id },
        data: { status: SaleStatus.VOIDED, voidedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          siteId,
          actorId: voidedByUserId,
          action: 'VOID',
          entityType: 'SALE',
          entityId: sale.id,
          reason,
          after: { status: SaleStatus.VOIDED },
        },
      });

      return voided;
    });

    await syncExpectedCashAmount({
      siteId,
      cashSessionId: sale.cashSessionId,
    });

    return ok(reply, { id: updated.id, status: updated.status });
  });

  app.patch('/sales/:id/electronic-invoice', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const id = sanitizeUuid((req.params as any).id as string);
    const body = req.body as {
      site_id: string;
      electronic_invoice_number: string;
      electronic_invoice_code?: string;
      managed_by_user_id: string;
    };

    const siteId = sanitizeUuid(body?.site_id);
    const managedByUserId = sanitizeUuid(body?.managed_by_user_id);
    const electronicInvoiceNumber = sanitizeText(body?.electronic_invoice_number, 80);
    const electronicInvoiceCode = sanitizeText(body?.electronic_invoice_code, 80);

    if (!id || !siteId || !managedByUserId || !electronicInvoiceNumber) {
      return fail(reply, 'VALIDATION_ERROR', 'site_id, managed_by_user_id y electronic_invoice_number son requeridos');
    }

    const authUser = (req as any).authUser as { id: string } | undefined;
    if (authUser?.id && authUser.id !== managedByUserId) {
      return fail(reply, 'FORBIDDEN', 'Usuario no autorizado', 403);
    }

    const sale = await prisma.sale.findFirst({
      where: { id, siteId },
      select: { id: true, requiresElectronicInvoice: true },
    });
    if (!sale) return fail(reply, 'NOT_FOUND', 'Venta no encontrada', 404);
    if (!sale.requiresElectronicInvoice) {
      return fail(reply, 'VALIDATION_ERROR', 'La venta no requiere factura electrónica');
    }

    const updated = await prisma.sale.update({
      where: { id },
      data: {
        electronicInvoiceNumber,
        electronicInvoiceCode: electronicInvoiceCode || 'GESTIONADA',
      },
    });

    return ok(reply, {
      id: updated.id,
      electronic_invoice_number: updated.electronicInvoiceNumber,
      electronic_invoice_code: updated.electronicInvoiceCode,
    });
  });

}
