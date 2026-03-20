/* eslint-disable no-console */
import { PrismaClient, Prisma, RoleName, PermissionCode, UserStatus, SiteStatus, ShiftStatus, PaymentMethod, SaleStatus, SaleCategory, LedgerEventType, LedgerEntrySide, LedgerAccount, InventoryCategory, InventoryMovementType, AttractionUsageType, ServiceStatus, AuditAction, ApprovalAction, EntityType, CardStatus, CashSessionStatus, CustomerDocumentType, TipoOperacionVendible } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const D = (n: number | string) => new Prisma.Decimal(n);
const ESP_TOKEN_PREFIX = "dev-esp-token";
const ESP_HMAC_PREFIX = "dev-esp-hmac-secret";

// ---------- Helpers ----------
async function hash(pw: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pw, salt);
}

function nowMinusDays(days: number) {
  const dt = new Date();
  dt.setDate(dt.getDate() - days);
  return dt;
}

function daysAgoAt(days: number, hour: number, minute = 0) {
  const dt = nowMinusDays(days);
  dt.setHours(hour, minute, 0, 0);
  return dt;
}

type Entry = { account: LedgerAccount; side: LedgerEntrySide; amount: Prisma.Decimal };

function mustBalance(entries: Entry[]) {
  const debit = entries
    .filter(e => e.side === "DEBIT")
    .reduce((a, b) => a.add(b.amount), D(0));
  const credit = entries
    .filter(e => e.side === "CREDIT")
    .reduce((a, b) => a.add(b.amount), D(0));
  if (!debit.equals(credit)) {
    throw new Error(`Ledger not balanced. Debit=${debit.toFixed(2)} Credit=${credit.toFixed(2)}`);
  }
}

async function createLedgerEvent(args: {
  siteId: string;
  createdById: string;
  shiftId?: string | null;
  saleId?: string | null;
  serviceSaleId?: string | null;
  eventType: LedgerEventType;
  description: string;
  occurredAt?: Date;
  approvalId?: string | null;
  reversalOfId?: string | null;
  entries: Entry[];
}) {
  mustBalance(args.entries);

  return prisma.ledgerEvent.create({
    data: {
      siteId: args.siteId,
      shiftId: args.shiftId ?? null,
      saleId: args.saleId ?? null,
      serviceSaleId: args.serviceSaleId ?? null,
      eventType: args.eventType,
      description: args.description,
      occurredAt: args.occurredAt ?? new Date(),
      createdById: args.createdById,
      approvalId: args.approvalId ?? null,
      reversalOfId: args.reversalOfId ?? null,
      entries: {
        create: args.entries.map(e => ({
          account: e.account,
          side: e.side,
          amount: e.amount,
        })),
      },
    },
    include: { entries: true },
  });
}

async function audit(args: {
  siteId: string;
  actorId: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  before?: Prisma.JsonValue;
  after?: Prisma.JsonValue;
  reason?: string | null;
  createdAt?: Date;
}) {
  return prisma.auditLog.create({
    data: {
      siteId: args.siteId,
      actorId: args.actorId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      before: args.before ?? undefined,
      after: args.after ?? undefined,
      reason: args.reason ?? null,
      createdAt: args.createdAt ?? new Date(),
    },
  });
}

type EnrollmentPaymentSeed = {
  amount: Prisma.Decimal;
  method: PaymentMethod;
  createdAt: Date;
  createdById: string;
  notes?: string | null;
};

type EnrollmentSeed = {
  programName: string;
  groupName: string;
  startsAt: Date;
  endsAt: Date;
  dueDate: Date;
  totalAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  finalAmount: Prisma.Decimal;
  payments: EnrollmentPaymentSeed[];
  statusOverride?: ServiceStatus;
};

type PolikidSeed = {
  firstName: string;
  lastName: string;
  documentType: CustomerDocumentType;
  documentNumber: string;
  birthDate: Date;
  phone: string;
  email?: string | null;
  guardianName: string;
  guardianPhone: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "WITHDRAWN";
  notes?: string | null;
  enrollments: EnrollmentSeed[];
};

// ---------- Seed ----------
async function main() {
  // 1) Organization + Site + Config
  const organization = await prisma.organization.upsert({
    where: { name: "POLIVERSE - POLIVALENTE" },
    update: {
      legalName: "POLIVERSE S.A.S.",
      nit: "901234567-8",
      phone: "6041234567",
      address: "Cra 1 # 2-03",
      city: "Montelíbano",
    },
    create: {
      name: "POLIVERSE - POLIVALENTE",
      legalName: "POLIVERSE S.A.S.",
      nit: "901234567-8",
      phone: "6041234567",
      address: "Cra 1 # 2-03",
      city: "Montelíbano",
    },
  });

  const site = await prisma.site.upsert({
    where: { code: "MLBP-MONTELIBANO" },
    update: {
      status: SiteStatus.ACTIVE,
      timezone: "America/Bogota",
      address: "Centro Comercial MallBP",
      city: "Montelíbano",
      phone: "6041234567",
    },
    create: {
      organizationId: organization.id,
      name: "POLIVERSE MallBP Montelíbano",
      code: "MLBP-MONTELIBANO",
      status: SiteStatus.ACTIVE,
      timezone: "America/Bogota",
      address: "Centro Comercial MallBP",
      city: "Montelíbano",
      phone: "6041234567",
    },
  });

  const siteConfig = await prisma.siteConfig.upsert({
    where: { siteId: site.id },
    update: {
      minRechargeAmount: D(5000),
      pointsPerCurrency: 1,
      currencyUnit: 1000,
      dailySalesGoal: D(3500000),
      creditTermDays: 15,
    },
    create: {
      siteId: site.id,
      minRechargeAmount: D(5000),
      pointsPerCurrency: 1,
      currencyUnit: 1000,
      dailySalesGoal: D(3500000),
      creditTermDays: 15,
    },
  });

  // 2) Roles + Permissions
  const roleCashier = await prisma.role.upsert({
    where: { name: RoleName.CASHIER },
    update: {},
    create: { name: RoleName.CASHIER },
  });
  const roleSupervisor = await prisma.role.upsert({
    where: { name: RoleName.SUPERVISOR },
    update: {},
    create: { name: RoleName.SUPERVISOR },
  });
  const roleAdmin = await prisma.role.upsert({
    where: { name: RoleName.ADMIN },
    update: {},
    create: { name: RoleName.ADMIN },
  });

  const permsCashier: PermissionCode[] = [
    "POS_SALE_CREATE",
    "CASH_SHIFT_OPEN",
    "CASH_SHIFT_CLOSE",
    "CARD_ISSUE",
    "CARD_RECHARGE",
    "PRIZE_REDEEM",
    "SERVICE_SALE_CREATE",
    "REPORTS_VIEW",
  ];

  const permsSupervisor: PermissionCode[] = [
    ...permsCashier,
    "POS_SALE_VOID",
    "POS_SALE_REFUND",
    "CASH_WITHDRAWAL_CREATE",
    "CARD_BLOCK",
    "CARD_ADJUST",
    "POINTS_ADJUST",
    "ATTRACTION_USAGE_REVERSE",
    "INVENTORY_ADJUST",
    "SERVICE_SALE_ADJUST",
    "AUDIT_VIEW",
  ];

  const permsAdmin: PermissionCode[] = Object.values(PermissionCode);

  async function setRolePerms(roleId: string, perms: PermissionCode[]) {
    // idempotent: upsert each pair
    for (const p of perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permission: { roleId, permission: p } },
        update: {},
        create: { roleId, permission: p },
      });
    }
  }

  await setRolePerms(roleCashier.id, permsCashier);
  await setRolePerms(roleSupervisor.id, permsSupervisor);
  await setRolePerms(roleAdmin.id, permsAdmin);

  // 3) Users + Assignments
  const admin = await prisma.user.upsert({
    where: { email: "admin@poliverse.local" },
    update: { status: UserStatus.ACTIVE, fullName: "Admin POLIVERSE" },
    create: {
      email: "admin@poliverse.local",
      fullName: "Admin POLIVERSE",
      passwordHash: await hash("Admin123!"),
      status: UserStatus.ACTIVE,
    },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: "supervisor@poliverse.local" },
    update: { status: UserStatus.ACTIVE, fullName: "Supervisor Turno" },
    create: {
      email: "supervisor@poliverse.local",
      fullName: "Supervisor Turno",
      passwordHash: await hash("Supervisor123!"),
      status: UserStatus.ACTIVE,
    },
  });

  const cashier = await prisma.user.upsert({
    where: { email: "cajero@poliverse.local" },
    update: { status: UserStatus.ACTIVE, fullName: "Cajero" },
    create: {
      email: "cajero@poliverse.local",
      fullName: "Cajero",
      passwordHash: await hash("Cajero123!"),
      status: UserStatus.ACTIVE,
    },
  });

  const legacyCashiers = await prisma.user.findMany({
    where: {
      email: { in: ["cajero1@poliverse.local", "cajero2@poliverse.local"] },
      id: { not: cashier.id },
    },
    select: { id: true },
  });

  if (legacyCashiers.length > 0) {
    await prisma.userAssignment.updateMany({
      where: {
        userId: { in: legacyCashiers.map((entry) => entry.id) },
        siteId: site.id,
      },
      data: { isActive: false },
    });
    await prisma.user.updateMany({
      where: { id: { in: legacyCashiers.map((entry) => entry.id) } },
      data: { status: UserStatus.DISABLED },
    });
  }

  const cashier1 = cashier;
  const cashier2 = cashier;

  async function assign(userId: string, roleId: string) {
    await prisma.userAssignment.upsert({
      where: { userId_siteId_roleId: { userId, siteId: site.id, roleId } },
      update: { isActive: true },
      create: { userId, siteId: site.id, roleId, isActive: true },
    });
  }

  await assign(admin.id, roleAdmin.id);
  await assign(supervisor.id, roleSupervisor.id);
  await assign(cashier.id, roleCashier.id);

  // 3.1) Auth codes (6 digits) - demo only
  async function setAuthCode(userId: string, code: string) {
    const codeHash = await hash(code);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // demo: 30 days

    await prisma.userAuthCode.upsert({
      where: { userId },
      update: {
        codeHash,
        issuedAt: new Date(),
        expiresAt,
        failedAttempts: 0,
        lockedUntil: null,
        lastUsedAt: null,
      },
      create: {
        userId,
        codeHash,
        issuedAt: new Date(),
        expiresAt,
      },
    });
  }

  await setAuthCode(admin.id, "111111");
  await setAuthCode(supervisor.id, "222222");
  await setAuthCode(cashier.id, "333333");

  // 4) Terminals + CashRegisters
  const terminalA = await prisma.terminal.upsert({
    where: { siteId_code: { siteId: site.id, code: "T-01" } },
    update: { name: "Terminal Taquilla 1" },
    create: { siteId: site.id, code: "T-01", name: "Terminal Taquilla 1" },
  });

  const terminalB = await prisma.terminal.upsert({
    where: { siteId_code: { siteId: site.id, code: "T-02" } },
    update: { name: "Terminal Taquilla 2" },
    create: { siteId: site.id, code: "T-02", name: "Terminal Taquilla 2" },
  });

  const registerA = await prisma.cashRegister.upsert({
    where: { siteId_code: { siteId: site.id, code: "CR-01" } },
    update: { name: "Caja 1" },
    create: { siteId: site.id, code: "CR-01", name: "Caja 1" },
  });

  const registerB = await prisma.cashRegister.upsert({
    where: { siteId_code: { siteId: site.id, code: "CR-02" } },
    update: { name: "Caja 2" },
    create: { siteId: site.id, code: "CR-02", name: "Caja 2" },
  });

  // 5) BonusScale (configurable)
  // Regla: escalas exactas, no proporcionales.
  const bonusRows = [
    { min: 50000, max: 50000, bonus: 15000 },
    { min: 70000, max: 70000, bonus: 20000 },
    { min: 100000, max: 100000, bonus: 35000 },
  ];

  for (const r of bonusRows) {
    // No hay unique compuesto: hacemos "findFirst + create si no existe".
    const exists = await prisma.bonusScale.findFirst({
      where: {
        siteId: site.id,
        minAmount: D(r.min),
        maxAmount: D(r.max),
        bonusAmount: D(r.bonus),
      },
    });
    if (!exists) {
      await prisma.bonusScale.create({
        data: {
          siteId: site.id,
          minAmount: D(r.min),
          maxAmount: D(r.max),
          bonusAmount: D(r.bonus),
          createdAt: new Date(),
        },
      });
    }
  }

  // 6) Products (POS catálogo actualizado)
  // Se carga exactamente con base en tu matriz operativa compartida.
  const products = [
    // Parque
    { name: "Tarjetas", sku: "PTA-001", category: SaleCategory.CARD_PLASTIC, analyticsCategory: "Parque", analyticsSubcategory: "Tarjetas", price: D(3000) },

    // Snacks - Granizados
    { name: "Granizados 12ml", sku: "SGR-001", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Granizados", price: D(10000) },
    { name: "Granizados 16ml", sku: "SGR-002", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Granizados", price: D(14000) },

    // Snacks - Crispetas
    { name: "Crispetas", sku: "SCR-001", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Crispetas", price: D(3000) },

    // Snacks - Dulces
    { name: "Gomitas", sku: "SDU-001", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Dulces", price: D(0) },
    { name: "Chocolatina 1", sku: "SDU-002", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Dulces", price: D(0) },
    { name: "Chocolatina 2", sku: "SDU-003", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Dulces", price: D(0) },
    { name: "Chocolatina 3", sku: "SDU-004", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Dulces", price: D(0) },

    // Snacks - Mekatos
    { name: "Mekato 1", sku: "SME-001", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Mekatos", price: D(0) },
    { name: "Mekato 2", sku: "SME-002", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Mekatos", price: D(0) },
    { name: "Mekato 3", sku: "SME-003", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Mekatos", price: D(0) },
    { name: "Mekato 4", sku: "SME-004", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Mekatos", price: D(0) },
    { name: "Mekato 5", sku: "SME-005", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Mekatos", price: D(0) },
    { name: "Mekato 6", sku: "SME-006", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Mekatos", price: D(0) },
    { name: "Mekato 7", sku: "SME-007", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Mekatos", price: D(0) },
    { name: "Mekato 8", sku: "SME-008", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Mekatos", price: D(0) },
    { name: "Mekato 9", sku: "SME-009", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Mekatos", price: D(0) },
    { name: "Mekato 10", sku: "SME-010", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Mekatos", price: D(0) },

    // Snacks - Bebidas
    { name: "Gaseosa 1", sku: "SBE-001", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Bebidas", price: D(0) },
    { name: "Gaseosa 2", sku: "SBE-002", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Bebidas", price: D(0) },
    { name: "Gaseosa 3", sku: "SBE-003", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Bebidas", price: D(0) },
    { name: "Gaseosa 4", sku: "SBE-004", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Bebidas", price: D(0) },
    { name: "Gaseosa 5", sku: "SBE-005", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Bebidas", price: D(0) },
    { name: "Agua 1", sku: "SBE-006", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Bebidas", price: D(0) },
    { name: "Agua 2", sku: "SBE-007", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Bebidas", price: D(0) },
    { name: "Agua 3", sku: "SBE-008", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Bebidas", price: D(0) },
    { name: "Agua 4", sku: "SBE-009", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Bebidas", price: D(0) },
    { name: "Jugo 1", sku: "SBE-010", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Bebidas", price: D(0) },
    { name: "Jugo 2", sku: "SBE-011", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Bebidas", price: D(0) },
    { name: "Jugo 3", sku: "SBE-012", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Bebidas", price: D(0) },

    // Snacks - Otros varios
    { name: "Kit de Pintarte", sku: "SOV-001", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Otros Varios", price: D(35000) },
    { name: "Kit de Pinceladas", sku: "SOV-002", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Otros Varios", price: D(50000) },

    // Snacks - Combos
    { name: "Granizado 12ml + Crispeta", sku: "SCO-001", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Combos", price: D(12000) },
    { name: "Granizado 16ml + Crispeta + Chocolatina", sku: "SCO-002", category: SaleCategory.SNACKS, analyticsCategory: "Snacks", analyticsSubcategory: "Combos", price: D(16000) },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { siteId_sku: { siteId: site.id, sku: p.sku! } },
      update: {
        name: p.name,
        price: p.price,
        category: p.category,
        analyticsCategory: p.analyticsCategory,
        analyticsSubcategory: p.analyticsSubcategory,
        isActive: true,
      },
      create: { siteId: site.id, ...p, isActive: true },
    });
  }

  const productCardPlastic = await prisma.product.findFirstOrThrow({ where: { siteId: site.id, sku: "PTA-001" } });
  const productGranizado12 = await prisma.product.findFirstOrThrow({ where: { siteId: site.id, sku: "SGR-001" } });
  const productCrispetas = await prisma.product.findFirstOrThrow({ where: { siteId: site.id, sku: "SCR-001" } });
  const productKitPintarte = await prisma.product.findFirstOrThrow({ where: { siteId: site.id, sku: "SOV-001" } });

  // 7) Inventory items (cards, prizes, snacks)
  const inventoryItems = [
    // Tarjetas físicas
    { name: "Tarjetas", sku: "INV-PTA-001", category: InventoryCategory.CARD_PLASTIC },
    // Premios
    { name: "Pelota Saltarina", sku: "PRIZE-BALL", category: InventoryCategory.PRIZE },
    { name: "Carro Mini", sku: "PRIZE-CAR", category: InventoryCategory.PRIZE },
    { name: "Muñeco Pequeño", sku: "PRIZE-DOLL", category: InventoryCategory.PRIZE },
    // Snacks
    { name: "Granizados 12ml", sku: "INV-SGR-001", category: InventoryCategory.SNACK },
    { name: "Crispetas", sku: "INV-SCR-001", category: InventoryCategory.SNACK },
  ];

  for (const it of inventoryItems) {
    await prisma.inventoryItem.upsert({
      where: { siteId_sku: { siteId: site.id, sku: it.sku } },
      update: { name: it.name, category: it.category, isActive: true },
      create: { siteId: site.id, ...it, isActive: true },
    });
  }

  const invCardPlastic = await prisma.inventoryItem.findFirstOrThrow({ where: { siteId: site.id, sku: "INV-PTA-001" } });
  const invPrizeBall = await prisma.inventoryItem.findFirstOrThrow({ where: { siteId: site.id, sku: "PRIZE-BALL" } });
  const invSnackGranizado = await prisma.inventoryItem.findFirstOrThrow({ where: { siteId: site.id, sku: "INV-SGR-001" } });
  const invSnackCrispetas = await prisma.inventoryItem.findFirstOrThrow({ where: { siteId: site.id, sku: "INV-SCR-001" } });

  // 8) Shifts (uno cerrado histórico + uno abierto actual)
  // Shift cerrado (ayer)
  const shiftClosed = await prisma.shift.create({
    data: {
      siteId: site.id,
      cashRegisterId: registerA.id,
      terminalId: terminalA.id,
      openedById: cashier1.id,
      openedAt: nowMinusDays(1),
      openingCash: D(200000),
      status: ShiftStatus.CLOSED,
      closedById: supervisor.id,
      closedAt: new Date(nowMinusDays(1).getTime() + 8 * 60 * 60 * 1000),
      expectedCash: D(520000),
      countedCash: D(518000),
      cashDiscrepancy: D(-2000),
      notes: "Cierre de prueba con descuadre leve",
    },
  });

  // Shift de hoy (cerrado para evitar conflictos al abrir caja en UI)
  const shiftOpen = await prisma.shift.create({
    data: {
      siteId: site.id,
      cashRegisterId: registerB.id,
      terminalId: terminalB.id,
      openedById: cashier2.id,
      openedAt: nowMinusDays(0),
      openingCash: D(150000),
      status: ShiftStatus.CLOSED,
      closedById: supervisor.id,
      closedAt: new Date(),
      expectedCash: D(150000),
      countedCash: D(150000),
      cashDiscrepancy: D(0),
      notes: "Turno seed (cerrado para demo)",
    },
  });

  // 8.1) Cash sessions (cerrada + abierta)
  const cashSessionClosed = await prisma.cashSession.create({
    data: {
      siteId: site.id,
      terminalId: terminalA.id,
      cashRegisterId: registerA.id,
      shiftId: shiftClosed.id,
      openedByUserId: cashier1.id,
      openedAt: shiftClosed.openedAt,
      openingCashAmount: D(200000),
      expectedCashAmount: D(520000),
      closedAt: shiftClosed.closedAt,
      closingCashAmount: D(518000),
      cashDifference: D(-2000),
      closeReason: "Descuadre leve en cierre",
      status: CashSessionStatus.CLOSED,
      closedById: supervisor.id,
    },
  });

  const cashSessionOpen = await prisma.cashSession.create({
    data: {
      siteId: site.id,
      terminalId: terminalB.id,
      cashRegisterId: registerB.id,
      shiftId: shiftOpen.id,
      openedByUserId: cashier2.id,
      openedAt: shiftOpen.openedAt,
      openingCashAmount: D(150000),
      expectedCashAmount: D(150000),
      status: CashSessionStatus.CLOSED,
      closedById: supervisor.id,
      closedAt: new Date(),
      closingCashAmount: D(150000),
      cashDifference: D(0),
      closeReason: "Cierre seed para evitar conflicto",
    },
  });

  // 9) Inventory movements (apertura + compras + ajustes)
  // Nota: tu modelo permite OPENING_COUNT. Creamos algunos movimientos para tener stock.
  await prisma.inventoryMovement.createMany({
    data: [
      // Apertura de tarjetas
      { siteId: site.id, itemId: invCardPlastic.id, shiftId: shiftClosed.id, performedById: admin.id, type: InventoryMovementType.OPENING_COUNT, quantity: 200, unitCost: D(1500), occurredAt: nowMinusDays(7), notes: "Stock inicial tarjetas" },

      // Apertura de snacks
      { siteId: site.id, itemId: invSnackGranizado.id, shiftId: shiftClosed.id, performedById: admin.id, type: InventoryMovementType.OPENING_COUNT, quantity: 120, unitCost: D(2500), occurredAt: nowMinusDays(7), notes: "Stock inicial granizados" },
      { siteId: site.id, itemId: invSnackCrispetas.id, shiftId: shiftClosed.id, performedById: admin.id, type: InventoryMovementType.OPENING_COUNT, quantity: 80, unitCost: D(3000), occurredAt: nowMinusDays(7), notes: "Stock inicial crispetas" },

      // Apertura de premios
      { siteId: site.id, itemId: invPrizeBall.id, shiftId: shiftClosed.id, performedById: admin.id, type: InventoryMovementType.OPENING_COUNT, quantity: 60, unitCost: D(4000), occurredAt: nowMinusDays(7), notes: "Stock inicial premios" },

      // Ajuste por daño (con nota)
      { siteId: site.id, itemId: invSnackGranizado.id, shiftId: shiftClosed.id, performedById: supervisor.id, type: InventoryMovementType.ADJUSTMENT, quantity: -2, unitCost: D(2500), occurredAt: nowMinusDays(2), notes: "Daño / merma" },
    ],
  });

  // 10) Attractions + Readers (20 atracciones, algunas con doble lectora)
  // Para no inflar demasiado, seed con nombres representativos + 4 arcades doble jugador.
  const attractionSpecs: Array<{ code: string; name: string; cost: number; readers: number }> = [
    { code: "ARCADE-01", name: "Arcade 01", cost: 4000, readers: 1 },
    { code: "ARCADE-02", name: "Arcade 02", cost: 4000, readers: 1 },
    { code: "ARCADE-03", name: "Arcade 03", cost: 4000, readers: 2 }, // doble
    { code: "ARCADE-04", name: "Arcade 04", cost: 4000, readers: 2 }, // doble
    { code: "ARCADE-05", name: "Arcade 05", cost: 4000, readers: 2 }, // doble
    { code: "ARCADE-06", name: "Arcade 06", cost: 4000, readers: 2 }, // doble
    { code: "ARCADE-07", name: "Arcade 07", cost: 4000, readers: 1 },
    { code: "ARCADE-08", name: "Arcade 08", cost: 4000, readers: 1 },
    { code: "ARCADE-09", name: "Arcade 09", cost: 4000, readers: 1 },
    { code: "ARCADE-10", name: "Arcade 10", cost: 4000, readers: 1 },
    { code: "ARCADE-11", name: "Arcade 11", cost: 4000, readers: 1 },
    { code: "PLAY-2-6", name: "Playground 2 a 6", cost: 8000, readers: 1 },
    { code: "PLAY-6-12", name: "Playground 6 a 12", cost: 10000, readers: 1 },
    { code: "VR-01", name: "Realidad Virtual 1", cost: 12000, readers: 1 },
    { code: "VR-02", name: "Realidad Virtual 2", cost: 12000, readers: 1 },
    { code: "POLIROBO", name: "Zona Polirobotics", cost: 15000, readers: 1 },
    // 4 extras “futuro” (isActive true) para llegar cerca de 20 atracciones del documento
    { code: "EXTRA-01", name: "Atracción Extra 01", cost: 5000, readers: 1 },
    { code: "EXTRA-02", name: "Atracción Extra 02", cost: 5000, readers: 1 },
    { code: "EXTRA-03", name: "Atracción Extra 03", cost: 7000, readers: 1 },
    { code: "EXTRA-04", name: "Atracción Extra 04", cost: 7000, readers: 1 },
  ];

  const attractions: Record<string, { id: string; name: string; cost: Prisma.Decimal; readerIds: string[] }> = {};

  for (const spec of attractionSpecs) {
    const pointsCost = Math.max(1, Math.round(spec.cost / 1000));
    const a = await prisma.attraction.upsert({
      where: { siteId_code: { siteId: site.id, code: spec.code } },
      update: { name: spec.name, price: D(spec.cost), costPoints: pointsCost, type: "SKILL", status: "ACTIVE", duration: 0 },
      create: { siteId: site.id, code: spec.code, name: spec.name, price: D(spec.cost), costPoints: pointsCost, type: "SKILL", status: "ACTIVE", duration: 0 },
    });

    const readerIds: string[] = [];
    for (let i = 1; i <= spec.readers; i++) {
      const code = `${spec.code}-R${i}`;
      const readerToken = `${ESP_TOKEN_PREFIX}-${code}`;
      const readerHmacSecret = `${ESP_HMAC_PREFIX}-${code}`;
      const tokenHash = await hash(readerToken);
      const r = await prisma.reader.upsert({
        where: { attractionId_code: { attractionId: a.id, code } },
        update: { position: i, isActive: true, apiTokenHash: tokenHash, hmacSecret: readerHmacSecret },
        create: { siteId: site.id, attractionId: a.id, code, position: i, isActive: true, apiTokenHash: tokenHash, hmacSecret: readerHmacSecret },
      });
      readerIds.push(r.id);
    }

    attractions[spec.code] = { id: a.id, name: a.name, cost: a.price, readerIds };
  }

  // 11) Cards (UIDs) + starting balances via CardBalanceEvent
  // Creamos 6 tarjetas: 2 nuevas, 1 perdida, 1 bloqueada, 2 activas con historial.
  const cardUids = ["04A1B2C3D4", "04A1B2C3D5", "04A1B2C3D6", "04A1B2C3D7", "04A1B2C3D8", "04A1B2C3D9"];
  const cardStatuses: CardStatus[] = [CardStatus.ACTIVE, CardStatus.ACTIVE, CardStatus.LOST, CardStatus.BLOCKED, CardStatus.ACTIVE, CardStatus.ACTIVE];

  const cards = [];
  for (let i = 0; i < cardUids.length; i++) {
    const c = await prisma.card.upsert({
      where: { uid: cardUids[i] },
      update: { status: cardStatuses[i] },
      create: { siteId: site.id, uid: cardUids[i], status: cardStatuses[i], issuedAt: nowMinusDays(3) },
    });
    cards.push(c);
  }

  // 12) Customers + Services + ServiceSales (abonos)
  // Customer upsert by non-unique fields (email) via find + update/create.
  const consumerFinal = await prisma.customer.upsert({
    where: {
      siteId_documentType_documentNumber: {
        siteId: site.id,
        documentType: CustomerDocumentType.NIT,
        documentNumber: "222222222",
      },
    },
    update: {
      fullName: "CONSUMIDOR FINAL",
      phone: "0000000000",
      city: "Montelíbano",
      notes: "Cliente genérico para ventas rápidas.",
    },
    create: {
      siteId: site.id,
      documentType: CustomerDocumentType.NIT,
      documentNumber: "222222222",
      fullName: "CONSUMIDOR FINAL",
      phone: "0000000000",
      city: "Montelíbano",
      notes: "Cliente genérico para ventas rápidas.",
    },
  });

  await prisma.site.update({
    where: { id: site.id },
    data: { defaultCustomerId: consumerFinal.id },
  });

  const fixedAnaId = "00000000-0000-0000-0000-000000000001";
  const existingAna =
    (await prisma.customer.findUnique({ where: { id: fixedAnaId } })) ??
    (await prisma.customer.findFirst({ where: { email: "ana@example.com", siteId: site.id } }));

  const customerAna = existingAna
    ? await prisma.customer.update({
        where: { id: existingAna.id },
        data: {
          siteId: site.id,
          documentType: CustomerDocumentType.CC,
          documentNumber: "1032456789",
          fullName: "Ana María Pérez",
          email: "ana@example.com",
          phone: "3001234567",
          city: "Montelíbano",
          notes: "Cliente frecuente.",
        },
      })
    : await prisma.customer.create({
        data: {
          id: fixedAnaId,
          siteId: site.id,
          documentType: CustomerDocumentType.CC,
          documentNumber: "1032456789",
          fullName: "Ana María Pérez",
          email: "ana@example.com",
          phone: "3001234567",
          city: "Montelíbano",
          notes: "Cliente frecuente.",
        },
      });

  const existingLuis = await prisma.customer.findFirst({ where: { email: "luis@example.com", siteId: site.id } });
  const customerLuis = existingLuis
    ? await prisma.customer.update({
        where: { id: existingLuis.id },
        data: {
          siteId: site.id,
          documentType: CustomerDocumentType.CE,
          documentNumber: "203456789",
          fullName: "Luis García",
          phone: "3017654321",
          email: "luis@example.com",
          city: "Montería",
        },
      })
    : await prisma.customer.create({
        data: {
          siteId: site.id,
          documentType: CustomerDocumentType.CE,
          documentNumber: "203456789",
          fullName: "Luis García",
          email: "luis@example.com",
          phone: "3017654321",
          city: "Montería",
        },
      });

  const serviceCumpleBasico = await prisma.service.upsert({
    where: { siteId_name: { siteId: site.id, name: "Cumpleaños Básico" } },
    update: { price: D(350000), isActive: true },
    create: { siteId: site.id, name: "Cumpleaños Básico", price: D(350000), isActive: true },
  });

  const serviceVacacional = await prisma.service.upsert({
    where: { siteId_name: { siteId: site.id, name: "Vacacional Semana" } },
    update: { price: D(220000), isActive: true },
    create: { siteId: site.id, name: "Vacacional Semana", price: D(220000), isActive: true },
  });

  // 12.1) Estructura unificada vendible: Categoria / Subcategoria / ItemVendible
  const categoriaCache = new Map<string, string>();
  const subcategoriaCache = new Map<string, string>();

  const ensureCategoria = async (nombre: string, codigo?: string | null) => {
    const key = nombre.trim().toLowerCase();
    const cached = categoriaCache.get(key);
    if (cached) return cached;
    const categoria = await prisma.categoria.upsert({
      where: { siteId_nombre: { siteId: site.id, nombre } },
      update: { codigo: codigo ?? undefined, activo: true },
      create: { siteId: site.id, nombre, codigo: codigo ?? null, activo: true },
    });
    categoriaCache.set(key, categoria.id);
    return categoria.id;
  };

  const ensureSubcategoria = async (categoriaId: string, nombre: string, codigo?: string | null) => {
    const key = `${categoriaId}:${nombre.trim().toLowerCase()}`;
    const cached = subcategoriaCache.get(key);
    if (cached) return cached;
    const subcategoria = await prisma.subcategoria.upsert({
      where: { siteId_categoriaId_nombre: { siteId: site.id, categoriaId, nombre } },
      update: { codigo: codigo ?? undefined, activo: true },
      create: { siteId: site.id, categoriaId, nombre, codigo: codigo ?? null, activo: true },
    });
    subcategoriaCache.set(key, subcategoria.id);
    return subcategoria.id;
  };

  // Productos del POS como items vendibles tipo PRODUCTO
  for (const p of products) {
    const categoriaNombre = p.analyticsCategory ?? "Otros";
    const subcategoriaNombre = p.analyticsSubcategory ?? "General";
    const categoriaId = await ensureCategoria(categoriaNombre);
    const subcategoriaId = await ensureSubcategoria(categoriaId, subcategoriaNombre);
    await prisma.itemVendible.upsert({
      where: { siteId_codigo: { siteId: site.id, codigo: p.sku ?? `PROD-${p.name.replace(/\s+/g, "-").toUpperCase()}` } },
      update: {
        categoriaId,
        subcategoriaId,
        nombre: p.name,
        tipoOperacion: TipoOperacionVendible.PRODUCTO,
        tieneInventario: [SaleCategory.CARD_PLASTIC, SaleCategory.GIFT_CARD, SaleCategory.SNACKS, SaleCategory.PRIZE].includes(p.category),
        usaSaldoElectronico: false,
        usaPuntos: false,
        precioBase: p.price,
        activo: true,
      },
      create: {
        siteId: site.id,
        categoriaId,
        subcategoriaId,
        codigo: p.sku ?? `PROD-${p.name.replace(/\s+/g, "-").toUpperCase()}`,
        nombre: p.name,
        tipoOperacion: TipoOperacionVendible.PRODUCTO,
        tieneInventario: [SaleCategory.CARD_PLASTIC, SaleCategory.GIFT_CARD, SaleCategory.SNACKS, SaleCategory.PRIZE].includes(p.category),
        usaSaldoElectronico: false,
        usaPuntos: false,
        precioBase: p.price,
        activo: true,
      },
    });
  }

  // Servicios como items vendibles tipo SERVICIO/PROGRAMA/EVENTO
  const serviceCatalogRows = [
    serviceCumpleBasico,
    serviceVacacional,
  ];
  for (const service of serviceCatalogRows) {
    const lower = service.name.toLowerCase();
    const tipoOperacion =
      lower.includes("cumple")
        ? TipoOperacionVendible.EVENTO
        : lower.includes("vacacional")
          ? TipoOperacionVendible.PROGRAMA
          : TipoOperacionVendible.SERVICIO;
    const categoriaNombre =
      tipoOperacion === TipoOperacionVendible.EVENTO
        ? "Eventos y celebraciones"
        : tipoOperacion === TipoOperacionVendible.PROGRAMA
          ? "Programas"
          : "Servicios";
    const subcategoriaNombre =
      tipoOperacion === TipoOperacionVendible.EVENTO
        ? "Cumpleaños"
        : tipoOperacion === TipoOperacionVendible.PROGRAMA
          ? "Vacacionales"
          : "Servicios";
    const categoriaId = await ensureCategoria(categoriaNombre);
    const subcategoriaId = await ensureSubcategoria(categoriaId, subcategoriaNombre);
    const serviceCode = `SRV-${service.name.replace(/[^a-zA-Z0-9]+/g, "-").toUpperCase()}`;

    await prisma.itemVendible.upsert({
      where: { siteId_codigo: { siteId: site.id, codigo: serviceCode } },
      update: {
        categoriaId,
        subcategoriaId,
        nombre: service.name,
        tipoOperacion,
        tieneInventario: false,
        usaSaldoElectronico: false,
        usaPuntos: false,
        precioBase: service.price,
        activo: service.isActive,
      },
      create: {
        siteId: site.id,
        categoriaId,
        subcategoriaId,
        codigo: serviceCode,
        nombre: service.name,
        tipoOperacion,
        tieneInventario: false,
        usaSaldoElectronico: false,
        usaPuntos: false,
        precioBase: service.price,
        activo: service.isActive,
      },
    });
  }

  // Atracciones como items vendibles tipo USO
  const usosCategoriaId = await ensureCategoria("Parque");
  const usosSubcategoriaId = await ensureSubcategoria(usosCategoriaId, "Usos");
  for (const [code, attractionData] of Object.entries(attractions)) {
    await prisma.itemVendible.upsert({
      where: { siteId_codigo: { siteId: site.id, codigo: code } },
      update: {
        categoriaId: usosCategoriaId,
        subcategoriaId: usosSubcategoriaId,
        nombre: attractionData.name,
        tipoOperacion: TipoOperacionVendible.USO,
        tieneInventario: false,
        usaSaldoElectronico: true,
        usaPuntos: true,
        precioBase: attractionData.cost,
        activo: true,
      },
      create: {
        siteId: site.id,
        categoriaId: usosCategoriaId,
        subcategoriaId: usosSubcategoriaId,
        codigo: code,
        nombre: attractionData.name,
        tipoOperacion: TipoOperacionVendible.USO,
        tieneInventario: false,
        usaSaldoElectronico: true,
        usaPuntos: true,
        precioBase: attractionData.cost,
        activo: true,
      },
    });
  }

  const serviceSale1 = await prisma.serviceSale.create({
    data: {
      siteId: site.id,
      serviceId: serviceCumpleBasico.id,
      customerId: customerAna.id,
      status: ServiceStatus.PARTIAL,
      totalAmount: D(350000),
      paidAmount: D(150000),
    },
  });

  await prisma.servicePayment.createMany({
    data: [
      { serviceSaleId: serviceSale1.id, amount: D(100000), method: PaymentMethod.TRANSFER, createdAt: nowMinusDays(2) },
      { serviceSaleId: serviceSale1.id, amount: D(50000), method: PaymentMethod.CASH, createdAt: nowMinusDays(1) },
    ],
  });

  // Ledger for service payments (ejemplo: dinero entra, ingreso diferido si servicio no se presta aún)
  const leServicePay1 = await createLedgerEvent({
    siteId: site.id,
    createdById: cashier1.id,
    shiftId: shiftClosed.id,
    serviceSaleId: serviceSale1.id,
    eventType: LedgerEventType.SERVICE_PAYMENT,
    description: "Abonos Cumpleaños Básico (ingreso diferido hasta prestación)",
    occurredAt: nowMinusDays(1),
    entries: [
      // entra efectivo + transfer
      { account: LedgerAccount.CASH_ON_HAND, side: LedgerEntrySide.DEBIT, amount: D(50000) },
      { account: LedgerAccount.BANK_TRANSFER, side: LedgerEntrySide.DEBIT, amount: D(100000) },
      // contra pasivo de ingreso diferido
      { account: LedgerAccount.DEFERRED_SERVICE_REVENUE, side: LedgerEntrySide.CREDIT, amount: D(150000) },
    ],
  });

  await audit({
    siteId: site.id,
    actorId: cashier1.id,
    action: AuditAction.CREATE,
    entityType: EntityType.LEDGER_EVENT,
    entityId: leServicePay1.id,
    after: { note: "Seed service payment ledger" },
  });

  // 12.5) POLIKid demo: estudiantes, inscripciones y abonos para poblar cartera/programas
  const polikidsSeed: PolikidSeed[] = [
    {
      firstName: "Sofia",
      lastName: "Mejia",
      documentType: CustomerDocumentType.TI,
      documentNumber: "10324411",
      birthDate: new Date("2017-05-14"),
      phone: "3001239087",
      email: "ana.mejia@example.com",
      guardianName: "Ana Mejia",
      guardianPhone: "3001239087",
      status: "ACTIVE" as const,
      notes: "Interes en robotica y arte.",
      enrollments: [
        {
          programName: "Robotica Kids",
          groupName: "G1",
          startsAt: new Date("2026-03-01"),
          endsAt: new Date("2026-06-30"),
          dueDate: new Date("2026-03-08"),
          totalAmount: D(280000),
          discountAmount: D(20000),
          finalAmount: D(260000),
          payments: [
            { amount: D(180000), method: PaymentMethod.TRANSFER_ACCOUNT_1, createdAt: new Date("2026-03-02T20:10:00.000Z"), createdById: cashier1.id, notes: "Abono inicial marzo" },
          ],
        },
        {
          programName: "Arte Sensorial",
          groupName: "Clase abierta",
          startsAt: new Date("2026-03-05"),
          endsAt: new Date("2026-03-29"),
          dueDate: new Date("2026-03-05"),
          totalAmount: D(55000),
          discountAmount: D(0),
          finalAmount: D(55000),
          payments: [
            { amount: D(55000), method: PaymentMethod.CASH, createdAt: new Date("2026-03-05T16:20:00.000Z"), createdById: cashier2.id, notes: "Clase sabatina pagada" },
          ],
        },
      ],
    },
    {
      firstName: "Samuel",
      lastName: "Ortiz",
      documentType: CustomerDocumentType.TI,
      documentNumber: "88421190",
      birthDate: new Date("2019-08-01"),
      phone: "3013334412",
      email: "lina.ortiz@example.com",
      guardianName: "Lina Ortiz",
      guardianPhone: "3013334412",
      status: "ACTIVE" as const,
      notes: "Prefiere cocina y actividades manuales.",
      enrollments: [
        {
          programName: "Mini Chefs",
          groupName: "G3",
          startsAt: new Date("2026-03-01"),
          endsAt: new Date("2026-05-31"),
          dueDate: new Date("2026-03-10"),
          totalAmount: D(240000),
          discountAmount: D(0),
          finalAmount: D(240000),
          payments: [
            { amount: D(120000), method: PaymentMethod.NEQUI, createdAt: new Date("2026-03-03T19:00:00.000Z"), createdById: cashier1.id, notes: "Abono 1" },
            { amount: D(120000), method: PaymentMethod.CASH, createdAt: new Date("2026-03-09T20:40:00.000Z"), createdById: cashier1.id, notes: "Pago saldo" },
          ],
        },
      ],
    },
    {
      firstName: "Valeria",
      lastName: "Torres",
      documentType: CustomerDocumentType.TI,
      documentNumber: "77112233",
      birthDate: new Date("2016-11-23"),
      phone: "3158001140",
      email: "carlos.torres@example.com",
      guardianName: "Carlos Torres",
      guardianPhone: "3158001140",
      status: "ACTIVE" as const,
      notes: "Inscripcion con pausa medica temporal.",
      enrollments: [
        {
          programName: "Ballet Creativo",
          groupName: "G2",
          startsAt: new Date("2026-02-15"),
          endsAt: new Date("2026-06-15"),
          dueDate: new Date("2026-03-01"),
          totalAmount: D(320000),
          discountAmount: D(20000),
          finalAmount: D(300000),
          payments: [
            { amount: D(20000), method: PaymentMethod.CREDIT_CARD, createdAt: new Date("2026-02-16T15:18:00.000Z"), createdById: cashier2.id, notes: "Reserva cupo" },
            { amount: D(150000), method: PaymentMethod.TRANSFER, createdAt: new Date("2026-02-20T18:12:00.000Z"), createdById: cashier2.id, notes: "Abono febrero" },
          ],
          statusOverride: ServiceStatus.PARTIAL,
        },
      ],
    },
  ];

  for (const polikid of polikidsSeed) {
    const student = await prisma.polikidStudent.upsert({
      where: {
        siteId_documentType_documentNumber: {
          siteId: site.id,
          documentType: polikid.documentType,
          documentNumber: polikid.documentNumber,
        },
      },
      update: {
        firstName: polikid.firstName,
        lastName: polikid.lastName,
        birthDate: polikid.birthDate,
        phone: polikid.phone,
        email: polikid.email,
        guardianName: polikid.guardianName,
        guardianPhone: polikid.guardianPhone,
        status: polikid.status as any,
        notes: polikid.notes,
      },
      create: {
        siteId: site.id,
        firstName: polikid.firstName,
        lastName: polikid.lastName,
        documentType: polikid.documentType,
        documentNumber: polikid.documentNumber,
        birthDate: polikid.birthDate,
        phone: polikid.phone,
        email: polikid.email,
        guardianName: polikid.guardianName,
        guardianPhone: polikid.guardianPhone,
        status: polikid.status as any,
        notes: polikid.notes,
      },
    });

    for (const enrollmentSeed of polikid.enrollments) {
      let enrollment = await prisma.programEnrollment.findFirst({
        where: {
          siteId: site.id,
          studentId: student.id,
          programName: enrollmentSeed.programName,
          groupName: enrollmentSeed.groupName,
        },
      });

      if (!enrollment) {
        enrollment = await prisma.programEnrollment.create({
          data: {
            siteId: site.id,
            studentId: student.id,
            programName: enrollmentSeed.programName,
            groupName: enrollmentSeed.groupName,
            startsAt: enrollmentSeed.startsAt,
            endsAt: enrollmentSeed.endsAt,
            dueDate: enrollmentSeed.dueDate,
            totalAmount: enrollmentSeed.totalAmount,
            discountAmount: enrollmentSeed.discountAmount,
            finalAmount: enrollmentSeed.finalAmount,
            status: enrollmentSeed.statusOverride ?? ServiceStatus.OPEN,
            createdAt: enrollmentSeed.startsAt,
          },
        });
      } else {
        enrollment = await prisma.programEnrollment.update({
          where: { id: enrollment.id },
          data: {
            startsAt: enrollmentSeed.startsAt,
            endsAt: enrollmentSeed.endsAt,
            dueDate: enrollmentSeed.dueDate,
            totalAmount: enrollmentSeed.totalAmount,
            discountAmount: enrollmentSeed.discountAmount,
            finalAmount: enrollmentSeed.finalAmount,
            status: enrollmentSeed.statusOverride ?? enrollment.status,
          },
        });
      }

      const existingPayments = await prisma.enrollmentPayment.count({
        where: { enrollmentId: enrollment.id },
      });

      if (existingPayments === 0) {
        await prisma.enrollmentPayment.createMany({
          data: enrollmentSeed.payments.map((payment) => ({
            siteId: site.id,
            enrollmentId: enrollment.id,
            amount: payment.amount,
            method: payment.method,
            notes: payment.notes,
            createdById: payment.createdById,
            createdAt: payment.createdAt,
          })),
        });
      }

      const paymentAggregate = await prisma.enrollmentPayment.aggregate({
        where: { enrollmentId: enrollment.id },
        _sum: { amount: true },
      });
      const totalPaid = paymentAggregate._sum.amount ?? D(0);
      const pending = Prisma.Decimal.max(enrollment.finalAmount.sub(totalPaid), D(0));

      await prisma.programEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: pending.lte(0) ? ServiceStatus.CLOSED : (enrollmentSeed.statusOverride ?? ServiceStatus.PARTIAL),
        },
      });
    }
  }

  // 13) Sales: (A) Venta tarjeta + recarga con bono (B) Snacks con pago mixto (C) Venta anulada (requiere aprobación)
  // Helpers para crear Sale con lines + payments + ledger.

  async function createSale(args: {
    siteId: string;
    customerId: string;
    shiftId: string;
    terminalId: string;
    cashSessionId: string;
    createdById: string;
    status: SaleStatus;
    requiresElectronicInvoice?: boolean;
    createdAt: Date;
    bonusTotal?: Prisma.Decimal;
    pointsEarned?: number;
    lines: Array<{
      productId?: string;
      cardId?: string;
      category: SaleCategory;
      qty: number;
      unitPrice: Prisma.Decimal;
      metadata?: Prisma.JsonValue;
    }>;
    payments: Array<{ method: PaymentMethod; amount: Prisma.Decimal; reference?: string }>;
  }) {
    const subtotal = args.lines.reduce((s, l) => s.add(l.unitPrice.mul(l.qty)), D(0));
    const tax = D(0); // si luego metes IVA, aquí cambias lógica
    const total = subtotal.add(tax);
    const totalPaid = args.payments.reduce((s, p) => s.add(p.amount), D(0));
    const balanceDue = total.sub(totalPaid);

    const sale = await prisma.sale.create({
      data: {
        siteId: args.siteId,
        customerId: args.customerId,
        shiftId: args.shiftId,
        terminalId: args.terminalId,
        cashSessionId: args.cashSessionId,
        status: args.status,
        subtotal,
        tax,
        total,
        totalPaid,
        balanceDue,
        bonusTotal: args.bonusTotal ?? D(0),
        pointsEarned: args.pointsEarned ?? 0,
        requiresElectronicInvoice: args.requiresElectronicInvoice ?? false,
        createdById: args.createdById,
        createdAt: args.createdAt,
        paidAt: args.status === SaleStatus.PAID ? args.createdAt : null,
        lines: {
          create: args.lines.map(l => ({
            productId: l.productId ?? null,
            cardId: l.cardId ?? null,
            category: l.category,
            quantity: l.qty,
            unitPrice: l.unitPrice,
            lineTotal: l.unitPrice.mul(l.qty),
            metadata: l.metadata ?? undefined,
          })),
        },
        payments: {
          create: args.payments.map(p => ({
            method: p.method,
            amount: p.amount,
            reference: p.reference ?? null,
          })),
        },
      },
      include: { lines: true, payments: true },
    });

    // Audit sale create
    await audit({
      siteId: args.siteId,
      actorId: args.createdById,
      action: AuditAction.CREATE,
      entityType: EntityType.SALE,
      entityId: sale.id,
      after: { total: sale.total.toFixed(2), status: sale.status },
      createdAt: args.createdAt,
    });

    return sale;
  }

  function paymentToLedgerAccount(m: PaymentMethod): LedgerAccount {
    switch (m) {
      case PaymentMethod.CASH:
        return LedgerAccount.CASH_ON_HAND;
      case PaymentMethod.TRANSFER:
      case PaymentMethod.TRANSFER_ACCOUNT_1:
      case PaymentMethod.TRANSFER_ACCOUNT_2:
      case PaymentMethod.NEQUI:
        return LedgerAccount.BANK_TRANSFER;
      case PaymentMethod.QR:
        return LedgerAccount.QR_PROVIDER;
      case PaymentMethod.CARD:
      case PaymentMethod.CREDIT_CARD:
        return LedgerAccount.CARD_PROCESSOR;
      case PaymentMethod.MIXED:
      default:
        // MIXED no debería venir aquí como "un solo payment"
        return LedgerAccount.CASH_ON_HAND;
    }
  }

  function seedContextForDay(daysAgo: number) {
    if (daysAgo === 0) {
      return {
        shiftId: shiftOpen.id,
        terminalId: terminalB.id,
        cashSessionId: cashSessionOpen.id,
        createdById: cashier2.id,
      };
    }
    return {
      shiftId: shiftClosed.id,
      terminalId: terminalA.id,
      cashSessionId: cashSessionClosed.id,
      createdById: cashier1.id,
    };
  }

  // A) Venta: 1 plástico + recarga 50.000 (bono 15.000) a tarjeta cards[0]
  // Nota: en tu modelo la recarga se puede representar como SaleLine con category RECHARGE y cardId asociado,
  // y el efecto de saldo en CardBalanceEvent.
  const rechargeBase = D(50000);
  const bonusScale50 = await prisma.bonusScale.findFirstOrThrow({
    where: { siteId: site.id, minAmount: D(50000), maxAmount: D(50000) },
  });
  const bonusAmount = bonusScale50.bonusAmount; // 15000
  const points = rechargeBase.div(D(siteConfig.currencyUnit)).toNumber(); // 50 si unit=1000
  // (Prisma Decimal -> number): aquí es exacto por división entera.

  const saleA = await createSale({
    siteId: site.id,
    customerId: customerAna.id,
    shiftId: shiftOpen.id,
    terminalId: terminalB.id,
    cashSessionId: cashSessionOpen.id,
    createdById: cashier2.id,
    status: SaleStatus.PAID,
    requiresElectronicInvoice: true,
    createdAt: nowMinusDays(0),
    bonusTotal: bonusAmount,
    pointsEarned: points,
    lines: [
      {
        productId: productCardPlastic.id,
        category: SaleCategory.CARD_PLASTIC,
        qty: 1,
        unitPrice: productCardPlastic.price,
        metadata: { physicalCount: 1, note: "Venta de plástico" },
      },
      {
        cardId: cards[0].id,
        category: SaleCategory.RECHARGE,
        qty: 1,
        unitPrice: rechargeBase,
        metadata: { rechargeBase: rechargeBase.toFixed(2), bonusApplied: bonusAmount.toFixed(2), pointsEarned: points },
      },
    ],
    payments: [
      { method: PaymentMethod.CASH, amount: D(20000) },
      { method: PaymentMethod.TRANSFER, amount: D(35000), reference: "NEQUI-TRX-88921" }, // total = 55.000 (plástico 5k + recarga 50k)
    ],
  });

  // Ledger SALE for saleA:
  //   DR Cash 20k, DR Bank 35k
  //   CR Card Plastic Revenue 5k
  //   CR Card Float Liability 50k (porque recarga es pasivo: saldo a favor del cliente)
  const leSaleA = await createLedgerEvent({
    siteId: site.id,
    createdById: cashier2.id,
    shiftId: shiftOpen.id,
    saleId: saleA.id,
    eventType: LedgerEventType.SALE,
    description: "Venta plástico + recarga 50k (bono 15k)",
    occurredAt: saleA.createdAt,
    entries: [
      { account: LedgerAccount.CASH_ON_HAND, side: LedgerEntrySide.DEBIT, amount: D(20000) },
      { account: LedgerAccount.BANK_TRANSFER, side: LedgerEntrySide.DEBIT, amount: D(35000) },

      { account: LedgerAccount.CARD_PLASTIC_REVENUE, side: LedgerEntrySide.CREDIT, amount: D(5000) },
      { account: LedgerAccount.CARD_FLOAT_LIABILITY, side: LedgerEntrySide.CREDIT, amount: rechargeBase },
    ],
  });

  // Card balance event for recharge (moneyDelta includes base + bonus; pointsDelta includes points)
  const cbeRecharge = await prisma.cardBalanceEvent.create({
    data: {
      cardId: cards[0].id,
      siteId: site.id,
      ledgerEventId: leSaleA.id,
      occurredAt: saleA.createdAt,
      moneyDelta: rechargeBase.add(bonusAmount), // 65.000 disponibles
      pointsDelta: points,
      reason: "Recarga con bono",
    },
  });

  await prisma.bonusApplied.create({
    data: {
      cardId: cards[0].id,
      saleId: saleA.id,
      bonusScaleId: bonusScale50.id,
      bonusAmount: bonusAmount,
    },
  });

  await audit({
    siteId: site.id,
    actorId: cashier2.id,
    action: AuditAction.CREATE,
    entityType: EntityType.CARD,
    entityId: cards[0].id,
    after: { moneyDelta: "65000", pointsDelta: points, reason: "Recarga con bono" },
    createdAt: saleA.createdAt,
  });

  // B) Venta snacks + souvenir, pago mixto (cash + QR)
  const saleB = await createSale({
    siteId: site.id,
    customerId: consumerFinal.id,
    shiftId: shiftOpen.id,
    terminalId: terminalB.id,
    cashSessionId: cashSessionOpen.id,
    createdById: cashier2.id,
    status: SaleStatus.PAID,
    createdAt: new Date(nowMinusDays(0).getTime() + 10 * 60 * 1000),
    lines: [
      { productId: productGranizado12.id, category: SaleCategory.SNACKS, qty: 2, unitPrice: productGranizado12.price },
      { productId: productCrispetas.id, category: SaleCategory.SNACKS, qty: 1, unitPrice: productCrispetas.price },
      { productId: productKitPintarte.id, category: SaleCategory.SNACKS, qty: 1, unitPrice: productKitPintarte.price },
    ],
    payments: [
      { method: PaymentMethod.CASH, amount: D(30000) },
      { method: PaymentMethod.QR, amount: D(28000), reference: "QR-CO-7712001" },
    ],
  });

  // Inventory movements for snack sale (sale decreases stock)
  await prisma.inventoryMovement.createMany({
    data: [
      { siteId: site.id, itemId: invSnackGranizado.id, shiftId: shiftOpen.id, performedById: cashier2.id, type: InventoryMovementType.SALE, quantity: -2, unitCost: D(2500), occurredAt: saleB.createdAt, notes: `Venta snacks: Sale ${saleB.id}` },
      { siteId: site.id, itemId: invSnackCrispetas.id, shiftId: shiftOpen.id, performedById: cashier2.id, type: InventoryMovementType.SALE, quantity: -1, unitCost: D(3000), occurredAt: saleB.createdAt, notes: `Venta snacks: Sale ${saleB.id}` },
    ],
  });

  const leSaleB = await createLedgerEvent({
    siteId: site.id,
    createdById: cashier2.id,
    shiftId: shiftOpen.id,
    saleId: saleB.id,
    eventType: LedgerEventType.SALE,
    description: "Venta snacks + souvenir",
    occurredAt: saleB.createdAt,
    entries: [
      { account: LedgerAccount.CASH_ON_HAND, side: LedgerEntrySide.DEBIT, amount: D(30000) },
      { account: LedgerAccount.QR_PROVIDER, side: LedgerEntrySide.DEBIT, amount: D(28000) },

      // Revenue split: todo se registra como snacks en este catálogo
      { account: LedgerAccount.SNACKS_REVENUE, side: LedgerEntrySide.CREDIT, amount: productGranizado12.price.mul(2).add(productCrispetas.price).add(productKitPintarte.price) },
    ],
  });

  // Actividad comercial adicional distribuida en varios dias para poblar analytics
  const historicalSalesSeed = [
    {
      daysAgo: 6,
      customerId: customerAna.id,
      createdAt: daysAgoAt(6, 11, 20),
      lines: [
        { productId: productGranizado12.id, category: SaleCategory.SNACKS, qty: 1, unitPrice: productGranizado12.price },
        { productId: productCrispetas.id, category: SaleCategory.SNACKS, qty: 1, unitPrice: productCrispetas.price },
      ],
      payments: [{ method: PaymentMethod.CASH, amount: productGranizado12.price.add(productCrispetas.price) }],
      revenueAccount: LedgerAccount.SNACKS_REVENUE,
      description: "Venta historica snacks dia 6",
    },
    {
      daysAgo: 5,
      customerId: customerLuis.id,
      createdAt: daysAgoAt(5, 16, 45),
      lines: [
        { productId: productKitPintarte.id, category: SaleCategory.SNACKS, qty: 2, unitPrice: productKitPintarte.price },
      ],
      payments: [{ method: PaymentMethod.QR, amount: productKitPintarte.price.mul(2), reference: "QR-HIST-501" }],
      revenueAccount: LedgerAccount.SNACKS_REVENUE,
      description: "Venta historica souvenirs dia 5",
    },
    {
      daysAgo: 4,
      customerId: consumerFinal.id,
      createdAt: daysAgoAt(4, 14, 10),
      lines: [
        { productId: productCardPlastic.id, category: SaleCategory.CARD_PLASTIC, qty: 1, unitPrice: productCardPlastic.price },
      ],
      payments: [{ method: PaymentMethod.CASH, amount: productCardPlastic.price }],
      revenueAccount: LedgerAccount.CARD_PLASTIC_REVENUE,
      description: "Venta historica plastico dia 4",
    },
    {
      daysAgo: 3,
      customerId: customerAna.id,
      createdAt: daysAgoAt(3, 17, 5),
      lines: [
        { productId: productGranizado12.id, category: SaleCategory.SNACKS, qty: 2, unitPrice: productGranizado12.price },
        { productId: productKitPintarte.id, category: SaleCategory.SNACKS, qty: 1, unitPrice: productKitPintarte.price },
      ],
      payments: [
        { method: PaymentMethod.CASH, amount: D(20000) },
        { method: PaymentMethod.NEQUI, amount: productGranizado12.price.mul(2).add(productKitPintarte.price).sub(D(20000)), reference: "NEQUI-HIST-317" },
      ],
      revenueAccount: LedgerAccount.SNACKS_REVENUE,
      description: "Venta historica mix dia 3",
    },
    {
      daysAgo: 2,
      customerId: customerLuis.id,
      createdAt: daysAgoAt(2, 12, 30),
      lines: [
        { productId: productGranizado12.id, category: SaleCategory.SNACKS, qty: 3, unitPrice: productGranizado12.price },
      ],
      payments: [{ method: PaymentMethod.TRANSFER_ACCOUNT_1, amount: productGranizado12.price.mul(3), reference: "TRX-HIST-212" }],
      revenueAccount: LedgerAccount.SNACKS_REVENUE,
      description: "Venta historica snacks dia 2",
    },
    {
      daysAgo: 1,
      customerId: consumerFinal.id,
      createdAt: daysAgoAt(1, 18, 50),
      lines: [
        { productId: productCrispetas.id, category: SaleCategory.SNACKS, qty: 2, unitPrice: productCrispetas.price },
        { productId: productCardPlastic.id, category: SaleCategory.CARD_PLASTIC, qty: 1, unitPrice: productCardPlastic.price },
      ],
      payments: [{ method: PaymentMethod.CASH, amount: productCrispetas.price.mul(2).add(productCardPlastic.price) }],
      revenueAccount: null,
      description: "Venta historica snacks y plastico dia 1",
    },
  ];

  for (const seedSale of historicalSalesSeed) {
    const ctx = seedContextForDay(seedSale.daysAgo);
    const sale = await createSale({
      siteId: site.id,
      customerId: seedSale.customerId,
      shiftId: ctx.shiftId,
      terminalId: ctx.terminalId,
      cashSessionId: ctx.cashSessionId,
      createdById: ctx.createdById,
      status: SaleStatus.PAID,
      createdAt: seedSale.createdAt,
      lines: seedSale.lines,
      payments: seedSale.payments,
    });

    const ledgerEntries: Entry[] = seedSale.payments.map((payment) => ({
      account: paymentToLedgerAccount(payment.method),
      side: LedgerEntrySide.DEBIT,
      amount: payment.amount,
    }));

    if (seedSale.revenueAccount) {
      ledgerEntries.push({
        account: seedSale.revenueAccount,
        side: LedgerEntrySide.CREDIT,
        amount: sale.total,
      });
    } else {
      const plasticTotal = productCardPlastic.price;
      const snackTotal = sale.total.sub(plasticTotal);
      ledgerEntries.push(
        { account: LedgerAccount.CARD_PLASTIC_REVENUE, side: LedgerEntrySide.CREDIT, amount: plasticTotal },
        { account: LedgerAccount.SNACKS_REVENUE, side: LedgerEntrySide.CREDIT, amount: snackTotal },
      );
    }

    await createLedgerEvent({
      siteId: site.id,
      createdById: ctx.createdById,
      shiftId: ctx.shiftId,
      saleId: sale.id,
      eventType: LedgerEventType.SALE,
      description: seedSale.description,
      occurredAt: sale.createdAt,
      entries: ledgerEntries,
    });
  }

  // C) Venta de gift card (plástico) que se anula con aprobación
  const saleC = await createSale({
    siteId: site.id,
    customerId: consumerFinal.id,
    shiftId: shiftClosed.id,
    terminalId: terminalA.id,
    cashSessionId: cashSessionClosed.id,
    createdById: cashier1.id,
    status: SaleStatus.PAID,
    createdAt: new Date(nowMinusDays(1).getTime() + 60 * 60 * 1000),
    lines: [{ productId: productCardPlastic.id, category: SaleCategory.CARD_PLASTIC, qty: 1, unitPrice: productCardPlastic.price }],
    payments: [{ method: PaymentMethod.CASH, amount: productCardPlastic.price }],
  });

  const leSaleC = await createLedgerEvent({
    siteId: site.id,
    createdById: cashier1.id,
    shiftId: shiftClosed.id,
    saleId: saleC.id,
    eventType: LedgerEventType.SALE,
    description: "Venta gift card (plástico)",
    occurredAt: saleC.createdAt,
    entries: [
      { account: LedgerAccount.CASH_ON_HAND, side: LedgerEntrySide.DEBIT, amount: productCardPlastic.price },
      { account: LedgerAccount.CARD_PLASTIC_REVENUE, side: LedgerEntrySide.CREDIT, amount: productCardPlastic.price },
    ],
  });

  // Supervisor approval to VOID saleC
  const approvalVoid = await prisma.supervisorApproval.create({
    data: {
      siteId: site.id,
      action: ApprovalAction.VOID_SALE,
      entityType: EntityType.SALE,
      entityId: saleC.id,
      requestedById: cashier1.id,
      approvedById: supervisor.id,
      reason: "Cliente desistió inmediatamente",
      createdAt: new Date(saleC.createdAt.getTime() + 3 * 60 * 1000),
    },
  });

  // Mark sale as VOIDED + create reversal ledger event
  const saleCVoided = await prisma.sale.update({
    where: { id: saleC.id },
    data: {
      status: SaleStatus.VOIDED,
      approvedById: supervisor.id,
      approvedAt: approvalVoid.createdAt,
      voidedAt: approvalVoid.createdAt,
    },
  });

  await audit({
    siteId: site.id,
    actorId: supervisor.id,
    action: AuditAction.VOID,
    entityType: EntityType.SALE,
    entityId: saleC.id,
    before: { status: "PAID" },
    after: { status: saleCVoided.status, approvedById: supervisor.id },
    reason: approvalVoid.reason,
    createdAt: approvalVoid.createdAt,
  });

  // Ledger reversal: reverse the original saleC effect
  await createLedgerEvent({
    siteId: site.id,
    createdById: supervisor.id,
    shiftId: shiftClosed.id,
    saleId: saleC.id,
    eventType: LedgerEventType.REVERSAL,
    description: "Reverso por anulación venta gift card",
    occurredAt: approvalVoid.createdAt,
    approvalId: approvalVoid.id,
    reversalOfId: leSaleC.id,
    entries: [
      { account: LedgerAccount.CARD_PLASTIC_REVENUE, side: LedgerEntrySide.DEBIT, amount: productCardPlastic.price },
      { account: LedgerAccount.CASH_ON_HAND, side: LedgerEntrySide.CREDIT, amount: productCardPlastic.price },
    ],
  });

  // 14) Cash withdrawal (salida de efectivo) con aprobación y ledger
  const approvalWithdrawal = await prisma.supervisorApproval.create({
    data: {
      siteId: site.id,
      action: ApprovalAction.CASH_WITHDRAWAL,
      entityType: EntityType.SHIFT,
      entityId: shiftOpen.id,
      requestedById: cashier2.id,
      approvedById: supervisor.id,
      reason: "Bajar efectivo en caja",
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  });

  const leWithdrawal = await createLedgerEvent({
    siteId: site.id,
    createdById: supervisor.id,
    shiftId: shiftOpen.id,
    eventType: LedgerEventType.CASH_WITHDRAWAL,
    description: "Salida de efectivo a custodia",
    occurredAt: approvalWithdrawal.createdAt,
    approvalId: approvalWithdrawal.id,
    entries: [
      // Sale cash from drawer (credit cash on hand). Contra: bank transfer/other clearing.
      // Como no tienes una cuenta "SAFE" / "CUSTODY", usamos BANK_TRANSFER como placeholder contable (o crea otra cuenta luego).
      { account: LedgerAccount.BANK_TRANSFER, side: LedgerEntrySide.DEBIT, amount: D(100000) },
      { account: LedgerAccount.CASH_ON_HAND, side: LedgerEntrySide.CREDIT, amount: D(100000) },
    ],
  });

  await audit({
    siteId: site.id,
    actorId: supervisor.id,
    action: AuditAction.CREATE,
    entityType: EntityType.LEDGER_EVENT,
    entityId: leWithdrawal.id,
    after: { amount: "100000", approvalId: approvalWithdrawal.id },
    reason: approvalWithdrawal.reason,
    createdAt: approvalWithdrawal.createdAt,
  });

  // 15) Prize redemption: consume points + inventory movement + ledger (si quieres reconocer ingreso por premios)
  // En tu esquema: redención debería afectar puntos (CardBalanceEvent pointsDelta negativo).
  // Inventario: movimiento REDEMPTION -1.
  const prizePointsCost = 20;

  // Approval (opcional) para redención: no está listada como ApprovalAction específica, pero puedes usar OTHER.
  const approvalPrize = await prisma.supervisorApproval.create({
    data: {
      siteId: site.id,
      action: ApprovalAction.OTHER,
      entityType: EntityType.OTHER,
      entityId: `PRIZE-${invPrizeBall.id}`,
      requestedById: cashier2.id,
      approvedById: supervisor.id,
      reason: "Redención premio seed",
    },
  });

  // Ledger event PRIZE_REDEMPTION: (opcional) si reconoces "PRIZE_REVENUE" vs. reducción de pasivo points
  // Aquí modelamos: CR PRIZE_REVENUE, DR POINTS_LIABILITY (si llevas puntos como pasivo).
  const lePrize = await createLedgerEvent({
    siteId: site.id,
    createdById: cashier2.id,
    shiftId: shiftOpen.id,
    eventType: LedgerEventType.PRIZE_REDEMPTION,
    description: "Redención premio (puntos)",
    occurredAt: new Date(Date.now() - 15 * 60 * 1000),
    approvalId: approvalPrize.id,
    entries: [
      { account: LedgerAccount.POINTS_LIABILITY, side: LedgerEntrySide.DEBIT, amount: D(prizePointsCost) }, // unidad contable “puntos” como COP no es perfecto; lo ideal es cuenta separada o memo ledger
      { account: LedgerAccount.PRIZE_REVENUE, side: LedgerEntrySide.CREDIT, amount: D(prizePointsCost) },
    ],
  }).catch(async (e) => {
    // Si no quieres mezclar puntos con COP, comenta este bloque y deja solo CardBalanceEvent + inventory
    console.warn("Prize ledger skipped due to accounting mismatch:", e.message);
    return null;
  });

  // consume points
  await prisma.cardBalanceEvent.create({
    data: {
      cardId: cards[0].id,
      siteId: site.id,
      ledgerEventId: lePrize?.id ?? null,
      occurredAt: new Date(Date.now() - 15 * 60 * 1000),
      moneyDelta: D(0),
      pointsDelta: -prizePointsCost,
      reason: `Redención premio: ${invPrizeBall.name}`,
    },
  });

  await prisma.inventoryMovement.create({
    data: {
      siteId: site.id,
      itemId: invPrizeBall.id,
      shiftId: shiftOpen.id,
      performedById: cashier2.id,
      type: InventoryMovementType.REDEMPTION,
      quantity: -1,
      unitCost: D(4000),
      occurredAt: new Date(Date.now() - 15 * 60 * 1000),
      notes: "Entrega premio por puntos",
      approvalId: approvalPrize.id,
    },
  });

  // 16) Attraction usage + reversal (high-volume events)
  // Usage: descuenta moneyDelta negativo (consumo) + ledger ATTRACTION_USAGE (opcional).
  const useAttractionCode = "ARCADE-03";
  const useAttraction = attractions[useAttractionCode];
  const readerId = useAttraction.readerIds[0];
  const useCost = useAttraction.cost; // 4000

  const leUsage = await createLedgerEvent({
    siteId: site.id,
    createdById: cashier2.id,
    shiftId: shiftOpen.id,
    eventType: LedgerEventType.ATTRACTION_USAGE,
    description: `Uso atracción ${useAttractionCode}`,
    occurredAt: new Date(Date.now() - 5 * 60 * 1000),
    entries: [
      // Reduce pasivo del float (porque el cliente consume saldo)
      { account: LedgerAccount.CARD_FLOAT_LIABILITY, side: LedgerEntrySide.DEBIT, amount: useCost },
      { account: LedgerAccount.POS_REVENUE, side: LedgerEntrySide.CREDIT, amount: useCost },
    ],
  });

  const usage = await prisma.attractionUsage.create({
    data: {
      siteId: site.id,
      cardId: cards[0].id,
      attractionId: useAttraction.id,
      readerId,
      playerIndex: 1,
      type: AttractionUsageType.USE,
      cost: useCost,
      occurredAt: leUsage.occurredAt,
      ledgerEventId: leUsage.id,
      performedById: null, // evento automático de lectora
    },
  });

  await prisma.cardBalanceEvent.create({
    data: {
      cardId: cards[0].id,
      siteId: site.id,
      ledgerEventId: leUsage.id,
      occurredAt: leUsage.occurredAt,
      moneyDelta: useCost.mul(-1),
      pointsDelta: 0,
      reason: `Uso atracción ${useAttractionCode}`,
    },
  });

  // Reversal (por doble lectura / error) con aprobación
  const approvalReverseUse = await prisma.supervisorApproval.create({
    data: {
      siteId: site.id,
      action: ApprovalAction.REVERSE_ATTRACTION,
      entityType: EntityType.ATTRACTION_USAGE,
      entityId: usage.id.toString(),
      requestedById: cashier2.id,
      approvedById: supervisor.id,
      reason: "Doble lectura detectada",
      createdAt: new Date(),
    },
  });

  const leUsageReversal = await createLedgerEvent({
    siteId: site.id,
    createdById: supervisor.id,
    shiftId: shiftOpen.id,
    eventType: LedgerEventType.REVERSAL,
    description: `Reverso uso atracción ${useAttractionCode}`,
    occurredAt: approvalReverseUse.createdAt,
    approvalId: approvalReverseUse.id,
    reversalOfId: leUsage.id,
    entries: [
      { account: LedgerAccount.POS_REVENUE, side: LedgerEntrySide.DEBIT, amount: useCost },
      { account: LedgerAccount.CARD_FLOAT_LIABILITY, side: LedgerEntrySide.CREDIT, amount: useCost },
    ],
  });

  const usageReversal = await prisma.attractionUsage.create({
    data: {
      siteId: site.id,
      cardId: cards[0].id,
      attractionId: useAttraction.id,
      readerId,
      playerIndex: 1,
      type: AttractionUsageType.REVERSAL,
      cost: useCost,
      occurredAt: approvalReverseUse.createdAt,
      ledgerEventId: leUsageReversal.id,
      reversalOfId: usage.id,
      performedById: supervisor.id,
      approvalId: approvalReverseUse.id,
    },
  });

  // return money to card
  const cbeUseReversal = await prisma.cardBalanceEvent.create({
    data: {
      cardId: cards[0].id,
      siteId: site.id,
      ledgerEventId: leUsageReversal.id,
      occurredAt: approvalReverseUse.createdAt,
      moneyDelta: useCost, // devuelve
      pointsDelta: 0,
      reason: `Reverso uso atracción ${useAttractionCode}`,
      reversalOfId: null,
    },
  });

  // Link reversal explicitly if quieres trazabilidad bidireccional en CardBalanceEvent
  // (Tu modelo soporta reversalOfId; aquí lo aplicamos a la transacción de consumo más reciente si la encuentras)
  const lastUseCBE = await prisma.cardBalanceEvent.findFirst({
    where: { cardId: cards[0].id, reason: { contains: `Uso atracción ${useAttractionCode}` } },
    orderBy: { occurredAt: "desc" },
  });
  if (lastUseCBE) {
    await prisma.cardBalanceEvent.update({
      where: { id: cbeUseReversal.id },
      data: { reversalOfId: lastUseCBE.id },
    });
  }

  const historicalUsageSeed = [
    { daysAgo: 6, hour: 13, minute: 5, attractionCode: "ARCADE-01", cardId: cards[0].id },
    { daysAgo: 6, hour: 17, minute: 20, attractionCode: "VR-01", cardId: cards[4].id },
    { daysAgo: 5, hour: 15, minute: 40, attractionCode: "PLAY-2-6", cardId: cards[5].id },
    { daysAgo: 4, hour: 11, minute: 15, attractionCode: "ARCADE-04", cardId: cards[0].id },
    { daysAgo: 4, hour: 18, minute: 25, attractionCode: "VR-02", cardId: cards[4].id },
    { daysAgo: 3, hour: 16, minute: 10, attractionCode: "POLIROBO", cardId: cards[5].id },
    { daysAgo: 2, hour: 14, minute: 50, attractionCode: "ARCADE-03", cardId: cards[0].id },
    { daysAgo: 2, hour: 19, minute: 0, attractionCode: "PLAY-6-12", cardId: cards[4].id },
    { daysAgo: 1, hour: 12, minute: 35, attractionCode: "ARCADE-05", cardId: cards[5].id },
    { daysAgo: 1, hour: 17, minute: 45, attractionCode: "EXTRA-03", cardId: cards[0].id },
  ];

  for (const usageSeed of historicalUsageSeed) {
    const attraction = attractions[usageSeed.attractionCode];
    const ctx = seedContextForDay(usageSeed.daysAgo);
    const occurredAt = daysAgoAt(usageSeed.daysAgo, usageSeed.hour, usageSeed.minute);

    const ledger = await createLedgerEvent({
      siteId: site.id,
      createdById: ctx.createdById,
      shiftId: ctx.shiftId,
      eventType: LedgerEventType.ATTRACTION_USAGE,
      description: `Uso histórico ${usageSeed.attractionCode}`,
      occurredAt,
      entries: [
        { account: LedgerAccount.CARD_FLOAT_LIABILITY, side: LedgerEntrySide.DEBIT, amount: attraction.cost },
        { account: LedgerAccount.POS_REVENUE, side: LedgerEntrySide.CREDIT, amount: attraction.cost },
      ],
    });

    await prisma.attractionUsage.create({
      data: {
        siteId: site.id,
        cardId: usageSeed.cardId,
        attractionId: attraction.id,
        readerId: attraction.readerIds[0],
        playerIndex: 1,
        type: AttractionUsageType.USE,
        cost: attraction.cost,
        occurredAt,
        ledgerEventId: ledger.id,
        performedById: null,
      },
    });

    await prisma.cardBalanceEvent.create({
      data: {
        cardId: usageSeed.cardId,
        siteId: site.id,
        ledgerEventId: ledger.id,
        occurredAt,
        moneyDelta: attraction.cost.mul(-1),
        pointsDelta: 0,
        reason: `Uso histórico ${usageSeed.attractionCode}`,
      },
    });
  }

  await audit({
    siteId: site.id,
    actorId: supervisor.id,
    action: AuditAction.REVERSE,
    entityType: EntityType.ATTRACTION_USAGE,
    entityId: usage.id.toString(),
    after: { reversalUsageId: usageReversal.id.toString(), approvalId: approvalReverseUse.id },
    reason: approvalReverseUse.reason,
    createdAt: approvalReverseUse.createdAt,
  });

  // 17) Close shift example (no cierres el shiftOpen si lo quieres para probar UI; pero dejamos un ejemplo aparte)
  // (Opcional) Cierre simulado de otro turno para reporting:
  const shiftReport = await prisma.shift.create({
    data: {
      siteId: site.id,
      cashRegisterId: registerA.id,
      terminalId: terminalA.id,
      openedById: cashier1.id,
      openedAt: nowMinusDays(3),
      openingCash: D(100000),
      status: ShiftStatus.RECONCILED,
      closedById: supervisor.id,
      closedAt: new Date(nowMinusDays(3).getTime() + 9 * 60 * 60 * 1000),
      expectedCash: D(300000),
      countedCash: D(300000),
      cashDiscrepancy: D(0),
      notes: "Turno conciliado seed",
    },
  });

  await audit({
    siteId: site.id,
    actorId: supervisor.id,
    action: AuditAction.CLOSE,
    entityType: EntityType.SHIFT,
    entityId: shiftReport.id,
    after: { status: "RECONCILED", discrepancy: "0" },
    createdAt: shiftReport.closedAt ?? new Date(),
  });

  console.log("✅ Seed completo generado.");
  console.log({
    organization: organization.name,
    site: site.name,
    users: [admin.email, supervisor.email, cashier.email],
    shiftOpenId: shiftOpen.id,
    sampleCardUid: cards[0].uid,
    sampleSaleId: saleA.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
