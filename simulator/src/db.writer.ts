import {
  CashMovementType,
  CashSessionStatus,
  PaymentMethod,
  Prisma,
  PrismaClient,
  SaleCategory,
  SaleStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import pino from 'pino';
import crypto from 'node:crypto';

type DbWriterOptions = {
  prisma?: PrismaClient;
  prismaConnectionLimit?: number;
  logger: pino.Logger;
};

const D = (value: number | string | Prisma.Decimal) => new Prisma.Decimal(value);

function paymentToAccount(method: PaymentMethod): 'CASH_ON_HAND' | 'BANK_TRANSFER' | 'QR_PROVIDER' | 'CARD_PROCESSOR' {
  if (method === 'CASH') return 'CASH_ON_HAND';
  if (method === 'QR') return 'QR_PROVIDER';
  if (method === 'CARD' || method === 'CREDIT_CARD') return 'CARD_PROCESSOR';
  return 'BANK_TRANSFER';
}

function randomDocument(rng: () => number): string {
  return `${Math.floor(10_000_000 + rng() * 80_000_000)}${Date.now().toString().slice(-4)}${Math.floor(rng() * 90) + 10}`;
}

export class DbWriter {
  readonly prisma: PrismaClient;
  private readonly ownsClient: boolean;
  private readonly logger: pino.Logger;

  constructor(options: DbWriterOptions) {
    if (options.prisma) {
      this.prisma = options.prisma;
      this.ownsClient = false;
    } else {
      this.prisma = new PrismaClient({
        datasources: { db: { url: process.env.DATABASE_URL } },
      });
      this.ownsClient = true;
    }
    this.logger = options.logger.child({ module: 'db-writer' });
  }

  async disconnect(): Promise<void> {
    if (this.ownsClient) {
      await this.prisma.$disconnect();
    }
  }

  async ensureCustomer(params: {
    siteId: string;
    rng: () => number;
    customerType: 'new' | 'recurrent' | 'heavy';
  }): Promise<{ id: string }> {
    const existing = await this.prisma.customer.findFirst({
      where: { siteId: params.siteId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (existing && params.customerType !== 'new' && params.rng() < 0.8) {
      return existing;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const documentNumber = randomDocument(params.rng);
      const now = Date.now();
      try {
        const created = await this.prisma.customer.create({
          data: {
            siteId: params.siteId,
            documentType: 'CC',
            documentNumber,
            fullName: `Sim Customer ${documentNumber.slice(-4)}`,
            phone: `3${Math.floor(10_000_000 + params.rng() * 89_999_999)}`,
            email: `sim_${now}_${crypto.randomUUID()}@poliverse.local`,
            city: 'Bogota',
          },
          select: { id: true },
        });
        return created;
      } catch (error: any) {
        if (error?.code !== 'P2002') throw error;
      }
    }

    throw new Error('Failed to create unique customer after retries');
  }

  async ensureActiveCard(params: {
    siteId: string;
    customerId: string;
    rng: () => number;
    minBalance?: number;
  }): Promise<{ id: string; uid: string; creditBalance: Prisma.Decimal; pointsBalance: number }> {
    const card = await this.prisma.card.findFirst({
      where: {
        siteId: params.siteId,
        status: 'ACTIVE',
        OR: [{ ownerCustomerId: params.customerId }, { ownerCustomerId: null }],
      },
      orderBy: [{ creditBalance: 'desc' }, { issuedAt: 'desc' }],
      select: { id: true, uid: true, creditBalance: true, pointsBalance: true },
    });

    if (card && (!params.minBalance || card.creditBalance.gte(params.minBalance))) {
      if (!card.uid) {
        throw new Error('invalid card uid');
      }
      return card;
    }

    const uid = `SIM${Date.now().toString(36).toUpperCase()}${Math.floor(params.rng() * 9999)
      .toString()
      .padStart(4, '0')}`;

    const created = await this.prisma.card.create({
      data: {
        siteId: params.siteId,
        uid,
        ownerCustomerId: params.customerId,
        status: 'ACTIVE',
        creditBalance: D(Math.max(0, params.minBalance ?? 0)),
      },
      select: { id: true, uid: true, creditBalance: true, pointsBalance: true },
    });

    const systemUser = await this.pickSystemUser(params.siteId);
    if (systemUser) {
      await this.prisma.cardStatusHistory.create({
        data: {
          siteId: params.siteId,
          cardId: created.id,
          fromStatus: null,
          toStatus: 'ACTIVE',
          reason: 'SIM_CARD_ISSUE',
          changedByUserId: systemUser,
        },
      });
    }

    return created;
  }

  async createDirectSale(params: {
    siteId: string;
    customerId: string;
    shiftId: string;
    terminalId: string;
    cashSessionId: string;
    createdByUserId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    occurredAt: Date;
    category?: SaleCategory;
    note?: string;
  }): Promise<{ saleId: string }> {
    const amount = D(Math.max(1000, params.amount));
    const account = paymentToAccount(params.paymentMethod);

    const sale = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          siteId: params.siteId,
          customerId: params.customerId,
          shiftId: params.shiftId,
          terminalId: params.terminalId,
          cashSessionId: params.cashSessionId,
          createdById: params.createdByUserId,
          status: SaleStatus.PAID,
          subtotal: amount,
          tax: D(0),
          total: amount,
          totalPaid: amount,
          balanceDue: D(0),
          createdAt: params.occurredAt,
          paidAt: params.occurredAt,
          lines: {
            create: {
              category: params.category ?? SaleCategory.SNACKS,
              quantity: 1,
              unitPrice: amount,
              lineTotal: amount,
              metadata: params.note ? ({ note: params.note } as Prisma.JsonObject) : undefined,
            },
          },
          payments: {
            create: {
              method: params.paymentMethod,
              amount,
              createdAt: params.occurredAt,
            },
          },
        },
      });

      await tx.ledgerEvent.create({
        data: {
          siteId: params.siteId,
          shiftId: params.shiftId,
          saleId: created.id,
          eventType: 'SALE',
          description: `SIM POS SALE ${params.category ?? SaleCategory.SNACKS}`,
          createdById: params.createdByUserId,
          occurredAt: params.occurredAt,
          entries: {
            create: [
              { account, side: 'DEBIT', amount },
              { account: 'POS_REVENUE', side: 'CREDIT', amount },
            ],
          },
        },
      });

      return created;
    });

    return { saleId: sale.id };
  }

  async createAttractionUsageDirect(params: {
    siteId: string;
    cardId: string;
    readerId: string;
    requestId: string;
    occurredAt: Date;
    createdByUserId: string;
    reason?: string;
    forceAllow?: boolean;
  }): Promise<{ allowed: boolean; reason: string; usageId?: bigint }> {
    return this.prisma.$transaction(async (tx) => {
      const reader = await tx.reader.findFirst({
        where: { id: params.readerId, siteId: params.siteId },
        include: { attraction: true },
      });

      const card = await tx.card.findFirst({
        where: { id: params.cardId, siteId: params.siteId },
      });

      if (!reader || !card) {
        return { allowed: false, reason: 'MISSING_CARD_OR_READER' };
      }

      if (!reader.isActive || reader.attraction.status !== 'ACTIVE') {
        await tx.deviceLog.create({
          data: {
            siteId: params.siteId,
            readerId: reader.id,
            cardId: card.id,
            uid: card.uid,
            requestId: params.requestId,
            eventType: 'READER_VALIDATE',
            allowed: false,
            reason: !reader.isActive ? 'READER_INACTIVE' : 'MACHINE_INACTIVE',
            creditBefore: card.creditBalance,
            creditAfter: card.creditBalance,
            createdAt: params.occurredAt,
          },
        });
        return { allowed: false, reason: !reader.isActive ? 'READER_INACTIVE' : 'MACHINE_INACTIVE' };
      }

      const price = reader.attraction.price;
      const hasBalance = card.creditBalance.gte(price);
      if (!hasBalance && !params.forceAllow) {
        await tx.deviceLog.create({
          data: {
            siteId: params.siteId,
            readerId: reader.id,
            cardId: card.id,
            uid: card.uid,
            requestId: params.requestId,
            eventType: 'READER_VALIDATE',
            allowed: false,
            reason: 'INSUFFICIENT_FUNDS',
            creditBefore: card.creditBalance,
            creditAfter: card.creditBalance,
            createdAt: params.occurredAt,
          },
        });
        return { allowed: false, reason: 'INSUFFICIENT_FUNDS' };
      }

      const before = card.creditBalance;
      const after = before.sub(price);

      const ledger = await tx.ledgerEvent.create({
        data: {
          siteId: params.siteId,
          eventType: 'ATTRACTION_USAGE',
          description: params.reason ?? `SIM_USAGE ${reader.attraction.code}`,
          createdById: params.createdByUserId,
          occurredAt: params.occurredAt,
          entries: {
            create: [
              { account: 'CARD_FLOAT_LIABILITY', side: 'DEBIT', amount: price },
              { account: 'SERVICE_REVENUE', side: 'CREDIT', amount: price },
            ],
          },
        },
      });

      await tx.card.update({
        where: { id: card.id },
        data: { creditBalance: { decrement: price } },
      });

      await tx.cardBalanceEvent.create({
        data: {
          cardId: card.id,
          siteId: params.siteId,
          ledgerEventId: ledger.id,
          moneyDelta: price.mul(-1),
          pointsDelta: 0,
          reason: params.reason ?? 'SIM_USAGE',
          occurredAt: params.occurredAt,
        },
      });

      const usage = await tx.attractionUsage.create({
        data: {
          siteId: params.siteId,
          cardId: card.id,
          attractionId: reader.attractionId,
          readerId: reader.id,
          cost: price,
          occurredAt: params.occurredAt,
          ledgerEventId: ledger.id,
          performedById: params.createdByUserId,
        },
      });

      await tx.deviceLog.create({
        data: {
          siteId: params.siteId,
          readerId: reader.id,
          cardId: card.id,
          uid: card.uid,
          activityId: reader.attractionId,
          requestId: params.requestId,
          eventType: 'READER_VALIDATE',
          allowed: true,
          reason: params.reason ?? 'OK',
          creditBefore: before,
          creditAfter: after,
          createdAt: params.occurredAt,
        },
      });

      return { allowed: true, reason: 'OK', usageId: usage.id };
    });
  }

  async createDeviceLog(params: {
    siteId: string;
    readerId: string;
    requestId: string;
    eventType: string;
    allowed: boolean;
    reason: string;
    cardId?: string;
    uid?: string;
    occurredAt: Date;
  }): Promise<void> {
    await this.prisma.deviceLog.create({
      data: {
        siteId: params.siteId,
        readerId: params.readerId,
        requestId: params.requestId,
        eventType: params.eventType,
        allowed: params.allowed,
        reason: params.reason,
        cardId: params.cardId,
        uid: params.uid,
        createdAt: params.occurredAt,
      },
    });
  }

  async setReaderCredentials(siteId: string, readerIds: string[], apiToken: string, hmacSecret: string): Promise<void> {
    const tokenHash = await bcrypt.hash(apiToken, 10);
    await this.prisma.reader.updateMany({
      where: { siteId, id: { in: readerIds } },
      data: { apiTokenHash: tokenHash, hmacSecret, isActive: true },
    });
  }

  async getOpenCashSession(params: {
    siteId: string;
    terminalId: string;
    cashRegisterId: string;
  }): Promise<{ id: string; shiftId: string; openedByUserId: string } | null> {
    const session = await this.prisma.cashSession.findFirst({
      where: {
        siteId: params.siteId,
        terminalId: params.terminalId,
        cashRegisterId: params.cashRegisterId,
        status: CashSessionStatus.OPEN,
      },
      select: { id: true, shiftId: true, openedByUserId: true },
      orderBy: { openedAt: 'desc' },
    });
    if (!session?.shiftId) return null;
    return { id: session.id, shiftId: session.shiftId, openedByUserId: session.openedByUserId };
  }

  async getOpeningReference(params: {
    siteId: string;
    terminalId: string;
    cashRegisterId: string;
  }): Promise<{ suggestedOpeningCash: number }> {
    const lastClosed = await this.prisma.cashSession.findFirst({
      where: {
        siteId: params.siteId,
        terminalId: params.terminalId,
        cashRegisterId: params.cashRegisterId,
        status: CashSessionStatus.CLOSED,
      },
      orderBy: { closedAt: 'desc' },
      select: {
        closingCashAmount: true,
        expectedCashAmount: true,
        openingCashAmount: true,
      },
    });

    const suggested =
      lastClosed?.closingCashAmount ??
      lastClosed?.expectedCashAmount ??
      lastClosed?.openingCashAmount ??
      D(0);

    return { suggestedOpeningCash: Number(suggested.toFixed(2)) };
  }

  async openCashSessionDirect(params: {
    siteId: string;
    terminalId: string;
    cashRegisterId: string;
    openedByUserId: string;
    openingCashAmount: number;
    occurredAt: Date;
  }): Promise<{ id: string; shiftId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const open = await tx.cashSession.findFirst({
        where: {
          siteId: params.siteId,
          terminalId: params.terminalId,
          cashRegisterId: params.cashRegisterId,
          status: CashSessionStatus.OPEN,
        },
        select: { id: true, shiftId: true },
      });
      if (open?.shiftId) return { id: open.id, shiftId: open.shiftId };

      const shift = await tx.shift.create({
        data: {
          siteId: params.siteId,
          terminalId: params.terminalId,
          cashRegisterId: params.cashRegisterId,
          openedById: params.openedByUserId,
          openedAt: params.occurredAt,
          openingCash: D(params.openingCashAmount),
          status: 'OPEN',
          notes: 'SIM_AUTO_SHIFT',
        },
      });

      const session = await tx.cashSession.create({
        data: {
          siteId: params.siteId,
          terminalId: params.terminalId,
          cashRegisterId: params.cashRegisterId,
          shiftId: shift.id,
          openedByUserId: params.openedByUserId,
          openedAt: params.occurredAt,
          openingCashAmount: D(params.openingCashAmount),
          expectedCashAmount: D(params.openingCashAmount),
          status: CashSessionStatus.OPEN,
        },
      });

      return { id: session.id, shiftId: shift.id };
    });
  }

  async closeCashSessionDirect(params: {
    siteId: string;
    cashSessionId: string;
    closedByUserId: string;
    closingCashAmount: number;
    closeReason: string;
    occurredAt: Date;
  }): Promise<void> {
    const closed = await this.prisma.$transaction(async (tx) => {
      const session = await tx.cashSession.findFirst({
        where: {
          id: params.cashSessionId,
          siteId: params.siteId,
          status: CashSessionStatus.OPEN,
        },
      });
      if (!session) return null;

      const cashSales = await tx.salePayment.aggregate({
        where: {
          method: 'CASH',
          sale: { cashSessionId: session.id, status: { not: 'VOIDED' } },
        },
        _sum: { amount: true },
      });

      const withdrawals = await tx.cashMovement.aggregate({
        where: { cashSessionId: session.id, type: CashMovementType.WITHDRAWAL, voidedAt: null },
        _sum: { amount: true },
      });

      const adjustments = await tx.cashMovement.aggregate({
        where: { cashSessionId: session.id, type: CashMovementType.ADJUSTMENT, voidedAt: null },
        _sum: { amount: true },
      });

      const expected = session.openingCashAmount
        .add(cashSales._sum.amount ?? D(0))
        .sub(withdrawals._sum.amount ?? D(0))
        .add(adjustments._sum.amount ?? D(0));

      const closeAmount = D(params.closingCashAmount);
      const difference = closeAmount.sub(expected);

      await tx.cashSession.update({
        where: { id: session.id },
        data: {
          status: CashSessionStatus.CLOSED,
          closedAt: params.occurredAt,
          closedById: params.closedByUserId,
          closingCashAmount: closeAmount,
          cashDifference: difference,
          expectedCashAmount: expected,
          closeReason: params.closeReason,
        },
      });

      if (session.shiftId) {
        await tx.shift.updateMany({
          where: { id: session.shiftId, status: 'OPEN' },
          data: {
            status: 'CLOSED',
            closedById: params.closedByUserId,
            closedAt: params.occurredAt,
            expectedCash: expected,
            countedCash: closeAmount,
            cashDiscrepancy: difference,
            notes: params.closeReason,
          },
        });
      }

      return true;
    });

    if (!closed) {
      this.logger.warn({ cashSessionId: params.cashSessionId }, 'cash session already closed or missing');
    }
  }

  async createCashMovementDirect(params: {
    siteId: string;
    cashSessionId: string;
    createdByUserId: string;
    authorizedByUserId: string;
    type: CashMovementType;
    amount: number;
    reason: string;
    occurredAt: Date;
  }): Promise<void> {
    await this.prisma.cashMovement.create({
      data: {
        siteId: params.siteId,
        cashSessionId: params.cashSessionId,
        createdByUserId: params.createdByUserId,
        authorizedByUserId: params.authorizedByUserId,
        type: params.type,
        amount: D(params.amount),
        reason: params.reason,
        createdAt: params.occurredAt,
      },
    });
  }

  async voidRecentSalesBurst(params: {
    siteId: string;
    actorId: string;
    burstSize: number;
    occurredAt: Date;
  }): Promise<number> {
    const recentSales = await this.prisma.sale.findMany({
      where: {
        siteId: params.siteId,
        status: 'PAID',
      },
      orderBy: { createdAt: 'desc' },
      take: params.burstSize,
      select: { id: true },
    });

    if (recentSales.length === 0) return 0;

    await this.prisma.$transaction(async (tx) => {
      for (const sale of recentSales) {
        await tx.sale.update({
          where: { id: sale.id },
          data: { status: SaleStatus.VOIDED, voidedAt: params.occurredAt },
        });
        await tx.auditLog.create({
          data: {
            siteId: params.siteId,
            actorId: params.actorId,
            action: 'VOID',
            entityType: 'SALE',
            entityId: sale.id,
            reason: 'SIM_VOID_BURST',
            createdAt: params.occurredAt,
            after: { status: 'VOIDED' },
          },
        });
      }
    });

    return recentSales.length;
  }

  private async pickSystemUser(siteId: string): Promise<string | null> {
    const assignment = await this.prisma.userAssignment.findFirst({
      where: { siteId, isActive: true, user: { status: 'ACTIVE' } },
      select: { userId: true },
    });
    return assignment?.userId ?? null;
  }
}
