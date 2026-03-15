import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '@/backend/prisma';
import { requireAuth } from '../middleware/auth';
import { ok, fail } from '../utils/response';
import { sanitizeDigits, sanitizeId, sanitizeText, sanitizeUuid } from '@/backend/utils/sanitize';

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

    const siteId = sanitizeUuid(body?.site_id);
    const requestedByUserId = sanitizeUuid(body?.requested_by_user_id);
    const action = sanitizeId(body?.action, 50);
    const entityType = sanitizeId(body?.entity_type, 50);
    const entityId = sanitizeId(body?.entity_id, 100);
    const reason = sanitizeText(body?.reason, 400);
    const supervisorCode = sanitizeDigits(body?.supervisor_code, 8);

    if (!siteId || !requestedByUserId || !action || !entityType || !entityId || !supervisorCode || !reason) {
      return fail(reply, 'VALIDATION_ERROR', 'Campos requeridos incompletos');
    }

    const authUser = (req as any).authUser as { id: string } | undefined;
    if (authUser?.id && authUser.id !== requestedByUserId) {
      return fail(reply, 'FORBIDDEN', 'Usuario no autorizado para solicitar aprobación', 403);
    }

    const supervisors = await prisma.userAssignment.findMany({
      where: {
        siteId,
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
      if (await bcrypt.compare(supervisorCode, authCode.codeHash)) {
        approvedById = assignment.user.id;
        break;
      }
    }

    if (!approvedById) {
      return fail(reply, 'INVALID_CODE', 'Código de supervisor inválido', 401);
    }

    const approval = await prisma.supervisorApproval.create({
      data: {
        siteId,
        action: action as any,
        entityType: entityType as any,
        entityId,
        requestedById: requestedByUserId,
        approvedById,
        reason,
      },
    });

    return ok(reply, { id: approval.id, approved_by_id: approvedById });
  });
}
