import type { FastifyInstance } from 'fastify';
import { requireAuth, requireRole } from '../middleware/auth';
import { fail } from '../utils/response';

export async function stubRoutes(app: FastifyInstance) {
  const notImplemented = (_req: any, reply: any) =>
    fail(reply, 'NOT_IMPLEMENTED', 'Endpoint no implementado todavía', 501);

  const guarded = { preHandler: [requireAuth, requireRole('cashier')] } as const;

  app.get('/inventory', guarded, notImplemented);
  app.post('/inventory/movements', guarded, notImplemented);
  app.get('/prizes', guarded, notImplemented);
  app.post('/prizes/redeem', guarded, notImplemented);
  app.post('/attractions/usages', guarded, notImplemented);
  app.get('/reports/daily', guarded, notImplemented);
  app.get('/reports/cash', guarded, notImplemented);
}
