import { ApprovalAction, PermissionCode, Prisma, RoleName } from "@prisma/client";
import { prisma } from "../prisma";

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export function assertPositiveAmount(amount: Prisma.Decimal) {
  if (amount.lte(new Prisma.Decimal(0))) {
    throw new DomainError("El monto debe ser mayor a cero.");
  }
}

export async function assertUserHasPermission(args: {
  userId: string;
  siteId: string;
  permission: PermissionCode;
}) {
  const assignment = await prisma.userAssignment.findFirst({
    where: {
      userId: args.userId,
      siteId: args.siteId,
      isActive: true,
      role: {
        permissions: {
          some: { permission: args.permission },
        },
      },
    },
  });

  if (!assignment) {
    throw new DomainError("Usuario sin permisos para esta operación.");
  }
}

export async function assertSupervisorApproval(args: {
  approvalId: string;
  siteId: string;
  action?: ApprovalAction;
}) {
  const approval = await prisma.supervisorApproval.findFirst({
    where: {
      id: args.approvalId,
      siteId: args.siteId,
      ...(args.action ? { action: args.action } : {}),
    },
    include: { approvedBy: { include: { assignments: { include: { role: true } } } } },
  });

  if (!approval) {
    throw new DomainError("Autorización inválida o inexistente.");
  }

  const hasSupervisorRole = approval.approvedBy.assignments.some(
    (a) =>
      a.siteId === args.siteId &&
      (a.role.name === RoleName.SUPERVISOR || a.role.name === RoleName.ADMIN)
  );

  if (!hasSupervisorRole) {
    throw new DomainError("La autorización debe ser de un supervisor o administrador.");
  }
}

export function assertNoOpenSession(openSessionId?: string | null) {
  if (openSessionId) {
    throw new DomainError("Ya existe una caja abierta para esta terminal.");
  }
}

export function assertReason(reason?: string | null) {
  if (!reason || reason.trim().length < 3) {
    throw new DomainError("El motivo es obligatorio.");
  }
}
