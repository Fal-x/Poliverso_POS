import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '@/backend/prisma';
import { requireAuth } from '../middleware/auth';
import { ok, fail } from '../utils/response';

export async function approvalRoutes(app: FastifyInstance) {
  app.post('/supervisor-approvals', { preHandler: [requireAuth] }, async (req, reply) => {
    const body = req.body as {
      site_id: string;
      requested_by_user_id: string;
      action: string;
      entity_type: string;
      entity_id: string;
      reason: string;
      supervisor_code: string;
    };

    if (!body?.site_id || !body?.requested_by_user_id || !body?.entity_id || !body?.supervisor_code || !body?.reason) {
      return fail(reply, 'VALIDATION_ERROR', 'Campos requeridos incompletos');
    }

    const authUser = (req as any).authUser as { id: string } | undefined;
    if (authUser?.id && authUser.id !== body.requested_by_user_id) {
      return fail(reply, 'FORBIDDEN', 'Usuario no autorizado para solicitar aprobación', 403);
    }

    const supervisors = await prisma.userAssignment.findMany({
      where: {
        siteId: body.site_id,
        isActive: true,
        role: { name: { in: ['SUPERVISOR', 'ADMIN'] } },
      },
      include: {
        user: { include: { authCode: true } },
        role: true,
      },
    });

    const now = new Date();
    let approvedById: string | null = null;

    for (const assignment of supervisors) {
      const authCode = assignment.user.authCode;
      if (!authCode) continue;
      if (authCode.expiresAt <= now) continue;
      if (authCode.lockedUntil && authCode.lockedUntil > now) continue;
      if (await bcrypt.compare(body.supervisor_code, authCode.codeHash)) {
        approvedById = assignment.user.id;
        break;
      }
    }

    if (!approvedById) {
      return fail(reply, 'INVALID_CODE', 'Código de supervisor inválido', 401);
    }

    const approval = await prisma.supervisorApproval.create({
      data: {
        siteId: body.site_id,
        action: body.action as any,
        entityType: body.entity_type as any,
        entityId: body.entity_id,
        requestedById: body.requested_by_user_id,
        approvedById,
        reason: body.reason,
      },
    });

    return ok(reply, { id: approval.id, approved_by_id: approvedById });
  });
}
