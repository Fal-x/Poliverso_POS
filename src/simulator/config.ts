import { PaymentMethod } from '@prisma/client';

export type SimMode = 'backfill' | 'realtime' | 'x60';

export type SiteCalibration = {
  siteId?: string;
  areaM2: number;
  baseAverageTicket: number;
  avgSessionMinutes: number;
  machineMtbfMinutes: number;
  fraudRate: number;
  newCustomerRate: number;
  retentionRate: number;
  targetAttractions: number;
  targetCashiers: number;
  targetTerminals: number;
  targetCashRegisters: number;
};

export type SpecialEventWindow = {
  name: string;
  startsAtIso: string;
  endsAtIso: string;
  demandMultiplier: number;
};

export type FraudSwitches = {
  enabled: boolean;
  simultaneousCardUse: boolean;
  repeatedRechargeBurst: boolean;
  voidBurst: boolean;
  suspiciousCashImbalance: boolean;
  offHoursUsage: boolean;
};

export type SimulatorConfig = {
  apiBaseUrl: string;
  jwtSecret: string;
  timezone: string;
  mode: SimMode;
  startAt: string;
  endAt: string;
  tickMinutes: number;
  x60TickMs: number;
  realtimeTickMs: number;
  prismaConnectionLimit: number;
  workerCount: number;
  paymentWeights: Array<{ method: PaymentMethod; weight: number }>;
  siteCalibrations: SiteCalibration[];
  fraud: FraudSwitches;
  specialEvents: SpecialEventWindow[];
  heavyGamerRate: number;
  defaultReaderToken: string;
  hmacSecret: string;
  minRecharge: number;
  rechargeToTicketRatio: number;
  randomSeed: number;
};

const mode = (process.env.SIM_MODE ?? 'realtime').toLowerCase() as SimMode;

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function envBoolean(name: string, fallback: boolean): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export const simulatorConfig: SimulatorConfig = {
  apiBaseUrl: process.env.SIM_API_BASE_URL ?? process.env.VITE_API_URL ?? 'http://127.0.0.1:3001/api/v1',
  jwtSecret: process.env.JWT_SECRET ?? 'dev_secret',
  timezone: process.env.SIM_TIMEZONE ?? 'America/Bogota',
  mode,
  startAt: process.env.SIM_START_AT ?? new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  endAt: process.env.SIM_END_AT ?? new Date().toISOString(),
  tickMinutes: Math.max(1, envNumber('SIM_TICK_MINUTES', 1)),
  x60TickMs: Math.max(100, envNumber('SIM_X60_TICK_MS', 1000)),
  realtimeTickMs: Math.max(1000, envNumber('SIM_REALTIME_TICK_MS', 60_000)),
  prismaConnectionLimit: Math.max(2, envNumber('SIM_PRISMA_CONNECTION_LIMIT', 6)),
  workerCount: Math.max(1, envNumber('SIM_WORKERS', 2)),
  paymentWeights: [
    { method: 'CASH', weight: 0.46 },
    { method: 'TRANSFER', weight: 0.14 },
    { method: 'NEQUI', weight: 0.12 },
    { method: 'QR', weight: 0.08 },
    { method: 'CARD', weight: 0.06 },
    { method: 'CREDIT_CARD', weight: 0.05 },
    { method: 'TRANSFER_ACCOUNT_1', weight: 0.05 },
    { method: 'TRANSFER_ACCOUNT_2', weight: 0.04 },
  ],
  siteCalibrations: [
    {
      areaM2: envNumber('SIM_SITE_AREA_M2', 520),
      baseAverageTicket: envNumber('SIM_BASE_AVG_TICKET', 28000),
      avgSessionMinutes: envNumber('SIM_AVG_SESSION_MINUTES', 37),
      machineMtbfMinutes: envNumber('SIM_MACHINE_MTBF_MINUTES', 360),
      fraudRate: envNumber('SIM_FRAUD_RATE', 0.012),
      newCustomerRate: envNumber('SIM_NEW_CUSTOMER_RATE', 0.24),
      retentionRate: envNumber('SIM_RETENTION_RATE', 0.68),
      targetAttractions: Math.max(4, envNumber('SIM_ATTRACTIONS_PER_SITE', 12)),
      targetCashiers: Math.max(1, envNumber('SIM_CASHIERS_PER_SITE', 3)),
      targetTerminals: Math.max(1, envNumber('SIM_TERMINALS_PER_SITE', 2)),
      targetCashRegisters: Math.max(1, envNumber('SIM_REGISTERS_PER_SITE', 2)),
    },
  ],
  fraud: {
    enabled: envBoolean('SIM_FRAUD_ENABLED', true),
    simultaneousCardUse: envBoolean('SIM_FRAUD_SIMULTANEOUS_USE', true),
    repeatedRechargeBurst: envBoolean('SIM_FRAUD_RECHARGE_BURST', true),
    voidBurst: envBoolean('SIM_FRAUD_VOID_BURST', true),
    suspiciousCashImbalance: envBoolean('SIM_FRAUD_CASH_IMBALANCE', true),
    offHoursUsage: envBoolean('SIM_FRAUD_OFF_HOURS', true),
  },
  specialEvents: [
    {
      name: 'Weekend Tournament',
      startsAtIso: process.env.SIM_EVENT_START ?? new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      endsAtIso: process.env.SIM_EVENT_END ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      demandMultiplier: envNumber('SIM_EVENT_MULTIPLIER', 1.25),
    },
  ],
  heavyGamerRate: envNumber('SIM_HEAVY_GAMER_RATE', 0.11),
  defaultReaderToken: process.env.SIM_READER_TOKEN ?? 'sim_reader_token',
  hmacSecret: process.env.SIM_READER_HMAC_SECRET ?? 'sim_reader_hmac_secret',
  minRecharge: envNumber('SIM_MIN_RECHARGE', 10000),
  rechargeToTicketRatio: envNumber('SIM_RECHARGE_TICKET_RATIO', 1.6),
  randomSeed: envNumber('SIM_SEED', 1701),
};
