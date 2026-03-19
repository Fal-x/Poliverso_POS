import crypto from 'node:crypto';
import type { PaymentMethod } from '@prisma/client';
import type { ApiClient } from '../api.client';
import type { DbWriter } from '../db.writer';

export type SimReader = {
  id: string;
  code: string;
  siteId: string;
  attractionId: string;
  attractionCode: string;
};

export type FraudPatternContext = {
  siteId: string;
  terminalId: string;
  shiftId: string;
  cashSessionId: string;
  cashierUserId: string;
  supervisorUserId: string;
  customerId: string;
  cardId: string;
  cardUid: string;
  readers: SimReader[];
  now: Date;
};

export async function runSimultaneousCardUse(params: {
  db: DbWriter;
  context: FraudPatternContext;
}): Promise<number> {
  const { db, context } = params;
  if (context.readers.length < 2) return 0;

  const [readerA, readerB] = context.readers;
  const requestA = `FRD-SIM-A-${crypto.randomUUID()}`;
  const requestB = `FRD-SIM-B-${crypto.randomUUID()}`;

  const [resA, resB] = await Promise.all([
    db.createAttractionUsageDirect({
      siteId: context.siteId,
      cardId: context.cardId,
      readerId: readerA.id,
      requestId: requestA,
      occurredAt: context.now,
      createdByUserId: context.cashierUserId,
      reason: 'FRAUD_SIMULTANEOUS_USE',
      forceAllow: true,
    }),
    db.createAttractionUsageDirect({
      siteId: context.siteId,
      cardId: context.cardId,
      readerId: readerB.id,
      requestId: requestB,
      occurredAt: context.now,
      createdByUserId: context.cashierUserId,
      reason: 'FRAUD_SIMULTANEOUS_USE',
      forceAllow: true,
    }),
  ]);

  return Number(resA.allowed) + Number(resB.allowed);
}

export async function runRepeatedRechargeBurst(params: {
  api: ApiClient;
  context: FraudPatternContext;
  times: number;
  amount: number;
}): Promise<number> {
  const { api, context, times, amount } = params;
  let ok = 0;
  for (let i = 0; i < times; i += 1) {
    const method: PaymentMethod = i % 2 === 0 ? 'CASH' : 'TRANSFER';
    const applied = await api.rechargeCard({
      identity: { userId: context.cashierUserId, role: 'cashier' },
      cardUid: context.cardUid,
      siteId: context.siteId,
      customerId: context.customerId,
      terminalId: context.terminalId,
      shiftId: context.shiftId,
      cashSessionId: context.cashSessionId,
      createdByUserId: context.cashierUserId,
      amount,
      paymentMethod: method,
    });
    if (applied) ok += 1;
  }
  return ok;
}

export async function runVoidBurst(params: {
  db: DbWriter;
  context: FraudPatternContext;
  burstSize: number;
}): Promise<number> {
  return params.db.voidRecentSalesBurst({
    siteId: params.context.siteId,
    actorId: params.context.supervisorUserId,
    burstSize: params.burstSize,
    occurredAt: params.context.now,
  });
}

export async function runSuspiciousCashImbalance(params: {
  db: DbWriter;
  context: FraudPatternContext;
  amount: number;
}): Promise<void> {
  await params.db.createCashMovementDirect({
    siteId: params.context.siteId,
    cashSessionId: params.context.cashSessionId,
    createdByUserId: params.context.cashierUserId,
    authorizedByUserId: params.context.supervisorUserId,
    type: 'WITHDRAWAL',
    amount: params.amount,
    reason: 'FRAUD_SUSPICIOUS_WITHDRAWAL',
    occurredAt: params.context.now,
  });
}

export async function runOffHoursUsage(params: {
  db: DbWriter;
  context: FraudPatternContext;
}): Promise<boolean> {
  const reader = params.context.readers[0];
  if (!reader) return false;
  const result = await params.db.createAttractionUsageDirect({
    siteId: params.context.siteId,
    cardId: params.context.cardId,
    readerId: reader.id,
    requestId: `FRD-OFFHOURS-${crypto.randomUUID()}`,
    occurredAt: params.context.now,
    createdByUserId: params.context.cashierUserId,
    reason: 'FRAUD_OFF_HOURS',
    forceAllow: true,
  });
  return result.allowed;
}
