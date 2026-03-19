import type { FastifyInstance } from 'fastify';
import PDFDocument from 'pdfkit';
import { CardStatus, CashMovementType, PaymentMethod, Prisma, SaleCategory, SaleStatus } from '@prisma/client';
import { prisma } from '@/backend/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, fail } from '../utils/response';
import { sanitizeText, sanitizeUuid } from '@/backend/utils/sanitize';

const D = (value: string | number | Prisma.Decimal) => new Prisma.Decimal(value);
const BOGOTA_TZ = 'America/Bogota';

function getBogotaDayRange(reference = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TZ,
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

function getBogotaDayKey(reference = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reference);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function getBogotaHour(reference = new Date()) {
  const hourRaw = new Intl.DateTimeFormat('en-GB', {
    timeZone: BOGOTA_TZ,
    hour: '2-digit',
    hour12: false,
  }).format(reference);
  const parsed = Number.parseInt(hourRaw, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 23) : 0;
}

function parseReportRange(query: Record<string, unknown>) {
  const fromRaw = sanitizeText(query.from, 30);
  const toRaw = sanitizeText(query.to, 30);
  if (!fromRaw && !toRaw) {
    const day = getBogotaDayRange();
    return { ...day, mode: 'day' as const };
  }

  const from = fromRaw ? new Date(fromRaw) : null;
  const to = toRaw ? new Date(toRaw) : null;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return null;
  }

  const start = from ?? new Date('1970-01-01T00:00:00.000Z');
  const endBase = to ?? new Date();
  // End is exclusive; add 1 day for date-only filters.
  const end = new Date(endBase.getTime() + 24 * 60 * 60 * 1000);
  if (start >= end) return null;
  return { start, end, mode: 'range' as const };
}

function formatBogotaDateKey(reference: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(reference);
}

function formatBogotaMonthKey(reference: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(reference);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  return `${year}-${month}`;
}

function countDaysInRange(start: Date, end: Date) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
}

function monthLabel(key: string) {
  const [year, month] = key.split('-');
  const date = new Date(`${year}-${month}-01T00:00:00.000Z`);
  return date.toLocaleDateString('es-CO', { month: 'short', year: 'numeric', timeZone: BOGOTA_TZ });
}

function csvEscape(value: string | number | null | undefined) {
  const raw = value == null ? '' : String(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function applyStreamCorsHeaders(reply: any, origin: string | undefined) {
  if (!origin) return;
  reply.raw.setHeader('Access-Control-Allow-Origin', origin);
  reply.raw.setHeader('Vary', 'Origin');
}

function normalizePaymentMethod(method: PaymentMethod) {
  if (method === 'TRANSFER') return 'TRANSFER_ACCOUNT_1';
  if (method === 'CARD') return 'CREDIT_CARD';
  return method;
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  TRANSFER_ACCOUNT_1: 'Transferencia cuenta 1',
  TRANSFER_ACCOUNT_2: 'Transferencia cuenta 2',
  NEQUI: 'Nequi',
  CREDIT_CARD: 'Tarjeta crédito',
  CREDIT: 'Crédito',
  QR: 'QR',
  MIXED: 'Mixto',
};

function resolveCategoryGroup(line: { category: SaleCategory; product: { analyticsCategory: string | null } | null }) {
  if (line.category === 'CARD_PLASTIC' || line.category === 'RECHARGE') return 'Parque';
  if (line.product?.analyticsCategory) return line.product.analyticsCategory;
  if (line.category === 'SNACKS') return 'Snacks';
  if (line.category === 'SERVICE') return 'Programas';
  if (line.category === 'GIFT_CARD' || line.category === 'PRIZE') return 'Eventos y celebraciones';
  return 'Otros';
}

function resolveSubcategory(line: { category: SaleCategory; product: { analyticsSubcategory: string | null; name: string } | null }) {
  if (line.category === 'CARD_PLASTIC') return 'Tarjetas';
  if (line.category === 'RECHARGE') return 'Recargas';
  if (line.product?.analyticsSubcategory) return line.product.analyticsSubcategory;
  return line.product?.name ?? 'Sin subcategoría';
}

export async function reportRoutes(app: FastifyInstance) {
  app.get('/reports/dashboard/summary', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const range = parseReportRange(req.query as Record<string, unknown>);
    const requestedGroupBy = sanitizeText((req.query as any).group_by, 10).toLowerCase();
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    if (!range) return fail(reply, 'VALIDATION_ERROR', 'Rango de fechas inválido');
    const { start, end } = range;
    const groupBy = requestedGroupBy === 'month' ? 'month' : 'day';

    const [siteConfig, sales] = await Promise.all([
      prisma.siteConfig.findUnique({ where: { siteId } }),
      prisma.sale.findMany({
        where: { siteId, createdAt: { gte: start, lt: end }, status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] } },
        select: { id: true, total: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 5000,
      }),
    ]);

    const goalPerDay = Number(siteConfig?.dailySalesGoal ?? 0);
    const trendMap = new Map<string, { label: string; sales: number; transactions: number; goal: number }>();

    sales.forEach((sale) => {
      const key = groupBy === 'month' ? formatBogotaMonthKey(sale.createdAt) : formatBogotaDateKey(sale.createdAt);
      const label = groupBy === 'month'
        ? monthLabel(key)
        : new Date(`${key}T00:00:00.000Z`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: BOGOTA_TZ });
      const current = trendMap.get(key) ?? { label, sales: 0, transactions: 0, goal: 0 };
      current.sales += Number(sale.total);
      current.transactions += 1;
      trendMap.set(key, current);
    });

    Array.from(trendMap.entries()).forEach(([key, value]) => {
      value.goal = groupBy === 'month'
        ? goalPerDay * countDaysInRange(new Date(`${key}-01T00:00:00.000Z`), new Date(new Date(`${key}-01T00:00:00.000Z`).setMonth(new Date(`${key}-01T00:00:00.000Z`).getMonth() + 1)))
        : goalPerDay;
      trendMap.set(key, value);
    });

    const totalSales = sales.reduce((acc, sale) => acc + Number(sale.total), 0);
    const transactions = sales.length;
    const averageTicket = transactions > 0 ? totalSales / transactions : 0;
    const totalGoal = goalPerDay * countDaysInRange(start, end);
    const goalPct = totalGoal > 0 ? (totalSales / totalGoal) * 100 : 0;

    return ok(reply, {
      range_mode: range.mode,
      group_by: groupBy,
      summary: {
        total_sales: Number(totalSales.toFixed(2)),
        transactions,
        average_ticket: Number(averageTicket.toFixed(2)),
        goal_amount: Number(totalGoal.toFixed(2)),
        goal_pct: Number(goalPct.toFixed(2)),
        daily_goal: Number(goalPerDay.toFixed(2)),
      },
      trend: Array.from(trendMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({
        key,
        label: value.label,
        sales: Number(value.sales.toFixed(2)),
        transactions: value.transactions,
        goal: Number(value.goal.toFixed(2)),
        goal_pct: value.goal > 0 ? Number(((value.sales / value.goal) * 100).toFixed(2)) : 0,
      })),
    });
  });

  app.get('/reports/dashboard/pending', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');

    const [invoiceSales, approvalCandidates] = await Promise.all([
      prisma.sale.findMany({
        where: { siteId, status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] }, requiresElectronicInvoice: true, electronicInvoiceNumber: null },
        include: { customer: true, createdBy: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.sale.findMany({
        where: { siteId, status: SaleStatus.PARTIAL, approvedById: null, balanceDue: { gt: 0 } },
        include: { customer: true, createdBy: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    return ok(reply, {
      approvals_required_count: approvalCandidates.length,
      approvals_required: approvalCandidates.map((sale) => ({
        id: sale.id,
        created_at: sale.createdAt.toISOString(),
        label: `Venta parcial ${sale.id.slice(0, 8)}`,
        customer_name: sale.customer.fullName,
        total: sale.total.toFixed(2),
        balance_due: sale.balanceDue.toFixed(2),
        created_by: sale.createdBy.fullName,
      })),
      electronic_invoice_count: invoiceSales.length,
      electronic_invoices: invoiceSales.map((sale) => ({
        id: sale.id,
        created_at: sale.createdAt.toISOString(),
        customer_name: sale.customer.fullName,
        total: sale.total.toFixed(2),
        created_by: sale.createdBy.fullName,
        electronic_invoice_code: sale.electronicInvoiceCode ?? '',
      })),
    });
  });

  app.get('/reports/dashboard/movements', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const q = sanitizeText((req.query as any).q, 120).toLowerCase();
    const flow = sanitizeText((req.query as any).flow, 20).toLowerCase();
    const categoryFilter = sanitizeText((req.query as any).category, 120).toLowerCase();
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const range = parseReportRange(req.query as Record<string, unknown>);
    if (!range) return fail(reply, 'VALIDATION_ERROR', 'Rango de fechas inválido');
    const { start, end } = range;

    const [sales, voidedSales, cashMovements] = await Promise.all([
      prisma.sale.findMany({
        where: { siteId, createdAt: { gte: start, lt: end }, status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] } },
        include: { payments: true, lines: { include: { product: true } }, createdBy: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.sale.findMany({
        where: { siteId, status: SaleStatus.VOIDED, voidedAt: { gte: start, lt: end } },
        include: { createdBy: true, customer: true },
        orderBy: { voidedAt: 'desc' },
        take: 200,
      }),
      prisma.cashMovement.findMany({
        where: { siteId, OR: [{ createdAt: { gte: start, lt: end } }, { voidedAt: { gte: start, lt: end } }] },
        include: { createdBy: true, authorizedBy: true, voidedBy: true },
        orderBy: { createdAt: 'desc' },
        take: 400,
      }),
    ]);

    const rows: Array<Record<string, unknown>> = [];
    sales.forEach((sale) => {
      const categories = Array.from(new Set(sale.lines.map((line) => resolveCategoryGroup({ category: line.category, product: line.product }))));
      rows.push({
        id: sale.id,
        occurred_at: sale.createdAt.toISOString(),
        kind: 'SALE',
        flow: 'income',
        category: categories.join(', '),
        label: sale.lines.map((line) => line.product?.name ?? 'Producto').join(', '),
        amount: sale.total.toFixed(2),
        detail: `${sale.status} • ${sale.payments[0]?.method ?? 'N/A'}`,
        description: sale.lines.map((line) => `${line.product?.name ?? 'Producto'} x${line.quantity}`).join(' | '),
        authorized_by: sale.createdBy.fullName,
        cash_session_id: sale.cashSessionId,
        receipt_number: sale.receiptNumber ?? null,
        receipt_text: sale.receiptText ?? null,
      });
    });
    voidedSales.forEach((sale) => {
      rows.push({
        id: sale.id,
        occurred_at: (sale.voidedAt ?? sale.createdAt).toISOString(),
        kind: 'SALE_VOID',
        flow: 'expense',
        category: 'Anulación',
        label: `Venta anulada ${sale.id.slice(0, 8)}`,
        amount: sale.total.toFixed(2),
        detail: `Anulada por ${sale.createdBy.fullName}`,
        description: 'Anulación de venta',
        authorized_by: sale.createdBy.fullName,
        receipt_number: sale.receiptNumber ?? null,
        receipt_text: sale.receiptText ?? null,
      });
    });
    cashMovements.forEach((movement) => {
      rows.push({
        id: movement.id,
        occurred_at: (movement.voidedAt ?? movement.createdAt).toISOString(),
        kind: movement.voidedAt ? 'CASH_MOVEMENT_VOID' : 'CASH_MOVEMENT',
        flow: movement.type === CashMovementType.WITHDRAWAL ? 'expense' : 'adjustment',
        category: movement.type === CashMovementType.WITHDRAWAL ? 'EGRESO' : 'AJUSTE',
        label: movement.type === CashMovementType.WITHDRAWAL ? 'Egreso de caja' : 'Ajuste de caja',
        amount: movement.amount.toFixed(2),
        detail: movement.voidedAt ? `Anulado por ${movement.voidedBy?.fullName ?? 'N/A'}` : `Autorizado por ${movement.authorizedBy.fullName}`,
        description: movement.reason,
        authorized_by: movement.authorizedBy.fullName,
      });
    });

    const filtered = rows.filter((row) => {
      const searchBase = `${row.kind ?? ''} ${row.label ?? ''} ${row.detail ?? ''} ${row.description ?? ''} ${row.category ?? ''}`.toLowerCase();
      if (q && !searchBase.includes(q)) return false;
      if (flow && flow !== 'all' && row.flow !== flow) return false;
      if (categoryFilter && !String(row.category ?? '').toLowerCase().includes(categoryFilter)) return false;
      return true;
    }).sort((a, b) => new Date(String(b.occurred_at)).getTime() - new Date(String(a.occurred_at)).getTime());

    return ok(reply, { data: filtered });
  });

  app.get('/reports/dashboard/movements/export', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const flow = sanitizeText((req.query as any).flow, 20);
    const category = sanitizeText((req.query as any).category, 120);
    const q = sanitizeText((req.query as any).q, 120);
    const params = new URLSearchParams({ site_id: siteId });
    if (flow) params.set('flow', flow);
    if (category) params.set('category', category);
    if (q) params.set('q', q);
    if ((req.query as any).from) params.set('from', String((req.query as any).from));
    if ((req.query as any).to) params.set('to', String((req.query as any).to));
    const movements = await app.inject({ method: 'GET', url: `/reports/dashboard/movements?${params.toString()}`, headers: req.headers as Record<string, string> });
    const payload = movements.json();
    const rows = Array.isArray(payload?.data?.data) ? payload.data.data : [];
    const header = ['Fecha', 'Tipo', 'Flujo', 'Categoria', 'Descripcion', 'Valor', 'Autorizado por'];
    const csvRows = [header.join(','), ...rows.map((row: any) => [csvEscape(row.occurred_at), csvEscape(row.kind), csvEscape(row.flow), csvEscape(row.category), csvEscape(row.description || row.label), csvEscape(row.amount), csvEscape(row.authorized_by)].join(','))];
    reply.type('text/csv; charset=utf-8').header('Content-Disposition', `attachment; filename="movimientos-${new Date().toISOString().slice(0, 10)}.csv"`).send(csvRows.join('\n'));
  });

  app.get('/reports/dashboard/inventory', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const range = parseReportRange(req.query as Record<string, unknown>);
    if (!range) return fail(reply, 'VALIDATION_ERROR', 'Rango de fechas inválido');
    const { start, end } = range;

    const [items, movements] = await Promise.all([
      prisma.inventoryItem.findMany({ where: { siteId, isActive: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
      prisma.inventoryMovement.findMany({ where: { siteId }, orderBy: { occurredAt: 'desc' }, take: 4000 }),
    ]);

    const currentBalanceByItem = new Map<string, number>();
    const soldRangeByItem = new Map<string, number>();
    const entriesRangeByItem = new Map<string, number>();
    const lastMovementByItem = new Map<string, any>();

    movements.forEach((movement) => {
      currentBalanceByItem.set(movement.itemId, (currentBalanceByItem.get(movement.itemId) ?? 0) + movement.quantity);
      if (movement.occurredAt >= start && movement.occurredAt < end) {
        if (movement.type === 'SALE' || movement.type === 'REDEMPTION') soldRangeByItem.set(movement.itemId, (soldRangeByItem.get(movement.itemId) ?? 0) + Math.abs(movement.quantity));
        else if (movement.quantity > 0) entriesRangeByItem.set(movement.itemId, (entriesRangeByItem.get(movement.itemId) ?? 0) + movement.quantity);
      }
      if (!lastMovementByItem.has(movement.itemId)) lastMovementByItem.set(movement.itemId, movement);
    });

    const rows = items.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      category: item.category === 'CARD_PLASTIC' ? 'Parque' : item.category === 'SNACK' ? 'Snacks' : item.category === 'PRIZE' ? 'Premios' : 'Otros',
      stock_current: currentBalanceByItem.get(item.id) ?? 0,
      sold_or_redeemed: soldRangeByItem.get(item.id) ?? 0,
      entries: entriesRangeByItem.get(item.id) ?? 0,
      last_movement_at: lastMovementByItem.get(item.id)?.occurredAt?.toISOString() ?? null,
      last_notes: lastMovementByItem.get(item.id)?.notes ?? '',
    }));

    return ok(reply, {
      summary: ['Parque', 'Snacks', 'Premios'].map((category) => ({
        category,
        total_current: rows.filter((row) => row.category === category).reduce((acc, row) => acc + row.stock_current, 0),
        total_sold_or_redeemed: rows.filter((row) => row.category === category).reduce((acc, row) => acc + row.sold_or_redeemed, 0),
        items: rows.filter((row) => row.category === category),
      })),
    });
  });

  app.get('/reports/day/summary', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const { start, end } = getBogotaDayRange();

    const [siteConfig, salesAggregate, cardsSold, prizeRedemptions, outflows, openCash, deletedCount, creditSales] = await Promise.all([
      prisma.siteConfig.findUnique({ where: { siteId } }),
      prisma.sale.aggregate({
        where: {
          siteId,
          createdAt: { gte: start, lt: end },
          status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] },
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.saleLine.aggregate({
        where: {
          category: SaleCategory.CARD_PLASTIC,
          sale: { siteId, createdAt: { gte: start, lt: end }, status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] } },
        },
        _sum: { quantity: true },
      }),
      prisma.saleLine.aggregate({
        where: {
          category: SaleCategory.PRIZE,
          sale: { siteId, createdAt: { gte: start, lt: end }, status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] } },
        },
        _sum: { quantity: true },
      }),
      prisma.cashMovement.aggregate({
        where: {
          siteId,
          createdAt: { gte: start, lt: end },
          type: CashMovementType.WITHDRAWAL,
          voidedAt: null,
        },
        _sum: { amount: true },
      }),
      prisma.cashSession.aggregate({
        where: { siteId, status: 'OPEN' },
        _sum: { expectedCashAmount: true },
      }),
      prisma.sale.count({
        where: {
          siteId,
          status: SaleStatus.VOIDED,
          voidedAt: { gte: start, lt: end },
        },
      }),
      prisma.sale.findMany({
        where: {
          siteId,
          status: SaleStatus.PARTIAL,
          payments: { some: { method: PaymentMethod.CREDIT } },
        },
        include: { payments: true },
        orderBy: { createdAt: 'asc' },
        take: 300,
      }),
    ]);

    const salesToday = salesAggregate._sum.total ?? D(0);
    const dailyGoal = siteConfig?.dailySalesGoal ?? D(0);
    const goalPct = dailyGoal.gt(0) ? Number(salesToday.div(dailyGoal).mul(100).toFixed(2)) : 0;

    const cardStockMovements = await prisma.inventoryMovement.findMany({
      where: {
        siteId,
        item: { category: 'CARD_PLASTIC' },
      },
      select: { type: true, quantity: true },
      take: 2000,
    });
    const cardsStock = cardStockMovements.reduce((acc, movement) => {
      if (movement.type === 'SALE' || movement.type === 'REDEMPTION') return acc - movement.quantity;
      return acc + movement.quantity;
    }, 0);

    const creditTermDays = siteConfig?.creditTermDays ?? 15;
    const now = new Date();
    const creditsDueSoon = creditSales.filter((sale) => {
      const due = new Date(sale.createdAt.getTime() + creditTermDays * 24 * 60 * 60 * 1000);
      const diffDays = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      return diffDays >= 0 && diffDays <= 2;
    }).length;
    const creditsOverdue = creditSales.filter((sale) => {
      const due = new Date(sale.createdAt.getTime() + creditTermDays * 24 * 60 * 60 * 1000);
      return due < now;
    }).length;

    return ok(reply, {
      scope: 'day',
      sales_today: salesToday.toFixed(2),
      daily_goal: dailyGoal.toFixed(2),
      goal_pct: goalPct,
      cards_sold: Number(cardsSold._sum.quantity ?? 0),
      cards_stock: Math.max(cardsStock, 0),
      prizes_redeemed: Number(prizeRedemptions._sum.quantity ?? 0),
      cash_outflows: (outflows._sum.amount ?? D(0)).toFixed(2),
      cash_balance_expected: (openCash._sum.expectedCashAmount ?? D(0)).toFixed(2),
      deleted_transactions: deletedCount,
      modified_transactions: 0,
      transactions_count: salesAggregate._count.id,
      credit_alerts: {
        due_soon: creditsDueSoon,
        overdue: creditsOverdue,
      },
      credit_term_days: creditTermDays,
    });
  });

  app.get('/reports/day/payment-breakdown', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const metric = sanitizeText((req.query as any).metric, 20).toLowerCase() === 'count' ? 'count' : 'value';
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const { start, end } = getBogotaDayRange();

    const payments = await prisma.salePayment.findMany({
      where: {
        sale: {
          siteId,
          createdAt: { gte: start, lt: end },
          status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] },
        },
      },
      select: { method: true, amount: true },
    });

    const bucket = new Map<string, { value: number; count: number }>();
    payments.forEach((payment) => {
      const key = normalizePaymentMethod(payment.method);
      const current = bucket.get(key) ?? { value: 0, count: 0 };
      current.value += Number(payment.amount);
      current.count += 1;
      bucket.set(key, current);
    });

    const total = Array.from(bucket.values()).reduce((acc, row) => acc + (metric === 'count' ? row.count : row.value), 0);
    const data = Array.from(bucket.entries()).map(([key, row]) => {
      const currentMetric = metric === 'count' ? row.count : row.value;
      return {
        key,
        name: PAYMENT_LABELS[key] ?? key,
        value: Number(row.value.toFixed(2)),
        count: row.count,
        metric_value: Number(currentMetric.toFixed(2)),
        pct: total > 0 ? Number(((currentMetric / total) * 100).toFixed(2)) : 0,
      };
    }).sort((a, b) => b.metric_value - a.metric_value);

    return ok(reply, { metric, total: Number(total.toFixed(2)), data });
  });

  app.get('/reports/day/type-breakdown', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const metric = sanitizeText((req.query as any).metric, 20).toLowerCase() === 'count' ? 'count' : 'value';
    const selectedType = sanitizeText((req.query as any).type, 80);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const range = parseReportRange(req.query as Record<string, unknown>);
    if (!range) return fail(reply, 'VALIDATION_ERROR', 'Rango de fechas inválido');
    const { start, end } = range;

    const lines = await prisma.saleLine.findMany({
      where: {
        sale: {
          siteId,
          createdAt: { gte: start, lt: end },
          status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] },
        },
      },
      include: { product: { select: { name: true, analyticsCategory: true, analyticsSubcategory: true } } },
      take: 4000,
    });

    const grouped = new Map<string, { value: number; count: number }>();
    lines.forEach((line) => {
      const top = resolveCategoryGroup({ category: line.category, product: line.product });
      if (selectedType && top !== selectedType) return;
      const key = selectedType ? resolveSubcategory({ category: line.category, product: line.product }) : top;
      const current = grouped.get(key) ?? { value: 0, count: 0 };
      current.value += Number(line.lineTotal);
      current.count += line.quantity;
      grouped.set(key, current);
    });

    const total = Array.from(grouped.values()).reduce((acc, row) => acc + (metric === 'count' ? row.count : row.value), 0);
    const data = Array.from(grouped.entries()).map(([name, row]) => {
      const currentMetric = metric === 'count' ? row.count : row.value;
      return {
        name,
        value: Number(row.value.toFixed(2)),
        count: row.count,
        metric_value: Number(currentMetric.toFixed(2)),
        pct: total > 0 ? Number(((currentMetric / total) * 100).toFixed(2)) : 0,
      };
    }).sort((a, b) => b.metric_value - a.metric_value);

    return ok(reply, {
      metric,
      view: selectedType ? 'subcategory' : 'category',
      selected_type: selectedType || null,
      total: Number(total.toFixed(2)),
      data,
    });
  });

  app.get('/reports/day/movements', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const q = sanitizeText((req.query as any).q, 120).toLowerCase();
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const range = parseReportRange(req.query as Record<string, unknown>);
    if (!range) return fail(reply, 'VALIDATION_ERROR', 'Rango de fechas inválido');
    const { start, end } = range;

    const [sales, voidedSales, cashMovements] = await Promise.all([
      prisma.sale.findMany({
        where: { siteId, createdAt: { gte: start, lt: end }, status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] } },
        include: { payments: true, lines: { include: { product: true } }, createdBy: true },
        orderBy: { createdAt: 'desc' },
        take: 400,
      }),
      prisma.sale.findMany({
        where: { siteId, status: SaleStatus.VOIDED, voidedAt: { gte: start, lt: end } },
        include: { createdBy: true },
        orderBy: { voidedAt: 'desc' },
        take: 200,
      }),
      prisma.cashMovement.findMany({
        where: {
          siteId,
          OR: [
            { createdAt: { gte: start, lt: end } },
            { voidedAt: { gte: start, lt: end } },
          ],
        },
        include: { createdBy: true, authorizedBy: true, voidedBy: true },
        orderBy: { createdAt: 'desc' },
        take: 400,
      }),
    ]);

    const movementRows: Array<{
      id: string;
      occurred_at: string;
      kind: string;
      label: string;
      amount: string;
      detail: string;
      can_modify: boolean;
      cash_session_id?: string;
      receipt_number?: string | null;
      receipt_text?: string | null;
    }> = [];

    sales.forEach((sale) => {
      const label = sale.lines.map((line) => line.product?.name ?? 'Producto').join(', ');
      const paymentLabel = sale.payments[0]?.method ? (PAYMENT_LABELS[normalizePaymentMethod(sale.payments[0].method)] ?? sale.payments[0].method) : 'N/A';
      movementRows.push({
        id: sale.id,
        occurred_at: sale.createdAt.toISOString(),
        kind: 'SALE',
        label,
        amount: sale.total.toFixed(2),
        detail: `${sale.status} • ${paymentLabel}`,
        can_modify: true,
        cash_session_id: sale.cashSessionId,
        receipt_number: sale.receiptNumber ?? null,
        receipt_text: sale.receiptText ?? null,
      });
    });

    voidedSales.forEach((sale) => {
      movementRows.push({
        id: sale.id,
        occurred_at: (sale.voidedAt ?? sale.createdAt).toISOString(),
        kind: 'SALE_VOID',
        label: `Venta anulada ${sale.id.slice(0, 8)}`,
        amount: sale.total.toFixed(2),
        detail: `Anulada por ${sale.createdBy.fullName}`,
        can_modify: false,
        cash_session_id: sale.cashSessionId,
        receipt_number: sale.receiptNumber ?? null,
        receipt_text: sale.receiptText ?? null,
      });
    });

    cashMovements.forEach((movement) => {
      movementRows.push({
        id: movement.id,
        occurred_at: (movement.voidedAt ?? movement.createdAt).toISOString(),
        kind: movement.voidedAt ? 'CASH_MOVEMENT_VOID' : 'CASH_MOVEMENT',
        label: movement.type === CashMovementType.WITHDRAWAL ? 'Egreso de caja' : 'Ajuste de caja',
        amount: movement.amount.toFixed(2),
        detail: movement.voidedAt
          ? `Anulado por ${movement.voidedBy?.fullName ?? 'N/A'}`
          : `Autorizado por ${movement.authorizedBy.fullName}`,
        can_modify: !movement.voidedAt,
        cash_session_id: movement.cashSessionId,
      });
    });

    const filtered = movementRows
      .filter((row) => {
        if (!q) return true;
        return `${row.kind} ${row.label} ${row.detail}`.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

    return ok(reply, { data: filtered });
  });

  app.get('/reports/day/station-usage', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const limit = Math.min(Math.max(Number.parseInt(String((req.query as any).limit ?? '200'), 10) || 200, 1), 2000);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const { start, end } = getBogotaDayRange();

    const usages = await prisma.attractionUsage.findMany({
      where: {
        siteId,
        occurredAt: { gte: start, lt: end },
        type: 'USE',
      },
      include: {
        reader: { select: { id: true, code: true, position: true } },
        attraction: { select: { id: true, name: true, code: true, type: true, location: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });

    const stationMap = new Map<string, {
      station_id: string;
      station_code: string;
      station_position: number;
      machine_code: string;
      machine_name: string;
      machine_type: string;
      machine_location: string | null;
      uses: number;
      revenue: number;
      last_use_at: string | null;
    }>();

    for (const usage of usages) {
      const key = usage.reader.id;
      const current = stationMap.get(key) ?? {
        station_id: usage.reader.id,
        station_code: usage.reader.code,
        station_position: usage.reader.position,
        machine_code: usage.attraction.code,
        machine_name: usage.attraction.name,
        machine_type: usage.attraction.type,
        machine_location: usage.attraction.location,
        uses: 0,
        revenue: 0,
        last_use_at: null,
      };
      current.uses += 1;
      current.revenue += Number(usage.cost);
      if (!current.last_use_at || new Date(usage.occurredAt).getTime() > new Date(current.last_use_at).getTime()) {
        current.last_use_at = usage.occurredAt.toISOString();
      }
      stationMap.set(key, current);
    }

    const data = Array.from(stationMap.values())
      .map((row) => ({ ...row, revenue: Number(row.revenue.toFixed(2)) }))
      .sort((a, b) => b.uses - a.uses);

    return ok(reply, {
      scope: 'day',
      total_uses: data.reduce((acc, row) => acc + row.uses, 0),
      total_revenue: Number(data.reduce((acc, row) => acc + row.revenue, 0).toFixed(2)),
      data,
    });
  });

  app.get('/reports/critical/revenue-by-category', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const range = parseReportRange(req.query as any);
    if (!range) return fail(reply, 'VALIDATION_ERROR', 'Rango de fechas inválido');

    const lines = await prisma.saleLine.findMany({
      where: {
        sale: {
          siteId,
          createdAt: { gte: range.start, lt: range.end },
          status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] },
        },
      },
      include: { product: { select: { analyticsCategory: true } } },
      take: 10000,
    });

    const bucket = new Map<string, { amount: number; qty: number }>();
    for (const line of lines) {
      const category = resolveCategoryGroup({ category: line.category, product: line.product as any });
      const current = bucket.get(category) ?? { amount: 0, qty: 0 };
      current.amount += Number(line.lineTotal);
      current.qty += line.quantity;
      bucket.set(category, current);
    }

    const totalRevenue = Array.from(bucket.values()).reduce((acc, row) => acc + row.amount, 0);
    const data = Array.from(bucket.entries())
      .map(([category, row]) => ({
        category,
        revenue: Number(row.amount.toFixed(2)),
        units: row.qty,
        pct: totalRevenue > 0 ? Number(((row.amount / totalRevenue) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return ok(reply, {
      scope: range.mode,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      total_revenue: Number(totalRevenue.toFixed(2)),
      data,
    });
  });

  app.get('/reports/critical/machine-usage', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const range = parseReportRange(req.query as any);
    if (!range) return fail(reply, 'VALIDATION_ERROR', 'Rango de fechas inválido');

    const usages = await prisma.attractionUsage.findMany({
      where: {
        siteId,
        occurredAt: { gte: range.start, lt: range.end },
        type: 'USE',
      },
      include: {
        attraction: { select: { id: true, code: true, name: true, type: true, location: true } },
      },
      take: 20000,
    });

    const machineMap = new Map<string, {
      machine_id: string;
      machine_code: string;
      machine_name: string;
      machine_type: string;
      machine_location: string | null;
      uses: number;
      revenue: number;
    }>();
    for (const usage of usages) {
      const key = usage.attraction.id;
      const current = machineMap.get(key) ?? {
        machine_id: usage.attraction.id,
        machine_code: usage.attraction.code,
        machine_name: usage.attraction.name,
        machine_type: usage.attraction.type,
        machine_location: usage.attraction.location,
        uses: 0,
        revenue: 0,
      };
      current.uses += 1;
      current.revenue += Number(usage.cost);
      machineMap.set(key, current);
    }

    const data = Array.from(machineMap.values())
      .map((row) => ({ ...row, revenue: Number(row.revenue.toFixed(2)) }))
      .sort((a, b) => b.uses - a.uses);

    return ok(reply, {
      scope: range.mode,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      total_uses: data.reduce((acc, row) => acc + row.uses, 0),
      total_revenue: Number(data.reduce((acc, row) => acc + row.revenue, 0).toFixed(2)),
      data,
    });
  });

  app.get('/reports/critical/points', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const range = parseReportRange(req.query as any);
    if (!range) return fail(reply, 'VALIDATION_ERROR', 'Rango de fechas inválido');

    const events = await prisma.pointsLedgerEvent.findMany({
      where: {
        siteId,
        occurredAt: { gte: range.start, lt: range.end },
      },
      select: { pointsDelta: true, reason: true },
      take: 20000,
    });

    let granted = 0;
    let redeemed = 0;
    const byReason = new Map<string, number>();
    for (const event of events) {
      const reason = event.reason || 'SIN_MOTIVO';
      byReason.set(reason, (byReason.get(reason) ?? 0) + event.pointsDelta);
      if (event.pointsDelta > 0) granted += event.pointsDelta;
      if (event.pointsDelta < 0) redeemed += Math.abs(event.pointsDelta);
    }

    return ok(reply, {
      scope: range.mode,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      granted_points: granted,
      redeemed_points: redeemed,
      net_points: granted - redeemed,
      by_reason: Array.from(byReason.entries())
        .map(([reason, points]) => ({ reason, points }))
        .sort((a, b) => Math.abs(b.points) - Math.abs(a.points)),
    });
  });

  app.get('/reports/critical/program-portfolio', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const onlyOverdue = sanitizeText((req.query as any).only_overdue, 10).toLowerCase() === 'true';
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');

    const enrollments = await prisma.programEnrollment.findMany({
      where: { siteId },
      include: {
        student: true,
        payments: { select: { amount: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const now = new Date();
    const rows = enrollments.map((enrollment) => {
      const paid = enrollment.payments.reduce((acc, payment) => acc + Number(payment.amount), 0);
      const finalAmount = Number(enrollment.finalAmount);
      const pending = Math.max(0, Number((finalAmount - paid).toFixed(2)));
      const overdue = Boolean(enrollment.dueDate && enrollment.dueDate < now && pending > 0);
      return {
        enrollment_id: enrollment.id,
        student: `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim(),
        document: `${enrollment.student.documentType}-${enrollment.student.documentNumber}`,
        program: enrollment.programName,
        group: enrollment.groupName ?? '-',
        final_amount: finalAmount,
        paid_amount: Number(paid.toFixed(2)),
        pending_amount: pending,
        due_date: enrollment.dueDate?.toISOString() ?? null,
        overdue,
        status: enrollment.status,
      };
    });

    const data = (onlyOverdue ? rows.filter((row) => row.overdue) : rows).sort((a, b) => b.pending_amount - a.pending_amount);
    const totalFinal = data.reduce((acc, row) => acc + row.final_amount, 0);
    const totalPaid = data.reduce((acc, row) => acc + row.paid_amount, 0);
    const totalPending = data.reduce((acc, row) => acc + row.pending_amount, 0);

    return ok(reply, {
      total_enrollments: data.length,
      total_final_amount: Number(totalFinal.toFixed(2)),
      total_paid_amount: Number(totalPaid.toFixed(2)),
      total_pending_amount: Number(totalPending.toFixed(2)),
      overdue_count: data.filter((row) => row.overdue).length,
      data,
    });
  });

  app.get('/reports/critical/inventory', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const thresholdRaw = Number.parseInt(String((req.query as any).threshold ?? '10'), 10);
    const threshold = Number.isFinite(thresholdRaw) ? Math.max(0, thresholdRaw) : 10;
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');

    const items = await prisma.inventoryItem.findMany({
      where: { siteId, isActive: true },
      orderBy: { name: 'asc' },
      take: 5000,
    });
    const sums = await prisma.inventoryMovement.groupBy({
      by: ['itemId'],
      where: { siteId, itemId: { in: items.map((item) => item.id) } },
      _sum: { quantity: true },
      _max: { occurredAt: true },
    });
    const sumMap = new Map(sums.map((row) => [row.itemId, row]));

    const data = items
      .map((item) => {
        const row = sumMap.get(item.id);
        const stock = Number(row?._sum.quantity ?? 0);
        return {
          item_id: item.id,
          sku: item.sku,
          name: item.name,
          category: item.category,
          stock,
          threshold,
          last_movement_at: row?._max.occurredAt?.toISOString() ?? null,
          critical: stock <= threshold,
        };
      })
      .filter((item) => item.critical)
      .sort((a, b) => a.stock - b.stock);

    return ok(reply, {
      threshold,
      critical_count: data.length,
      data,
    });
  });

  app.get('/reports/critical/promotion-usage', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const range = parseReportRange(req.query as any);
    if (!range) return fail(reply, 'VALIDATION_ERROR', 'Rango de fechas inválido');

    const [promotions, additionalCredits, salePromoLogs] = await Promise.all([
      prisma.promotion.findMany({
        where: { siteId },
        orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
      }),
      prisma.cardBalanceEvent.findMany({
        where: {
          siteId,
          occurredAt: { gte: range.start, lt: range.end },
          reason: { startsWith: 'RECHARGE_ADDITIONAL:' },
        },
        select: { reason: true, moneyDelta: true, occurredAt: true },
        take: 20000,
      }),
      prisma.deviceLog.findMany({
        where: {
          siteId,
          createdAt: { gte: range.start, lt: range.end },
          reason: { startsWith: 'PROMO:' },
        },
        select: { reason: true, createdAt: true },
        take: 30000,
      }),
    ]);

    const usageMap = new Map<string, { uses: number; credit_total: number; last_used_at: string | null }>();
    for (const event of additionalCredits) {
      const code = event.reason.replace('RECHARGE_ADDITIONAL:', '').trim().toUpperCase();
      const current = usageMap.get(code) ?? { uses: 0, credit_total: 0, last_used_at: null };
      current.uses += 1;
      current.credit_total += Number(event.moneyDelta);
      const iso = event.occurredAt.toISOString();
      if (!current.last_used_at || new Date(iso).getTime() > new Date(current.last_used_at).getTime()) {
        current.last_used_at = iso;
      }
      usageMap.set(code, current);
    }
    for (const log of salePromoLogs) {
      const rawCodes = log.reason.replace('PROMO:', '').split(',');
      for (const rawCode of rawCodes) {
        const code = rawCode.trim().toUpperCase();
        if (!code) continue;
        const current = usageMap.get(code) ?? { uses: 0, credit_total: 0, last_used_at: null };
        current.uses += 1;
        const iso = log.createdAt.toISOString();
        if (!current.last_used_at || new Date(iso).getTime() > new Date(current.last_used_at).getTime()) {
          current.last_used_at = iso;
        }
        usageMap.set(code, current);
      }
    }

    const data = promotions.map((promotion) => {
      const usage = usageMap.get(promotion.code) ?? { uses: 0, credit_total: 0, last_used_at: null };
      return {
        promotion_id: promotion.id,
        code: promotion.code,
        name: promotion.name,
        type: promotion.type,
        scope: promotion.scope,
        is_active: promotion.isActive,
        uses: usage.uses,
        credit_total: Number(usage.credit_total.toFixed(2)),
        last_used_at: usage.last_used_at,
      };
    }).sort((a, b) => b.uses - a.uses);

    return ok(reply, {
      scope: range.mode,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      total_uses: data.reduce((acc, row) => acc + row.uses, 0),
      total_credit: Number(data.reduce((acc, row) => acc + row.credit_total, 0).toFixed(2)),
      data,
    });
  });

  app.get('/reports/admin/executive', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');

    const areaRaw = Number((req.query as any).area_m2);
    const areaM2 = Number.isFinite(areaRaw) && areaRaw > 0 ? areaRaw : 120;
    const now = new Date();
    const { start: dayStart, end: dayEnd } = getBogotaDayRange(now);
    const { start: yesterdayStart, end: yesterdayEnd } = getBogotaDayRange(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const monthStart = new Date(dayStart.getTime() - 29 * 24 * 60 * 60 * 1000);
    const monthEnd = dayEnd;
    const weekStart = new Date(dayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [todaySales, yesterdaySales, todayUsages, allActiveAttractions, todayReaders, todayDeviceLogs, closedCashSessionsDay, cardsIssuedToday, allCardsWithBalance, cardBalanceLastEvent, cardUsageLastEvent, monthSales, monthUsages, monthWithdrawals, customersCreatedMonth, recentSalesForProfile, weeklySales] = await Promise.all([
      prisma.sale.findMany({
        where: {
          siteId,
          createdAt: { gte: dayStart, lt: dayEnd },
          status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] },
        },
        select: { id: true, createdAt: true, total: true, customerId: true },
      }),
      prisma.sale.findMany({
        where: {
          siteId,
          createdAt: { gte: yesterdayStart, lt: yesterdayEnd },
          status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] },
        },
        select: { id: true, total: true },
      }),
      prisma.attractionUsage.findMany({
        where: {
          siteId,
          occurredAt: { gte: dayStart, lt: dayEnd },
          type: 'USE',
        },
        include: {
          attraction: { select: { id: true, name: true, code: true, type: true, duration: true, location: true } },
          card: { select: { uid: true, ownerCustomerId: true } },
        },
      }),
      prisma.attraction.findMany({
        where: { siteId, status: 'ACTIVE' },
        select: { id: true, name: true, code: true, type: true, duration: true, location: true },
      }),
      prisma.reader.findMany({
        where: { siteId, isActive: true },
        select: { id: true, code: true, lastSeenAt: true },
      }),
      prisma.deviceLog.findMany({
        where: {
          siteId,
          createdAt: { gte: dayStart, lt: dayEnd },
        },
        select: { uid: true, readerId: true, reason: true, eventType: true, createdAt: true },
      }),
      prisma.cashSession.findMany({
        where: {
          siteId,
          closedAt: { gte: dayStart, lt: dayEnd },
        },
        select: { cashDifference: true },
      }),
      prisma.card.count({
        where: {
          siteId,
          issuedAt: { gte: dayStart, lt: dayEnd },
        },
      }),
      prisma.card.findMany({
        where: {
          siteId,
          creditBalance: { gt: D(0) },
        },
        select: { id: true, uid: true, creditBalance: true, status: true, issuedAt: true },
        take: 20000,
      }),
      prisma.cardBalanceEvent.groupBy({
        by: ['cardId'],
        where: { siteId },
        _max: { occurredAt: true },
      }),
      prisma.attractionUsage.groupBy({
        by: ['cardId'],
        where: { siteId, type: 'USE' },
        _max: { occurredAt: true },
      }),
      prisma.sale.findMany({
        where: {
          siteId,
          createdAt: { gte: monthStart, lt: monthEnd },
          status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] },
        },
        select: { createdAt: true, total: true, customerId: true },
      }),
      prisma.attractionUsage.findMany({
        where: {
          siteId,
          occurredAt: { gte: monthStart, lt: monthEnd },
          type: 'USE',
        },
        include: {
          attraction: { select: { id: true, name: true, code: true, type: true, duration: true } },
          card: { select: { ownerCustomerId: true } },
        },
      }),
      prisma.cashMovement.aggregate({
        where: {
          siteId,
          type: CashMovementType.WITHDRAWAL,
          voidedAt: null,
          createdAt: { gte: monthStart, lt: monthEnd },
        },
        _sum: { amount: true },
      }),
      prisma.customer.count({
        where: {
          siteId,
          createdAt: { gte: monthStart, lt: monthEnd },
        },
      }),
      prisma.sale.findMany({
        where: {
          siteId,
          createdAt: { gte: monthStart, lt: monthEnd },
          status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] },
        },
        select: { customerId: true, customer: { select: { city: true } } },
        take: 12000,
      }),
      prisma.sale.findMany({
        where: {
          siteId,
          createdAt: { gte: weekStart, lt: dayEnd },
          status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] },
        },
        select: { createdAt: true, total: true },
      }),
    ]);

    const todayRevenue = todaySales.reduce((acc, sale) => acc + Number(sale.total), 0);
    const yesterdayRevenue = yesterdaySales.reduce((acc, sale) => acc + Number(sale.total), 0);
    const ticketAverage = todaySales.length > 0 ? todayRevenue / todaySales.length : 0;
    const comparisonVsYesterdayPct = yesterdayRevenue > 0
      ? Number((((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(2))
      : 0;

    const hourlyRevenue = Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0, transactions: 0 }));
    for (const sale of todaySales) {
      const hour = getBogotaHour(sale.createdAt);
      hourlyRevenue[hour].revenue += Number(sale.total);
      hourlyRevenue[hour].transactions += 1;
    }
    hourlyRevenue.forEach((row) => {
      row.revenue = Number(row.revenue.toFixed(2));
    });

    const usageByMachine = new Map<string, { machine_id: string; machine_name: string; machine_code: string; machine_type: string; location: string | null; uses: number; revenue: number; duration_sum: number }>();
    for (const usage of todayUsages) {
      const key = usage.attraction.id;
      const current = usageByMachine.get(key) ?? {
        machine_id: usage.attraction.id,
        machine_name: usage.attraction.name,
        machine_code: usage.attraction.code,
        machine_type: usage.attraction.type,
        location: usage.attraction.location,
        uses: 0,
        revenue: 0,
        duration_sum: 0,
      };
      current.uses += 1;
      current.revenue += Number(usage.cost);
      current.duration_sum += usage.attraction.duration > 0 ? usage.attraction.duration : 5;
      usageByMachine.set(key, current);
    }

    for (const machine of allActiveAttractions) {
      if (usageByMachine.has(machine.id)) continue;
      usageByMachine.set(machine.id, {
        machine_id: machine.id,
        machine_name: machine.name,
        machine_code: machine.code,
        machine_type: machine.type,
        location: machine.location,
        uses: 0,
        revenue: 0,
        duration_sum: 0,
      });
    }

    const machines = Array.from(usageByMachine.values()).map((row) => ({
      ...row,
      revenue: Number(row.revenue.toFixed(2)),
      avg_session_minutes: row.uses > 0 ? Number((row.duration_sum / row.uses).toFixed(2)) : 0,
    }));
    const maxUses = machines.reduce((max, row) => Math.max(max, row.uses), 0);
    const occupancyByMachine = machines
      .map((row) => ({
        machine_name: row.machine_name,
        machine_code: row.machine_code,
        uses: row.uses,
        occupancy_pct: maxUses > 0 ? Number(((row.uses / maxUses) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.occupancy_pct - a.occupancy_pct);
    const top5Machines = [...machines].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const lowRotationMachines = [...machines].sort((a, b) => a.uses - b.uses).slice(0, 5);
    const avgSessionMinutes = todayUsages.length > 0
      ? Number((machines.reduce((acc, row) => acc + row.duration_sum, 0) / todayUsages.length).toFixed(2))
      : 0;

    const todayCustomerIds = Array.from(new Set(todaySales.map((sale) => sale.customerId)));
    const recurrentCustomerIds = todayCustomerIds.length > 0
      ? await prisma.sale.findMany({
          where: {
            siteId,
            customerId: { in: todayCustomerIds },
            createdAt: { lt: dayStart },
            status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] },
          },
          select: { customerId: true },
          distinct: ['customerId'],
        }).then((rows) => rows.map((row) => row.customerId))
      : [];
    const uniqueCustomersToday = todayCustomerIds.length;
    const recurrentCustomersToday = recurrentCustomerIds.length;
    const retentionRatePct = uniqueCustomersToday > 0
      ? Number(((recurrentCustomersToday / uniqueCustomersToday) * 100).toFixed(2))
      : 0;

    const pendingLoadedBalance = allCardsWithBalance.reduce((acc, card) => acc + Number(card.creditBalance), 0);
    const eventMaxByCard = new Map(cardBalanceLastEvent.map((row) => [row.cardId, row._max.occurredAt]));
    const usageMaxByCard = new Map(cardUsageLastEvent.map((row) => [row.cardId, row._max.occurredAt]));
    let breakageEstimate = 0;
    for (const card of allCardsWithBalance) {
      const eventAt = eventMaxByCard.get(card.id) ?? null;
      const usageAt = usageMaxByCard.get(card.id) ?? null;
      const lastActivity = [card.issuedAt, eventAt, usageAt]
        .filter((value): value is Date => Boolean(value))
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? card.issuedAt;
      if (lastActivity < ninetyDaysAgo || card.status !== CardStatus.ACTIVE) {
        breakageEstimate += Number(card.creditBalance);
      }
    }

    const offlineThreshold = new Date(now.getTime() - 10 * 60 * 1000);
    const offlineMachines = todayReaders.filter((reader) => !reader.lastSeenAt || reader.lastSeenAt < offlineThreshold).length;
    const networkFailures = todayDeviceLogs.filter((log) => {
      const text = `${log.reason ?? ''} ${log.eventType ?? ''}`.toUpperCase();
      return text.includes('NETWORK') || text.includes('TIMEOUT') || text.includes('OFFLINE') || text.includes('ERROR');
    }).length;
    const cashImbalanceTotal = closedCashSessionsDay.reduce((acc, session) => acc + Math.abs(Number(session.cashDifference ?? 0)), 0);
    const suspiciousFromLogs = todayDeviceLogs.filter((log) => {
      const text = `${log.reason ?? ''} ${log.eventType ?? ''}`.toUpperCase();
      return text.includes('FRAUD') || text.includes('CLONE') || text.includes('ANOMAL') || text.includes('DENY');
    }).length;
    const suspiciousVoids = await prisma.sale.count({
      where: {
        siteId,
        status: SaleStatus.VOIDED,
        voidedAt: { gte: dayStart, lt: dayEnd },
      },
    });
    const suspiciousTransactions = suspiciousFromLogs + suspiciousVoids;

    const machineProfitability = new Map<string, { machine_name: string; machine_type: string; revenue: number; energy: number; maintenance: number; depreciation: number; profit: number }>();
    const roiByType = new Map<string, { revenue: number; cost: number; profit: number; uses: number }>();
    for (const usage of monthUsages) {
      const revenue = Number(usage.cost);
      const energy = revenue * 0.08;
      const maintenance = revenue * 0.06;
      const depreciation = revenue * 0.1;
      const cost = energy + maintenance + depreciation;
      const profit = revenue - cost;

      const machineKey = usage.attraction.id;
      const machineCurrent = machineProfitability.get(machineKey) ?? {
        machine_name: usage.attraction.name,
        machine_type: usage.attraction.type,
        revenue: 0,
        energy: 0,
        maintenance: 0,
        depreciation: 0,
        profit: 0,
      };
      machineCurrent.revenue += revenue;
      machineCurrent.energy += energy;
      machineCurrent.maintenance += maintenance;
      machineCurrent.depreciation += depreciation;
      machineCurrent.profit += profit;
      machineProfitability.set(machineKey, machineCurrent);

      const typeCurrent = roiByType.get(usage.attraction.type) ?? { revenue: 0, cost: 0, profit: 0, uses: 0 };
      typeCurrent.revenue += revenue;
      typeCurrent.cost += cost;
      typeCurrent.profit += profit;
      typeCurrent.uses += 1;
      roiByType.set(usage.attraction.type, typeCurrent);
    }

    const profitabilityByMachine = Array.from(machineProfitability.values())
      .map((row) => ({
        machine_name: row.machine_name,
        machine_type: row.machine_type,
        revenue: Number(row.revenue.toFixed(2)),
        energy_cost: Number(row.energy.toFixed(2)),
        maintenance_cost: Number(row.maintenance.toFixed(2)),
        depreciation_cost: Number(row.depreciation.toFixed(2)),
        profit: Number(row.profit.toFixed(2)),
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 8);

    const roiByGameType = Array.from(roiByType.entries()).map(([type, row]) => ({
      game_type: type,
      revenue: Number(row.revenue.toFixed(2)),
      cost: Number(row.cost.toFixed(2)),
      profit: Number(row.profit.toFixed(2)),
      roi_pct: row.cost > 0 ? Number(((row.profit / row.cost) * 100).toFixed(2)) : 0,
      uses: row.uses,
    })).sort((a, b) => b.roi_pct - a.roi_pct);

    const promoCreditMonth = await prisma.cardBalanceEvent.aggregate({
      where: {
        siteId,
        occurredAt: { gte: monthStart, lt: monthEnd },
        reason: { startsWith: 'RECHARGE_ADDITIONAL:' },
      },
      _sum: { moneyDelta: true },
    });
    const promoUsesMonth = await prisma.deviceLog.count({
      where: {
        siteId,
        createdAt: { gte: monthStart, lt: monthEnd },
        reason: { startsWith: 'PROMO:' },
      },
    });
    const promotionCost = Number(promoCreditMonth._sum.moneyDelta ?? 0);
    const newCustomersAttributed = Math.min(customersCreatedMonth, promoUsesMonth);
    const cac = newCustomersAttributed > 0 ? Number((promotionCost / newCustomersAttributed).toFixed(2)) : 0;

    const peakHours = [...hourlyRevenue]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((row) => ({ hour: row.hour, revenue: row.revenue, transactions: row.transactions }));

    const weeklyHeatMap = Array.from({ length: 7 }, (_, dayOffset) => ({
      day_key: getBogotaDayKey(new Date(dayStart.getTime() - (6 - dayOffset) * 24 * 60 * 60 * 1000)),
      hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, transactions: 0, revenue: 0 })),
    }));
    const weekIndex = new Map(weeklyHeatMap.map((row, idx) => [row.day_key, idx]));
    for (const sale of weeklySales) {
      const dayKey = getBogotaDayKey(sale.createdAt);
      const idx = weekIndex.get(dayKey);
      if (idx === undefined) continue;
      const hour = getBogotaHour(sale.createdAt);
      weeklyHeatMap[idx].hourly[hour].transactions += 1;
      weeklyHeatMap[idx].hourly[hour].revenue += Number(sale.total);
    }
    weeklyHeatMap.forEach((row) => row.hourly.forEach((cell) => { cell.revenue = Number(cell.revenue.toFixed(2)); }));

    const cityBucket = new Map<string, number>();
    recentSalesForProfile.forEach((sale) => {
      const city = sale.customer.city?.trim() || 'Sin ciudad';
      cityBucket.set(city, (cityBucket.get(city) ?? 0) + 1);
    });
    const customerProfile = Array.from(cityBucket.entries())
      .map(([city, sales]) => ({ city, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 8);

    const customerSalesCount = await prisma.sale.groupBy({
      by: ['customerId'],
      where: {
        siteId,
        status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] },
      },
      _count: { customerId: true },
    });
    const customerSegmentMap = new Map(customerSalesCount.map((row) => [row.customerId, row._count.customerId > 1 ? 'recurrent' : 'new']));
    const preferredBySegmentBucket = new Map<string, Map<string, number>>();
    for (const usage of monthUsages) {
      const customerId = usage.card.ownerCustomerId;
      if (!customerId) continue;
      const segment = customerSegmentMap.get(customerId) ?? 'new';
      const machineName = usage.attraction.name;
      const segmentMap = preferredBySegmentBucket.get(segment) ?? new Map<string, number>();
      segmentMap.set(machineName, (segmentMap.get(machineName) ?? 0) + 1);
      preferredBySegmentBucket.set(segment, segmentMap);
    }
    const preferredGameBySegment = Array.from(preferredBySegmentBucket.entries()).map(([segment, bucket]) => {
      const top = Array.from(bucket.entries()).sort((a, b) => b[1] - a[1])[0];
      return {
        segment,
        game: top?.[0] ?? 'N/D',
        uses: top?.[1] ?? 0,
      };
    });

    const logsByUid = new Map<string, Array<{ readerId: string; createdAt: Date }>>();
    for (const log of todayDeviceLogs) {
      const uid = (log.uid || '').trim().toUpperCase();
      if (!uid) continue;
      const arr = logsByUid.get(uid) ?? [];
      arr.push({ readerId: log.readerId, createdAt: log.createdAt });
      logsByUid.set(uid, arr);
    }
    let anomalousRepeats = 0;
    let clonedCards = 0;
    for (const [, entries] of logsByUid) {
      if (entries.length >= 20) anomalousRepeats += 1;
      const sorted = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      let cloneDetected = false;
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1];
        const current = sorted[i];
        if (prev.readerId !== current.readerId && (current.createdAt.getTime() - prev.createdAt.getTime()) <= 5 * 60 * 1000) {
          cloneDetected = true;
          break;
        }
      }
      if (cloneDetected) clonedCards += 1;
    }
    const avgSaleValue = todaySales.length > 0 ? todayRevenue / todaySales.length : 0;
    const outPatternOps = todaySales.filter((sale) => Number(sale.total) > (avgSaleValue * 3)).length;

    const revenueByDayBucket = new Map<string, number>();
    monthSales.forEach((sale) => {
      const key = getBogotaDayKey(sale.createdAt);
      revenueByDayBucket.set(key, (revenueByDayBucket.get(key) ?? 0) + Number(sale.total));
    });
    const avgDailyRevenue30 = revenueByDayBucket.size > 0
      ? Array.from(revenueByDayBucket.values()).reduce((acc, value) => acc + value, 0) / revenueByDayBucket.size
      : 0;

    const daysInMonth = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: BOGOTA_TZ,
        day: '2-digit',
      }).format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))
    ) || 30;

    const monthlyRevenueForecast = Number((avgDailyRevenue30 * daysInMonth).toFixed(2));
    const monthRevenueObserved = monthSales.reduce((acc, sale) => acc + Number(sale.total), 0);
    const monthWithdrawal = Number(monthWithdrawals._sum.amount ?? 0);
    const outflowRatio = monthRevenueObserved > 0 ? Math.min(Math.max(monthWithdrawal / monthRevenueObserved, 0), 1) : 0.18;
    const projectedCashFlow = Number((monthlyRevenueForecast * (1 - outflowRatio)).toFixed(2));
    const fixedCostEstimate = 12000000;
    const contributionMarginPct = 0.76;
    const dynamicBreakEven = Number((fixedCostEstimate / contributionMarginPct).toFixed(2));

    const playsToday = todayUsages.length;
    const scenarioRevenuePlus500 = Number((monthlyRevenueForecast + (playsToday * 500 * daysInMonth)).toFixed(2));
    const scenarioCashFlowPlus500 = Number((projectedCashFlow + (playsToday * 500 * daysInMonth * (1 - outflowRatio))).toFixed(2));

    const activityTimestamps = [
      ...todaySales.map((sale) => sale.createdAt.getTime()),
      ...todayUsages.map((usage) => usage.occurredAt.getTime()),
    ].sort((a, b) => a - b);
    const operationHours = activityTimestamps.length >= 2
      ? Math.max(1, Number(((activityTimestamps[activityTimestamps.length - 1] - activityTimestamps[0]) / (1000 * 60 * 60)).toFixed(2)))
      : 1;
    const revenuePerSquareMeterPerHour = Number((todayRevenue / areaM2 / operationHours).toFixed(2));

    return ok(reply, {
      generated_at: now.toISOString(),
      executive: {
        today_revenue: Number(todayRevenue.toFixed(2)),
        average_ticket: Number(ticketAverage.toFixed(2)),
        hourly_revenue: hourlyRevenue,
        comparison_vs_yesterday_pct: comparisonVsYesterdayPct,
      },
      machine_efficiency: {
        occupancy_by_machine: occupancyByMachine,
        top5_profitable: top5Machines,
        low_rotation: lowRotationMachines,
        average_session_minutes: avgSessionMinutes,
      },
      customer_flow: {
        unique_customers_today: uniqueCustomersToday,
        recurrent_customers_today: recurrentCustomersToday,
        new_cards_activated_today: cardsIssuedToday,
        retention_rate_pct: retentionRatePct,
      },
      card_float: {
        pending_loaded_money: Number(pendingLoadedBalance.toFixed(2)),
        estimated_breakage: Number(breakageEstimate.toFixed(2)),
      },
      operational_alerts: {
        offline_machines: offlineMachines,
        network_failures: networkFailures,
        cash_imbalance_total: Number(cashImbalanceTotal.toFixed(2)),
        suspicious_transactions: suspiciousTransactions,
      },
      deep_finance: {
        profitability_by_machine: profitabilityByMachine,
        roi_by_game_type: roiByGameType,
        customer_acquisition_cost: {
          promo_uses: promoUsesMonth,
          estimated_promo_cost: Number(promotionCost.toFixed(2)),
          attributed_new_customers: newCustomersAttributed,
          cac: Number(cac.toFixed(2)),
        },
      },
      behavioral: {
        peak_hours: peakHours,
        weekly_heatmap: weeklyHeatMap,
        customer_profile: customerProfile,
        preferred_game_by_segment: preferredGameBySegment,
      },
      risk_control: {
        anomalous_repeat_cards: anomalousRepeats,
        cloned_card_signals: clonedCards,
        out_of_pattern_operations: outPatternOps,
      },
      projection: {
        monthly_revenue_forecast: monthlyRevenueForecast,
        cash_flow_forecast: projectedCashFlow,
        dynamic_break_even: dynamicBreakEven,
        scenario_plus_500_revenue: scenarioRevenuePlus500,
        scenario_plus_500_cash_flow: scenarioCashFlowPlus500,
      },
      strategic_metric: {
        area_m2: areaM2,
        operation_hours: operationHours,
        revenue_per_m2_per_hour: revenuePerSquareMeterPerHour,
      },
    });
  });

  app.get('/reports/dashboard/executive.pdf', { preHandler: [requireAuth, requireRole('admin')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');

    const from = sanitizeText((req.query as any).from, 30);
    const to = sanitizeText((req.query as any).to, 30);
    const areaM2 = sanitizeText((req.query as any).area_m2, 20) || '120';
    const q = sanitizeText((req.query as any).q, 120);
    const flow = sanitizeText((req.query as any).flow, 20);
    const category = sanitizeText((req.query as any).category, 120);
    const groupBy = sanitizeText((req.query as any).group_by, 10) || 'day';

    const summaryParams = new URLSearchParams({ site_id: siteId, from, to, group_by: groupBy });
    const executiveParams = new URLSearchParams({ site_id: siteId, area_m2: areaM2 });
    const movementParams = new URLSearchParams({ site_id: siteId, from, to, q, flow, category });
    const inventoryParams = new URLSearchParams({ site_id: siteId, from, to });

    const [summaryResp, executiveResp, pendingResp, movementResp, inventoryResp] = await Promise.all([
      app.inject({ method: 'GET', url: `/reports/dashboard/summary?${summaryParams.toString()}`, headers: req.headers as Record<string, string> }),
      app.inject({ method: 'GET', url: `/reports/admin/executive?${executiveParams.toString()}`, headers: req.headers as Record<string, string> }),
      app.inject({ method: 'GET', url: `/reports/dashboard/pending?site_id=${siteId}`, headers: req.headers as Record<string, string> }),
      app.inject({ method: 'GET', url: `/reports/dashboard/movements?${movementParams.toString()}`, headers: req.headers as Record<string, string> }),
      app.inject({ method: 'GET', url: `/reports/dashboard/inventory?${inventoryParams.toString()}`, headers: req.headers as Record<string, string> }),
    ]);

    const summary = summaryResp.json()?.data;
    const executive = executiveResp.json()?.data;
    const pending = pendingResp.json()?.data;
    const movementData = movementResp.json()?.data?.data ?? [];
    const inventory = inventoryResp.json()?.data;

    if (!summary || !executive) return fail(reply, 'INTERNAL_ERROR', 'No se pudo construir el reporte PDF', 500);

    const money = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0);
    const pct = (value: number) => `${Number(value || 0).toFixed(1)}%`;
    const dateRangeLabel = from && to ? `${from} a ${to}` : getBogotaDayKey();
    const topMachines = executive.machine_efficiency.top5_profitable.slice(0, 5);
    const alerts = [
      executive.operational_alerts.offline_machines > 0 ? `Maquinas offline: ${executive.operational_alerts.offline_machines}` : null,
      executive.operational_alerts.network_failures > 0 ? `Lectores NFC con error/red: ${executive.operational_alerts.network_failures}` : null,
      executive.operational_alerts.suspicious_transactions > 0 ? `Transacciones sospechosas: ${executive.operational_alerts.suspicious_transactions}` : null,
      executive.operational_alerts.cash_imbalance_total > 0 ? `Descuadre de caja: ${money(executive.operational_alerts.cash_imbalance_total)}` : null,
    ].filter(Boolean);
    const movementTotals = movementData.reduce((acc: { income: number; expense: number; adjustment: number }, row: any) => {
      const amount = Number(row.amount) || 0;
      if (row.flow === 'income') acc.income += amount;
      if (row.flow === 'expense') acc.expense += amount;
      if (row.flow === 'adjustment') acc.adjustment += amount;
      return acc;
    }, { income: 0, expense: 0, adjustment: 0 });

    reply.hijack();
    const doc = new PDFDocument({ margin: 34, size: 'A4' });
    applyStreamCorsHeaders(reply, req.headers.origin);
    reply.raw.setHeader('Content-Type', 'application/pdf');
    reply.raw.setHeader('Content-Disposition', `attachment; filename="dashboard-arcade-${dateRangeLabel.replace(/\s+/g, '_')}.pdf"`);
    doc.pipe(reply.raw);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const cardGap = 12;
    const cardWidth = (pageWidth - (cardGap * 3)) / 4;

    const ensureSpace = (heightNeeded: number) => {
      if (doc.y + heightNeeded > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }
    };

    const sectionTitle = (title: string, subtitle?: string) => {
      ensureSpace(52);
      doc.moveDown(0.4);
      doc.fillColor('#0f172a').fontSize(15).font('Helvetica-Bold').text(title);
      if (subtitle) {
        doc.moveDown(0.2);
        doc.fillColor('#64748b').fontSize(9).font('Helvetica').text(subtitle);
      }
      doc.moveDown(0.4);
    };

    const statCard = (x: number, y: number, title: string, value: string, foot?: string) => {
      doc.roundedRect(x, y, cardWidth, 72, 10).fillAndStroke('#f8fafc', '#dbe4ee');
      doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text(title.toUpperCase(), x + 10, y + 10, { width: cardWidth - 20 });
      doc.fillColor('#0f172a').fontSize(18).font('Helvetica-Bold').text(value, x + 10, y + 26, { width: cardWidth - 20 });
      if (foot) {
        doc.fillColor('#475569').fontSize(8).font('Helvetica').text(foot, x + 10, y + 52, { width: cardWidth - 20 });
      }
    };

    const listCard = (title: string, items: string[], emptyText: string) => {
      const height = Math.max(88, 40 + (Math.max(items.length, 1) * 14));
      ensureSpace(height + 12);
      const startY = doc.y;
      doc.roundedRect(doc.page.margins.left, startY, pageWidth, height, 10).fillAndStroke('#ffffff', '#dbe4ee');
      doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text(title, doc.page.margins.left + 12, startY + 12);
      let y = startY + 32;
      if (items.length === 0) {
        doc.fillColor('#64748b').fontSize(9).font('Helvetica').text(emptyText, doc.page.margins.left + 12, y);
      } else {
        items.forEach((item) => {
          doc.fillColor('#334155').fontSize(9).font('Helvetica').text(`• ${item}`, doc.page.margins.left + 12, y, { width: pageWidth - 24 });
          y += 14;
        });
      }
      doc.y = startY + height + 10;
    };

    const tableRow = (columns: string[], widths: number[], isHeader = false) => {
      const font = isHeader ? 'Helvetica-Bold' : 'Helvetica';
      const color = isHeader ? '#475569' : '#0f172a';
      const rowY = doc.y;
      let x = doc.page.margins.left;
      columns.forEach((col, index) => {
        doc.fillColor(color).fontSize(isHeader ? 8 : 9).font(font).text(col, x, rowY, { width: widths[index], ellipsis: true });
        x += widths[index];
      });
      doc.y = rowY + (isHeader ? 16 : 18);
    };

    doc.fillColor('#0f172a').fontSize(18).font('Helvetica-Bold').text('POLIVERSO · Dashboard Ejecutivo Arcade');
    doc.moveDown(0.3);
    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text(`Periodo: ${dateRangeLabel}`);
    doc.fillColor('#64748b').fontSize(9).text(`Generado: ${new Date().toLocaleString('es-CO')} · Área analizada: ${areaM2} m2`);
    doc.moveDown(0.8);

    const headerY = doc.y;
    statCard(doc.page.margins.left, headerY, 'Ingresos hoy', money(executive.executive.today_revenue), `${pct(executive.executive.comparison_vs_yesterday_pct)} vs ayer`);
    statCard(doc.page.margins.left + cardWidth + cardGap, headerY, 'Clientes hoy', String(executive.customer_flow.unique_customers_today), `Nuevos ${executive.customer_flow.new_cards_activated_today} · Recurrentes ${executive.customer_flow.recurrent_customers_today}`);
    statCard(doc.page.margins.left + (cardWidth + cardGap) * 2, headerY, 'Maquinas activas', `${Math.max((executive.machine_efficiency.occupancy_by_machine.length - executive.operational_alerts.offline_machines), 0)} / ${executive.machine_efficiency.occupancy_by_machine.length}`, `Offline ${executive.operational_alerts.offline_machines}`);
    statCard(doc.page.margins.left + (cardWidth + cardGap) * 3, headerY, 'Ticket promedio', money(executive.executive.average_ticket), `Meta ${pct(summary.summary.goal_pct)}`);
    doc.y = headerY + 84;

    sectionTitle('Ingresos y rentabilidad', 'Resumen comercial del periodo consultado.');
    listCard('KPIs del periodo', [
      `Ventas totales: ${money(summary.summary.total_sales)}`,
      `Transacciones: ${summary.summary.transactions}`,
      `Ticket promedio: ${money(summary.summary.average_ticket)}`,
      `Meta del periodo: ${money(summary.summary.goal_amount)}`,
      `Cumplimiento: ${pct(summary.summary.goal_pct)}`,
    ], 'Sin datos para el periodo.');

    sectionTitle('Top atracciones y desempeño', 'Máquinas con mejor contribución económica.');
    listCard('Top 5 por ingreso', topMachines.map((row: any) => (
      `${row.machine_name} · ${money(row.revenue)} · ${row.uses} usos · ${row.avg_session_minutes.toFixed(1)} min`
    )), 'No hay atracciones con actividad registrada.');

    sectionTitle('Clientes y operación', 'Comportamiento de clientes y estado actual del arcade.');
    listCard('Indicadores operativos', [
      `Retención estimada: ${pct(executive.customer_flow.retention_rate_pct)}`,
      `Duración promedio de sesión: ${executive.machine_efficiency.average_session_minutes.toFixed(1)} min`,
      `Saldo pendiente cargado: ${money(executive.card_float.pending_loaded_money)}`,
      `Breakage estimado: ${money(executive.card_float.estimated_breakage)}`,
      `Ingreso por m2/h: ${money(executive.strategic_metric.revenue_per_m2_per_hour)}`,
    ], 'Sin indicadores operativos.');

    sectionTitle('Alertas', 'Eventos que requieren atención del administrador.');
    listCard('Alertas críticas', alerts as string[], 'Sin alertas críticas para el periodo.');

    ensureSpace(160);
    sectionTitle('Movimientos', 'Consolidado de ingresos, egresos y ajustes según filtros activos.');
    listCard('Totales de movimientos', [
      `Ingresos: ${money(movementTotals.income)}`,
      `Egresos: ${money(movementTotals.expense)}`,
      `Ajustes: ${money(movementTotals.adjustment)}`,
      `Pendientes de aprobación: ${pending?.approvals_required_count ?? 0}`,
      `Facturas electrónicas pendientes: ${pending?.electronic_invoice_count ?? 0}`,
    ], 'Sin movimientos.');

    ensureSpace(180);
    sectionTitle('Últimos movimientos', 'Vista resumida del panel de movimientos.');
    const movementWidths = [130, 110, 95, 80, 115];
    tableRow(['Movimiento', 'Fecha', 'Categoría', 'Valor', 'Autorizado'], movementWidths, true);
    movementData.slice(0, 12).forEach((row: any) => {
      ensureSpace(22);
      tableRow([
        String(row.label ?? 'N/D'),
        new Date(String(row.occurred_at)).toLocaleDateString('es-CO'),
        String(row.category ?? 'N/D'),
        money(Number(row.amount) || 0),
        String(row.authorized_by ?? 'N/D'),
      ], movementWidths);
    });

    ensureSpace(160);
    sectionTitle('Inventario', 'Totales resumidos por categoría.');
    const inventoryItems = Array.isArray(inventory?.summary) ? inventory.summary : [];
    listCard('Resumen inventario', inventoryItems.map((group: any) => (
      `${group.category}: actual ${group.total_current} · vendidas/redimidas ${group.total_sold_or_redeemed}`
    )), 'Sin datos de inventario.');

    doc.end();
  });

  app.get('/reports/daily', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = sanitizeUuid((req.query as any).site_id);
    const format = sanitizeText((req.query as any).format, 20).toLowerCase();
    if (!siteId) {
      reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'site_id requerido' } });
      return;
    }

    const { start } = getBogotaDayRange();

    const sales = await prisma.sale.findMany({
      where: {
        siteId,
        createdAt: { gte: start },
        status: { in: ['PAID', 'PARTIAL'] },
      },
      include: { payments: true, lines: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    if (format === 'xls') {
      const rows = sales.flatMap((sale) => (
        sale.lines.map((line) => ({
          saleId: sale.id.slice(0, 8),
          createdAt: sale.createdAt.toLocaleString('es-CO'),
          status: sale.status,
          paymentMethod: sale.payments[0]?.method ?? 'N/A',
          productName: line.product?.name ?? 'Producto',
          category: resolveCategoryGroup({ category: line.category, product: line.product }),
          quantity: line.quantity,
          lineTotal: line.lineTotal.toFixed(2),
          saleTotal: sale.total.toFixed(2),
        }))
      ));
      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
          </head>
          <body>
            <table border="1">
              <tr>
                <th>Venta</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Pago</th>
                <th>Tipo</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Total linea</th>
                <th>Total venta</th>
              </tr>
              ${rows.map((row) => `
                <tr>
                  <td>${row.saleId}</td>
                  <td>${row.createdAt}</td>
                  <td>${row.status}</td>
                  <td>${row.paymentMethod}</td>
                  <td>${row.category}</td>
                  <td>${row.productName}</td>
                  <td>${row.quantity}</td>
                  <td>${row.lineTotal}</td>
                  <td>${row.saleTotal}</td>
                </tr>
              `).join('')}
            </table>
          </body>
        </html>
      `;
      reply
        .type('application/vnd.ms-excel; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="reporte-dia-${start.toISOString().slice(0, 10)}.xls"`)
        .send(html);
      return;
    }

    reply.hijack();
    const doc = new PDFDocument({ margin: 40 });
    applyStreamCorsHeaders(reply, req.headers.origin);
    reply.raw.setHeader('Content-Type', 'application/pdf');
    reply.raw.setHeader('Content-Disposition', `attachment; filename="reporte-dia-${start.toISOString().slice(0, 10)}.pdf"`);
    doc.pipe(reply.raw);

    doc.fontSize(16).text('POLIVERSE - Reporte del Día', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Fecha: ${start.toLocaleDateString('es-CO')}`, { align: 'center' });
    doc.moveDown();

    let totalSum = 0;
    sales.forEach((sale, idx) => {
      totalSum += Number(sale.total);
      doc.fontSize(11).text(`${idx + 1}. Venta ${sale.id.slice(0, 8)} • ${sale.createdAt.toLocaleString('es-CO')}`);
      doc.fontSize(10).text(`Total: ${sale.total.toFixed(2)} | Medio: ${sale.payments[0]?.method ?? 'N/A'} | Estado: ${sale.status}`);
      sale.lines.forEach((line) => {
        doc.fontSize(9).text(`  - ${line.product?.name ?? 'Producto'} x${line.quantity} = ${line.lineTotal.toFixed(2)}`);
      });
      doc.moveDown(0.4);
    });

    doc.moveDown();
    doc.fontSize(12).text(`Total del día: ${totalSum.toFixed(2)}`, { align: 'right' });
    doc.end();
  });
}
