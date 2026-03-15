/* eslint-disable no-console */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { PrismaClient, SaleStatus } from '@prisma/client';

type SimulationProfile = 'normal' | 'stress';

type PeriodOptions = {
  startAtIso: string;
  endAtIso: string;
  seed: number;
  workers: number;
  tickMinutes: number;
  sites: number;
  baseUrl: string;
  siteCode?: string;
  profile: SimulationProfile;
  reportFile: string;
};

type SimulationReport = {
  mode: 'backfill';
  profile: SimulationProfile;
  generated_at: string;
  elapsed_ms: number;
  elapsed_human: string;
  seed: number;
  base_url: string;
  range: {
    start_at: string;
    end_at: string;
    total_days: number;
  };
  config: {
    workers: number;
    tick_minutes: number;
    sites: number;
    approx_time_acceleration: number;
  };
  sites: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  totals: {
    visitors: number;
    sales: number;
    recharges: number;
    game_plays: number;
    game_reversals: number;
    prizes_redeemed: number;
    prize_units_redeemed: number;
    cash_sessions_opened: number;
    cash_sessions_closed: number;
    cash_expenses: number;
    cash_adjustments: number;
    voided_sales: number;
    modified_sales: number;
    reversed_events: number;
    transaction_logs: number;
    revenue_total: number;
    recharge_revenue_total: number;
    average_ticket: number;
  };
  payment_distribution: Array<{
    method: string;
    amount: number;
    transactions: number;
    pct_amount: number;
  }>;
  daily_breakdown: Array<{
    day: string;
    visitors: number;
    sales: number;
    revenue: number;
    recharges: number;
    game_plays: number;
    prizes: number;
    voided_sales: number;
  }>;
  activity_chart: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseArgs(argv: string[]): PeriodOptions {
  const values = new Map<string, string>();
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const [key, ...rest] = raw.slice(2).split('=');
    values.set(key, rest.length > 0 ? rest.join('=') : 'true');
  }

  const getNumber = (key: string, fallback: number) => {
    const raw = values.get(key);
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const profile = (values.get('profile') === 'stress' ? 'stress' : 'normal') satisfies SimulationProfile;
  const profileDefaults = profile === 'stress'
    ? { workers: 6, tickMinutes: 5, sites: 1 }
    : { workers: 2, tickMinutes: 15, sites: 1 };

  const month = values.get('month');
  const historyDays = getNumber('history-days', 30);
  const explicitStart = values.get('start-date');
  const explicitEnd = values.get('end-date');

  let start = explicitStart ? new Date(`${explicitStart}T00:00:00.000Z`) : new Date();
  let end = explicitEnd ? new Date(`${explicitEnd}T23:59:59.999Z`) : new Date();

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthNumber] = month.split('-').map(Number);
    start = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999));
  } else if (!explicitStart && !explicitEnd) {
    end = new Date();
    start = new Date(end.getTime() - (Math.max(1, historyDays) - 1) * DAY_MS);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);
  }

  if (start > end) {
    throw new Error('La fecha inicial debe ser menor o igual a la fecha final.');
  }

  return {
    startAtIso: start.toISOString(),
    endAtIso: end.toISOString(),
    seed: Math.floor(getNumber('seed', 1701)),
    workers: Math.max(1, Math.floor(getNumber('workers', profileDefaults.workers))),
    tickMinutes: Math.max(1, Math.floor(getNumber('tick-minutes', profileDefaults.tickMinutes))),
    sites: Math.max(1, Math.floor(getNumber('sites', profileDefaults.sites))),
    baseUrl: (values.get('base-url') ?? process.env.SIM_BASE_URL ?? process.env.VITE_API_URL ?? 'http://127.0.0.1:3001/api/v1').replace(/\/$/, ''),
    siteCode: values.get('site-code') ?? process.env.SIM_SITE_CODE,
    profile,
    reportFile: path.resolve(values.get('report-file') ?? 'simulation_report.json'),
  };
}

function countDays(startAtIso: string, endAtIso: string): number {
  const start = new Date(startAtIso);
  const end = new Date(endAtIso);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime() + 1) / DAY_MS));
}

function formatMoney(value: number): number {
  return Number(value.toFixed(2));
}

function formatElapsed(ms: number): string {
  if (ms < 1_000) return `${ms} ms`;
  const seconds = ms / 1_000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = Math.round(seconds % 60);
  return `${minutes}m ${String(remSeconds).padStart(2, '0')}s`;
}

function buildDailyChart(rows: SimulationReport['daily_breakdown']): string[] {
  const maxRevenue = rows.reduce((max, row) => Math.max(max, row.revenue), 0);
  return rows.map((row) => {
    const level = maxRevenue <= 0 ? 0 : Math.max(1, Math.round((row.revenue / maxRevenue) * 12));
    const bar = `${'#'.repeat(level)}${'.'.repeat(Math.max(0, 12 - level))}`;
    return `${row.day} ${bar} ${row.sales} ventas ${row.game_plays} juegos $${row.revenue.toFixed(2)}`;
  });
}

function paymentLabel(method: string): string {
  const labels: Record<string, string> = {
    CASH: 'efectivo',
    TRANSFER: 'transferencia',
    TRANSFER_ACCOUNT_1: 'transferencia cuenta 1',
    TRANSFER_ACCOUNT_2: 'transferencia cuenta 2',
    NEQUI: 'nequi',
    QR: 'qr',
    CARD: 'tarjeta',
    CREDIT_CARD: 'tarjeta credito',
    CREDIT: 'credito',
    MIXED: 'mixto',
  };
  return labels[method] ?? method.toLowerCase();
}

function applyProfileEnv(options: PeriodOptions): NodeJS.ProcessEnv {
  if (options.profile === 'stress') {
    return {
      SIM_WORKERS: String(options.workers),
      SIM_TICK_MINUTES: String(options.tickMinutes),
      SIM_SITES: String(options.sites),
      SIM_FRAUD_RATE: '0.025',
      SIM_EVENT_MULTIPLIER: '1.45',
      SIM_ATTRACTIONS_PER_SITE: '18',
      SIM_CASHIERS_PER_SITE: '5',
      SIM_TERMINALS_PER_SITE: '3',
      SIM_REGISTERS_PER_SITE: '3',
      SIM_HEAVY_GAMER_RATE: '0.18',
    };
  }

  return {
    SIM_WORKERS: String(options.workers),
    SIM_TICK_MINUTES: String(options.tickMinutes),
    SIM_SITES: String(options.sites),
    SIM_FRAUD_RATE: '0.012',
    SIM_EVENT_MULTIPLIER: '1.15',
    SIM_ATTRACTIONS_PER_SITE: '12',
    SIM_CASHIERS_PER_SITE: '3',
    SIM_TERMINALS_PER_SITE: '2',
    SIM_REGISTERS_PER_SITE: '2',
    SIM_HEAVY_GAMER_RATE: '0.11',
  };
}

function runEngine(options: PeriodOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['tsx', 'simulator/src/engine.ts'],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          SIM_MODE: 'backfill',
          SIM_START_AT: options.startAtIso,
          SIM_END_AT: options.endAtIso,
          SIM_SEED: String(options.seed),
          SIM_API_BASE_URL: options.baseUrl,
          ...applyProfileEnv(options),
        },
      },
    );

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`El motor de simulación terminó con código ${code ?? 'desconocido'}.`));
    });
  });
}

async function buildReport(options: PeriodOptions, elapsedMs: number): Promise<SimulationReport> {
  const prisma = new PrismaClient();

  try {
    const startAt = new Date(options.startAtIso);
    const endAt = new Date(options.endAtIso);
    const rangeFilter = { gte: startAt, lte: endAt };

    const sites = await prisma.site.findMany({
      where: {
        status: 'ACTIVE',
        ...(options.siteCode ? { code: options.siteCode } : {}),
      },
      select: { id: true, code: true, name: true },
      orderBy: { createdAt: 'asc' },
      take: options.sites,
    });

    if (sites.length === 0) {
      throw new Error(`No se encontró una sede activa${options.siteCode ? ` con código ${options.siteCode}` : ''}.`);
    }

    const siteIds = sites.map((site) => site.id);
    const saleWhere = {
      siteId: { in: siteIds },
      createdAt: rangeFilter,
      status: { in: [SaleStatus.PAID, SaleStatus.PARTIAL] },
    } as const;

    const [
      distinctVisitors,
      salesCount,
      rechargeLines,
      salesTotals,
      usages,
      usageReversals,
      prizeRedemptions,
      cashOpened,
      cashClosed,
      cashMovements,
      voidedSales,
      modifiedSales,
      reversedAuditEvents,
      transactionLogs,
      paymentGroups,
      dailySales,
      dailyRecharges,
      dailyUsages,
      dailyPrizes,
      dailyVoids,
    ] = await Promise.all([
      prisma.sale.findMany({
        where: saleWhere,
        select: { customerId: true },
        distinct: ['customerId'],
      }),
      prisma.sale.count({ where: saleWhere }),
      prisma.saleLine.count({
        where: {
          category: 'RECHARGE',
          sale: saleWhere,
        },
      }),
      prisma.sale.aggregate({
        where: saleWhere,
        _sum: { total: true },
        _avg: { total: true },
      }),
      prisma.attractionUsage.count({
        where: {
          siteId: { in: siteIds },
          occurredAt: rangeFilter,
          type: 'USE',
        },
      }),
      prisma.attractionUsage.count({
        where: {
          siteId: { in: siteIds },
          occurredAt: rangeFilter,
          type: 'REVERSAL',
        },
      }),
      prisma.prizeRedemption.aggregate({
        where: {
          siteId: { in: siteIds },
          createdAt: rangeFilter,
        },
        _count: { id: true },
        _sum: { quantity: true },
      }),
      prisma.cashSession.count({
        where: {
          siteId: { in: siteIds },
          openedAt: rangeFilter,
        },
      }),
      prisma.cashSession.count({
        where: {
          siteId: { in: siteIds },
          closedAt: rangeFilter,
        },
      }),
      prisma.cashMovement.groupBy({
        by: ['type'],
        where: {
          siteId: { in: siteIds },
          createdAt: rangeFilter,
          voidedAt: null,
        },
        _count: { _all: true },
      }),
      prisma.sale.count({
        where: {
          siteId: { in: siteIds },
          voidedAt: rangeFilter,
          status: 'VOIDED',
        },
      }),
      prisma.auditLog.count({
        where: {
          siteId: { in: siteIds },
          createdAt: rangeFilter,
          entityType: 'SALE',
          action: { in: ['ADJUST', 'UPDATE'] },
        },
      }),
      prisma.auditLog.count({
        where: {
          siteId: { in: siteIds },
          createdAt: rangeFilter,
          action: 'REVERSE',
        },
      }),
      prisma.auditLog.count({
        where: {
          siteId: { in: siteIds },
          createdAt: rangeFilter,
        },
      }),
      prisma.salePayment.groupBy({
        by: ['method'],
        where: {
          sale: saleWhere,
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.sale.findMany({
        where: saleWhere,
        select: { createdAt: true, total: true, customerId: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.saleLine.findMany({
        where: {
          category: 'RECHARGE',
          sale: saleWhere,
        },
        select: { sale: { select: { createdAt: true } } },
      }),
      prisma.attractionUsage.findMany({
        where: {
          siteId: { in: siteIds },
          occurredAt: rangeFilter,
          type: 'USE',
        },
        select: { occurredAt: true },
      }),
      prisma.prizeRedemption.findMany({
        where: {
          siteId: { in: siteIds },
          createdAt: rangeFilter,
        },
        select: { createdAt: true },
      }),
      prisma.sale.findMany({
        where: {
          siteId: { in: siteIds },
          voidedAt: rangeFilter,
          status: 'VOIDED',
        },
        select: { voidedAt: true },
      }),
    ]);

    const rechargeRevenueTotal = await prisma.saleLine.aggregate({
      where: {
        category: 'RECHARGE',
        sale: saleWhere,
      },
      _sum: { lineTotal: true },
    });

    const dailyMap = new Map<string, SimulationReport['daily_breakdown'][number]>();
    const ensureDay = (day: string) => {
      const current = dailyMap.get(day) ?? {
        day,
        visitors: 0,
        sales: 0,
        revenue: 0,
        recharges: 0,
        game_plays: 0,
        prizes: 0,
        voided_sales: 0,
      };
      dailyMap.set(day, current);
      return current;
    };

    const visitorsByDay = new Map<string, Set<string>>();
    for (const sale of dailySales) {
      const day = sale.createdAt.toISOString().slice(0, 10);
      const row = ensureDay(day);
      row.sales += 1;
      row.revenue += Number(sale.total);
      const bucket = visitorsByDay.get(day) ?? new Set<string>();
      bucket.add(sale.customerId);
      visitorsByDay.set(day, bucket);
    }

    for (const line of dailyRecharges) {
      const day = line.sale.createdAt.toISOString().slice(0, 10);
      ensureDay(day).recharges += 1;
    }

    for (const usage of dailyUsages) {
      const day = usage.occurredAt.toISOString().slice(0, 10);
      ensureDay(day).game_plays += 1;
    }

    for (const prize of dailyPrizes) {
      const day = prize.createdAt.toISOString().slice(0, 10);
      ensureDay(day).prizes += 1;
    }

    for (const sale of dailyVoids) {
      if (!sale.voidedAt) continue;
      const day = sale.voidedAt.toISOString().slice(0, 10);
      ensureDay(day).voided_sales += 1;
    }

    for (const [day, visitors] of visitorsByDay.entries()) {
      ensureDay(day).visitors = visitors.size;
    }

    const dailyBreakdown = Array.from(dailyMap.values())
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((row) => ({
        ...row,
        revenue: formatMoney(row.revenue),
      }));

    const totalRevenue = Number(salesTotals._sum.total ?? 0);
    const rechargeRevenue = Number(rechargeRevenueTotal._sum.lineTotal ?? 0);
    const averageTicket = Number(salesTotals._avg.total ?? 0);
    const paymentTotal = paymentGroups.reduce((acc, row) => acc + Number(row._sum.amount ?? 0), 0);

    const report: SimulationReport = {
      mode: 'backfill',
      profile: options.profile,
      generated_at: new Date().toISOString(),
      elapsed_ms: elapsedMs,
      elapsed_human: formatElapsed(elapsedMs),
      seed: options.seed,
      base_url: options.baseUrl,
      range: {
        start_at: options.startAtIso,
        end_at: options.endAtIso,
        total_days: countDays(options.startAtIso, options.endAtIso),
      },
      config: {
        workers: options.workers,
        tick_minutes: options.tickMinutes,
        sites: options.sites,
        approx_time_acceleration: Math.max(1, Math.round((countDays(options.startAtIso, options.endAtIso) * 24 * 60) / Math.max(1, elapsedMs / 1000))),
      },
      sites,
      totals: {
        visitors: distinctVisitors.length,
        sales: salesCount,
        recharges: rechargeLines,
        game_plays: usages,
        game_reversals: usageReversals,
        prizes_redeemed: prizeRedemptions._count.id,
        prize_units_redeemed: prizeRedemptions._sum.quantity ?? 0,
        cash_sessions_opened: cashOpened,
        cash_sessions_closed: cashClosed,
        cash_expenses: cashMovements.find((row) => row.type === 'WITHDRAWAL')?._count._all ?? 0,
        cash_adjustments: cashMovements.find((row) => row.type === 'ADJUSTMENT')?._count._all ?? 0,
        voided_sales: voidedSales,
        modified_sales: modifiedSales,
        reversed_events: reversedAuditEvents + usageReversals,
        transaction_logs: transactionLogs,
        revenue_total: formatMoney(totalRevenue),
        recharge_revenue_total: formatMoney(rechargeRevenue),
        average_ticket: formatMoney(averageTicket),
      },
      payment_distribution: paymentGroups
        .map((row) => {
          const amount = Number(row._sum.amount ?? 0);
          return {
            method: paymentLabel(row.method),
            amount: formatMoney(amount),
            transactions: row._count._all,
            pct_amount: paymentTotal > 0 ? formatMoney((amount / paymentTotal) * 100) : 0,
          };
        })
        .sort((a, b) => b.amount - a.amount),
      daily_breakdown: dailyBreakdown,
      activity_chart: buildDailyChart(dailyBreakdown),
    };

    return report;
  } finally {
    await prisma.$disconnect();
  }
}

async function persistReport(reportFile: string, report: SimulationReport): Promise<void> {
  await mkdir(path.dirname(reportFile), { recursive: true });
  await writeFile(reportFile, JSON.stringify(report, null, 2));
}

function printConsoleSummary(report: SimulationReport, reportFile: string): void {
  console.log('');
  console.log('=== Simulacion mensual arcade ===');
  console.log(`Perfil: ${report.profile}`);
  console.log(`Rango: ${report.range.start_at} -> ${report.range.end_at} (${report.range.total_days} dias)`);
  console.log(`Tiempo total: ${report.elapsed_human}`);
  console.log(`Visitantes simulados: ${report.totals.visitors}`);
  console.log(`Ventas generadas: ${report.totals.sales}`);
  console.log(`Recargas generadas: ${report.totals.recharges}`);
  console.log(`Juegos ejecutados: ${report.totals.game_plays}`);
  console.log(`Premios redimidos: ${report.totals.prizes_redeemed}`);
  console.log(`Errores/anomalias simuladas: ${report.totals.voided_sales + report.totals.modified_sales + report.totals.reversed_events}`);
  console.log(`Ingresos totales: $${report.totals.revenue_total.toFixed(2)}`);
  console.log(`Reporte JSON: ${reportFile}`);

  if (report.payment_distribution.length > 0) {
    console.log('');
    console.log('Distribucion medios de pago:');
    for (const payment of report.payment_distribution) {
      console.log(`- ${payment.method}: $${payment.amount.toFixed(2)} (${payment.transactions} tx, ${payment.pct_amount.toFixed(2)}%)`);
    }
  }

  if (report.activity_chart.length > 0) {
    console.log('');
    console.log('Actividad diaria:');
    for (const line of report.activity_chart) {
      console.log(line);
    }
  }
}

export async function runPeriodCli(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();
  await runEngine(options);
  const elapsedMs = Date.now() - startedAt;
  const report = await buildReport(options, elapsedMs);
  await persistReport(options.reportFile, report);
  printConsoleSummary(report, options.reportFile);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPeriodCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
