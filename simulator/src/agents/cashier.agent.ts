import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import pino from 'pino';
import type { PaymentMethod } from '@prisma/client';
import { ApiClient } from '../api.client';
import { simulatorConfig, type SimulatorConfig } from '../config';
import { DbWriter } from '../db.writer';
import { CustomerAgent } from './customer.agent';
import { buildCustomerIntent } from '../models/retention.model';

export type WorkerReader = {
  id: string;
  code: string;
  siteId: string;
  attractionId: string;
  attractionCode: string;
};

export type CashierWorkerInit = {
  workerId: number;
  config: SimulatorConfig;
  siteId: string;
  terminalId: string;
  cashRegisterId: string;
  cashierUserId: string;
  supervisorUserId: string;
  avgTicket: number;
  rechargeToTicketRatio: number;
  readers: WorkerReader[];
};

type TickPayload = {
  atIso: string;
  expectedArrivals: number;
  demandIndex: number;
};

class Lcg {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
}

async function runWorker(init: CashierWorkerInit): Promise<void> {
  const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' }).child({
    module: 'cashier-worker',
    workerId: init.workerId,
    siteId: init.siteId,
  });

  const rng = new Lcg(simulatorConfig.randomSeed + init.workerId * 9973);
  const db = new DbWriter({ logger });
  const api = new ApiClient({
    baseUrl: init.config.apiBaseUrl,
    jwtSecret: init.config.jwtSecret,
    logger,
    timeoutMs: 15_000,
  });
  const customers = new CustomerAgent(db);

  async function ensureOpenSession(now: Date): Promise<{ cashSessionId: string; shiftId: string }> {
    const openSession = await db.getOpenCashSession({
      siteId: init.siteId,
      terminalId: init.terminalId,
      cashRegisterId: init.cashRegisterId,
    });

    if (openSession) {
      return { cashSessionId: openSession.id, shiftId: openSession.shiftId };
    }

    const { suggestedOpeningCash } = await db.getOpeningReference({
      siteId: init.siteId,
      terminalId: init.terminalId,
      cashRegisterId: init.cashRegisterId,
    });
    const openingCash = suggestedOpeningCash;

    const openedByApi = await api.openCashSession({
      identity: { userId: init.cashierUserId, role: 'cashier' },
      siteId: init.siteId,
      terminalId: init.terminalId,
      cashRegisterId: init.cashRegisterId,
      openedByUserId: init.cashierUserId,
      openingCashAmount: openingCash,
    });

    if (openedByApi?.id) {
      const resolved = await db.getOpenCashSession({
        siteId: init.siteId,
        terminalId: init.terminalId,
        cashRegisterId: init.cashRegisterId,
      });
      if (resolved) {
        return { cashSessionId: resolved.id, shiftId: resolved.shiftId };
      }
    }

    const reopened = await db.getOpenCashSession({
      siteId: init.siteId,
      terminalId: init.terminalId,
      cashRegisterId: init.cashRegisterId,
    });
    if (reopened) {
      return { cashSessionId: reopened.id, shiftId: reopened.shiftId };
    }

    const direct = await db.openCashSessionDirect({
      siteId: init.siteId,
      terminalId: init.terminalId,
      cashRegisterId: init.cashRegisterId,
      openedByUserId: init.cashierUserId,
      openingCashAmount: openingCash,
      occurredAt: now,
    });

    return { cashSessionId: direct.id, shiftId: direct.shiftId };
  }

  parentPort?.on('message', async (message: { type: string; payload?: TickPayload }) => {
    if (message.type === 'shutdown') {
      await db.disconnect();
      parentPort?.postMessage({ type: 'shutdown_ack', workerId: init.workerId });
      return;
    }

    if (message.type !== 'tick' || !message.payload) {
      return;
    }

    const tickAt = new Date(message.payload.atIso);
    const response = {
      type: 'tick_result',
      workerId: init.workerId,
      siteId: init.siteId,
      atIso: message.payload.atIso,
      sales: 0,
      recharges: 0,
      errors: 0,
      cardsTouched: [] as string[],
      cashSessionId: '',
      shiftId: '',
      cardRefs: [] as Array<{ customerId: string; cardId: string; cardUid: string }>,
    };

    try {
      const { cashSessionId, shiftId } = await ensureOpenSession(tickAt);
      response.cashSessionId = cashSessionId;
      response.shiftId = shiftId;

      const opsBase = Math.max(1, Math.floor(message.payload.expectedArrivals / 2));
      const operations = Math.max(1, Math.round(opsBase * (0.65 + rng.next() * 0.85)));

      for (let i = 0; i < operations; i += 1) {
        const intent = buildCustomerIntent({
          calibration: {
            areaM2: 0,
            baseAverageTicket: init.avgTicket,
            avgSessionMinutes: 30,
            machineMtbfMinutes: 360,
            fraudRate: 0.01,
            newCustomerRate: 0.22,
            retentionRate: 0.68,
            targetAttractions: 8,
            targetCashiers: 2,
            targetTerminals: 1,
            targetCashRegisters: 1,
          },
          demandIndex: message.payload.demandIndex,
          rng: () => rng.next(),
          baseTicket: init.avgTicket,
          heavyGamerRate: init.config.heavyGamerRate,
        });

        const actor = await customers.resolveCustomer({
          siteId: init.siteId,
          intent,
          rng: () => rng.next(),
        });

        response.cardsTouched.push(actor.cardUid);
        response.cardRefs.push(actor);

        const shouldRecharge = intent.willRecharge || rng.next() < 0.25;
        if (shouldRecharge) {
          const rechargeAmount = Math.max(
            init.config.minRecharge,
            Math.round(intent.intendedSpend * init.rechargeToTicketRatio * (0.8 + rng.next() * 0.6)),
          );
          const methods: PaymentMethod[] = ['CASH', 'TRANSFER', 'NEQUI', 'QR'];
          const paymentMethod = methods[Math.floor(rng.next() * methods.length)]!;
          const ok = await api.rechargeCard({
            identity: { userId: init.cashierUserId, role: 'cashier' },
            cardUid: actor.cardUid,
            siteId: init.siteId,
            customerId: actor.customerId,
            terminalId: init.terminalId,
            shiftId,
            cashSessionId,
            createdByUserId: init.cashierUserId,
            amount: rechargeAmount,
            paymentMethod,
          });
          if (ok) {
            response.recharges += 1;
          } else {
            response.errors += 1;
          }
        }

        const saleAmount = Math.max(1800, Math.round(intent.intendedSpend * (0.55 + rng.next() * 0.55)));
        const methods: PaymentMethod[] = ['CASH', 'TRANSFER', 'NEQUI', 'QR', 'CARD'];
        const paymentMethod = methods[Math.floor(rng.next() * methods.length)]!;

        await db.createDirectSale({
          siteId: init.siteId,
          customerId: actor.customerId,
          shiftId,
          terminalId: init.terminalId,
          cashSessionId,
          createdByUserId: init.cashierUserId,
          amount: saleAmount,
          paymentMethod,
          occurredAt: tickAt,
          category: rng.next() < 0.7 ? 'SNACKS' : 'SERVICE',
        });
        response.sales += 1;
      }
    } catch (error) {
      logger.error({ err: error, at: message.payload.atIso }, 'worker tick failed');
      response.errors += 1;
    }

    parentPort?.postMessage(response);
  });

  parentPort?.postMessage({ type: 'ready', workerId: init.workerId, siteId: init.siteId });
}

if (!isMainThread) {
  runWorker(workerData as CashierWorkerInit).catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
