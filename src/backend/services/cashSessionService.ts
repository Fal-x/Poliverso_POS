import {
  AuditAction,
  CashMovementType,
  CashSessionStatus,
  EntityType,
  PaymentMethod,
  PermissionCode,
  Prisma,
  SaleStatus,
  ShiftStatus,
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
import { publishSiteNotification } from "../api/realtime/notificationHub";

const D = (value: number | string | Prisma.Decimal) => new Prisma.Decimal(value);
const HIGH_CASH_THRESHOLD = D(500000);

// ---- Public API ----

export async function openCashSession(args: {
  siteId: string;
  terminalId: string;
  cashRegisterId: string;
  shiftId?: string | null;
  openedByUserId: string;
  openingCashAmount: Prisma.Decimal;
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
    select: {
      id: true,
      openedByUserId: true,
      cashRegisterId: true,
      shiftId: true,
    },
  });
  if (openSession) {
    if (openSession.openedByUserId !== args.openedByUserId || openSession.cashRegisterId !== args.cashRegisterId) {
      assertNoOpenSession(openSession.id);
    }
  }

  const openingReference = await getOpeningReference({
    siteId: args.siteId,
    terminalId: args.terminalId,
    cashRegisterId: args.cashRegisterId,
  });
  const suggested = openingReference.suggestedOpeningCash;

  if (!suggested.equals(args.openingCashAmount) && !args.approvalId) {
    throw new DomainError("La apertura requiere autorización para ajustar el efectivo sugerido.");
  }
  if (args.approvalId) {
    await assertSupervisorApproval({ approvalId: args.approvalId, siteId: args.siteId });
  }

  return prisma.$transaction(async (tx) => {
    let resolvedShiftId = args.shiftId ?? null;
    if (!resolvedShiftId) {
      const existingShift = await tx.shift.findFirst({
        where: {
          siteId: args.siteId,
          terminalId: args.terminalId,
          cashRegisterId: args.cashRegisterId,
          status: ShiftStatus.OPEN,
        },
        select: { id: true },
      });
      if (existingShift) {
        resolvedShiftId = existingShift.id;
      } else {
        const createdShift = await tx.shift.create({
          data: {
            siteId: args.siteId,
            terminalId: args.terminalId,
            cashRegisterId: args.cashRegisterId,
            openedById: args.openedByUserId,
            openedAt: new Date(),
            openingCash: args.openingCashAmount,
            status: ShiftStatus.OPEN,
            notes: "Turno abierto automáticamente por apertura de caja.",
          },
        });

        await tx.auditLog.create({
          data: {
            siteId: args.siteId,
            actorId: args.openedByUserId,
            action: AuditAction.OPEN,
            entityType: EntityType.SHIFT,
            entityId: createdShift.id,
            after: {
              openingCash: createdShift.openingCash.toFixed(2),
              terminalId: args.terminalId,
              cashRegisterId: args.cashRegisterId,
              autoOpened: true,
            },
          },
        });

        resolvedShiftId = createdShift.id;
      }
    }

    if (openSession) {
      if (!openSession.shiftId) {
        if (!resolvedShiftId) {
          const createdShift = await tx.shift.create({
            data: {
              siteId: args.siteId,
              terminalId: args.terminalId,
              cashRegisterId: args.cashRegisterId,
              openedById: args.openedByUserId,
              openedAt: new Date(),
              openingCash: args.openingCashAmount,
              status: ShiftStatus.OPEN,
              notes: "Turno abierto automáticamente por caja existente.",
            },
          });

          await tx.auditLog.create({
            data: {
              siteId: args.siteId,
              actorId: args.openedByUserId,
              action: AuditAction.OPEN,
              entityType: EntityType.SHIFT,
              entityId: createdShift.id,
              after: {
                openingCash: createdShift.openingCash.toFixed(2),
                terminalId: args.terminalId,
                cashRegisterId: args.cashRegisterId,
                autoOpened: true,
                reason: "attach_to_existing_cash_session",
              },
            },
          });

          resolvedShiftId = createdShift.id;
        }

        await tx.cashSession.update({
          where: { id: openSession.id },
          data: { shiftId: resolvedShiftId },
        });
      }

      return tx.cashSession.findUniqueOrThrow({ where: { id: openSession.id } });
    }

    const session = await tx.cashSession.create({
      data: {
        siteId: args.siteId,
        terminalId: args.terminalId,
        cashRegisterId: args.cashRegisterId,
        shiftId: resolvedShiftId,
        openedByUserId: args.openedByUserId,
        openingCashAmount: args.openingCashAmount,
        expectedCashAmount: args.openingCashAmount,
        status: CashSessionStatus.OPEN,
        openedApprovalId: args.approvalId ?? null,
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
      where: { id: args.cashSessionId, siteId: args.siteId, status: CashSessionStatus.OPEN },
    });

    if (!session) {
      throw new DomainError("No existe una caja abierta para registrar movimientos.");
    }

    const currentExpectedCash = await syncExpectedCashForSession(tx, session.id);
    if (args.type === CashMovementType.WITHDRAWAL && args.amount.greaterThan(currentExpectedCash)) {
      throw new DomainError("El retiro no puede ser mayor al efectivo disponible en caja.");
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

    const expected = await syncExpectedCashForSession(tx, session.id);

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
          expectedCashAmount: expected.toFixed(2),
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
      where: { id: args.cashSessionId, siteId: args.siteId, status: CashSessionStatus.OPEN },
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

    const expected = await syncExpectedCashForSession(tx, session.id);
    const cashSales = await getCashSalesForSession(tx, session.id);

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

export async function voidCashMovement(args: {
  siteId: string;
  cashSessionId: string;
  movementId: string;
  voidedByUserId: string;
  approvalId: string;
  reason: string;
}) {
  assertReason(args.reason);

  await assertUserHasPermission({
    userId: args.voidedByUserId,
    siteId: args.siteId,
    permission: PermissionCode.CASH_WITHDRAWAL_CREATE,
  });

  await assertSupervisorApproval({
    approvalId: args.approvalId,
    siteId: args.siteId,
  });

  return prisma.$transaction(async (tx) => {
    const session = await tx.cashSession.findFirst({
      where: { id: args.cashSessionId, siteId: args.siteId, status: CashSessionStatus.OPEN },
    });

    if (!session) {
      throw new DomainError("No existe una caja abierta para anular movimientos.");
    }

    const movement = await tx.cashMovement.findFirst({
      where: {
        id: args.movementId,
        cashSessionId: args.cashSessionId,
        voidedAt: null,
      },
    });

    if (!movement) {
      throw new DomainError("Movimiento no encontrado o ya anulado.");
    }

    await tx.cashMovement.update({
      where: { id: movement.id },
      data: {
        voidedAt: new Date(),
        voidedByUserId: args.voidedByUserId,
        voidedApprovalId: args.approvalId,
        voidReason: args.reason,
      },
    });

    const expected = await syncExpectedCashForSession(tx, session.id);

    await tx.auditLog.create({
      data: {
        siteId: args.siteId,
        actorId: args.voidedByUserId,
        action: AuditAction.VOID,
        entityType: EntityType.CASH_SESSION,
        entityId: session.id,
        after: {
          movementId: movement.id,
          amount: movement.amount.toFixed(2),
          type: movement.type,
          reason: args.reason,
          expectedCashAmount: expected.toFixed(2),
        },
      },
    });

    return movement;
  });
}

// ---- Helpers ----

export async function getOpeningReference(args: {
  siteId: string;
  terminalId: string;
  cashRegisterId: string;
}) {
  const lastClosed = await prisma.cashSession.findFirst({
    where: {
      siteId: args.siteId,
      terminalId: args.terminalId,
      cashRegisterId: args.cashRegisterId,
      status: CashSessionStatus.CLOSED,
    },
    orderBy: { closedAt: "desc" },
  });

  const lastClosedCash =
    lastClosed?.closingCashAmount ??
    lastClosed?.expectedCashAmount ??
    lastClosed?.openingCashAmount ??
    D(0);

  return {
    suggestedOpeningCash: lastClosedCash,
    lastClosedCash,
    lastClosedAt: lastClosed?.closedAt ?? null,
    lastSessionId: lastClosed?.id ?? null,
  };
}

export async function getCashSessionFinancials(args: {
  siteId: string;
  cashSessionId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.cashSession.findUnique({
      where: { id: args.cashSessionId },
    });

    if (!session || session.siteId !== args.siteId) {
      throw new DomainError("Caja no encontrada.");
    }

    const cashSales = await getCashSalesForSession(tx, session.id);
    const withdrawals = await tx.cashMovement.aggregate({
      where: { cashSessionId: session.id, type: CashMovementType.WITHDRAWAL, voidedAt: null },
      _sum: { amount: true },
    });
    const adjustments = await tx.cashMovement.aggregate({
      where: { cashSessionId: session.id, type: CashMovementType.ADJUSTMENT, voidedAt: null },
      _sum: { amount: true },
    });
    const expected = await syncExpectedCashForSession(tx, session.id);

    return {
      session,
      cashSales,
      withdrawals: withdrawals._sum.amount ?? D(0),
      adjustments: adjustments._sum.amount ?? D(0),
      expectedCash: expected,
    };
  });
}

export async function syncExpectedCashAmount(args: {
  siteId: string;
  cashSessionId: string;
}) {
  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.cashSession.findUnique({
      where: { id: args.cashSessionId },
    });

    if (!session || session.siteId !== args.siteId) {
      throw new DomainError("Caja no encontrada.");
    }

    const expected = await syncExpectedCashForSession(tx, session.id);
    return {
      sessionId: session.id,
      expected,
      crossedThreshold:
        session.expectedCashAmount.lessThan(HIGH_CASH_THRESHOLD)
        && expected.greaterThanOrEqualTo(HIGH_CASH_THRESHOLD),
    };
  });

  if (result.crossedThreshold) {
    publishSiteNotification(args.siteId, {
      type: 'cash_threshold_alert',
      site_id: args.siteId,
      created_at: new Date().toISOString(),
      message: 'La caja superó el umbral de efectivo recomendado.',
      data: {
        cash_session_id: result.sessionId,
        expected_cash_amount: result.expected.toFixed(2),
        threshold_amount: HIGH_CASH_THRESHOLD.toFixed(2),
      },
    });
  }

  return { sessionId: result.sessionId, expected: result.expected };
}

async function getCashSalesForSession(tx: Prisma.TransactionClient, cashSessionId: string) {
  const paymentsByMethod = await tx.salePayment.groupBy({
    by: ["method"],
    where: { sale: { cashSessionId, status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] } } },
    _sum: { amount: true },
  });

  return paymentsByMethod
    .filter(p => p.method === PaymentMethod.CASH)
    .reduce((sum, p) => sum.add(p._sum.amount ?? D(0)), D(0));
}

async function syncExpectedCashForSession(tx: Prisma.TransactionClient, cashSessionId: string) {
  const session = await tx.cashSession.findUnique({
    where: { id: cashSessionId },
    select: { id: true, openingCashAmount: true, expectedCashAmount: true },
  });

  if (!session) {
    throw new DomainError("Caja no encontrada.");
  }

  const cashSales = await getCashSalesForSession(tx, cashSessionId);
  const withdrawals = await tx.cashMovement.aggregate({
    where: {
      cashSessionId,
      type: CashMovementType.WITHDRAWAL,
      voidedAt: null,
    },
    _sum: { amount: true },
  });
  const adjustments = await tx.cashMovement.aggregate({
    where: {
      cashSessionId,
      type: CashMovementType.ADJUSTMENT,
      voidedAt: null,
    },
    _sum: { amount: true },
  });

  const expected = session.openingCashAmount
    .add(cashSales)
    .minus(withdrawals._sum.amount ?? D(0))
    .add(adjustments._sum.amount ?? D(0));

  if (!session.expectedCashAmount.equals(expected)) {
    await tx.cashSession.update({
      where: { id: session.id },
      data: { expectedCashAmount: expected },
    });
  }

  return expected;
}
