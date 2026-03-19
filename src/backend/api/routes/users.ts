import type { FastifyInstance } from 'fastify';
import { prisma } from '@/backend/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, fail } from '../utils/response';

export async function userRoutes(app: FastifyInstance) {
  app.get('/auth/users', async (req, reply) => {
    const siteId = (req.query as any).site_id as string | undefined;
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const assignments = await prisma.userAssignment.findMany({
      where: { siteId, isActive: true, user: { status: 'ACTIVE' } },
      include: { user: true, role: true },
    });
    const data = assignments.map(a => ({
      id: a.user.id,
      name: a.user.fullName,
      email: a.user.email,
      role: a.role.name === 'ADMIN' ? 'admin' : a.role.name === 'SUPERVISOR' ? 'supervisor' : 'cashier',
    }));
    return ok(reply, data);
  });

  app.get('/users', { preHandler: [requireAuth, requireRole('supervisor')] }, async (req, reply) => {
    const siteId = (req.query as any).site_id as string | undefined;
    if (!siteId) return fail(reply, 'VALIDATION_ERROR', 'site_id requerido');
    const assignments = await prisma.userAssignment.findMany({
      where: { siteId, isActive: true, user: { status: 'ACTIVE' } },
      include: { user: true, role: true },
    });
    const data = assignments.map(a => ({
      id: a.user.id,
      name: a.user.fullName,
      email: a.user.email,
      role: a.role.name === 'ADMIN' ? 'admin' : a.role.name === 'SUPERVISOR' ? 'supervisor' : 'cashier',
    }));
    return ok(reply, data);
  });
}
