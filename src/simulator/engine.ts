import 'dotenv/config';
import { Worker } from 'node:worker_threads';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { ApiClient } from './api.client';
import { simulatorConfig, type SiteCalibration } from './config';
import { DbWriter } from './db.writer';
import { computeDemand } from './models/demand.model';
import { computeOccupancy } from './models/occupancy.model';
import { MachineAgent, type MachineReader } from './agents/machine.agent';
import { FraudAgent } from './agents/fraud.agent';
import { runMinuteLoop } from './schedulers/minute.loop';
import type { CashierWorkerInit } from './agents/cashier.agent';

type SiteRuntime = {
  siteId: string;
  calibration: SiteCalibration;
  terminals: Array<{ id: string; code: string }>;
  cashRegisters: Array<{ id: string; code: string }>;
  cashiers: string[];
  supervisorId: string;
  readers: MachineReader[];
};

type WorkerHandle = {
  init: CashierWorkerInit;
  worker: Worker;
};

type WorkerTickResult = {
  type: 'tick_result';
  workerId: number;
  siteId: string;
  atIso: string;
  sales: number;
  recharges: number;
  errors: number;
  cardsTouched: string[];
  cashSessionId: string;
  shiftId: string;
  cardRefs: Array<{ customerId: string; cardId: string; cardUid: string }>;
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

function choose<T>(items: T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)]!;
}

async function ensureSites(prisma: PrismaClient, logger: pino.Logger): Promise<SiteRuntime[]> {
  const targetSites = Math.max(1, Number(process.env.SIM_SITES ?? simulatorConfig.siteCalibrations.length));
  const calibrations = [...simulatorConfig.siteCalibrations];
  while (calibrations.length < targetSites) {
    calibrations.push({ ...simulatorConfig.siteCalibrations[0]! });
  }

  const org = await prisma.organization.findFirst({ select: { id: true } });
  if (!org) {
    throw new Error('No organization found. Run seed before simulator.');
  }

  const existingSites = await prisma.site.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, code: true },
    orderBy: { createdAt: 'asc' },
  });

  for (let i = existingSites.length; i < targetSites; i += 1) {
    const code = `SIM-${String(i + 1).padStart(2, '0')}`;
    const site = await prisma.site.create({
      data: {
        organizationId: org.id,
        name: `POLIVERSE SIM ${i + 1}`,
        code,
        city: 'Bogota',
        timezone: simulatorConfig.timezone,
      },
      select: { id: true },
    });

    const customer = await prisma.customer.create({
      data: {
        siteId: site.id,
        documentType: 'CC',
        documentNumber: `${Date.now()}${i}`,
        fullName: `SIM DEFAULT ${i + 1}`,
        phone: `3${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
        email: `sim_default_${i + 1}@poliverse.local`,
        city: 'Bogota',
      },
      select: { id: true },
    });

    await prisma.site.update({
      where: { id: site.id },
      data: { defaultCustomerId: customer.id },
    });

    await prisma.siteConfig.create({
      data: {
        siteId: site.id,
        minRechargeAmount: simulatorConfig.minRecharge,
        pointsPerCurrency: 1,
        currencyUnit: 1000,
      },
    });

    logger.info({ siteId: site.id, code }, 'created simulation site');
  }

  const activeSites = await prisma.site.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: targetSites,
  });

  const roleCashier = await prisma.role.findUnique({ where: { name: 'CASHIER' }, select: { id: true } });
  const roleSupervisor = await prisma.role.findUnique({ where: { name: 'SUPERVISOR' }, select: { id: true } });
  const roleAdmin = await prisma.role.findUnique({ where: { name: 'ADMIN' }, select: { id: true } });
  if (!roleCashier || !roleSupervisor) {
    throw new Error('Missing CASHIER/SUPERVISOR roles');
  }

  const runtimes: SiteRuntime[] = [];

  for (let idx = 0; idx < activeSites.length; idx += 1) {
    const siteId = activeSites[idx]!.id;
    const calibration = calibrations[idx]!;

    const siteConfig = await prisma.siteConfig.findUnique({ where: { siteId }, select: { siteId: true } });
    if (!siteConfig) {
      await prisma.siteConfig.create({
        data: {
          siteId,
          minRechargeAmount: simulatorConfig.minRecharge,
          pointsPerCurrency: 1,
          currencyUnit: 1000,
        },
      });
    }

    const terminals = await prisma.terminal.findMany({
      where: { siteId },
      select: { id: true, code: true },
      orderBy: { createdAt: 'asc' },
    });
    for (let i = terminals.length; i < calibration.targetTerminals; i += 1) {
      await prisma.terminal.create({
        data: { siteId, code: `SIM-T-${i + 1}`, name: `Sim Terminal ${i + 1}` },
      });
    }

    const cashRegisters = await prisma.cashRegister.findMany({
      where: { siteId },
      select: { id: true, code: true },
      orderBy: { createdAt: 'asc' },
    });
    for (let i = cashRegisters.length; i < calibration.targetCashRegisters; i += 1) {
      await prisma.cashRegister.create({
        data: { siteId, code: `SIM-R-${i + 1}`, name: `Sim Register ${i + 1}` },
      });
    }

    const currentTerminals = await prisma.terminal.findMany({
      where: { siteId },
      select: { id: true, code: true },
      orderBy: { createdAt: 'asc' },
    });
    const currentRegisters = await prisma.cashRegister.findMany({
      where: { siteId },
      select: { id: true, code: true },
      orderBy: { createdAt: 'asc' },
    });

    const activeCashierAssignments = await prisma.userAssignment.findMany({
      where: {
        siteId,
        roleId: roleCashier.id,
        isActive: true,
        user: { status: 'ACTIVE' },
      },
      select: { userId: true },
      orderBy: { createdAt: 'asc' },
    });

    for (let i = activeCashierAssignments.length; i < calibration.targetCashiers; i += 1) {
      const user = await prisma.user.create({
        data: {
          email: `sim_cashier_${siteId.slice(0, 5)}_${Date.now()}_${i}@poliverse.local`,
          fullName: `SIM Cashier ${i + 1}`,
          passwordHash: 'sim_hash',
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      await prisma.userAssignment.create({
        data: {
          userId: user.id,
          siteId,
          roleId: roleCashier.id,
          isActive: true,
        },
      });
    }

    const supervisors = await prisma.userAssignment.findMany({
      where: {
        siteId,
        isActive: true,
        user: { status: 'ACTIVE' },
        roleId: { in: [roleSupervisor.id, roleAdmin?.id].filter(Boolean) as string[] },
      },
      select: { userId: true },
      orderBy: { createdAt: 'asc' },
    });

    if (supervisors.length === 0) {
      const user = await prisma.user.create({
        data: {
          email: `sim_supervisor_${siteId.slice(0, 5)}_${Date.now()}@poliverse.local`,
          fullName: 'SIM Supervisor',
          passwordHash: 'sim_hash',
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      await prisma.userAssignment.create({
        data: {
          userId: user.id,
          siteId,
          roleId: roleSupervisor.id,
          isActive: true,
        },
      });
    }

    const cashiers = await prisma.userAssignment.findMany({
      where: {
        siteId,
        roleId: roleCashier.id,
        isActive: true,
        user: { status: 'ACTIVE' },
      },
      select: { userId: true },
      orderBy: { createdAt: 'asc' },
    });

    const supervisor = await prisma.userAssignment.findFirst({
      where: {
        siteId,
        isActive: true,
        user: { status: 'ACTIVE' },
        roleId: { in: [roleSupervisor.id, roleAdmin?.id].filter(Boolean) as string[] },
      },
      select: { userId: true },
      orderBy: { createdAt: 'asc' },
    });

    const attractions = await prisma.attraction.findMany({
      where: { siteId },
      select: { id: true, code: true },
      orderBy: { createdAt: 'asc' },
    });

    for (let i = attractions.length; i < calibration.targetAttractions; i += 1) {
      const attraction = await prisma.attraction.create({
        data: {
          siteId,
          name: `SIM Machine ${i + 1}`,
          code: `SIM-M-${String(i + 1).padStart(3, '0')}`,
          type: i % 2 === 0 ? 'SKILL' : 'TIME',
          price: 3000 + i * 150,
          duration: 60,
          status: 'ACTIVE',
          costPoints: 0,
          pointsReward: 1000,
        },
        select: { id: true, code: true },
      });

      const reader = await prisma.reader.create({
        data: {
          siteId,
          attractionId: attraction.id,
          code: `SIM-RD-${String(i + 1).padStart(3, '0')}`,
          position: 1,
          isActive: true,
        },
        select: { id: true },
      });

      await prisma.attraction.update({
        where: { id: attraction.id },
        data: { readerId: reader.id },
      });
    }

    const readers = await prisma.reader.findMany({
      where: {
        siteId,
        isActive: true,
        attraction: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        code: true,
        siteId: true,
        attractionId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const attractionCodes = await prisma.attraction.findMany({
      where: { id: { in: readers.map((r) => r.attractionId) } },
      select: { id: true, code: true },
    });
    const codeByAttraction = new Map(attractionCodes.map((a) => [a.id, a.code]));

    runtimes.push({
      siteId,
      calibration,
      terminals: currentTerminals,
      cashRegisters: currentRegisters,
      cashiers: cashiers.map((c) => c.userId),
      supervisorId: supervisor?.userId ?? cashiers[0]!.userId,
      readers: readers.map((reader) => ({
        id: reader.id,
        code: reader.code,
        siteId: reader.siteId,
        attractionId: reader.attractionId,
        attractionCode: codeByAttraction.get(reader.attractionId) ?? reader.attractionId,
      })),
    });
  }

  return runtimes;
}

async function startWorkers(siteRuntimes: SiteRuntime[], logger: pino.Logger): Promise<WorkerHandle[]> {
  const handles: WorkerHandle[] = [];
  let workerId = 1;

  for (const runtime of siteRuntimes) {
    const workerTarget = Math.min(runtime.cashiers.length, runtime.calibration.targetCashiers, simulatorConfig.workerCount);
    for (let i = 0; i < workerTarget; i += 1) {
      const init: CashierWorkerInit = {
        workerId,
        config: simulatorConfig,
        siteId: runtime.siteId,
        terminalId: runtime.terminals[i % runtime.terminals.length]!.id,
        cashRegisterId: runtime.cashRegisters[i % runtime.cashRegisters.length]!.id,
        cashierUserId: runtime.cashiers[i]!,
        supervisorUserId: runtime.supervisorId,
        avgTicket: runtime.calibration.baseAverageTicket,
        rechargeToTicketRatio: simulatorConfig.rechargeToTicketRatio,
        readers: runtime.readers,
      };

      const worker = new Worker(new URL('./agents/cashier.worker.mjs', import.meta.url), {
        workerData: init,
      });

      worker.on('error', (error) => {
        logger.error({ err: error, workerId: init.workerId, siteId: init.siteId }, 'worker error');
      });

      handles.push({ init, worker });
      workerId += 1;
    }
  }

  await Promise.all(
    handles.map(
      (handle) =>
        new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error(`worker ${handle.init.workerId} ready timeout`)), 20_000);
          handle.worker.on('message', (message: { type: string }) => {
            if (message.type === 'ready') {
              clearTimeout(timeout);
              resolve();
            }
          });
        }),
    ),
  );

  return handles;
}

async function sendTick(handle: WorkerHandle, tick: { atIso: string; expectedArrivals: number; demandIndex: number }): Promise<WorkerTickResult> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`worker ${handle.init.workerId} tick timeout`)), 60_000);
    const listener = (message: WorkerTickResult) => {
      if (message?.type === 'tick_result' && message.workerId === handle.init.workerId && message.atIso === tick.atIso) {
        clearTimeout(timeout);
        handle.worker.off('message', listener as any);
        resolve(message);
      }
    };
    handle.worker.on('message', listener as any);
    handle.worker.postMessage({ type: 'tick', payload: tick });
  });
}

async function shutdownWorkers(handles: WorkerHandle[]): Promise<void> {
  await Promise.all(
    handles.map(async ({ worker }) => {
      worker.postMessage({ type: 'shutdown' });
      await worker.terminate();
    }),
  );
}

async function closeOpenSessions(db: DbWriter, siteRuntimes: SiteRuntime[], logger: pino.Logger): Promise<void> {
  for (const site of siteRuntimes) {
    for (let i = 0; i < site.terminals.length; i += 1) {
      const terminal = site.terminals[i]!;
      const register = site.cashRegisters[i % site.cashRegisters.length]!;
      const openSession = await db.getOpenCashSession({
        siteId: site.siteId,
        terminalId: terminal.id,
        cashRegisterId: register.id,
      });
      if (!openSession) continue;

      const drift = (Math.random() - 0.5) * 6000;
      const closeAmount = 100_000 + drift;
      await db.closeCashSessionDirect({
        siteId: site.siteId,
        cashSessionId: openSession.id,
        closedByUserId: site.supervisorId,
        closingCashAmount: closeAmount,
        closeReason: drift === 0 ? 'SIM_CLOSE' : 'SIM_CLOSE_WITH_NATURAL_DRIFT',
        occurredAt: new Date(),
      });

      logger.info({ siteId: site.siteId, cashSessionId: openSession.id, drift }, 'closed open cash session');
    }
  }
}

async function main(): Promise<void> {
  const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
          }
        : undefined,
  }).child({ service: 'poliverse-simulator', mode: simulatorConfig.mode });

  logger.info({ config: simulatorConfig }, 'simulator start');

  const prisma = new PrismaClient();
  const db = new DbWriter({ prisma, logger });
  const api = new ApiClient({
    baseUrl: simulatorConfig.apiBaseUrl,
    jwtSecret: simulatorConfig.jwtSecret,
    logger,
    timeoutMs: 15_000,
  });
  const machineAgent = new MachineAgent(api, db, logger);
  const fraudAgent = new FraudAgent(simulatorConfig, api, db, logger);
  const rng = new Lcg(simulatorConfig.randomSeed);

  let workers: WorkerHandle[] = [];

  try {
    const siteRuntimes = await ensureSites(prisma, logger);

    for (const site of siteRuntimes) {
      await db.setReaderCredentials(
        site.siteId,
        site.readers.map((reader) => reader.id),
        simulatorConfig.defaultReaderToken,
        simulatorConfig.hmacSecret,
      );
    }

    workers = await startWorkers(siteRuntimes, logger);
    logger.info({ workers: workers.length, sites: siteRuntimes.length }, 'workers ready');

    const startAt = new Date(simulatorConfig.startAt);
    const endAt = new Date(simulatorConfig.endAt);

    await runMinuteLoop({
      mode: simulatorConfig.mode,
      startAt,
      endAt,
      tickMinutes: simulatorConfig.tickMinutes,
      x60TickMs: simulatorConfig.x60TickMs,
      realtimeTickMs: simulatorConfig.realtimeTickMs,
      logger,
      onTick: async ({ tickIndex, at }) => {
        const tickIso = at.toISOString();

        const siteDemand = new Map<string, ReturnType<typeof computeDemand>>();
        for (const site of siteRuntimes) {
          const trend = 1 + tickIndex / 50_000;
          siteDemand.set(
            site.siteId,
            computeDemand({
              at,
              calibration: site.calibration,
              trend,
              rng: () => rng.next(),
              events: simulatorConfig.specialEvents,
            }),
          );
        }

        const tickResults = await Promise.all(
          workers.map((handle) => {
            const demand = siteDemand.get(handle.init.siteId)!;
            return sendTick(handle, {
              atIso: tickIso,
              expectedArrivals: Math.max(1, Math.round(demand.expectedArrivals / Math.max(1, handle.init.readers.length / 4))),
              demandIndex: demand.demandIndex,
            });
          }),
        );

        const cardsBySite = new Map<string, string[]>();
        for (const result of tickResults) {
          cardsBySite.set(result.siteId, result.cardsTouched);
        }

        for (const site of siteRuntimes) {
          const demand = siteDemand.get(site.siteId)!;
          const occupancy = computeOccupancy({
            demandIndex: demand.demandIndex,
            totalReaders: site.readers.length,
            avgSessionMinutes: site.calibration.avgSessionMinutes,
            mtbfMinutes: site.calibration.machineMtbfMinutes,
            rng: () => rng.next(),
          });

          const cardUidPool = cardsBySite.get(site.siteId) ?? [];
          await machineAgent.runMinute({
            siteId: site.siteId,
            readers: site.readers,
            occupancy,
            cardUidPool,
            readerAuth: {
              readerCode: site.readers[0]?.code ?? '',
              apiToken: simulatorConfig.defaultReaderToken,
              hmacSecret: simulatorConfig.hmacSecret,
            },
            createdByUserId: site.cashiers[0]!,
            now: at,
            rng: () => rng.next(),
          });

          const sourceWorker = tickResults.find((row) => row.siteId === site.siteId && row.cardRefs.length > 0);
          const fraudCandidate = sourceWorker?.cardRefs[0];
          if (fraudCandidate && sourceWorker.cashSessionId && sourceWorker.shiftId) {
            await fraudAgent.maybeRun({
              context: {
                siteId: site.siteId,
                terminalId: sourceWorker ? workers.find((w) => w.init.workerId === sourceWorker.workerId)?.init.terminalId ?? site.terminals[0]!.id : site.terminals[0]!.id,
                shiftId: sourceWorker.shiftId,
                cashSessionId: sourceWorker.cashSessionId,
                cashierUserId: site.cashiers[0]!,
                supervisorUserId: site.supervisorId,
                customerId: fraudCandidate.customerId,
                cardId: fraudCandidate.cardId,
                cardUid: fraudCandidate.cardUid,
                readers: site.readers,
                now: at,
              },
              rng: () => rng.next(),
            });
          }
        }

        const summary = tickResults.reduce(
          (acc, row) => {
            acc.sales += row.sales;
            acc.recharges += row.recharges;
            acc.errors += row.errors;
            return acc;
          },
          { sales: 0, recharges: 0, errors: 0 },
        );

        logger.info(
          {
            tick: tickIndex,
            at: tickIso,
            sales: summary.sales,
            recharges: summary.recharges,
            errors: summary.errors,
          },
          'tick processed',
        );
      },
    });

    await closeOpenSessions(db, siteRuntimes, logger);
  } finally {
    await shutdownWorkers(workers).catch(() => undefined);
    await db.disconnect();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
