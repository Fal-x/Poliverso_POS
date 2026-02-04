import {
  AuditAction,
  CashCountType,
  CashMovementType,
  CashSessionStatus,
  EntityType,
  PaymentMethod,
  PermissionCode,
  Prisma,
  SaleStatus,
} from "@prisma/client";
import { prisma } from "../prisma";
import {
  assertNoOpenSession,
  assertPositiveAmount,
  assertReason,
  assertSupervisorApproval,
  assertUserHasPermission,
  DomainError,
} from "../validation/cashSessionValidators";

const D = (value: number | string | Prisma.Decimal) => new Prisma.Decimal(value);

// ---- Public API ----

export async function openCashSession(args: {
  siteId: string;
  terminalId: string;
  cashRegisterId: string;
  shiftId?: string | null;
  openedByUserId: string;
  openingCashAmount: Prisma.Decimal;
  denominations: Prisma.JsonValue;
  approvalId?: string | null;
}) {
  await assertUserHasPermission({
    userId: args.openedByUserId,
    siteId: args.siteId,
    permission: PermissionCode.CASH_SHIFT_OPEN,
  });

  const openSession = await prisma.cashSession.findFirst({
    where: {
      terminalId: args.terminalId,
      status: CashSessionStatus.OPEN,
    },
    select: { id: true },
  });
  assertNoOpenSession(openSession?.id);

  const suggested = await getSuggestedOpeningCash({
    terminalId: args.terminalId,
    cashRegisterId: args.cashRegisterId,
  });

  if (!suggested.equals(args.openingCashAmount) && !args.approvalId && !args.openingCashAmount.lte(D(0))) {
    throw new DomainError("La apertura requiere autorización para ajustar el efectivo sugerido.");
  }
  if (args.approvalId) {
    await assertSupervisorApproval({ approvalId: args.approvalId, siteId: args.siteId });
  }

  return prisma.$transaction(async (tx) => {
    const session = await tx.cashSession.create({
      data: {
        siteId: args.siteId,
        terminalId: args.terminalId,
        cashRegisterId: args.cashRegisterId,
        shiftId: args.shiftId ?? null,
        openedByUserId: args.openedByUserId,
        openingCashAmount: args.openingCashAmount,
        expectedCashAmount: args.openingCashAmount,
        status: CashSessionStatus.OPEN,
        openedApprovalId: args.approvalId ?? null,
      },
    });

    await tx.cashCount.create({
      data: {
        siteId: args.siteId,
        cashSessionId: session.id,
        type: CashCountType.OPENING,
        denominations: args.denominations,
        totalAmount: args.openingCashAmount,
        countedByUserId: args.openedByUserId,
      },
    });

    await tx.auditLog.create({
      data: {
        siteId: args.siteId,
        actorId: args.openedByUserId,
        action: AuditAction.OPEN,
        entityType: EntityType.CASH_SESSION,
        entityId: session.id,
        after: {
          openingCashAmount: session.openingCashAmount.toFixed(2),
          suggested: suggested.toFixed(2),
          terminalId: args.terminalId,
        },
      },
    });

    return session;
  });
}

export async function registerCashMovement(args: {
  siteId: string;
  cashSessionId: string;
  type: CashMovementType;
  amount: Prisma.Decimal;
  reason: string;
  createdByUserId: string;
  authorizedByUserId: string;
  approvalId?: string | null;
}) {
  assertPositiveAmount(args.amount);
  assertReason(args.reason);

  await assertUserHasPermission({
    userId: args.createdByUserId,
    siteId: args.siteId,
    permission: PermissionCode.CASH_WITHDRAWAL_CREATE,
  });

  if (!args.approvalId) {
    throw new DomainError("El movimiento requiere autorización registrada.");
  }
  await assertSupervisorApproval({
    approvalId: args.approvalId,
    siteId: args.siteId,
  });

  return prisma.$transaction(async (tx) => {
    const session = await tx.cashSession.findFirst({
      where: { id: args.cashSessionId, status: CashSessionStatus.OPEN },
    });

    if (!session) {
      throw new DomainError("No existe una caja abierta para registrar movimientos.");
    }

    const movement = await tx.cashMovement.create({
      data: {
        siteId: args.siteId,
        cashSessionId: args.cashSessionId,
        type: args.type,
        amount: args.amount,
        reason: args.reason,
        createdByUserId: args.createdByUserId,
        authorizedByUserId: args.authorizedByUserId,
        approvalId: args.approvalId ?? null,
      },
    });

    const delta = args.type === CashMovementType.WITHDRAWAL ? args.amount.mul(-1) : args.amount;

    await tx.cashSession.update({
      where: { id: session.id },
      data: {
        expectedCashAmount: session.expectedCashAmount.add(delta),
      },
    });

    await tx.auditLog.create({
      data: {
        siteId: args.siteId,
        actorId: args.createdByUserId,
        action: AuditAction.ADJUST,
        entityType: EntityType.CASH_SESSION,
        entityId: session.id,
        after: {
          type: args.type,
          amount: args.amount.toFixed(2),
          reason: args.reason,
        },
      },
    });

    return movement;
  });
}

export async function closeCashSession(args: {
  siteId: string;
  cashSessionId: string;
  closedByUserId: string;
  denominations: Prisma.JsonValue;
  closingCashAmount: Prisma.Decimal;
  closeReason?: string | null;
  approvalId?: string | null;
}) {
  await assertUserHasPermission({
    userId: args.closedByUserId,
    siteId: args.siteId,
    permission: PermissionCode.CASH_SHIFT_CLOSE,
  });

  return prisma.$transaction(async (tx) => {
    const session = await tx.cashSession.findFirst({
      where: { id: args.cashSessionId, status: CashSessionStatus.OPEN },
    });

    if (!session) {
      throw new DomainError("No existe una caja abierta para cerrar.");
    }

    const openSales = await tx.sale.count({
      where: { cashSessionId: session.id, status: SaleStatus.OPEN },
    });

    if (openSales > 0) {
      throw new DomainError("Existen ventas abiertas; cierre bloqueado.");
    }

    const paymentsByMethod = await tx.salePayment.groupBy({
      by: ["method"],
      where: { sale: { cashSessionId: session.id, status: SaleStatus.PAID } },
      _sum: { amount: true },
    });

    const cashSales = paymentsByMethod
      .filter(p => p.method === PaymentMethod.CASH)
      .reduce((sum, p) => sum.add(p._sum.amount ?? D(0)), D(0));

    const withdrawals = await tx.cashMovement.aggregate({
      where: { cashSessionId: session.id, type: CashMovementType.WITHDRAWAL },
      _sum: { amount: true },
    });

    const adjustments = await tx.cashMovement.aggregate({
      where: { cashSessionId: session.id, type: CashMovementType.ADJUSTMENT },
      _sum: { amount: true },
    });

    const expected = session.openingCashAmount
      .add(cashSales)
      .minus(withdrawals._sum.amount ?? D(0))
      .add(adjustments._sum.amount ?? D(0));

    const difference = args.closingCashAmount.sub(expected);

    if (!difference.equals(0)) {
      assertReason(args.closeReason ?? null);
      if (!args.approvalId) {
        throw new DomainError("Diferencia detectada: requiere autorización de supervisor.");
      }
      await assertSupervisorApproval({
        approvalId: args.approvalId,
        siteId: args.siteId,
      });
    }

    await tx.cashCount.create({
      data: {
        siteId: args.siteId,
        cashSessionId: session.id,
        type: CashCountType.CLOSING,
        denominations: args.denominations,
        totalAmount: args.closingCashAmount,
        countedByUserId: args.closedByUserId,
      },
    });

    const closed = await tx.cashSession.update({
      where: { id: session.id },
      data: {
        closedAt: new Date(),
        closedById: args.closedByUserId,
        expectedCashAmount: expected,
        closingCashAmount: args.closingCashAmount,
        cashDifference: difference,
        closeReason: args.closeReason ?? null,
        status: CashSessionStatus.CLOSED,
        closedApprovalId: args.approvalId ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        siteId: args.siteId,
        actorId: args.closedByUserId,
        action: AuditAction.CLOSE,
        entityType: EntityType.CASH_SESSION,
        entityId: session.id,
        after: {
          expected: expected.toFixed(2),
          counted: args.closingCashAmount.toFixed(2),
          difference: difference.toFixed(2),
        },
      },
    });

    return {
      session: closed,
      totals: {
        cashSales: cashSales.toFixed(2),
        expectedCash: expected.toFixed(2),
        closingCash: args.closingCashAmount.toFixed(2),
        difference: difference.toFixed(2),
      },
    };
  });
}

// ---- Helpers ----

async function getSuggestedOpeningCash(args: {
  terminalId: string;
  cashRegisterId: string;
}) {
  const lastClosed = await prisma.cashSession.findFirst({
    where: {
      terminalId: args.terminalId,
      cashRegisterId: args.cashRegisterId,
      status: CashSessionStatus.CLOSED,
    },
    orderBy: { closedAt: "desc" },
  });

  if (!lastClosed) {
    return D(0);
  }

  const base =
    lastClosed.closingCashAmount ??
    lastClosed.expectedCashAmount ??
    lastClosed.openingCashAmount;

  const withdrawalsAfter = await prisma.cashMovement.aggregate({
    where: {
      type: CashMovementType.WITHDRAWAL,
      createdAt: { gt: lastClosed.closedAt ?? lastClosed.openedAt },
      cashSession: {
        terminalId: args.terminalId,
        cashRegisterId: args.cashRegisterId,
      },
    },
    _sum: { amount: true },
  });

  return base.sub(withdrawalsAfter._sum.amount ?? D(0));
}
