import type { FastifyInstance } from 'fastify';
import { prisma } from '@/backend/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, fail } from '../utils/response';

export async function catalogRoutes(app: FastifyInstance) {
  app.get('/sites', async (_req, reply) => {
    const sites = await prisma.site.findMany({ orderBy: { name: 'asc' } });
    return ok(reply, sites.map(s => ({ id: s.id, name: s.name, code: s.code })));
  });

  app.get('/pos/context', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const siteId = (req.query as any).site_id as string;
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');

    const shift = await prisma.shift.findFirst({
      where: { siteId, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    });

    const terminal = shift
      ? await prisma.terminal.findUnique({ where: { id: shift.terminalId } })
      : await prisma.terminal.findFirst({ where: { siteId } });

    const cashRegister = shift
      ? await prisma.cashRegister.findUnique({ where: { id: shift.cashRegisterId } })
      : await prisma.cashRegister.findFirst({ where: { siteId } });

    const cashSession = shift
      ? await prisma.cashSession.findFirst({ where: { shiftId: shift.id, status: 'OPEN' } })
      : null;

    return ok(reply, {
      shift_id: shift?.id ?? null,
      terminal_id: terminal?.id ?? null,
      cash_register_id: cashRegister?.id ?? null,
      cash_session_id: cashSession?.id ?? null,
    });
  });

  app.get('/products', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const siteId = (req.query as any).site_id as string;
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const products = await prisma.product.findMany({
      where: { siteId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return ok(reply, products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price.toFixed(2),
      category: p.category,
      sku: p.sku,
    })));
  });

  app.get('/bonus-scales', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const siteId = (req.query as any).site_id as string;
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const bonuses = await prisma.bonusScale.findMany({ where: { siteId }, orderBy: { minAmount: 'asc' } });
    return ok(reply, bonuses.map(b => ({
      id: b.id,
      min_amount: b.minAmount.toFixed(2),
      max_amount: b.maxAmount?.toFixed(2) ?? null,
      bonus_amount: b.bonusAmount.toFixed(2),
    })));
  });

  app.get('/site-config', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const siteId = (req.query as any).site_id as string;
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const config = await prisma.siteConfig.findUnique({ where: { siteId } });
    if (!config) return fail(reply, 'NOT_FOUND', 'Config no encontrada', 404);
    return ok(reply, {
      min_recharge_amount: config.minRechargeAmount.toFixed(2),
      points_per_currency: config.pointsPerCurrency,
      currency_unit: config.currencyUnit,
    });
  });

  app.get('/attractions', { preHandler: [requireAuth, requireRole('cashier')] }, async (req, reply) => {
    const siteId = (req.query as any).site_id as string;
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const attractions = await prisma.attraction.findMany({
      where: { siteId },
      include: { readers: true },
      orderBy: { name: 'asc' },
    });
    return ok(reply, attractions.map(a => ({
      id: a.id,
      name: a.name,
      code: a.code,
      price_per_use: a.cost.toFixed(2),
      readers: a.readers.length,
      status: a.isActive ? 'active' : 'inactive',
    })));
  });

  app.get('/inventory/prizes', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = (req.query as any).site_id as string;
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const prizes = await prisma.inventoryItem.findMany({
      where: { siteId, category: 'PRIZE', isActive: true },
      orderBy: { name: 'asc' },
    });
    return ok(reply, prizes.map(p => ({
      id: p.id,
      name: p.name,
      stock: 0,
      points_required: 0,
    })));
  });
}
