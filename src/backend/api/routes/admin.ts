import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AttractionStatus, AuditAction, EntityType, InventoryCategory, InventoryMovementType, Prisma, PromotionScope, PromotionType, SaleCategory, TipoOperacionVendible } from '@prisma/client';
import { prisma } from '@/backend/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, fail } from '../utils/response';
import { sanitizeDigits, sanitizeEmail, sanitizeMoney, sanitizeText, sanitizeUuid } from '@/backend/utils/sanitize';
import { reserveNextItemCode, validateAndReserveManualCode } from '@/backend/utils/itemCodeGenerator';
import { writeAuditLog } from '@/backend/utils/audit';
import { appendCardBalanceEvent } from '@/backend/services/cardBalanceService';

function mapProductCategoryToInventoryCategory(category: string): InventoryCategory {
  if (category === 'CARD_PLASTIC' || category === 'GIFT_CARD') return 'CARD_PLASTIC';
  if (category === 'PRIZE') return 'PRIZE';
  if (category === 'SNACKS') return 'SNACK';
  return 'OTHER';
}

function normalizeLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function mapGroupToSaleCategory(group: string): SaleCategory {
  const normalized = normalizeLabel(group);
  if (normalized.includes('SNACK')) return 'SNACKS';
  if (normalized.includes('PARQUE') && normalized.includes('TARJETA')) return 'CARD_PLASTIC';
  if (normalized.includes('RECARGA')) return 'RECHARGE';
  if (normalized.includes('SERVICIO') || normalized.includes('PROGRAMA') || normalized.includes('EVENTO')) return 'SERVICE';
  return 'OTHER';
}

function parseInventoryCategory(value: unknown): InventoryCategory | null {
  const cleaned = sanitizeText(value, 40).toUpperCase();
  if (!cleaned) return null;
  if (cleaned === 'CARD_PLASTIC' || cleaned === 'TARJETAS' || cleaned === 'TARJETA') return 'CARD_PLASTIC';
  if (cleaned === 'SNACK' || cleaned === 'SNACKS') return 'SNACK';
  if (cleaned === 'PRIZE' || cleaned === 'PREMIOS' || cleaned === 'PREMIO') return 'PRIZE';
  if (cleaned === 'OTHER' || cleaned === 'OTROS' || cleaned === 'OTRO') return 'OTHER';
  return null;
}

function parseInventoryMovementType(value: unknown): InventoryMovementType | null {
  const cleaned = sanitizeText(value, 40).toUpperCase();
  if (!cleaned) return null;
  if (cleaned === 'OPENING_COUNT' || cleaned === 'REGISTRO') return 'OPENING_COUNT';
  if (cleaned === 'PURCHASE') return 'PURCHASE';
  if (cleaned === 'ADJUSTMENT') return 'ADJUSTMENT';
  if (cleaned === 'SALE') return 'SALE';
  if (cleaned === 'TRANSFER') return 'TRANSFER';
  if (cleaned === 'REDEMPTION') return 'REDEMPTION';
  if (cleaned === 'CLOSING_COUNT') return 'CLOSING_COUNT';
  return null;
}

const INVENTORY_REASON_OPTIONS = [
  'NUEVA_COMPRA',
  'VENCIMIENTO',
  'DANO',
  'PERDIDA',
  'TRASLADO',
  'CORTESIA',
] as const;
type InventoryReason = (typeof INVENTORY_REASON_OPTIONS)[number];
const READER_STATUS_OFFLINE_THRESHOLD_MS = 2 * 60 * 1000;

function parseInventoryReason(value: unknown): InventoryReason | null {
  const cleaned = sanitizeText(value, 40)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (!cleaned) return null;
  if ((INVENTORY_REASON_OPTIONS as readonly string[]).includes(cleaned)) return cleaned as InventoryReason;
  return null;
}

function buildInventoryNote(reason: InventoryReason, observations: string) {
  if (!observations) return reason;
  return `${reason} | OBS: ${observations}`;
}

function parseInventoryNote(note: string | null | undefined) {
  const raw = (note ?? '').trim();
  if (!raw) return { reason: '', observations: '' };
  const marker = '| OBS:';
  const markerIdx = raw.indexOf(marker);
  if (markerIdx < 0) return { reason: raw, observations: '' };
  return {
    reason: raw.slice(0, markerIdx).trim(),
    observations: raw.slice(markerIdx + marker.length).trim(),
  };
}

function toBool(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (['true', '1', 'si', 'sí', 'yes'].includes(lowered)) return true;
    if (['false', '0', 'no'].includes(lowered)) return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function parsePromotionType(value: unknown): PromotionType | null {
  const cleaned = sanitizeText(value, 40).toUpperCase();
  if (cleaned === 'PERCENT_DISCOUNT') return 'PERCENT_DISCOUNT';
  if (cleaned === 'COMBO') return 'COMBO';
  if (cleaned === 'BONUS') return 'BONUS';
  if (cleaned === 'RECHARGE_ADDITIONAL') return 'RECHARGE_ADDITIONAL';
  return null;
}

function parsePromotionScope(value: unknown): PromotionScope | null {
  const cleaned = sanitizeText(value, 20).toUpperCase();
  if (cleaned === 'SALE') return 'SALE';
  if (cleaned === 'RECHARGE') return 'RECHARGE';
  return null;
}

function parseAttractionStatus(value: unknown): AttractionStatus | null {
  const cleaned = sanitizeText(value, 30).toUpperCase();
  if (cleaned === 'ACTIVE') return 'ACTIVE';
  if (cleaned === 'INACTIVE') return 'INACTIVE';
  if (cleaned === 'MAINTENANCE') return 'MAINTENANCE';
  return null;
}

function parseAttractionType(value: unknown): 'TIME' | 'SKILL' | null {
  const cleaned = sanitizeText(value, 20).toUpperCase();
  if (cleaned === 'TIME') return 'TIME';
  if (cleaned === 'SKILL') return 'SKILL';
  return null;
}

function getBogotaDayRange(reference = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reference);

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';

  const start = new Date(`${year}-${month}-${day}T05:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function parseNumberArray(value: unknown) {
  if (!Array.isArray(value)) return [] as number[];
  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));
}

function parseStringArray(value: unknown) {
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
  const days = parseNumberArray(dayRestrictions);
  if (days.length === 0) return true;
  return days.includes(reference.getDay());
}

async function calculateAttractionPriceWithPromotions(params: {
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
    const restrictedCodes = parseStringArray(promo.productRestrictions);
    if (restrictedCodes.length > 0 && !restrictedCodes.includes(attractionCode)) continue;
    const exclusionRules = parseStringArray(promo.exceptions).map((rule) => rule.toUpperCase());
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

function asAuthUser(req: any): { id: string; role: 'cashier' | 'supervisor' | 'admin' } | null {
  const authUser = req?.authUser as { id?: string; role?: string } | undefined;
  if (!authUser?.id || !authUser?.role) return null;
  if (authUser.role !== 'cashier' && authUser.role !== 'supervisor' && authUser.role !== 'admin') return null;
  return { id: authUser.id, role: authUser.role };
}

function ensureSupervisorManualAdjustment(authUser: { id: string; role: string } | null) {
  if (!authUser) throw new Error('UNAUTHORIZED');
  if (authUser.role !== 'supervisor') throw new Error('FORBIDDEN_SUPERVISOR_ONLY');
}

function snapshotProductRow(product: {
  id: string;
  name: string;
  price: Prisma.Decimal;
  category: string;
  analyticsCategory: string | null;
  analyticsSubcategory: string | null;
  sku: string | null;
  isActive: boolean;
}) {
  return {
    id: product.id,
    name: product.name,
    price: product.price.toFixed(2),
    category: product.category,
    analytics_category: product.analyticsCategory,
    analytics_subcategory: product.analyticsSubcategory,
    sku: product.sku,
    is_active: product.isActive,
  };
}

export async function adminRoutes(app: FastifyInstance) {
  app.get('/admin/products', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const products = await prisma.product.findMany({
      where: { siteId },
      orderBy: { name: 'asc' },
    });
    const skuToProductId = new Map<string, string>();
    for (const p of products) {
      if (p.sku) skuToProductId.set(`INV-${p.sku}`, p.id);
    }

    const inventoryItems = await prisma.inventoryItem.findMany({
      where: {
        siteId,
        sku: { in: Array.from(skuToProductId.keys()) },
      },
      select: { id: true, sku: true },
    });
    const productIdByItemId = new Map<string, string>();
    for (const item of inventoryItems) {
      const productId = skuToProductId.get(item.sku ?? '');
      if (productId) productIdByItemId.set(item.id, productId);
    }

    const stockByProductId = new Map<string, number>();
    if (inventoryItems.length > 0) {
      const aggregates = await prisma.inventoryMovement.groupBy({
        by: ['itemId'],
        where: { siteId, itemId: { in: inventoryItems.map((i) => i.id) } },
        _sum: { quantity: true },
      });
      for (const row of aggregates) {
        const productId = productIdByItemId.get(row.itemId);
        if (!productId) continue;
        stockByProductId.set(productId, Number(row._sum.quantity ?? 0));
      }
    }

    return ok(reply, products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price.toFixed(2),
      category: p.category,
      analytics_category: p.analyticsCategory,
      analytics_subcategory: p.analyticsSubcategory,
      sku: p.sku,
      is_active: p.isActive,
      stock: stockByProductId.get(p.id) ?? null,
    })));
  });

  app.get('/admin/cards/lookup', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const uid = sanitizeText((req.query as any).uid, 60).toUpperCase().replace(/\s+/g, '');
    if (!siteId || !uid) return fail(reply, 'VALIDATION_ERROR', 'site_id y uid requeridos');

    const card = await prisma.card.findFirst({
      where: { siteId, uid },
      include: {
        ownerCustomer: {
          select: {
            id: true,
            documentType: true,
            documentNumber: true,
            fullName: true,
            phone: true,
            email: true,
            city: true,
          },
        },
      },
    });
    if (!card) {
      return ok(reply, {
        found: false,
        uid,
        message: 'Tarjeta no encontrada',
      });
    }

    const [issuedLine, rechargeLines, statusHistory, usages, balanceEvents, prizeRedemptions, deviceLogs] = await Promise.all([
      prisma.saleLine.findFirst({
        where: { cardId: card.id, category: SaleCategory.CARD_PLASTIC, sale: { siteId } },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          sale: {
            select: {
              id: true,
              createdAt: true,
              receiptNumber: true,
              status: true,
              total: true,
              createdBy: { select: { id: true, fullName: true, email: true } },
              customer: { select: { id: true, fullName: true, documentType: true, documentNumber: true } },
            },
          },
        },
        orderBy: { sale: { createdAt: 'asc' } },
      }),
      prisma.saleLine.findMany({
        where: { cardId: card.id, category: SaleCategory.RECHARGE, sale: { siteId } },
        include: {
          sale: {
            select: {
              id: true,
              createdAt: true,
              receiptNumber: true,
              status: true,
              total: true,
              createdBy: { select: { id: true, fullName: true, email: true } },
              payments: { select: { method: true, amount: true } },
            },
          },
        },
        orderBy: { sale: { createdAt: 'desc' } },
        take: 100,
      }),
      prisma.cardStatusHistory.findMany({
        where: { siteId, cardId: card.id },
        include: { changedBy: { select: { id: true, fullName: true, email: true } } },
        orderBy: { occurredAt: 'desc' },
        take: 150,
      }),
      prisma.attractionUsage.findMany({
        where: { siteId, cardId: card.id },
        include: {
          attraction: { select: { id: true, code: true, name: true, type: true, location: true } },
          reader: { select: { id: true, code: true, position: true } },
          performedBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { occurredAt: 'desc' },
        take: 200,
      }),
      prisma.cardBalanceEvent.findMany({
        where: { siteId, cardId: card.id },
        orderBy: { occurredAt: 'desc' },
        take: 200,
      }),
      prisma.prizeRedemption.findMany({
        where: { siteId, cardId: card.id },
        include: {
          item: { select: { id: true, name: true, sku: true } },
          performedBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.deviceLog.findMany({
        where: { siteId, uid },
        include: { reader: { select: { id: true, code: true, position: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    return ok(reply, {
      found: true,
      card: {
        id: card.id,
        uid: card.uid,
        label: card.label,
        status: card.status,
        issued_at: card.issuedAt.toISOString(),
        balance: Number(card.creditBalance ?? 0),
        points: Number(card.pointsBalance ?? 0),
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
      },
      issued_sale: issuedLine
        ? {
            sale_id: issuedLine.sale.id,
            occurred_at: issuedLine.sale.createdAt.toISOString(),
            receipt_number: issuedLine.sale.receiptNumber,
            status: issuedLine.sale.status,
            total: issuedLine.sale.total.toFixed(2),
            product: issuedLine.product
              ? { id: issuedLine.product.id, name: issuedLine.product.name, sku: issuedLine.product.sku }
              : null,
            customer: {
              id: issuedLine.sale.customer.id,
              full_name: issuedLine.sale.customer.fullName,
              document_type: issuedLine.sale.customer.documentType,
              document_number: issuedLine.sale.customer.documentNumber,
            },
            created_by: issuedLine.sale.createdBy.fullName || issuedLine.sale.createdBy.email,
          }
        : null,
      recharges: rechargeLines.map((line) => ({
        sale_id: line.sale.id,
        occurred_at: line.sale.createdAt.toISOString(),
        receipt_number: line.sale.receiptNumber,
        sale_status: line.sale.status,
        amount: line.lineTotal.toFixed(2),
        unit_price: line.unitPrice.toFixed(2),
        payments: line.sale.payments.map((payment) => ({
          method: payment.method,
          amount: payment.amount.toFixed(2),
        })),
        created_by: line.sale.createdBy.fullName || line.sale.createdBy.email,
      })),
      status_history: statusHistory.map((entry) => ({
        id: entry.id,
        from_status: entry.fromStatus,
        to_status: entry.toStatus,
        reason: entry.reason,
        metadata: entry.metadata ?? null,
        changed_by: entry.changedBy.fullName || entry.changedBy.email,
        occurred_at: entry.occurredAt.toISOString(),
      })),
      usages: usages.map((usage) => ({
        id: usage.id.toString(),
        type: usage.type,
        cost: usage.cost.toFixed(2),
        occurred_at: usage.occurredAt.toISOString(),
        attraction: {
          id: usage.attraction.id,
          code: usage.attraction.code,
          name: usage.attraction.name,
          type: usage.attraction.type,
          location: usage.attraction.location,
        },
        reader: {
          id: usage.reader.id,
          code: usage.reader.code,
          position: usage.reader.position,
        },
        performed_by: usage.performedBy ? (usage.performedBy.fullName || usage.performedBy.email) : null,
      })),
      balance_events: balanceEvents.map((event) => ({
        id: event.id,
        occurred_at: event.occurredAt.toISOString(),
        money_delta: event.moneyDelta.toFixed(2),
        points_delta: event.pointsDelta,
        reason: event.reason,
        reversal_of_id: event.reversalOfId,
      })),
      prize_redemptions: prizeRedemptions.map((redemption) => ({
        id: redemption.id,
        occurred_at: redemption.createdAt.toISOString(),
        quantity: redemption.quantity,
        points_total: redemption.pointsTotal,
        item: {
          id: redemption.item.id,
          name: redemption.item.name,
          sku: redemption.item.sku,
        },
        performed_by: redemption.performedBy.fullName || redemption.performedBy.email,
      })),
      device_logs: deviceLogs.map((log) => ({
        id: log.id,
        created_at: log.createdAt.toISOString(),
        event_type: log.eventType,
        allowed: log.allowed,
        reason: log.reason,
        request_id: log.requestId,
        reader: {
          id: log.reader.id,
          code: log.reader.code,
          position: log.reader.position,
        },
      })),
    });
  });

  app.post('/admin/products', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      name?: string;
      price?: string;
      is_active?: boolean;
      analytics_category?: string;
      analytics_subcategory?: string;
      stock_available?: number | string;
    };
    const authUser = asAuthUser(req);
    const siteId = sanitizeUuid(body?.site_id);
    const name = sanitizeText(body?.name, 120);
    const analyticsCategory = sanitizeText(body?.analytics_category, 80);
    const analyticsSubcategory = sanitizeText(body?.analytics_subcategory, 80);
    const price = sanitizeMoney(body?.price ?? '');
    const rawStock = body?.stock_available;
    const stockAvailable = rawStock === undefined || rawStock === null || rawStock === ''
      ? null
      : Number.parseInt(String(rawStock), 10);

    if (!siteId || !name || !price) return fail(reply, 'VALIDATION_ERROR', 'site_id, name y price son requeridos');
    if (!analyticsCategory || !analyticsSubcategory) {
      return fail(reply, 'VALIDATION_ERROR', 'analytics_category y analytics_subcategory son requeridos para generar código');
    }
    if (stockAvailable !== null && (!Number.isFinite(stockAvailable) || stockAvailable < 0)) {
      return fail(reply, 'VALIDATION_ERROR', 'stock_available inválido');
    }
    if (!authUser?.id) return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);

    const codigo = await reserveNextItemCode({
      prisma,
      siteId,
      categoryName: analyticsCategory,
      subcategoryName: analyticsSubcategory,
      tipoOperacion: TipoOperacionVendible.PRODUCTO,
    });

    const saleCategory = mapGroupToSaleCategory(`${analyticsCategory} ${analyticsSubcategory}`);
    const categoria = await prisma.categoria.upsert({
      where: { siteId_nombre: { siteId, nombre: analyticsCategory } },
      update: { activo: true },
      create: { siteId, nombre: analyticsCategory, activo: true },
    });
    const subcategoria = await prisma.subcategoria.upsert({
      where: { siteId_categoriaId_nombre: { siteId, categoriaId: categoria.id, nombre: analyticsSubcategory } },
      update: { activo: true },
      create: { siteId, categoriaId: categoria.id, nombre: analyticsSubcategory, activo: true },
    });

    const created = await prisma.product.create({
      data: {
        siteId,
        name,
        price: new Prisma.Decimal(price),
        category: saleCategory,
        analyticsCategory,
        analyticsSubcategory,
        sku: codigo,
        isActive: body.is_active ?? true,
      },
    });

    await prisma.itemVendible.upsert({
      where: { siteId_codigo: { siteId, codigo } },
      update: {
        nombre: name,
        precioBase: new Prisma.Decimal(price),
        activo: body.is_active ?? true,
        categoriaId: categoria.id,
        subcategoriaId: subcategoria.id,
      },
      create: {
        siteId,
        categoriaId: categoria.id,
        subcategoriaId: subcategoria.id,
        codigo,
        nombre: name,
        tipoOperacion: TipoOperacionVendible.PRODUCTO,
        tieneInventario: true,
        usaSaldoElectronico: false,
        usaPuntos: false,
        precioBase: new Prisma.Decimal(price),
        activo: body.is_active ?? true,
      },
    });

    let finalStock: number | null = null;
    if (stockAvailable !== null) {
      const inventoryItem = await prisma.inventoryItem.upsert({
        where: { siteId_sku: { siteId, sku: `INV-${codigo}` } },
        update: {
          name: created.name,
          category: mapProductCategoryToInventoryCategory(created.category),
          isActive: true,
        },
        create: {
          siteId,
          sku: `INV-${codigo}`,
          name: created.name,
          category: mapProductCategoryToInventoryCategory(created.category),
          isActive: true,
        },
      });
      if (stockAvailable > 0) {
        await prisma.inventoryMovement.create({
          data: {
            siteId,
            itemId: inventoryItem.id,
            performedById: authUser.id,
            type: InventoryMovementType.OPENING_COUNT,
            quantity: stockAvailable,
            notes: `Registro inicial de inventario (${stockAvailable})`,
          },
        });
      }
      finalStock = stockAvailable;
    }

    await writeAuditLog({
      siteId,
      actorId: authUser.id,
      action: AuditAction.CREATE,
      entityType: EntityType.OTHER,
      entityId: created.id,
      after: {
        ...snapshotProductRow(created),
        stock: finalStock,
      },
    });

    return ok(reply, {
      id: created.id,
      name: created.name,
      price: created.price.toFixed(2),
      category: created.category,
      analytics_category: created.analyticsCategory,
      analytics_subcategory: created.analyticsSubcategory,
      sku: created.sku,
      is_active: created.isActive,
      stock: finalStock,
    });
  });

  app.patch('/admin/products/:id', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const id = sanitizeUuid((req.params as any).id);
    const body = req.body as {
      site_id: string;
      name?: string;
      price?: string;
      is_active?: boolean;
      analytics_category?: string;
      analytics_subcategory?: string;
      stock_available?: number | string;
    };
    const authUser = asAuthUser(req);
    const siteId = sanitizeUuid(body?.site_id);
    const name = sanitizeText(body?.name, 120);
    const analyticsCategory = sanitizeText(body?.analytics_category, 80);
    const analyticsSubcategory = sanitizeText(body?.analytics_subcategory, 80);
    const price = body?.price ? sanitizeMoney(body.price) : '';
    const rawStock = body?.stock_available;
    const stockAvailable = rawStock === undefined || rawStock === null || rawStock === ''
      ? null
      : Number.parseInt(String(rawStock), 10);
    if (!id || !siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    if (body?.price && !price) return fail(reply, 'VALIDATION_ERROR', 'price inválido');
    if (stockAvailable !== null && (!Number.isFinite(stockAvailable) || stockAvailable < 0)) {
      return fail(reply, 'VALIDATION_ERROR', 'stock_available inválido');
    }
    const product = await prisma.product.findFirst({ where: { id, siteId } });
    if (!product) return fail(reply, 'NOT_FOUND', 'Producto no encontrado', 404);

    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        name: name || product.name,
        price: price ? new Prisma.Decimal(price) : product.price,
        analyticsCategory: analyticsCategory || null,
        analyticsSubcategory: analyticsSubcategory || null,
        isActive: body.is_active ?? product.isActive,
      },
    });

    let finalStock: number | null = null;
    if (stockAvailable !== null) {
      return fail(reply, 'FORBIDDEN', 'El ajuste manual de stock solo puede hacerlo un supervisor desde movimientos de inventario', 403);
    } else if (product.sku) {
      const item = await prisma.inventoryItem.findUnique({
        where: { siteId_sku: { siteId, sku: `INV-${product.sku}` } },
      });
      if (item) {
        const stockAgg = await prisma.inventoryMovement.aggregate({
          where: { siteId, itemId: item.id },
          _sum: { quantity: true },
        });
        finalStock = Number(stockAgg._sum.quantity ?? 0);
      }
    }

    if (!authUser?.id) return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);
    await writeAuditLog({
      siteId,
      actorId: authUser.id,
      action: AuditAction.UPDATE,
      entityType: EntityType.OTHER,
      entityId: updated.id,
      before: snapshotProductRow(product),
      after: {
        ...snapshotProductRow(updated),
        stock: finalStock,
      },
    });

    return ok(reply, {
      id: updated.id,
      name: updated.name,
      price: updated.price.toFixed(2),
      analytics_category: updated.analyticsCategory,
      analytics_subcategory: updated.analyticsSubcategory,
      is_active: updated.isActive,
      stock: finalStock,
    });
  });

  app.delete('/admin/products/:id', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const id = sanitizeUuid((req.params as any).id);
    const siteId = sanitizeUuid((req.body as any)?.site_id);
    const authUser = asAuthUser(req);
    if (!id || !siteId) return fail(reply, 'VALIDATION_ERROR', 'id y site_id requeridos');
    if (!authUser?.id) return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);

    const product = await prisma.product.findFirst({ where: { id, siteId } });
    if (!product) return fail(reply, 'NOT_FOUND', 'Producto no encontrado', 404);

    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { isActive: false },
    });

    if (product.sku) {
      await prisma.itemVendible.updateMany({
        where: { siteId, codigo: product.sku },
        data: { activo: false },
      });
      await prisma.inventoryItem.updateMany({
        where: { siteId, sku: `INV-${product.sku}` },
        data: { isActive: false },
      });
    }

    await writeAuditLog({
      siteId,
      actorId: authUser.id,
      action: AuditAction.DELETE,
      entityType: EntityType.OTHER,
      entityId: updated.id,
      before: snapshotProductRow(product),
      after: {
        ...snapshotProductRow(updated),
        is_active: false,
      },
      reason: 'Eliminación lógica de producto',
    });

    return ok(reply, {
      id: updated.id,
      is_active: updated.isActive,
    });
  });

  app.get('/admin/inventory/items', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const category = parseInventoryCategory((req.query as any).category);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');

    const items = await prisma.inventoryItem.findMany({
      where: {
        siteId,
        ...(category ? { category } : {}),
      },
      orderBy: { name: 'asc' },
    });

    const movementSums = await prisma.inventoryMovement.groupBy({
      by: ['itemId'],
      where: { siteId, itemId: { in: items.map((item) => item.id) } },
      _sum: { quantity: true },
      _max: { occurredAt: true },
    });
    const stockByItemId = new Map(movementSums.map((row) => [row.itemId, Number(row._sum.quantity ?? 0)]));
    const lastMoveByItemId = new Map(movementSums.map((row) => [row.itemId, row._max.occurredAt?.toISOString() ?? null]));

    return ok(reply, items.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      is_active: item.isActive,
      stock: stockByItemId.get(item.id) ?? 0,
      last_movement_at: lastMoveByItemId.get(item.id) ?? null,
    })));
  });

  app.post('/admin/inventory/items', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      sku?: string;
      name?: string;
      category?: string;
      is_active?: boolean;
    };
    const siteId = sanitizeUuid(body?.site_id);
    const sku = sanitizeText(body?.sku, 40).toUpperCase();
    const name = sanitizeText(body?.name, 120);
    const category = parseInventoryCategory(body?.category);
    if (!siteId || !name || !category) {
      return fail(reply, 'VALIDATION_ERROR', 'site_id, name y category son requeridos');
    }
    const finalSku = sku || `INV-MANUAL-${name.replace(/\s+/g, '-').toUpperCase()}`;

    const item = await prisma.inventoryItem.upsert({
      where: { siteId_sku: { siteId, sku: finalSku } },
      update: {
        name,
        category,
        isActive: body?.is_active ?? true,
      },
      create: {
        siteId,
        sku: finalSku,
        name,
        category,
        isActive: body?.is_active ?? true,
      },
    });

    return ok(reply, {
      id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      is_active: item.isActive,
    });
  });

  app.post('/admin/inventory/movements', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      item_id: string;
      type?: string;
      quantity: number | string;
      unit_cost?: string;
      reason?: string;
      observations?: string;
      occurred_at?: string;
    };
    const authUser = asAuthUser(req);
    const siteId = sanitizeUuid(body?.site_id);
    const itemId = sanitizeUuid(body?.item_id);
    const type = parseInventoryMovementType(body?.type);
    const reason = parseInventoryReason(body?.reason);
    const observations = sanitizeText(body?.observations, 240);
    const quantity = Number.parseInt(String(body?.quantity ?? ''), 10);
    const unitCost = body?.unit_cost ? sanitizeMoney(body.unit_cost) : '';
    const occurredAtRaw = sanitizeText(body?.occurred_at, 40);
    const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : new Date();

    if (!authUser?.id) return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);
    try {
      ensureSupervisorManualAdjustment(authUser);
    } catch (error) {
      if (error instanceof Error && error.message === 'FORBIDDEN_SUPERVISOR_ONLY') {
        return fail(reply, 'FORBIDDEN', 'Solo supervisor puede registrar ajustes manuales', 403);
      }
      return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);
    }
    if (!siteId || !itemId || !type || !Number.isFinite(quantity) || quantity === 0) {
      return fail(reply, 'VALIDATION_ERROR', 'site_id, item_id, type y quantity son requeridos');
    }
    if (!reason) {
      return fail(
        reply,
        'VALIDATION_ERROR',
        `reason inválido. Opciones: ${INVENTORY_REASON_OPTIONS.join(', ')}`
      );
    }
    if (reason !== 'NUEVA_COMPRA' && !observations) {
      return fail(reply, 'VALIDATION_ERROR', 'observations es obligatorio para ajustes manuales por inconsistencias');
    }
    if (occurredAtRaw && Number.isNaN(occurredAt.getTime())) {
      return fail(reply, 'VALIDATION_ERROR', 'occurred_at inválido');
    }

    const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, siteId } });
    if (!item) return fail(reply, 'NOT_FOUND', 'Ítem de inventario no encontrado', 404);

    const balanceBeforeAgg = await prisma.inventoryMovement.aggregate({
      where: { siteId, itemId },
      _sum: { quantity: true },
    });
    const balanceBefore = Number(balanceBeforeAgg._sum.quantity ?? 0);

    const movement = await prisma.inventoryMovement.create({
      data: {
        siteId,
        itemId,
        performedById: authUser.id,
        type,
        quantity,
        unitCost: unitCost ? new Prisma.Decimal(unitCost) : null,
            notes: buildInventoryNote(reason, observations),
        occurredAt,
      },
      include: {
        performedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    const balance = await prisma.inventoryMovement.aggregate({
      where: { siteId, itemId },
      _sum: { quantity: true },
    });
    const balanceAfter = Number(balance._sum.quantity ?? 0);

    await writeAuditLog({
      siteId,
      actorId: authUser.id,
      action: AuditAction.ADJUST,
      entityType: EntityType.INVENTORY_MOVEMENT,
      entityId: movement.id,
      reason,
      before: {
        item_id: itemId,
        balance: balanceBefore,
      },
      after: {
        item_id: itemId,
        movement_type: type,
        quantity,
        reason,
        observations,
        balance: balanceAfter,
      },
    });

    return ok(reply, {
      id: movement.id,
      item_id: movement.itemId,
      type: movement.type,
      quantity: movement.quantity,
      unit_cost: movement.unitCost?.toFixed(2) ?? null,
      reason,
      observations,
      occurred_at: movement.occurredAt.toISOString(),
      performed_by: movement.performedBy.fullName || movement.performedBy.email,
      balance_after: balanceAfter,
    });
  });

  app.post('/admin/inventory/movements/register', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      item_id: string;
      quantity: number | string;
      unit_cost?: string;
      reason?: string;
      observations?: string;
      occurred_at?: string;
    };
    const authUser = asAuthUser(req);
    const siteId = sanitizeUuid(body?.site_id);
    const itemId = sanitizeUuid(body?.item_id);
    const qty = Number.parseInt(String(body?.quantity ?? ''), 10);
    const unitCost = body?.unit_cost ? sanitizeMoney(body.unit_cost) : '';
    const reason = parseInventoryReason(body?.reason);
    const observations = sanitizeText(body?.observations, 240);
    const occurredAtRaw = sanitizeText(body?.occurred_at, 40);
    const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : new Date();
    if (!authUser?.id) return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);
    try {
      ensureSupervisorManualAdjustment(authUser);
    } catch (error) {
      if (error instanceof Error && error.message === 'FORBIDDEN_SUPERVISOR_ONLY') {
        return fail(reply, 'FORBIDDEN', 'Solo supervisor puede registrar inventario manual', 403);
      }
      return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);
    }
    if (!siteId || !itemId) return fail(reply, 'VALIDATION_ERROR', 'site_id e item_id son requeridos');
    if (!reason) {
      return fail(
        reply,
        'VALIDATION_ERROR',
        `reason inválido. Opciones: ${INVENTORY_REASON_OPTIONS.join(', ')}`
      );
    }
    if (reason !== 'NUEVA_COMPRA' && !observations) {
      return fail(reply, 'VALIDATION_ERROR', 'observations es obligatorio para ajustes manuales por inconsistencias');
    }
    if (!Number.isFinite(qty) || qty <= 0) return fail(reply, 'VALIDATION_ERROR', 'quantity debe ser mayor a 0');
    if (occurredAtRaw && Number.isNaN(occurredAt.getTime())) {
      return fail(reply, 'VALIDATION_ERROR', 'occurred_at inválido');
    }

    const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, siteId } });
    if (!item) return fail(reply, 'NOT_FOUND', 'Ítem de inventario no encontrado', 404);

    const balanceBeforeAgg = await prisma.inventoryMovement.aggregate({
      where: { siteId, itemId },
      _sum: { quantity: true },
    });
    const balanceBefore = Number(balanceBeforeAgg._sum.quantity ?? 0);

    const movement = await prisma.inventoryMovement.create({
      data: {
        siteId,
        itemId,
        performedById: authUser.id,
        type: 'OPENING_COUNT',
        quantity: qty,
        unitCost: unitCost ? new Prisma.Decimal(unitCost) : null,
        notes: `Registro inicial: ${buildInventoryNote(reason, observations)}`,
        occurredAt,
      },
      include: {
        performedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    const balance = await prisma.inventoryMovement.aggregate({
      where: { siteId, itemId },
      _sum: { quantity: true },
    });
    const balanceAfter = Number(balance._sum.quantity ?? 0);

    await writeAuditLog({
      siteId,
      actorId: authUser.id,
      action: AuditAction.CREATE,
      entityType: EntityType.INVENTORY_MOVEMENT,
      entityId: movement.id,
      reason,
      before: {
        item_id: itemId,
        balance: balanceBefore,
      },
      after: {
        item_id: itemId,
        movement_type: 'OPENING_COUNT',
        quantity: qty,
        reason,
        observations,
        balance: balanceAfter,
      },
    });

    return ok(reply, {
      id: movement.id,
      item_id: movement.itemId,
      type: movement.type,
      quantity: movement.quantity,
      unit_cost: movement.unitCost?.toFixed(2) ?? null,
      reason,
      observations,
      occurred_at: movement.occurredAt.toISOString(),
      performed_by: movement.performedBy.fullName || movement.performedBy.email,
      balance_after: balanceAfter,
    });
  });

  app.get('/admin/inventory/kardex', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const itemId = sanitizeUuid((req.query as any).item_id);
    const limit = Math.min(Math.max(Number.parseInt(String((req.query as any).limit ?? '200'), 10) || 200, 1), 500);
    if (!siteId || !itemId) return fail(reply, 'VALIDATION_ERROR', 'site_id e item_id requeridos');

    const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, siteId } });
    if (!item) return fail(reply, 'NOT_FOUND', 'Ítem de inventario no encontrado', 404);

    const movementsAsc = await prisma.inventoryMovement.findMany({
      where: { siteId, itemId },
      orderBy: { occurredAt: 'asc' },
      include: {
        performedBy: { select: { fullName: true, email: true } },
      },
      take: limit,
    });

    let running = 0;
    const rows = movementsAsc.map((movement) => {
      running += movement.quantity;
      const parsedNote = parseInventoryNote(movement.notes);
      return {
        id: movement.id,
        occurred_at: movement.occurredAt.toISOString(),
        type: movement.type,
        quantity: movement.quantity,
        unit_cost: movement.unitCost?.toFixed(2) ?? null,
        reason: parsedNote.reason,
        observations: parsedNote.observations,
        performed_by: movement.performedBy.fullName || movement.performedBy.email,
        saldo: running,
      };
    });

    return ok(reply, {
      item: {
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
      },
      kardex: rows,
      saldo_actual: running,
    });
  });

  app.get('/admin/inventory/report', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const exportFormat = sanitizeText((req.query as any).export, 10).toLowerCase();
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');

    const items = await prisma.inventoryItem.findMany({
      where: { siteId },
      orderBy: { name: 'asc' },
      take: 5000,
    });
    const itemIds = items.map((item) => item.id);
    const [sums, movementsDesc] = await Promise.all([
      prisma.inventoryMovement.groupBy({
        by: ['itemId'],
        where: { siteId, itemId: { in: itemIds } },
        _sum: { quantity: true },
      }),
      prisma.inventoryMovement.findMany({
        where: { siteId, itemId: { in: itemIds } },
        orderBy: { occurredAt: 'desc' },
        include: { performedBy: { select: { fullName: true, email: true } } },
        take: 15000,
      }),
    ]);

    const sumMap = new Map(sums.map((row) => [row.itemId, Number(row._sum.quantity ?? 0)]));
    const lastMoveByItemId = new Map<string, (typeof movementsDesc)[number]>();
    for (const movement of movementsDesc) {
      if (!lastMoveByItemId.has(movement.itemId)) lastMoveByItemId.set(movement.itemId, movement);
    }

    const data = items.map((item) => {
      const stock = sumMap.get(item.id) ?? 0;
      const lastMove = lastMoveByItemId.get(item.id);
      const parsedNote = parseInventoryNote(lastMove?.notes);
      return {
        item_id: item.id,
        sku: item.sku ?? '',
        name: item.name,
        category: item.category,
        is_active: item.isActive ? 'SI' : 'NO',
        stock,
        last_movement_at: lastMove?.occurredAt.toISOString() ?? '',
        last_quantity: lastMove?.quantity ?? 0,
        last_type: lastMove?.type ?? '',
        last_reason: parsedNote.reason,
        last_observations: parsedNote.observations,
        last_performed_by: lastMove ? (lastMove.performedBy.fullName || lastMove.performedBy.email) : '',
      };
    });

    if (exportFormat === 'excel') {
      const headers = [
        'item_id',
        'sku',
        'name',
        'category',
        'is_active',
        'stock',
        'last_movement_at',
        'last_quantity',
        'last_type',
        'last_reason',
        'last_observations',
        'last_performed_by',
      ];
      const csv = [
        headers.join(','),
        ...data.map((row) => headers.map((header) => `"${String((row as any)[header] ?? '').replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      reply.header('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      reply.header(
        'Content-Disposition',
        `attachment; filename="reporte-inventario-${new Date().toISOString().slice(0, 10)}.csv"`
      );
      return reply.send(csv);
    }

    return ok(reply, {
      total_items: data.length,
      data,
    });
  });

  app.get('/admin/catalog/categories', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const categories = await prisma.categoria.findMany({
      where: { siteId },
      orderBy: { nombre: 'asc' },
    });
    return ok(reply, categories.map((category) => ({
      id: category.id,
      codigo: category.codigo,
      nombre: category.nombre,
      activo: category.activo,
    })));
  });

  app.get('/admin/promotions', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const scope = parsePromotionScope((req.query as any).scope);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const promotions = await prisma.promotion.findMany({
      where: {
        siteId,
        ...(scope ? { scope } : {}),
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
    return ok(reply, promotions.map((promotion) => ({
      id: promotion.id,
      code: promotion.code,
      name: promotion.name,
      description: promotion.description,
      type: promotion.type,
      scope: promotion.scope,
      is_active: promotion.isActive,
      priority: promotion.priority,
      starts_at: promotion.startsAt?.toISOString() ?? null,
      ends_at: promotion.endsAt?.toISOString() ?? null,
      percent_value: promotion.percentValue?.toFixed(4) ?? null,
      fixed_value: promotion.fixedValue?.toFixed(2) ?? null,
      exact_values: promotion.exactValues ?? null,
      day_restrictions: promotion.dayRestrictions ?? null,
      product_restrictions: promotion.productRestrictions ?? null,
      exceptions: promotion.exceptions ?? null,
      metadata: promotion.metadata ?? null,
    })));
  });

  app.post('/admin/promotions', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      code: string;
      name: string;
      description?: string;
      type: string;
      scope: string;
      is_active?: boolean;
      priority?: number;
      starts_at?: string;
      ends_at?: string;
      percent_value?: string;
      fixed_value?: string;
      exact_values?: unknown;
      day_restrictions?: unknown;
      product_restrictions?: unknown;
      exceptions?: unknown;
      metadata?: unknown;
    };
    const authUser = asAuthUser(req);
    const siteId = sanitizeUuid(body?.site_id);
    const code = sanitizeText(body?.code, 30).toUpperCase();
    const name = sanitizeText(body?.name, 120);
    const description = sanitizeText(body?.description, 240);
    const type = parsePromotionType(body?.type);
    const scope = parsePromotionScope(body?.scope);
    const startsAt = sanitizeText(body?.starts_at, 40);
    const endsAt = sanitizeText(body?.ends_at, 40);
    const percentValue = sanitizeMoney(body?.percent_value ?? '');
    const fixedValue = sanitizeMoney(body?.fixed_value ?? '');
    const priority = Number.isFinite(Number(body?.priority)) ? Number(body?.priority) : 100;
    if (!siteId || !code || !name || !type || !scope) {
      return fail(reply, 'VALIDATION_ERROR', 'site_id, code, name, type y scope requeridos');
    }
    if (!authUser?.id) return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);

    const parsedStartsAt = startsAt ? new Date(startsAt) : null;
    const parsedEndsAt = endsAt ? new Date(endsAt) : null;
    if ((parsedStartsAt && Number.isNaN(parsedStartsAt.getTime())) || (parsedEndsAt && Number.isNaN(parsedEndsAt.getTime()))) {
      return fail(reply, 'VALIDATION_ERROR', 'Rango de fechas inválido');
    }

    if (type === 'RECHARGE_ADDITIONAL') {
      if (scope !== 'RECHARGE') return fail(reply, 'VALIDATION_ERROR', 'RECHARGE_ADDITIONAL requiere scope RECHARGE');
      if (!/^RECA-\d{3}$/.test(code)) return fail(reply, 'VALIDATION_ERROR', 'Las promociones de recarga deben usar código RECA-00X');
      const exactValues = parseNumberArray(body?.exact_values);
      if (exactValues.length === 0) return fail(reply, 'VALIDATION_ERROR', 'RECA requiere exact_values');
      const fixed = fixedValue ? new Prisma.Decimal(fixedValue) : new Prisma.Decimal(0);
      if (fixed.lte(0)) return fail(reply, 'VALIDATION_ERROR', 'RECA requiere fixed_value mayor a 0');
    } else if (scope === 'SALE') {
      if (!/^PROM-\d{3}$/.test(code)) {
        return fail(reply, 'VALIDATION_ERROR', 'Las promociones de parque deben usar código PROM-00X');
      }
    }

    const promotion = await prisma.promotion.create({
      data: {
        siteId,
        code,
        name,
        description: description || null,
        type,
        scope,
        isActive: body?.is_active ?? true,
        priority,
        startsAt: parsedStartsAt,
        endsAt: parsedEndsAt,
        percentValue: percentValue ? new Prisma.Decimal(percentValue) : null,
        fixedValue: fixedValue ? new Prisma.Decimal(fixedValue) : null,
        exactValues: body?.exact_values ? (body.exact_values as Prisma.InputJsonValue) : null,
        dayRestrictions: body?.day_restrictions ? (body.day_restrictions as Prisma.InputJsonValue) : null,
        productRestrictions: body?.product_restrictions ? (body.product_restrictions as Prisma.InputJsonValue) : null,
        exceptions: body?.exceptions ? (body.exceptions as Prisma.InputJsonValue) : null,
        metadata: body?.metadata ? (body.metadata as Prisma.InputJsonValue) : null,
      },
    });

    await writeAuditLog({
      siteId,
      actorId: authUser.id,
      action: AuditAction.CREATE,
      entityType: EntityType.OTHER,
      entityId: promotion.id,
      after: {
        code: promotion.code,
        name: promotion.name,
        type: promotion.type,
        scope: promotion.scope,
        is_active: promotion.isActive,
        priority: promotion.priority,
      },
    });

    return ok(reply, {
      id: promotion.id,
      code: promotion.code,
      name: promotion.name,
      type: promotion.type,
      scope: promotion.scope,
      is_active: promotion.isActive,
    });
  });

  app.patch('/admin/promotions/:id', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const id = sanitizeUuid((req.params as any).id);
    const body = req.body as {
      site_id: string;
      name?: string;
      description?: string;
      is_active?: boolean;
      priority?: number;
      starts_at?: string;
      ends_at?: string;
      percent_value?: string;
      fixed_value?: string;
      exact_values?: unknown;
      day_restrictions?: unknown;
      product_restrictions?: unknown;
      exceptions?: unknown;
      metadata?: unknown;
    };
    const authUser = asAuthUser(req);
    const siteId = sanitizeUuid(body?.site_id);
    if (!id || !siteId) return fail(reply, 'VALIDATION_ERROR', 'id y site_id requeridos');
    if (!authUser?.id) return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);
    const current = await prisma.promotion.findFirst({ where: { id, siteId } });
    if (!current) return fail(reply, 'NOT_FOUND', 'Promoción no encontrada', 404);

    const startsAt = sanitizeText(body?.starts_at, 40);
    const endsAt = sanitizeText(body?.ends_at, 40);
    const parsedStartsAt = startsAt ? new Date(startsAt) : undefined;
    const parsedEndsAt = endsAt ? new Date(endsAt) : undefined;
    if ((parsedStartsAt && Number.isNaN(parsedStartsAt.getTime())) || (parsedEndsAt && Number.isNaN(parsedEndsAt.getTime()))) {
      return fail(reply, 'VALIDATION_ERROR', 'Rango de fechas inválido');
    }

    const fixedValue = sanitizeMoney(body?.fixed_value ?? '');
    const exactValues = body?.exact_values !== undefined ? parseNumberArray(body.exact_values) : null;
    if (current.type === 'RECHARGE_ADDITIONAL') {
      const fixed = fixedValue ? new Prisma.Decimal(fixedValue) : current.fixedValue ?? new Prisma.Decimal(0);
      if (fixed.lte(0)) return fail(reply, 'VALIDATION_ERROR', 'RECA requiere fixed_value mayor a 0');
      const exact = exactValues ?? parseNumberArray(current.exactValues);
      if (exact.length === 0) return fail(reply, 'VALIDATION_ERROR', 'RECA requiere exact_values');
    }

    const updated = await prisma.promotion.update({
      where: { id: current.id },
      data: {
        name: body?.name ? sanitizeText(body.name, 120) : undefined,
        description: body?.description !== undefined ? (sanitizeText(body.description, 240) || null) : undefined,
        isActive: body?.is_active ?? undefined,
        priority: Number.isFinite(Number(body?.priority)) ? Number(body?.priority) : undefined,
        startsAt: parsedStartsAt,
        endsAt: parsedEndsAt,
        percentValue: body?.percent_value !== undefined ? (sanitizeMoney(body.percent_value) ? new Prisma.Decimal(sanitizeMoney(body.percent_value)) : null) : undefined,
        fixedValue: body?.fixed_value !== undefined ? (fixedValue ? new Prisma.Decimal(fixedValue) : null) : undefined,
        exactValues: body?.exact_values !== undefined ? (body.exact_values ? (body.exact_values as Prisma.InputJsonValue) : null) : undefined,
        dayRestrictions: body?.day_restrictions !== undefined ? (body.day_restrictions ? (body.day_restrictions as Prisma.InputJsonValue) : null) : undefined,
        productRestrictions: body?.product_restrictions !== undefined ? (body.product_restrictions ? (body.product_restrictions as Prisma.InputJsonValue) : null) : undefined,
        exceptions: body?.exceptions !== undefined ? (body.exceptions ? (body.exceptions as Prisma.InputJsonValue) : null) : undefined,
        metadata: body?.metadata !== undefined ? (body.metadata ? (body.metadata as Prisma.InputJsonValue) : null) : undefined,
      },
    });

    await writeAuditLog({
      siteId,
      actorId: authUser.id,
      action: AuditAction.UPDATE,
      entityType: EntityType.OTHER,
      entityId: updated.id,
      before: {
        code: current.code,
        name: current.name,
        type: current.type,
        scope: current.scope,
        is_active: current.isActive,
        priority: current.priority,
      },
      after: {
        code: updated.code,
        name: updated.name,
        type: updated.type,
        scope: updated.scope,
        is_active: updated.isActive,
        priority: updated.priority,
      },
    });

    return ok(reply, {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      type: updated.type,
      scope: updated.scope,
      is_active: updated.isActive,
    });
  });

  app.post('/admin/catalog/categories', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      codigo?: string;
      nombre: string;
      activo?: boolean;
    };
    const siteId = sanitizeUuid(body?.site_id);
    const codigo = sanitizeText(body?.codigo, 20).toUpperCase();
    const nombre = sanitizeText(body?.nombre, 120);
    if (!siteId || !nombre) return fail(reply, 'VALIDATION_ERROR', 'site_id y nombre son requeridos');

    const category = await prisma.categoria.upsert({
      where: { siteId_nombre: { siteId, nombre } },
      update: {
        codigo: codigo || null,
        activo: body?.activo ?? true,
      },
      create: {
        siteId,
        codigo: codigo || null,
        nombre,
        activo: body?.activo ?? true,
      },
    });

    return ok(reply, {
      id: category.id,
      codigo: category.codigo,
      nombre: category.nombre,
      activo: category.activo,
    });
  });

  app.get('/admin/catalog/subcategories', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const categoriaId = sanitizeUuid((req.query as any).categoria_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');

    const subcategories = await prisma.subcategoria.findMany({
      where: {
        siteId,
        ...(categoriaId ? { categoriaId } : {}),
      },
      include: {
        categoria: true,
      },
      orderBy: { nombre: 'asc' },
    });
    return ok(reply, subcategories.map((subcategory) => ({
      id: subcategory.id,
      categoria_id: subcategory.categoriaId,
      categoria_nombre: subcategory.categoria.nombre,
      codigo: subcategory.codigo,
      nombre: subcategory.nombre,
      activo: subcategory.activo,
    })));
  });

  app.post('/admin/catalog/subcategories', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      categoria_id: string;
      codigo?: string;
      nombre: string;
      activo?: boolean;
    };
    const siteId = sanitizeUuid(body?.site_id);
    const categoriaId = sanitizeUuid(body?.categoria_id);
    const codigo = sanitizeText(body?.codigo, 20).toUpperCase();
    const nombre = sanitizeText(body?.nombre, 120);
    if (!siteId || !categoriaId || !nombre) return fail(reply, 'VALIDATION_ERROR', 'site_id, categoria_id y nombre son requeridos');

    const category = await prisma.categoria.findFirst({ where: { id: categoriaId, siteId } });
    if (!category) return fail(reply, 'NOT_FOUND', 'Categoría no encontrada', 404);

    const subcategory = await prisma.subcategoria.upsert({
      where: { siteId_categoriaId_nombre: { siteId, categoriaId, nombre } },
      update: {
        codigo: codigo || null,
        activo: body?.activo ?? true,
      },
      create: {
        siteId,
        categoriaId,
        codigo: codigo || null,
        nombre,
        activo: body?.activo ?? true,
      },
    });

    return ok(reply, {
      id: subcategory.id,
      categoria_id: subcategory.categoriaId,
      codigo: subcategory.codigo,
      nombre: subcategory.nombre,
      activo: subcategory.activo,
    });
  });

  app.get('/admin/catalog/items', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const items = await prisma.itemVendible.findMany({
      where: { siteId },
      include: {
        categoria: true,
        subcategoria: true,
      },
      orderBy: { nombre: 'asc' },
    });
    return ok(reply, items.map((item) => ({
      id: item.id,
      categoria_id: item.categoriaId,
      categoria_nombre: item.categoria.nombre,
      subcategoria_id: item.subcategoriaId,
      subcategoria_nombre: item.subcategoria.nombre,
      codigo: item.codigo,
      nombre: item.nombre,
      tipo_operacion: item.tipoOperacion,
      tiene_inventario: item.tieneInventario,
      usa_saldo_electronico: item.usaSaldoElectronico,
      usa_puntos: item.usaPuntos,
      precio_base: item.precioBase.toFixed(2),
      activo: item.activo,
    })));
  });

  app.post('/admin/catalog/items', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      categoria_id: string;
      subcategoria_id: string;
      codigo?: string;
      nombre: string;
      tipo_operacion: 'PRODUCTO' | 'SERVICIO' | 'USO' | 'PROGRAMA' | 'EVENTO';
      tiene_inventario?: boolean;
      usa_saldo_electronico?: boolean;
      usa_puntos?: boolean;
      precio_base: string;
      activo?: boolean;
    };

    const siteId = sanitizeUuid(body?.site_id);
    const categoriaId = sanitizeUuid(body?.categoria_id);
    const subcategoriaId = sanitizeUuid(body?.subcategoria_id);
    const nombre = sanitizeText(body?.nombre, 160);
    const tipoOperacion = sanitizeText(body?.tipo_operacion, 20) as 'PRODUCTO' | 'SERVICIO' | 'USO' | 'PROGRAMA' | 'EVENTO';
    const precioBase = sanitizeMoney(body?.precio_base);
    const codigoManual = sanitizeText(body?.codigo, 20).toUpperCase();

    if (!siteId || !categoriaId || !subcategoriaId || !nombre || !tipoOperacion || !precioBase) {
      return fail(reply, 'VALIDATION_ERROR', 'Campos obligatorios incompletos');
    }
    if (!['PRODUCTO', 'SERVICIO', 'USO', 'PROGRAMA', 'EVENTO'].includes(tipoOperacion)) {
      return fail(reply, 'VALIDATION_ERROR', 'tipo_operacion inválido');
    }

    const [category, subcategory] = await Promise.all([
      prisma.categoria.findFirst({ where: { id: categoriaId, siteId } }),
      prisma.subcategoria.findFirst({ where: { id: subcategoriaId, siteId, categoriaId } }),
    ]);
    if (!category) return fail(reply, 'NOT_FOUND', 'Categoría no encontrada', 404);
    if (!subcategory) return fail(reply, 'NOT_FOUND', 'Subcategoría no encontrada para la categoría', 404);

    let codigo = '';
    try {
      codigo = codigoManual
        ? await validateAndReserveManualCode({
            prisma,
            siteId,
            code: codigoManual,
            categoryName: category.nombre,
            subcategoryName: subcategory.nombre,
            tipoOperacion,
          })
        : await reserveNextItemCode({
            prisma,
            siteId,
            categoryName: category.nombre,
            subcategoryName: subcategory.nombre,
            tipoOperacion,
          });
    } catch (error: any) {
      return fail(reply, 'VALIDATION_ERROR', error?.message || 'Código inválido');
    }

    const item = await prisma.itemVendible.create({
      data: {
        siteId,
        categoriaId,
        subcategoriaId,
        codigo,
        nombre,
        tipoOperacion,
        tieneInventario: toBool(body?.tiene_inventario, false),
        usaSaldoElectronico: toBool(body?.usa_saldo_electronico, false),
        usaPuntos: toBool(body?.usa_puntos, false),
        precioBase: new Prisma.Decimal(precioBase),
        activo: toBool(body?.activo, true),
      },
    });

    return ok(reply, {
      id: item.id,
      categoria_id: item.categoriaId,
      subcategoria_id: item.subcategoriaId,
      codigo: item.codigo,
      nombre: item.nombre,
      tipo_operacion: item.tipoOperacion,
      tiene_inventario: item.tieneInventario,
      usa_saldo_electronico: item.usaSaldoElectronico,
      usa_puntos: item.usaPuntos,
      precio_base: item.precioBase.toFixed(2),
      activo: item.activo,
    });
  });

  app.patch('/admin/catalog/items/:id', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const id = sanitizeUuid((req.params as any).id);
    const body = req.body as {
      site_id: string;
      categoria_id?: string;
      subcategoria_id?: string;
      codigo?: string;
      nombre?: string;
      tipo_operacion?: 'PRODUCTO' | 'SERVICIO' | 'USO' | 'PROGRAMA' | 'EVENTO';
      tiene_inventario?: boolean;
      usa_saldo_electronico?: boolean;
      usa_puntos?: boolean;
      precio_base?: string;
      activo?: boolean;
      regenerar_codigo?: boolean;
    };
    const siteId = sanitizeUuid(body?.site_id);
    const categoriaId = body?.categoria_id ? sanitizeUuid(body.categoria_id) : '';
    const subcategoriaId = body?.subcategoria_id ? sanitizeUuid(body.subcategoria_id) : '';
    const nombre = sanitizeText(body?.nombre, 160);
    const tipoOperacion = body?.tipo_operacion ? sanitizeText(body.tipo_operacion, 20) as 'PRODUCTO' | 'SERVICIO' | 'USO' | 'PROGRAMA' | 'EVENTO' : undefined;
    const precioBase = body?.precio_base ? sanitizeMoney(body.precio_base) : '';
    const codigoManual = sanitizeText(body?.codigo, 20).toUpperCase();
    const regenerateCode = toBool(body?.regenerar_codigo, false);

    if (!id || !siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    if (body?.precio_base && !precioBase) return fail(reply, 'VALIDATION_ERROR', 'precio_base inválido');

    const current = await prisma.itemVendible.findFirst({ where: { id, siteId } });
    if (!current) return fail(reply, 'NOT_FOUND', 'Ítem no encontrado', 404);

    const nextCategoriaId = categoriaId || current.categoriaId;
    const nextSubcategoriaId = subcategoriaId || current.subcategoriaId;
    const nextTipoOperacion = (tipoOperacion || current.tipoOperacion) as 'PRODUCTO' | 'SERVICIO' | 'USO' | 'PROGRAMA' | 'EVENTO';

    const [category, subcategory] = await Promise.all([
      prisma.categoria.findFirst({ where: { id: nextCategoriaId, siteId } }),
      prisma.subcategoria.findFirst({ where: { id: nextSubcategoriaId, siteId, categoriaId: nextCategoriaId } }),
    ]);
    if (!category) return fail(reply, 'NOT_FOUND', 'Categoría no encontrada', 404);
    if (!subcategory) return fail(reply, 'NOT_FOUND', 'Subcategoría no encontrada para la categoría', 404);

    let codigo = current.codigo;
    if (codigoManual || regenerateCode) {
      try {
        codigo = codigoManual
          ? await validateAndReserveManualCode({
              prisma,
              siteId,
              code: codigoManual,
              categoryName: category.nombre,
              subcategoryName: subcategory.nombre,
              tipoOperacion: nextTipoOperacion,
              currentItemId: current.id,
            })
          : await reserveNextItemCode({
              prisma,
              siteId,
              categoryName: category.nombre,
              subcategoryName: subcategory.nombre,
              tipoOperacion: nextTipoOperacion,
            });
      } catch (error: any) {
        return fail(reply, 'VALIDATION_ERROR', error?.message || 'Código inválido');
      }
    }

    const updated = await prisma.itemVendible.update({
      where: { id: current.id },
      data: {
        categoriaId: nextCategoriaId,
        subcategoriaId: nextSubcategoriaId,
        codigo,
        nombre: nombre || current.nombre,
        tipoOperacion: nextTipoOperacion,
        ...(body?.precio_base ? { precioBase: new Prisma.Decimal(precioBase) } : {}),
        ...(body?.tiene_inventario !== undefined ? { tieneInventario: toBool(body.tiene_inventario) } : {}),
        ...(body?.usa_saldo_electronico !== undefined ? { usaSaldoElectronico: toBool(body.usa_saldo_electronico) } : {}),
        ...(body?.usa_puntos !== undefined ? { usaPuntos: toBool(body.usa_puntos) } : {}),
        ...(body?.activo !== undefined ? { activo: toBool(body.activo) } : {}),
      },
    });

    return ok(reply, {
      id: updated.id,
      categoria_id: updated.categoriaId,
      subcategoria_id: updated.subcategoriaId,
      codigo: updated.codigo,
      nombre: updated.nombre,
      tipo_operacion: updated.tipoOperacion,
      tiene_inventario: updated.tieneInventario,
      usa_saldo_electronico: updated.usaSaldoElectronico,
      usa_puntos: updated.usaPuntos,
      precio_base: updated.precioBase.toFixed(2),
      activo: updated.activo,
    });
  });

  app.get('/admin/site-config', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const config = await prisma.siteConfig.findUnique({ where: { siteId } });
    if (!config) return fail(reply, 'NOT_FOUND', 'Config no encontrada', 404);
    return ok(reply, {
      min_recharge_amount: config.minRechargeAmount.toFixed(2),
      points_per_currency: config.pointsPerCurrency,
      currency_unit: config.currencyUnit,
      daily_sales_goal: config.dailySalesGoal.toFixed(2),
      credit_term_days: config.creditTermDays,
    });
  });

  app.patch('/admin/site-config', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      min_recharge_amount?: string;
      points_per_currency?: number;
      currency_unit?: number;
      daily_sales_goal?: string;
      credit_term_days?: number;
    };
    const authUser = asAuthUser(req);
    const siteId = sanitizeUuid(body?.site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    if (!authUser?.id) return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);
    const minRechargeAmount = body?.min_recharge_amount ? sanitizeMoney(body.min_recharge_amount) : '';
    const dailySalesGoal = body?.daily_sales_goal ? sanitizeMoney(body.daily_sales_goal) : '';
    const pointsPerCurrency = Number.isInteger(body?.points_per_currency) ? Number(body.points_per_currency) : undefined;
    const currencyUnit = Number.isInteger(body?.currency_unit) ? Number(body.currency_unit) : undefined;
    const creditTermDays = Number.isInteger(body?.credit_term_days) ? Number(body.credit_term_days) : undefined;
    if (body?.min_recharge_amount && !minRechargeAmount) return fail(reply, 'VALIDATION_ERROR', 'min_recharge_amount inválido');
    if (body?.daily_sales_goal && !dailySalesGoal) return fail(reply, 'VALIDATION_ERROR', 'daily_sales_goal inválido');

    const currentConfig = await prisma.siteConfig.findUnique({ where: { siteId } });
    const updated = await prisma.siteConfig.upsert({
      where: { siteId },
      update: {
        ...(minRechargeAmount ? { minRechargeAmount: new Prisma.Decimal(minRechargeAmount) } : {}),
        ...(dailySalesGoal ? { dailySalesGoal: new Prisma.Decimal(dailySalesGoal) } : {}),
        ...(typeof pointsPerCurrency === 'number' ? { pointsPerCurrency: Math.max(0, pointsPerCurrency) } : {}),
        ...(typeof currencyUnit === 'number' ? { currencyUnit: Math.max(1, currencyUnit) } : {}),
        ...(typeof creditTermDays === 'number' ? { creditTermDays: Math.max(1, creditTermDays) } : {}),
      },
      create: {
        siteId,
        minRechargeAmount: new Prisma.Decimal(minRechargeAmount || '5000'),
        pointsPerCurrency: typeof pointsPerCurrency === 'number' ? Math.max(0, pointsPerCurrency) : 1,
        currencyUnit: typeof currencyUnit === 'number' ? Math.max(1, currencyUnit) : 1000,
        dailySalesGoal: new Prisma.Decimal(dailySalesGoal || '0'),
        creditTermDays: typeof creditTermDays === 'number' ? Math.max(1, creditTermDays) : 15,
      },
    });

    await writeAuditLog({
      siteId,
      actorId: authUser.id,
      action: currentConfig ? AuditAction.UPDATE : AuditAction.CREATE,
      entityType: EntityType.OTHER,
      entityId: updated.id,
      before: currentConfig
        ? {
            min_recharge_amount: currentConfig.minRechargeAmount.toFixed(2),
            points_per_currency: currentConfig.pointsPerCurrency,
            currency_unit: currentConfig.currencyUnit,
            daily_sales_goal: currentConfig.dailySalesGoal.toFixed(2),
            credit_term_days: currentConfig.creditTermDays,
          }
        : null,
      after: {
        min_recharge_amount: updated.minRechargeAmount.toFixed(2),
        points_per_currency: updated.pointsPerCurrency,
        currency_unit: updated.currencyUnit,
        daily_sales_goal: updated.dailySalesGoal.toFixed(2),
        credit_term_days: updated.creditTermDays,
      },
    });

    return ok(reply, {
      min_recharge_amount: updated.minRechargeAmount.toFixed(2),
      points_per_currency: updated.pointsPerCurrency,
      currency_unit: updated.currencyUnit,
      daily_sales_goal: updated.dailySalesGoal.toFixed(2),
      credit_term_days: updated.creditTermDays,
    });
  });

  app.get('/admin/stations', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const { start, end } = getBogotaDayRange();

    const [stations, usagesToday] = await Promise.all([
      prisma.attraction.findMany({
        where: { siteId },
        include: {
          reader: { select: { id: true, code: true } },
          readers: { select: { id: true, code: true, position: true }, orderBy: { position: 'asc' } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.attractionUsage.groupBy({
        by: ['attractionId'],
        where: {
          siteId,
          type: 'USE',
          occurredAt: { gte: start, lt: end },
        },
        _count: { _all: true },
        _sum: { cost: true },
        _max: { occurredAt: true },
      }),
    ]);

    const usageByAttraction = new Map(
      usagesToday.map((u) => [
        u.attractionId,
        {
          uses: u._count._all,
          revenue: Number(u._sum.cost ?? 0),
          lastUseAt: u._max.occurredAt?.toISOString() ?? null,
        },
      ]),
    );

    return ok(reply, stations.map((station) => {
      const usage = usageByAttraction.get(station.id);
      return {
        id: station.id,
        code: station.code,
        name: station.name,
        status: station.status,
        maintenance_mode: station.status === 'MAINTENANCE',
        maintenance_message: station.maintenanceMessage,
        type: station.type,
        location: station.location,
        price: station.price.toFixed(2),
        duration: station.duration,
        points_reward: station.pointsReward,
        reader_assigned: station.reader ? { id: station.reader.id, code: station.reader.code } : null,
        assigned_readers: station.readers.map((reader) => ({ id: reader.id, code: reader.code, position: reader.position })),
        last_use_at: usage?.lastUseAt ?? null,
        total_uses_today: usage?.uses ?? 0,
        total_revenue_today: Number((usage?.revenue ?? 0).toFixed(2)),
      };
    }));
  });

  app.get('/admin/readers/status', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');

    const offlineThreshold = new Date(Date.now() - READER_STATUS_OFFLINE_THRESHOLD_MS);
    const readers = await prisma.reader.findMany({
      where: { siteId },
      include: {
        attraction: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            maintenanceMessage: true,
          },
        },
      },
      orderBy: [{ code: 'asc' }, { position: 'asc' }],
    });

    return ok(reply, readers.map((reader) => {
      const isOnline = Boolean(reader.lastSeenAt && reader.lastSeenAt >= offlineThreshold);

      let status = 'ONLINE';
      let issue: string | null = null;

      if (!reader.isActive) {
        status = 'READER_INACTIVE';
        issue = 'Lectora desactivada';
      } else if (reader.attraction.status === 'MAINTENANCE') {
        status = 'MACHINE_MAINTENANCE';
        issue = reader.attraction.maintenanceMessage || 'Máquina en mantenimiento';
      } else if (reader.attraction.status !== 'ACTIVE') {
        status = 'MACHINE_INACTIVE';
        issue = 'Máquina inactiva';
      } else if (!isOnline) {
        status = 'OFFLINE';
        issue = 'Sin contacto reciente con el servidor';
      }

      return {
        id: reader.id,
        code: reader.code,
        position: reader.position,
        is_active: reader.isActive,
        last_seen_at: reader.lastSeenAt?.toISOString() ?? null,
        connected: status === 'ONLINE',
        status,
        issue,
        attraction: {
          id: reader.attraction.id,
          code: reader.attraction.code,
          name: reader.attraction.name,
          status: reader.attraction.status,
        },
      };
    }));
  });

  app.post('/admin/stations', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      name?: string;
      price?: string;
      duration?: number;
      points_reward?: number;
      status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
      type?: 'TIME' | 'SKILL';
      location?: string;
      maintenance_message?: string;
    };
    const authUser = asAuthUser(req);
    const siteId = sanitizeUuid(body?.site_id);
    const name = sanitizeText(body?.name, 120);
    const price = sanitizeMoney(body?.price ?? '');
    const duration = body?.duration !== undefined ? Number(body.duration) : 0;
    const pointsReward = body?.points_reward !== undefined ? Number(body.points_reward) : 1000;
    const status = body?.status !== undefined ? parseAttractionStatus(body.status) : 'ACTIVE';
    const type = body?.type !== undefined ? parseAttractionType(body.type) : 'SKILL';
    const maintenanceMessage = sanitizeText(body?.maintenance_message, 240) || null;

    if (!siteId || !name || !price) return fail(reply, 'VALIDATION_ERROR', 'site_id, name y price son requeridos');
    if (!Number.isInteger(duration) || duration < 0) return fail(reply, 'VALIDATION_ERROR', 'duration inválida');
    if (!Number.isInteger(pointsReward) || pointsReward < 0) return fail(reply, 'VALIDATION_ERROR', 'points_reward inválido');
    if (!status) return fail(reply, 'VALIDATION_ERROR', 'status inválido');
    if (!type) return fail(reply, 'VALIDATION_ERROR', 'type inválido');
    if (!authUser?.id) return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);

    const code = await reserveNextItemCode({
      prisma,
      siteId,
      categoryName: 'Maquina',
      subcategoryName: 'General',
      tipoOperacion: TipoOperacionVendible.USO,
    });

    const created = await prisma.attraction.create({
      data: {
        siteId,
        name,
        code,
        type,
        price: new Prisma.Decimal(price),
        duration,
        pointsReward,
        status,
        location: sanitizeText(body?.location, 120) || null,
        maintenanceMessage: status === 'MAINTENANCE' ? maintenanceMessage || 'Máquina en mantenimiento' : null,
      },
      include: {
        reader: { select: { id: true, code: true } },
        readers: { select: { id: true, code: true, position: true }, orderBy: { position: 'asc' } },
      },
    });

    await writeAuditLog({
      siteId,
      actorId: authUser.id,
      action: AuditAction.CREATE,
      entityType: EntityType.OTHER,
      entityId: created.id,
      before: null,
      after: {
        code: created.code,
        name: created.name,
        type: created.type,
        price: created.price.toFixed(2),
        duration: created.duration,
        points_reward: created.pointsReward,
        status: created.status,
        maintenance_message: created.maintenanceMessage,
        location: created.location,
      },
      reason: 'Creación de máquina',
    });

    return ok(reply, {
      id: created.id,
      code: created.code,
      name: created.name,
      status: created.status,
      maintenance_mode: created.status === 'MAINTENANCE',
      maintenance_message: created.maintenanceMessage,
      type: created.type,
      location: created.location,
      price: created.price.toFixed(2),
      duration: created.duration,
      points_reward: created.pointsReward,
      reader_assigned: created.reader ? { id: created.reader.id, code: created.reader.code } : null,
      assigned_readers: created.readers.map((reader) => ({ id: reader.id, code: reader.code, position: reader.position })),
    });
  });

  app.patch('/admin/stations/:id', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const id = sanitizeUuid((req.params as any).id);
    const body = req.body as {
      site_id: string;
      price?: string;
      duration?: number;
      points_reward?: number;
      status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
      reader_id?: string | null;
      location?: string;
      name?: string;
      type?: 'TIME' | 'SKILL';
      maintenance_message?: string | null;
    };
    const authUser = asAuthUser(req);
    const siteId = sanitizeUuid(body?.site_id);
    if (!id || !siteId) return fail(reply, 'VALIDATION_ERROR', 'id y site_id requeridos');
    if (!authUser?.id) return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);

    const station = await prisma.attraction.findFirst({
      where: { id, siteId },
      include: { readers: { select: { id: true, code: true, position: true }, orderBy: { position: 'asc' } } },
    });
    if (!station) return fail(reply, 'NOT_FOUND', 'Máquina no encontrada', 404);

    const price = body?.price ? sanitizeMoney(body.price) : '';
    if (body?.price && !price) return fail(reply, 'VALIDATION_ERROR', 'price inválido');
    const duration = body?.duration !== undefined ? Number(body.duration) : undefined;
    if (duration !== undefined && (!Number.isInteger(duration) || duration < 0)) {
      return fail(reply, 'VALIDATION_ERROR', 'duration inválida');
    }
    const pointsReward = body?.points_reward !== undefined ? Number(body.points_reward) : undefined;
    if (pointsReward !== undefined && (!Number.isInteger(pointsReward) || pointsReward < 0)) {
      return fail(reply, 'VALIDATION_ERROR', 'points_reward inválido');
    }
    const status = body?.status !== undefined ? parseAttractionStatus(body.status) : undefined;
    const type = body?.type !== undefined ? parseAttractionType(body.type) : undefined;
    const maintenanceMessageProvided = body?.maintenance_message !== undefined;
    const maintenanceMessage = maintenanceMessageProvided
      ? (sanitizeText(body?.maintenance_message, 240) || null)
      : undefined;
    if (body?.status !== undefined && !status) return fail(reply, 'VALIDATION_ERROR', 'status inválido');
    if (body?.type !== undefined && !type) return fail(reply, 'VALIDATION_ERROR', 'type inválido');

    let readerId: string | null | undefined = undefined;
    if (body?.reader_id !== undefined) {
      if (body.reader_id === null || body.reader_id === '') {
        readerId = null;
      } else {
        const selectedReaderId = sanitizeUuid(body.reader_id);
        if (!selectedReaderId) return fail(reply, 'VALIDATION_ERROR', 'reader_id inválido');
        const reader = await prisma.reader.findFirst({
          where: { id: selectedReaderId, siteId, attractionId: station.id },
          select: { id: true },
        });
        if (!reader) return fail(reply, 'NOT_FOUND', 'Lector no encontrado para esta máquina', 404);
        readerId = reader.id;
      }
    }

    const updated = await prisma.attraction.update({
      where: { id: station.id },
      data: {
        ...(price ? { price: new Prisma.Decimal(price) } : {}),
        ...(duration !== undefined ? { duration } : {}),
        ...(pointsReward !== undefined ? { pointsReward } : {}),
        ...(status ? { status } : {}),
        ...(readerId !== undefined ? { readerId } : {}),
        ...(body?.location !== undefined ? { location: sanitizeText(body.location, 120) || null } : {}),
        ...(body?.name !== undefined ? { name: sanitizeText(body.name, 120) || station.name } : {}),
        ...(type ? { type } : {}),
        ...(maintenanceMessageProvided ? { maintenanceMessage } : {}),
        ...(status === 'MAINTENANCE' && !maintenanceMessageProvided
          ? { maintenanceMessage: station.maintenanceMessage || 'Máquina en mantenimiento' }
          : {}),
        ...(status && status !== 'MAINTENANCE' ? { maintenanceMessage: null } : {}),
      },
      include: {
        reader: { select: { id: true, code: true } },
        readers: { select: { id: true, code: true, position: true }, orderBy: { position: 'asc' } },
      },
    });

    await writeAuditLog({
      siteId,
      actorId: authUser.id,
      action: AuditAction.UPDATE,
      entityType: EntityType.OTHER,
      entityId: updated.id,
      before: {
        price: station.price.toFixed(2),
        duration: station.duration,
        points_reward: station.pointsReward,
        status: station.status,
        reader_id: station.readerId,
        location: station.location,
        maintenance_message: station.maintenanceMessage,
      },
      after: {
        price: updated.price.toFixed(2),
        duration: updated.duration,
        points_reward: updated.pointsReward,
        status: updated.status,
        reader_id: updated.readerId,
        location: updated.location,
        maintenance_message: updated.maintenanceMessage,
      },
    });

    return ok(reply, {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      status: updated.status,
      maintenance_mode: updated.status === 'MAINTENANCE',
      maintenance_message: updated.maintenanceMessage,
      type: updated.type,
      location: updated.location,
      price: updated.price.toFixed(2),
      duration: updated.duration,
      points_reward: updated.pointsReward,
      reader_assigned: updated.reader ? { id: updated.reader.id, code: updated.reader.code } : null,
      assigned_readers: updated.readers.map((reader) => ({ id: reader.id, code: reader.code, position: reader.position })),
    });
  });

  app.post('/admin/stations/:id/maintenance', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const id = sanitizeUuid((req.params as any).id);
    const body = req.body as {
      site_id: string;
      enabled?: boolean;
      message?: string | null;
    };
    const authUser = asAuthUser(req);
    const siteId = sanitizeUuid(body?.site_id);
    const enabled = toBool(body?.enabled, false);
    const message = sanitizeText(body?.message, 240) || null;

    if (!id || !siteId) return fail(reply, 'VALIDATION_ERROR', 'id y site_id requeridos');
    if (!authUser?.id) return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);

    const station = await prisma.attraction.findFirst({
      where: { id, siteId },
      include: {
        reader: { select: { id: true, code: true } },
        readers: { select: { id: true, code: true, position: true }, orderBy: { position: 'asc' } },
      },
    });
    if (!station) return fail(reply, 'NOT_FOUND', 'Máquina no encontrada', 404);

    const updated = await prisma.attraction.update({
      where: { id: station.id },
      data: enabled
        ? {
            status: AttractionStatus.MAINTENANCE,
            maintenanceMessage: message || station.maintenanceMessage || 'Máquina en mantenimiento',
          }
        : {
            status: AttractionStatus.ACTIVE,
            maintenanceMessage: null,
          },
      include: {
        reader: { select: { id: true, code: true } },
        readers: { select: { id: true, code: true, position: true }, orderBy: { position: 'asc' } },
      },
    });

    await writeAuditLog({
      siteId,
      actorId: authUser.id,
      action: AuditAction.UPDATE,
      entityType: EntityType.OTHER,
      entityId: updated.id,
      before: {
        status: station.status,
        maintenance_message: station.maintenanceMessage,
      },
      after: {
        status: updated.status,
        maintenance_message: updated.maintenanceMessage,
      },
      reason: enabled ? 'Activación de mantenimiento de máquina' : 'Salida de mantenimiento de máquina',
    });

    return ok(reply, {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      status: updated.status,
      maintenance_mode: updated.status === 'MAINTENANCE',
      maintenance_message: updated.maintenanceMessage,
      type: updated.type,
      location: updated.location,
      price: updated.price.toFixed(2),
      duration: updated.duration,
      points_reward: updated.pointsReward,
      reader_assigned: updated.reader ? { id: updated.reader.id, code: updated.reader.code } : null,
      assigned_readers: updated.readers.map((reader) => ({ id: reader.id, code: reader.code, position: reader.position })),
    });
  });

  app.post('/admin/stations/simulate-use', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const startedAt = Date.now();
    const body = req.body as {
      site_id: string;
      machine_id: string;
      uid: string;
      reader_id?: string;
      request_id?: string;
    };
    const siteId = sanitizeUuid(body?.site_id);
    const machineId = sanitizeUuid(body?.machine_id);
    const uid = sanitizeText(body?.uid, 40).toUpperCase();
    const requestId = sanitizeText(body?.request_id, 80) || crypto.randomUUID();
    const explicitReaderId = body?.reader_id ? sanitizeUuid(body.reader_id) : '';
    if (!siteId || !machineId || !uid) {
      return fail(reply, 'VALIDATION_ERROR', 'site_id, machine_id y uid son requeridos');
    }

    const response = await prisma.$transaction(async (tx) => {
      const machine = await tx.attraction.findFirst({
        where: { id: machineId, siteId },
        include: {
          reader: { select: { id: true, code: true } },
          readers: { select: { id: true, code: true, position: true }, orderBy: { position: 'asc' } },
        },
      });
      if (!machine) return { allowed: false as const, reason: 'MACHINE_NOT_FOUND' };
      if (machine.status === 'MAINTENANCE') {
        return {
          allowed: false as const,
          reason: 'MACHINE_MAINTENANCE',
          message: machine.maintenanceMessage || 'Máquina en mantenimiento',
        };
      }
      if (machine.status !== 'ACTIVE') return { allowed: false as const, reason: 'MACHINE_INACTIVE' };

      const selectedReader =
        (explicitReaderId
          ? machine.readers.find((reader) => reader.id === explicitReaderId)
          : null) ??
        (machine.reader ? machine.readers.find((reader) => reader.id === machine.reader?.id) : null) ??
        machine.readers[0] ??
        null;
      if (!selectedReader) return { allowed: false as const, reason: 'READER_NOT_ASSIGNED' };

      const card = await tx.card.findFirst({
        where: { uid, siteId },
        select: { id: true, status: true, creditBalance: true, pointsBalance: true },
      });
      if (!card) return { allowed: false as const, reason: 'CARD_NOT_FOUND' };
      if (card.status !== 'ACTIVE') {
        return { allowed: false as const, reason: 'CARD_INACTIVE' };
      }
      const pricing = await calculateAttractionPriceWithPromotions({
        tx,
        siteId,
        attractionCode: machine.code,
        attractionType: machine.type,
        basePrice: machine.price,
        now: new Date(),
      });
      const price = pricing.finalPrice;

      const updateResult = await tx.card.updateMany({
        where: {
          id: card.id,
          status: 'ACTIVE',
          creditBalance: { gte: price },
        },
        data: {
          creditBalance: { decrement: price },
          pointsBalance: { increment: machine.pointsReward ?? 0 },
        },
      });
      if (updateResult.count !== 1) {
        const current = await tx.card.findUnique({
          where: { id: card.id },
          select: { status: true, creditBalance: true },
        });
        if (!current || current.status !== 'ACTIVE') {
          return { allowed: false as const, reason: 'CARD_INACTIVE' };
        }
        await tx.deviceLog.create({
          data: {
            siteId,
            readerId: selectedReader.id,
            uid,
            cardId: card.id,
            activityId: machine.id,
            requestId,
            eventType: 'SIMULATOR_VALIDATE',
            allowed: false,
            reason: 'INSUFFICIENT_FUNDS',
            latency: Date.now() - startedAt,
            creditBefore: current.creditBalance,
            creditAfter: current.creditBalance,
            payload: body as any,
          },
        });
        return { allowed: false as const, reason: 'INSUFFICIENT_FUNDS' };
      }

      const updatedCard = await tx.card.findUnique({
        where: { id: card.id },
        select: { creditBalance: true, pointsBalance: true },
      });
      if (!updatedCard) return { allowed: false as const, reason: 'CARD_NOT_FOUND' };
      const balanceAfter = updatedCard.creditBalance;
      const pointsAfter = updatedCard.pointsBalance;
      const balanceBefore = updatedCard.creditBalance.add(price);
      const pointsBefore = updatedCard.pointsBalance - (machine.pointsReward ?? 0);

      const systemActor = await tx.userAssignment.findFirst({
        where: { siteId, isActive: true, user: { status: 'ACTIVE' } },
        orderBy: { createdAt: 'asc' },
        select: { userId: true },
      });
      if (!systemActor) return { allowed: false as const, reason: 'SYSTEM_ACTOR_NOT_FOUND' };

      const ledgerEvent = await tx.ledgerEvent.create({
        data: {
          siteId,
          eventType: 'ATTRACTION_USAGE',
          description: `Simulator use ${machine.code} (${pricing.appliedCodes.join(',') || 'NO_PROMO'})`,
          createdById: systemActor.userId,
          entries: {
            create: [
              { account: 'CARD_FLOAT_LIABILITY', side: 'DEBIT', amount: price },
              { account: 'SERVICE_REVENUE', side: 'CREDIT', amount: price },
            ],
          },
        },
      });

      await tx.attractionUsage.create({
        data: {
          siteId,
          cardId: card.id,
          attractionId: machine.id,
          readerId: selectedReader.id,
          cost: price,
          ledgerEventId: ledgerEvent.id,
        },
      });

      await appendCardBalanceEvent({
        tx,
        siteId,
        cardId: card.id,
        ledgerEventId: ledgerEvent.id,
        moneyDelta: price.mul(-1),
        pointsDelta: machine.pointsReward ?? 0,
        reason: 'SIMULATOR_VALIDATE',
        updateCardBalances: false,
      });
      await tx.deviceLog.create({
        data: {
          siteId,
          readerId: selectedReader.id,
          uid,
          cardId: card.id,
          activityId: machine.id,
          requestId,
          eventType: 'SIMULATOR_VALIDATE',
          allowed: true,
          reason: pricing.appliedCodes.length ? `PROMO:${pricing.appliedCodes.join(',')}` : 'OK',
          latency: Date.now() - startedAt,
          pointsBefore,
          pointsAfter,
          creditBefore: balanceBefore,
          creditAfter: balanceAfter,
          payload: body as any,
        },
      });

      return {
        allowed: true as const,
        reason: null,
        price: Number(price),
        balanceBefore: Number(balanceBefore),
        balanceAfter: Number(balanceAfter),
        pointsBefore,
        pointsAfter,
        machine: machine.name,
        transactionId: ledgerEvent.id,
      };
    });

    return ok(reply, response);
  });

  app.get('/admin/users', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const assignments = await prisma.userAssignment.findMany({
      where: { siteId, isActive: true },
      include: { user: true, role: true },
      orderBy: { createdAt: 'desc' },
    });
    return ok(reply, assignments.map((a) => ({
      id: a.user.id,
      name: a.user.fullName,
      email: a.user.email,
      role: a.role.name === 'ADMIN' ? 'admin' : a.role.name === 'SUPERVISOR' ? 'supervisor' : 'cashier',
    })));
  });

  app.post('/admin/users', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      full_name: string;
      email: string;
      role: 'admin' | 'supervisor' | 'cashier';
      pin: string;
    };
    const authUser = asAuthUser(req);

    const siteId = sanitizeUuid(body?.site_id);
    const fullName = sanitizeText(body?.full_name, 120);
    const email = sanitizeEmail(body?.email);
    const pin = sanitizeDigits(body?.pin, 8);
    if (!siteId || !fullName || !email || !body?.role || pin.length < 4) {
      return fail(reply, 'VALIDATION_ERROR', 'Campos requeridos incompletos');
    }
    if (!authUser?.id) return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);

    const roleName = body.role === 'admin' ? 'ADMIN' : body.role === 'supervisor' ? 'SUPERVISOR' : 'CASHIER';
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) return fail(reply, 'NOT_FOUND', 'Rol no encontrado', 404);

    const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
    const pinHash = await bcrypt.hash(pin, 10);
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            fullName,
            authCode: {
              upsert: {
                create: { codeHash: pinHash, expiresAt },
                update: { codeHash: pinHash, expiresAt, failedAttempts: 0, lockedUntil: null },
              },
            },
          },
        })
      : await prisma.user.create({
          data: {
            email,
            fullName,
            passwordHash,
            authCode: { create: { codeHash: pinHash, expiresAt } },
          },
        });

    const assignment = await prisma.userAssignment.findFirst({
      where: { userId: user.id, siteId },
    });
    if (assignment) {
      await prisma.userAssignment.update({
        where: { id: assignment.id },
        data: { roleId: role.id, isActive: true },
      });
    } else {
      await prisma.userAssignment.create({
        data: { userId: user.id, siteId, roleId: role.id },
      });
    }

    await writeAuditLog({
      siteId,
      actorId: authUser.id,
      action: AuditAction.CREATE,
      entityType: EntityType.OTHER,
      entityId: user.id,
      after: {
        full_name: user.fullName,
        email: user.email,
        role: body.role,
        assignment_active: true,
      },
    });

    return ok(reply, { id: user.id });
  });

  app.patch('/admin/users/:id', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const id = sanitizeUuid((req.params as any).id);
    const body = req.body as {
      site_id: string;
      full_name?: string;
      email?: string;
      role?: 'admin' | 'supervisor' | 'cashier';
      pin?: string;
      is_active?: boolean;
    };
    const authUser = asAuthUser(req);

    const siteId = sanitizeUuid(body?.site_id);
    const fullName = sanitizeText(body?.full_name, 120);
    const email = sanitizeEmail(body?.email);
    const pin = sanitizeDigits(body?.pin, 8);
    if (!id || !siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    if (!authUser?.id) return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return fail(reply, 'NOT_FOUND', 'Usuario no encontrado', 404);
    const assignmentBefore = await prisma.userAssignment.findFirst({
      where: { userId: id, siteId },
      include: { role: true },
    });

    let roleId: string | null = null;
    if (body.role) {
      const roleName = body.role === 'admin' ? 'ADMIN' : body.role === 'supervisor' ? 'SUPERVISOR' : 'CASHIER';
      const role = await prisma.role.findUnique({ where: { name: roleName } });
      if (!role) return fail(reply, 'NOT_FOUND', 'Rol no encontrado', 404);
      roleId = role.id;
    }

    const updates: any = {};
    if (fullName) updates.fullName = fullName;
    if (email) updates.email = email;

    if (pin) {
      if (pin.length < 4) return fail(reply, 'VALIDATION_ERROR', 'pin inválido');
      const pinHash = await bcrypt.hash(pin, 10);
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      updates.authCode = {
        upsert: {
          create: { codeHash: pinHash, expiresAt },
          update: { codeHash: pinHash, expiresAt, failedAttempts: 0, lockedUntil: null },
        },
      };
    }

    await prisma.user.update({ where: { id }, data: updates });

    if (roleId || body.is_active !== undefined) {
      const assignment = await prisma.userAssignment.findFirst({
        where: { userId: id, siteId },
      });
      if (assignment) {
        await prisma.userAssignment.update({
          where: { id: assignment.id },
          data: {
            roleId: roleId ?? assignment.roleId,
            isActive: body.is_active ?? assignment.isActive,
          },
        });
      } else if (roleId) {
        await prisma.userAssignment.create({
          data: { userId: id, siteId, roleId, isActive: body.is_active ?? true },
        });
      }
    }

    const assignmentAfter = await prisma.userAssignment.findFirst({
      where: { userId: id, siteId },
      include: { role: true },
    });

    await writeAuditLog({
      siteId,
      actorId: authUser.id,
      action: AuditAction.UPDATE,
      entityType: EntityType.OTHER,
      entityId: id,
      before: {
        full_name: user.fullName,
        email: user.email,
        role: assignmentBefore?.role?.name ?? null,
        assignment_active: assignmentBefore?.isActive ?? null,
      },
      after: {
        full_name: fullName || user.fullName,
        email: email || user.email,
        role: assignmentAfter?.role?.name ?? assignmentBefore?.role?.name ?? null,
        assignment_active: assignmentAfter?.isActive ?? assignmentBefore?.isActive ?? null,
      },
      reason: body.pin ? 'PIN actualizado' : null,
    });

    return ok(reply, { id });
  });

  app.delete('/admin/users/:id', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const id = sanitizeUuid((req.params as any).id);
    const body = req.body as { site_id: string };
    const authUser = asAuthUser(req);
    const siteId = sanitizeUuid(body?.site_id);
    if (!id || !siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    if (!authUser?.id) return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);
    const assignment = await prisma.userAssignment.findFirst({
      where: { userId: id, siteId },
      include: { role: true },
    });
    if (!assignment) return fail(reply, 'NOT_FOUND', 'Asignación no encontrada', 404);
    await prisma.userAssignment.update({
      where: { id: assignment.id },
      data: { isActive: false },
    });

    await writeAuditLog({
      siteId,
      actorId: authUser.id,
      action: AuditAction.DELETE,
      entityType: EntityType.OTHER,
      entityId: id,
      before: {
        role: assignment.role.name,
        assignment_active: true,
      },
      after: {
        role: assignment.role.name,
        assignment_active: false,
      },
      reason: 'Desactivación de usuario',
    });

    return ok(reply, { id });
  });

  app.get('/audit-logs', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const limit = parseInt(((req.query as any).limit as string) ?? '50', 10);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const logs = await prisma.auditLog.findMany({
      where: { siteId },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
    return ok(reply, logs.map((log) => ({
      id: log.id,
      created_at: log.createdAt.toISOString(),
      action: log.action,
      entity_type: log.entityType,
      entity_id: log.entityId,
      actor: log.actor.fullName,
      reason: log.reason,
      before: log.before,
      after: log.after,
    })));
  });

  app.get('/admin/esp-logs', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const siteId = (req.query as any).site_id as string;
    const limit = parseInt(((req.query as any).limit as string) ?? '100', 10);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const logs = await prisma.deviceLog.findMany({
      where: { siteId },
      include: { reader: true },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
    return ok(reply, logs.map((log) => ({
      id: log.id,
      created_at: log.createdAt.toISOString(),
      event_type: log.eventType,
      request_id: log.requestId,
      reader_code: log.reader.code,
      uid: log.uid,
      allowed: log.allowed,
      reason: log.reason,
      latency: log.latency,
      points_before: log.pointsBefore,
      points_after: log.pointsAfter,
      credit_before: log.creditBefore?.toFixed(2) ?? null,
      credit_after: log.creditAfter?.toFixed(2) ?? null,
    })));
  });
}
