/* eslint-disable no-console */
import { PrismaClient, Prisma, RoleName, PermissionCode, UserStatus, SiteStatus, ShiftStatus, PaymentMethod, SaleStatus, SaleCategory, LedgerEventType, LedgerEntrySide, LedgerAccount, InventoryCategory, InventoryMovementType, AttractionUsageType, ServiceStatus, AuditAction, ApprovalAction, EntityType, CardStatus, CashSessionStatus, CashCountType, CustomerDocumentType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const D = (n: number | string) => new Prisma.Decimal(n);

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
    },
    create: {
      siteId: site.id,
      minRechargeAmount: D(5000),
      pointsPerCurrency: 1,
      currencyUnit: 1000,
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

  const cashier1 = await prisma.user.upsert({
    where: { email: "cajero1@poliverse.local" },
    update: { status: UserStatus.ACTIVE, fullName: "Cajero 1" },
    create: {
      email: "cajero1@poliverse.local",
      fullName: "Cajero 1",
      passwordHash: await hash("Cajero123!"),
      status: UserStatus.ACTIVE,
    },
  });

  const cashier2 = await prisma.user.upsert({
    where: { email: "cajero2@poliverse.local" },
    update: { status: UserStatus.ACTIVE, fullName: "Cajero 2" },
    create: {
      email: "cajero2@poliverse.local",
      fullName: "Cajero 2",
      passwordHash: await hash("Cajero123!"),
      status: UserStatus.ACTIVE,
    },
  });

  async function assign(userId: string, roleId: string) {
    await prisma.userAssignment.upsert({
      where: { userId_siteId_roleId: { userId, siteId: site.id, roleId } },
      update: { isActive: true },
      create: { userId, siteId: site.id, roleId, isActive: true },
    });
  }

  await assign(admin.id, roleAdmin.id);
  await assign(supervisor.id, roleSupervisor.id);
  await assign(cashier1.id, roleCashier.id);
  await assign(cashier2.id, roleCashier.id);

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
  await setAuthCode(cashier1.id, "333333");
  await setAuthCode(cashier2.id, "444444");

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

  // 6) Products (POS catálogo)
  // Incluye: plástico, gift card, snacks, servicios placeholders (aunque Service está separado), otros.
  const products = [
    { name: "Tarjeta Plástico POLIVERSE", sku: "CARD-PLASTIC", category: SaleCategory.CARD_PLASTIC, price: D(5000) },
    { name: "Tarjeta Regalo (plástico)", sku: "GIFT-PLASTIC", category: SaleCategory.GIFT_CARD, price: D(5000) },
    // Snacks
    { name: "Gaseosa 400ml", sku: "SNACK-SODA-400", category: SaleCategory.SNACKS, price: D(6000) },
    { name: "Agua 600ml", sku: "SNACK-WATER-600", category: SaleCategory.SNACKS, price: D(4000) },
    { name: "Crispetas", sku: "SNACK-POPCORN", category: SaleCategory.SNACKS, price: D(8000) },
    { name: "Mekato mixto", sku: "SNACK-MEKATO", category: SaleCategory.SNACKS, price: D(5000) },
    // Otros
    { name: "Accesorio / Souvenir", sku: "OTHER-SOUVENIR", category: SaleCategory.OTHER, price: D(12000) },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { siteId_sku: { siteId: site.id, sku: p.sku! } },
      update: { name: p.name, price: p.price, category: p.category, isActive: true },
      create: { siteId: site.id, ...p, isActive: true },
    });
  }

  const productCardPlastic = await prisma.product.findFirstOrThrow({ where: { siteId: site.id, sku: "CARD-PLASTIC" } });
  const productGiftPlastic = await prisma.product.findFirstOrThrow({ where: { siteId: site.id, sku: "GIFT-PLASTIC" } });
  const productSoda = await prisma.product.findFirstOrThrow({ where: { siteId: site.id, sku: "SNACK-SODA-400" } });
  const productPopcorn = await prisma.product.findFirstOrThrow({ where: { siteId: site.id, sku: "SNACK-POPCORN" } });
  const productSouvenir = await prisma.product.findFirstOrThrow({ where: { siteId: site.id, sku: "OTHER-SOUVENIR" } });

  // 7) Inventory items (cards, prizes, snacks)
  const inventoryItems = [
    // Tarjetas físicas
    { name: "Tarjeta Plástico POLIVERSE", sku: "INV-CARD-PLASTIC", category: InventoryCategory.CARD_PLASTIC },
    { name: "Tarjeta Regalo (plástico)", sku: "INV-GIFT-PLASTIC", category: InventoryCategory.CARD_PLASTIC },
    // Premios
    { name: "Pelota Saltarina", sku: "PRIZE-BALL", category: InventoryCategory.PRIZE },
    { name: "Carro Mini", sku: "PRIZE-CAR", category: InventoryCategory.PRIZE },
    { name: "Muñeco Pequeño", sku: "PRIZE-DOLL", category: InventoryCategory.PRIZE },
    // Snacks
    { name: "Gaseosa 400ml", sku: "INV-SNACK-SODA-400", category: InventoryCategory.SNACK },
    { name: "Crispetas", sku: "INV-SNACK-POPCORN", category: InventoryCategory.SNACK },
  ];

  for (const it of inventoryItems) {
    await prisma.inventoryItem.upsert({
      where: { siteId_sku: { siteId: site.id, sku: it.sku } },
      update: { name: it.name, category: it.category, isActive: true },
      create: { siteId: site.id, ...it, isActive: true },
    });
  }

  const invCardPlastic = await prisma.inventoryItem.findFirstOrThrow({ where: { siteId: site.id, sku: "INV-CARD-PLASTIC" } });
  const invGiftPlastic = await prisma.inventoryItem.findFirstOrThrow({ where: { siteId: site.id, sku: "INV-GIFT-PLASTIC" } });
  const invPrizeBall = await prisma.inventoryItem.findFirstOrThrow({ where: { siteId: site.id, sku: "PRIZE-BALL" } });
  const invSnackSoda = await prisma.inventoryItem.findFirstOrThrow({ where: { siteId: site.id, sku: "INV-SNACK-SODA-400" } });
  const invSnackPop = await prisma.inventoryItem.findFirstOrThrow({ where: { siteId: site.id, sku: "INV-SNACK-POPCORN" } });

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

  // Shift abierto (hoy)
  const shiftOpen = await prisma.shift.create({
    data: {
      siteId: site.id,
      cashRegisterId: registerB.id,
      terminalId: terminalB.id,
      openedById: cashier2.id,
      openedAt: nowMinusDays(0),
      openingCash: D(150000),
      status: ShiftStatus.OPEN,
      notes: "Turno abierto seed",
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

  await prisma.cashCount.createMany({
    data: [
      {
        siteId: site.id,
        cashSessionId: cashSessionClosed.id,
        type: CashCountType.OPENING,
        denominations: { "100000": 1, "50000": 2, "20000": 3, "10000": 1 },
        totalAmount: D(200000),
        countedByUserId: cashier1.id,
        createdAt: shiftClosed.openedAt,
      },
      {
        siteId: site.id,
        cashSessionId: cashSessionClosed.id,
        type: CashCountType.CLOSING,
        denominations: { "50000": 6, "20000": 6, "10000": 1, "5000": 4 },
        totalAmount: D(518000),
        countedByUserId: supervisor.id,
        createdAt: shiftClosed.closedAt ?? nowMinusDays(1),
      },
    ],
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
      status: CashSessionStatus.OPEN,
    },
  });

  await prisma.cashCount.create({
    data: {
      siteId: site.id,
      cashSessionId: cashSessionOpen.id,
      type: CashCountType.OPENING,
      denominations: { "50000": 2, "20000": 2, "10000": 2, "5000": 2 },
      totalAmount: D(150000),
      countedByUserId: cashier2.id,
      createdAt: shiftOpen.openedAt,
    },
  });

  // 9) Inventory movements (apertura + compras + ajustes)
  // Nota: tu modelo permite OPENING_COUNT. Creamos algunos movimientos para tener stock.
  await prisma.inventoryMovement.createMany({
    data: [
      // Apertura de tarjetas
      { siteId: site.id, itemId: invCardPlastic.id, shiftId: shiftClosed.id, performedById: admin.id, type: InventoryMovementType.OPENING_COUNT, quantity: 200, unitCost: D(1500), occurredAt: nowMinusDays(7), notes: "Stock inicial tarjetas" },
      { siteId: site.id, itemId: invGiftPlastic.id, shiftId: shiftClosed.id, performedById: admin.id, type: InventoryMovementType.OPENING_COUNT, quantity: 50, unitCost: D(1500), occurredAt: nowMinusDays(7), notes: "Stock inicial gift cards" },

      // Apertura de snacks
      { siteId: site.id, itemId: invSnackSoda.id, shiftId: shiftClosed.id, performedById: admin.id, type: InventoryMovementType.OPENING_COUNT, quantity: 120, unitCost: D(2500), occurredAt: nowMinusDays(7), notes: "Stock inicial gaseosas" },
      { siteId: site.id, itemId: invSnackPop.id, shiftId: shiftClosed.id, performedById: admin.id, type: InventoryMovementType.OPENING_COUNT, quantity: 80, unitCost: D(3000), occurredAt: nowMinusDays(7), notes: "Stock inicial crispetas" },

      // Apertura de premios
      { siteId: site.id, itemId: invPrizeBall.id, shiftId: shiftClosed.id, performedById: admin.id, type: InventoryMovementType.OPENING_COUNT, quantity: 60, unitCost: D(4000), occurredAt: nowMinusDays(7), notes: "Stock inicial premios" },

      // Ajuste por daño (con nota)
      { siteId: site.id, itemId: invSnackSoda.id, shiftId: shiftClosed.id, performedById: supervisor.id, type: InventoryMovementType.ADJUSTMENT, quantity: -2, unitCost: D(2500), occurredAt: nowMinusDays(2), notes: "Daño / merma" },
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

  const attractions: Record<string, { id: string; cost: Prisma.Decimal; readerIds: string[] }> = {};

  for (const spec of attractionSpecs) {
    const a = await prisma.attraction.upsert({
      where: { siteId_code: { siteId: site.id, code: spec.code } },
      update: { name: spec.name, cost: D(spec.cost), isActive: true },
      create: { siteId: site.id, code: spec.code, name: spec.name, cost: D(spec.cost), isActive: true },
    });

    const readerIds: string[] = [];
    for (let i = 1; i <= spec.readers; i++) {
      const code = `${spec.code}-R${i}`;
      const r = await prisma.reader.upsert({
        where: { attractionId_code: { attractionId: a.id, code } },
        update: { position: i, isActive: true },
        create: { siteId: site.id, attractionId: a.id, code, position: i, isActive: true },
      });
      readerIds.push(r.id);
    }

    attractions[spec.code] = { id: a.id, cost: a.cost, readerIds };
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
        return LedgerAccount.BANK_TRANSFER;
      case PaymentMethod.QR:
        return LedgerAccount.QR_PROVIDER;
      case PaymentMethod.CARD:
        return LedgerAccount.CARD_PROCESSOR;
      case PaymentMethod.MIXED:
      default:
        // MIXED no debería venir aquí como "un solo payment"
        return LedgerAccount.CASH_ON_HAND;
    }
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
      { productId: productSoda.id, category: SaleCategory.SNACKS, qty: 2, unitPrice: productSoda.price },
      { productId: productPopcorn.id, category: SaleCategory.SNACKS, qty: 1, unitPrice: productPopcorn.price },
      { productId: productSouvenir.id, category: SaleCategory.OTHER, qty: 1, unitPrice: productSouvenir.price },
    ],
    payments: [
      { method: PaymentMethod.CASH, amount: D(10000) },
      { method: PaymentMethod.QR, amount: D(22000), reference: "QR-CO-7712001" },
    ],
  });

  // Inventory movements for snack sale (sale decreases stock)
  await prisma.inventoryMovement.createMany({
    data: [
      { siteId: site.id, itemId: invSnackSoda.id, shiftId: shiftOpen.id, performedById: cashier2.id, type: InventoryMovementType.SALE, quantity: -2, unitCost: D(2500), occurredAt: saleB.createdAt, notes: `Venta snacks: Sale ${saleB.id}` },
      { siteId: site.id, itemId: invSnackPop.id, shiftId: shiftOpen.id, performedById: cashier2.id, type: InventoryMovementType.SALE, quantity: -1, unitCost: D(3000), occurredAt: saleB.createdAt, notes: `Venta snacks: Sale ${saleB.id}` },
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
      { account: LedgerAccount.CASH_ON_HAND, side: LedgerEntrySide.DEBIT, amount: D(10000) },
      { account: LedgerAccount.QR_PROVIDER, side: LedgerEntrySide.DEBIT, amount: D(22000) },

      // Revenue split: snacks vs other
      { account: LedgerAccount.SNACKS_REVENUE, side: LedgerEntrySide.CREDIT, amount: productSoda.price.mul(2).add(productPopcorn.price) }, // 2 sodas + popcorn
      { account: LedgerAccount.POS_REVENUE, side: LedgerEntrySide.CREDIT, amount: productSouvenir.price }, // souvenir a POS_REVENUE
    ],
  });

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
    lines: [{ productId: productGiftPlastic.id, category: SaleCategory.GIFT_CARD, qty: 1, unitPrice: productGiftPlastic.price }],
    payments: [{ method: PaymentMethod.CASH, amount: D(5000) }],
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
      { account: LedgerAccount.CASH_ON_HAND, side: LedgerEntrySide.DEBIT, amount: D(5000) },
      { account: LedgerAccount.POS_REVENUE, side: LedgerEntrySide.CREDIT, amount: D(5000) },
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
      { account: LedgerAccount.POS_REVENUE, side: LedgerEntrySide.DEBIT, amount: D(5000) },
      { account: LedgerAccount.CASH_ON_HAND, side: LedgerEntrySide.CREDIT, amount: D(5000) },
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
    users: [admin.email, supervisor.email, cashier1.email, cashier2.email],
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
