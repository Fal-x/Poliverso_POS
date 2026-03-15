import { AuditAction, EntityType, Prisma } from '@prisma/client';
import { prisma } from '@/backend/prisma';

export async function writeAuditLog(args: {
  siteId: string;
  actorId: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  reason?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      siteId: args.siteId,
      actorId: args.actorId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      before: args.before ?? undefined,
      after: args.after ?? undefined,
      reason: args.reason ?? null,
    },
  });
}

