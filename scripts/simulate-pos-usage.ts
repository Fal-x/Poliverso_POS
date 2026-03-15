/* eslint-disable no-console */
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { ApiClient, type ApiRequestResult, type AuthSession } from '../simulator/src/api.client.js';

type Role = 'cashier' | 'supervisor' | 'admin';
type PaymentMethod =
  | 'CASH'
  | 'TRANSFER'
  | 'TRANSFER_ACCOUNT_1'
  | 'TRANSFER_ACCOUNT_2'
  | 'NEQUI'
  | 'QR'
  | 'CARD'
  | 'CREDIT_CARD'
  | 'CREDIT';

type Site = { id: string; name: string; code: string };
type User = { id: string; name: string; email: string; role: Role };
type PosContextResponse = {
  shift_id: string | null;
  terminal_id: string | null;
  cash_register_id: string | null;
  cash_session_id: string | null;
};
type Product = {
  id: string;
  name: string;
  price: string;
  category: string;
  sku?: string | null;
};
type SiteConfig = {
  min_recharge_amount: string;
};
type RecentSale = {
  id: string;
  created_at: string;
  total: string;
  payment_method: string | null;
};
type DaySummary = {
  sales_today: string;
  deleted_transactions: number;
  transactions_count: number;
  cash_balance_expected: string;
};
type CashSessionSnapshot = {
  id: string;
  status: string;
  opening_cash_amount: string;
  expected_cash_amount: string;
  cash_sales: string;
  withdrawals_amount: string;
  adjustments_amount: string;
  closing_cash_amount: string | null;
  cash_difference: string | null;
};
type SaleCreateResponse = {
  id: string;
  total: string;
  status: string;
  receipt_number: string;
};
type CardLookupResponse = {
  id: string;
  code: string;
  status: string;
};
type ApprovalResponse = {
  id: string;
  approved_by_id: string;
};
type CashierCandidate = {
  user: User;
  session: AuthSession;
};
type DbTerminalContext = {
  terminalId: string;
  cashRegisterId: string;
  shiftId: string;
  cashSessionId: string;
  openedByUserId: string;
};

type CliOptions = {
  baseUrl: string;
  mode: 'smoke' | 'load';
  durationMinutes: number;
  cashiers: number;
  salesPerMinute: number;
  seed: number;
  rechargePct: number;
  voidPct: number;
  cashPct: number;
  transferPct: number;
  cardPct: number;
  creditPct: number;
  nequiPct: number;
  qrPct: number;
  siteCode?: string;
  timeoutMs: number;
};

type SimulationContext = {
  api: ApiClient;
  logger: pino.Logger;
  options: CliOptions;
  site: Site;
  cashier: User;
  cashiers: CashierCandidate[];
  activeCashierIndex: number;
  supervisor: User;
  cashierSession: AuthSession;
  supervisorSession: AuthSession;
  terminalId: string;
  cashRegisterId: string;
  shiftId: string;
  cashSessionId: string;
  products: {
    simple: Product;
    premium: Product;
    cardPlastic: Product;
  };
  minRechargeAmount: number;
  simTag: string;
  cardUid: string;
  expectedCash: number;
  beforeSummary: DaySummary;
};

const prisma = new PrismaClient();

type SummaryCounters = {
  sales_ok: number;
  sales_error: number;
  recharge_ok: number;
  recharge_error: number;
  void_ok: number;
  void_error: number;
  cash_open_ok: boolean;
  cash_close_ok: boolean;
  report_checks_ok: boolean;
};

type Summary = SummaryCounters & {
  mode: 'smoke' | 'load';
  seed: number;
  site_code: string;
  cashier: string;
  supervisor: string;
  operations_planned: number;
  operations_executed: number;
  http_error_count: number;
  p95_ms: number;
  expected_cash_before_close: number;
  sales_created: string[];
  sales_voided: string[];
  recharge_uid: string;
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

class MetricsCollector {
  private readonly durations: number[] = [];
  public httpErrors = 0;

  record<T>(result: ApiRequestResult<T>): ApiRequestResult<T> {
    this.durations.push(result.durationMs);
    if (!result.ok) this.httpErrors += 1;
    return result;
  }

  p95(): number {
    if (this.durations.length === 0) return 0;
    const sorted = [...this.durations].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
    return Number(sorted[index]!.toFixed(2));
  }
}

function parseArgs(argv: string[], defaultMode: 'smoke' | 'load' = 'smoke'): CliOptions {
  const values = new Map<string, string>();
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const [key, ...rest] = raw.slice(2).split('=');
    values.set(key, rest.length > 0 ? rest.join('=') : 'true');
  }

  const getNumber = (key: string, fallback: number) => {
    const raw = values.get(key);
    if (raw == null || raw === '') return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const mode = (values.get('mode') === 'load' ? 'load' : values.get('mode') === 'smoke' ? 'smoke' : defaultMode);

  return {
    baseUrl: (values.get('base-url') ?? process.env.SIM_BASE_URL ?? 'http://127.0.0.1:3001/api/v1').replace(/\/$/, ''),
    mode,
    durationMinutes: Math.max(1, getNumber('duration-minutes', mode === 'smoke' ? 2 : 3)),
    cashiers: Math.max(1, Math.floor(getNumber('cashiers', mode === 'smoke' ? 1 : 2))),
    salesPerMinute: Math.max(1, getNumber('sales-per-minute', mode === 'smoke' ? 6 : 18)),
    seed: Math.floor(getNumber('seed', 20260313)),
    rechargePct: clampPct(getNumber('recharge-pct', 25)),
    voidPct: clampPct(getNumber('void-pct', 12)),
    cashPct: clampPct(getNumber('cash-pct', 45)),
    transferPct: clampPct(getNumber('transfer-pct', 25)),
    cardPct: clampPct(getNumber('card-pct', 10)),
    creditPct: clampPct(getNumber('credit-pct', 10)),
    nequiPct: clampPct(getNumber('nequi-pct', 5)),
    qrPct: clampPct(getNumber('qr-pct', 5)),
    siteCode: values.get('site-code') ?? process.env.SIM_SITE_CODE,
    timeoutMs: Math.max(1_000, Math.floor(getNumber('timeout-ms', 15_000))),
  };
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function toAmount(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number(parsed.toFixed(2));
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

function buildQuery(path: string, params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    search.set(key, String(value));
  });
  const serialized = search.toString();
  return serialized ? `${path}?${serialized}` : path;
}

function assertOk<T>(label: string, result: ApiRequestResult<T>): T {
  if (!result.ok || !result.data) {
    throw new Error(`${label} failed [${result.status}] ${result.error ?? ''} ${result.message ?? ''}`.trim());
  }
  return result.data;
}

function uniqueSimTag(rng: Lcg): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let index = 0; index < 8; index += 1) {
    suffix += alphabet[Math.floor(rng.next() * alphabet.length)]!;
  }
  return `SIM-${suffix}`;
}

function pickPaymentMethod(options: CliOptions, rng: Lcg): PaymentMethod {
  const weighted: Array<[PaymentMethod, number]> = [
    ['CASH', options.cashPct],
    ['TRANSFER', options.transferPct],
    ['CARD', options.cardPct],
    ['CREDIT', options.creditPct],
    ['NEQUI', options.nequiPct],
    ['QR', options.qrPct],
  ];

  const total = weighted.reduce((acc, [, weight]) => acc + weight, 0);
  if (total <= 0) return 'CASH';
  let cursor = rng.next() * total;
  for (const [method, weight] of weighted) {
    cursor -= weight;
    if (cursor <= 0) return method;
  }
  return 'CASH';
}

async function authedGet<T>(
  api: ApiClient,
  metrics: MetricsCollector,
  token: string,
  path: string,
): Promise<T> {
  return assertOk(path, metrics.record(await api.requestWithToken<T>(token, path, 'GET')));
}

async function authedPost<T>(
  api: ApiClient,
  metrics: MetricsCollector,
  token: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  return assertOk(path, metrics.record(await api.requestWithToken<T>(token, path, 'POST', body)));
}

async function anonymousGet<T>(api: ApiClient, metrics: MetricsCollector, path: string): Promise<T> {
  return assertOk(path, metrics.record(await api.requestWithToken<T>('', path, 'GET')));
}

async function loginAndDiscoverContext(
  api: ApiClient,
  logger: pino.Logger,
  metrics: MetricsCollector,
  options: CliOptions,
  rng: Lcg,
): Promise<SimulationContext> {
  const sites = await anonymousGet<Site[]>(api, metrics, '/sites');
  const site = options.siteCode ? sites.find((entry) => entry.code === options.siteCode) : sites[0];
  if (!site) {
    throw new Error(`No site found${options.siteCode ? ` for code ${options.siteCode}` : ''}`);
  }

  const users = await anonymousGet<User[]>(api, metrics, buildQuery('/auth/users', { site_id: site.id }));
  const cashierUsers = users.filter((user) => user.role === 'cashier').slice(0, Math.max(1, options.cashiers));
  const cashier = cashierUsers[0];
  const supervisor = users.find((user) => user.role === 'supervisor') ?? users.find((user) => user.role === 'admin');
  if (!cashier || !supervisor) {
    throw new Error('Cashier or supervisor demo users are missing');
  }

  const pinByRole: Record<string, string> = {
    admin: '111111',
    supervisor: '222222',
    'cajero1@poliverse.local': '333333',
    'cajero2@poliverse.local': '444444',
  };

  const cashierCandidates: CashierCandidate[] = [];
  for (const candidate of cashierUsers) {
    const session = assertOk(
      `cashier login ${candidate.email}`,
      metrics.record(await api.loginWithCode({ userId: candidate.id, code: pinByRole[candidate.email] ?? '333333' })),
    );
    cashierCandidates.push({ user: candidate, session });
  }

  const cashierSession = cashierCandidates[0]!.session;
  const supervisorSession = assertOk(
    'supervisor login',
    metrics.record(await api.loginWithCode({ userId: supervisor.id, code: pinByRole[supervisor.role] })),
  );

  const products = await authedGet<Product[]>(
    api,
    metrics,
    cashierSession.token,
    buildQuery('/products', { site_id: site.id }),
  );
  const siteConfig = await authedGet<SiteConfig>(
    api,
    metrics,
    cashierSession.token,
    buildQuery('/site-config', { site_id: site.id }),
  );
  const beforeSummary = await authedGet<DaySummary>(
    api,
    metrics,
    supervisorSession.token,
    buildQuery('/reports/day/summary', { site_id: site.id }),
  );

  const simple = products.find((product) => product.category !== 'CARD_PLASTIC' && toAmount(product.price) > 0);
  const premium = [...products]
    .filter((product) => product.category !== 'CARD_PLASTIC' && toAmount(product.price) > 0)
    .sort((left, right) => toAmount(right.price) - toAmount(left.price))[0];
  const cardPlastic = products.find((product) => product.category === 'CARD_PLASTIC');

  if (!simple || !premium || !cardPlastic) {
    throw new Error('Required products not found in catalog');
  }

  const dbContext = await resolveDbTerminalContext(site.id, cashierCandidates);
  const activeCashierIndex = dbContext
    ? cashierCandidates.findIndex((candidate) => candidate.user.id === dbContext.openedByUserId)
    : 0;
  const resolvedCashierIndex = activeCashierIndex >= 0 ? activeCashierIndex : 0;
  const resolvedCashier = cashierCandidates[resolvedCashierIndex]!;

  const posContext = dbContext
    ? {
        shift_id: dbContext.shiftId || null,
        terminal_id: dbContext.terminalId,
        cash_register_id: dbContext.cashRegisterId,
        cash_session_id: dbContext.cashSessionId || null,
      }
    : await authedGet<PosContextResponse>(
        api,
        metrics,
        resolvedCashier.session.token,
        buildQuery('/pos/context', { site_id: site.id }),
      );

  if (!posContext.terminal_id || !posContext.cash_register_id) {
    throw new Error('POS context missing terminal or cash register');
  }

  const simTag = uniqueSimTag(rng);

  logger.info({
    site: site.code,
    cashier: resolvedCashier.user.email,
    supervisor: supervisor.email,
    terminalId: posContext.terminal_id,
    cashRegisterId: posContext.cash_register_id,
  }, 'simulation context discovered');

  return {
    api,
    logger,
    options,
    site,
    cashier: resolvedCashier.user,
    cashiers: cashierCandidates,
    activeCashierIndex: resolvedCashierIndex,
    supervisor,
    cashierSession: resolvedCashier.session,
    supervisorSession,
    terminalId: posContext.terminal_id,
    cashRegisterId: posContext.cash_register_id,
    shiftId: posContext.shift_id ?? '',
    cashSessionId: posContext.cash_session_id ?? '',
    products: { simple, premium, cardPlastic },
    minRechargeAmount: toAmount(siteConfig.min_recharge_amount),
    simTag,
    cardUid: `${simTag}-UID`,
    expectedCash: 0,
    beforeSummary,
  };
}

async function resolveDbTerminalContext(siteId: string, cashiers: CashierCandidate[]): Promise<DbTerminalContext | null> {
  const cashierIds = cashiers.map((candidate) => candidate.user.id);
  const [terminals, cashRegisters, openSessions, shifts] = await Promise.all([
    prisma.terminal.findMany({
      where: { siteId },
      select: { id: true, code: true },
      orderBy: { code: 'asc' },
    }),
    prisma.cashRegister.findMany({
      where: { siteId },
      select: { id: true, code: true },
      orderBy: { code: 'asc' },
    }),
    prisma.cashSession.findMany({
      where: { siteId, status: 'OPEN' },
      select: {
        id: true,
        terminalId: true,
        cashRegisterId: true,
        shiftId: true,
        openedByUserId: true,
        openedAt: true,
      },
      orderBy: { openedAt: 'desc' },
    }),
    prisma.shift.findMany({
      where: { siteId },
      select: {
        id: true,
        terminalId: true,
        cashRegisterId: true,
        openedAt: true,
      },
      orderBy: { openedAt: 'desc' },
      take: 50,
    }),
  ]);

  const preferredOpenSession = openSessions.find((session) => cashierIds.includes(session.openedByUserId));
  if (preferredOpenSession?.shiftId) {
    return {
      terminalId: preferredOpenSession.terminalId,
      cashRegisterId: preferredOpenSession.cashRegisterId,
      shiftId: preferredOpenSession.shiftId,
      cashSessionId: preferredOpenSession.id,
      openedByUserId: preferredOpenSession.openedByUserId,
    };
  }

  const busyTerminalIds = new Set(openSessions.map((session) => session.terminalId));
  const latestShiftByTerminal = new Map<string, { shiftId: string; cashRegisterId: string }>();
  for (const shift of shifts) {
    if (latestShiftByTerminal.has(shift.terminalId)) continue;
    latestShiftByTerminal.set(shift.terminalId, {
      shiftId: shift.id,
      cashRegisterId: shift.cashRegisterId,
    });
  }

  const freeTerminal = terminals.find((terminal) => !busyTerminalIds.has(terminal.id));
  if (freeTerminal) {
    const latest = latestShiftByTerminal.get(freeTerminal.id);
    const fallbackRegisterId = latest?.cashRegisterId ?? cashRegisters[0]?.id;
    if (!fallbackRegisterId) return null;
    return {
      terminalId: freeTerminal.id,
      cashRegisterId: fallbackRegisterId,
      shiftId: latest?.shiftId ?? '',
      cashSessionId: '',
      openedByUserId: cashiers[0]!.user.id,
    };
  }

  return null;
}

function isCashSessionOwnerMismatch(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('CASH_SESSION_OWNER_MISMATCH');
}

function syncSummaryCashier(summary: Summary, ctx: SimulationContext): void {
  summary.cashier = ctx.cashier.email;
}

function switchToNextCashier(ctx: SimulationContext): boolean {
  if (ctx.cashiers.length <= 1) return false;

  const nextIndex = (ctx.activeCashierIndex + 1) % ctx.cashiers.length;
  if (nextIndex === ctx.activeCashierIndex) return false;

  const nextCashier = ctx.cashiers[nextIndex]!;
  ctx.activeCashierIndex = nextIndex;
  ctx.cashier = nextCashier.user;
  ctx.cashierSession = nextCashier.session;
  ctx.logger.warn({ cashier: ctx.cashier.email }, 'switched cashier after ownership mismatch');
  return true;
}

async function withCashierRetry<T>(
  ctx: SimulationContext,
  summary: Summary | null,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isCashSessionOwnerMismatch(error) || !switchToNextCashier(ctx)) {
      throw error;
    }
    if (summary) syncSummaryCashier(summary, ctx);
    return operation();
  }
}

async function openCashSessionIfNeeded(ctx: SimulationContext, metrics: MetricsCollector): Promise<void> {
  if (ctx.cashSessionId && ctx.shiftId) {
    const current = await authedGet<CashSessionSnapshot>(
      ctx.api,
      metrics,
      ctx.cashierSession.token,
      `/cash-sessions/${ctx.cashSessionId}`,
    );
    ctx.expectedCash = toAmount(current.expected_cash_amount);
    return;
  }

  const reference = await authedGet<{
    suggested_opening_cash: string;
  }>(
    ctx.api,
    metrics,
    ctx.cashierSession.token,
    buildQuery('/cash-sessions/open/reference', {
      site_id: ctx.site.id,
      terminal_id: ctx.terminalId,
      cash_register_id: ctx.cashRegisterId,
    }),
  );

  const opened = await authedPost<{
    id: string;
    status: string;
  }>(
    ctx.api,
    metrics,
    ctx.cashierSession.token,
    '/cash-sessions/open',
    {
      site_id: ctx.site.id,
      terminal_id: ctx.terminalId,
      cash_register_id: ctx.cashRegisterId,
      opened_by_user_id: ctx.cashier.id,
      opening_cash_amount: reference.suggested_opening_cash,
    },
  );

  const posContext = await authedGet<PosContextResponse>(
    ctx.api,
    metrics,
    ctx.cashierSession.token,
    buildQuery('/pos/context', { site_id: ctx.site.id }),
  );

  ctx.cashSessionId = opened.id;
  ctx.shiftId = posContext.shift_id ?? ctx.shiftId;
  ctx.expectedCash = toAmount(reference.suggested_opening_cash);
}

async function resolveAvailableCardUid(ctx: SimulationContext, metrics: MetricsCollector): Promise<string> {
  const baseUid = ctx.cardUid;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? baseUid : `${baseUid}-R${attempt}`;
    const result = metrics.record(await ctx.api.requestWithToken<CardLookupResponse>(
      ctx.cashierSession.token,
      buildQuery(`/cards/${encodeURIComponent(candidate)}`, { site_id: ctx.site.id }),
      'GET',
    ));

    if (result.ok && result.data) {
      continue;
    }
    if (result.status === 404) {
      ctx.cardUid = candidate;
      return candidate;
    }
    throw new Error(`card uid probe failed [${result.status}] ${result.error ?? ''} ${result.message ?? ''}`.trim());
  }

  throw new Error(`No available SIM card UID found for base ${baseUid}`);
}

function buildSimCustomer(ctx: SimulationContext, suffix: string) {
  return {
    document_type: 'NIT',
    document_number: `${ctx.simTag}-${suffix}`,
    full_name: `${ctx.simTag} QA ${suffix}`,
    phone: '3000000000',
    address: `${ctx.simTag} CALLE 1`,
    city: 'SIM-CITY',
    email: `${ctx.simTag.toLowerCase()}-${suffix.toLowerCase()}@poliverse.local`,
    person_type: 'natural',
  };
}

async function createSale(
  ctx: SimulationContext,
  metrics: MetricsCollector,
  summary: Summary | null,
  body: Record<string, unknown>,
): Promise<SaleCreateResponse> {
  return withCashierRetry(ctx, summary, async () => authedPost<SaleCreateResponse>(ctx.api, metrics, ctx.cashierSession.token, '/sales', {
    ...body,
    created_by_user_id: ctx.cashier.id,
  }));
}

async function verifySaleListed(ctx: SimulationContext, metrics: MetricsCollector, saleId: string): Promise<void> {
  const recent = await authedGet<RecentSale[]>(
    ctx.api,
    metrics,
    ctx.cashierSession.token,
    buildQuery('/sales/recent', {
      site_id: ctx.site.id,
      created_by_user_id: ctx.cashier.id,
      limit: 20,
    }),
  );
  if (!recent.some((sale) => sale.id === saleId)) {
    throw new Error(`Sale ${saleId} was not listed in /sales/recent`);
  }
}

async function runSaleScenario(
  ctx: SimulationContext,
  metrics: MetricsCollector,
  summary: Summary,
): Promise<{
  cardSaleId: string;
  voidCandidateId: string;
}> {
  await resolveAvailableCardUid(ctx, metrics);

  const cashSale = await createSale(ctx, metrics, summary, {
    site_id: ctx.site.id,
    customer: buildSimCustomer(ctx, 'CASH'),
    terminal_id: ctx.terminalId,
    cash_session_id: ctx.cashSessionId,
    shift_id: ctx.shiftId,
    items: [{ product_id: ctx.products.simple.id, quantity: 1 }],
    payments: [{ method: 'CASH', amount: ctx.products.simple.price }],
  });
  summary.sales_ok += 1;
  summary.sales_created.push(cashSale.id);
  ctx.expectedCash += toAmount(ctx.products.simple.price);
  await verifySaleListed(ctx, metrics, cashSale.id);

  const mixedCash = Math.max(1000, Math.floor(toAmount(ctx.products.premium.price) * 0.4));
  const mixedTransfer = toAmount(ctx.products.premium.price) - mixedCash;
  const transferSale = await createSale(ctx, metrics, summary, {
    site_id: ctx.site.id,
    customer: buildSimCustomer(ctx, 'MIX'),
    terminal_id: ctx.terminalId,
    cash_session_id: ctx.cashSessionId,
    shift_id: ctx.shiftId,
    items: [{ product_id: ctx.products.premium.id, quantity: 1 }],
    payments: [
      { method: 'CASH', amount: formatMoney(mixedCash) },
      { method: 'TRANSFER', amount: formatMoney(mixedTransfer), reference: `${ctx.simTag}-REF-MIX` },
    ],
  });
  summary.sales_ok += 1;
  summary.sales_created.push(transferSale.id);
  ctx.expectedCash += mixedCash;
  await verifySaleListed(ctx, metrics, transferSale.id);

  const cardSale = await createSale(ctx, metrics, summary, {
    site_id: ctx.site.id,
    customer: buildSimCustomer(ctx, 'CARD'),
    terminal_id: ctx.terminalId,
    cash_session_id: ctx.cashSessionId,
    shift_id: ctx.shiftId,
    items: [{ product_id: ctx.products.cardPlastic.id, quantity: 1 }],
    issued_cards: [{ product_id: ctx.products.cardPlastic.id, uid: ctx.cardUid }],
    payments: [{ method: 'CASH', amount: ctx.products.cardPlastic.price }],
  });
  summary.sales_ok += 1;
  summary.sales_created.push(cardSale.id);
  ctx.expectedCash += toAmount(ctx.products.cardPlastic.price);
  await verifySaleListed(ctx, metrics, cardSale.id);

  const partialCreditAmount = Math.max(1000, Math.floor(toAmount(ctx.products.premium.price) * 0.5));
  const partialSale = await createSale(ctx, metrics, summary, {
    site_id: ctx.site.id,
    customer: buildSimCustomer(ctx, 'CREDIT'),
    terminal_id: ctx.terminalId,
    cash_session_id: ctx.cashSessionId,
    shift_id: ctx.shiftId,
    items: [{ product_id: ctx.products.premium.id, quantity: 1 }],
    payments: [{ method: 'CREDIT', amount: formatMoney(partialCreditAmount), reference: `${ctx.simTag}-REF-CREDIT` }],
  });
  summary.sales_ok += 1;
  summary.sales_created.push(partialSale.id);
  await verifySaleListed(ctx, metrics, partialSale.id);

  const voidCandidate = await createSale(ctx, metrics, summary, {
    site_id: ctx.site.id,
    customer: buildSimCustomer(ctx, 'VOID'),
    terminal_id: ctx.terminalId,
    cash_session_id: ctx.cashSessionId,
    shift_id: ctx.shiftId,
    items: [{ product_id: ctx.products.simple.id, quantity: 1 }],
    payments: [{ method: 'CASH', amount: ctx.products.simple.price }],
  });
  summary.sales_ok += 1;
  summary.sales_created.push(voidCandidate.id);
  ctx.expectedCash += toAmount(ctx.products.simple.price);
  await verifySaleListed(ctx, metrics, voidCandidate.id);

  return {
    cardSaleId: cardSale.id,
    voidCandidateId: voidCandidate.id,
  };
}

async function runRechargeScenario(ctx: SimulationContext, metrics: MetricsCollector, summary: Summary): Promise<void> {
  const rechargeAmount = Math.max(ctx.minRechargeAmount, 10000);
  await withCashierRetry(ctx, summary, async () => authedPost(ctx.api, metrics, ctx.cashierSession.token, `/cards/${encodeURIComponent(ctx.cardUid)}/recharge`, {
    site_id: ctx.site.id,
    amount: formatMoney(rechargeAmount),
    payment_method: 'CASH',
    terminal_id: ctx.terminalId,
    shift_id: ctx.shiftId,
    cash_session_id: ctx.cashSessionId,
    created_by_user_id: ctx.cashier.id,
  }));
  ctx.expectedCash += rechargeAmount;
  summary.recharge_ok += 1;
}

async function runVoidScenario(
  ctx: SimulationContext,
  metrics: MetricsCollector,
  summary: Summary,
  saleId: string,
  cashAmountToReverse: number,
): Promise<void> {
  await withCashierRetry(ctx, summary, async () => {
    const approval = await authedPost<ApprovalResponse>(
      ctx.api,
      metrics,
      ctx.cashierSession.token,
      '/supervisor-approvals',
      {
        site_id: ctx.site.id,
        requested_by_user_id: ctx.cashier.id,
        action: 'VOID_SALE',
        entity_type: 'SALE',
        entity_id: saleId,
        reason: `${ctx.simTag} VOID APPROVAL`,
        supervisor_code: ctx.supervisor.role === 'admin' ? '111111' : '222222',
      },
    );

    await authedPost(
      ctx.api,
      metrics,
      ctx.cashierSession.token,
      `/sales/${saleId}/void`,
      {
        site_id: ctx.site.id,
        voided_by_user_id: ctx.cashier.id,
        reason: `${ctx.simTag} VOID TEST`,
        approval_id: approval.id,
      },
    );
  });

  ctx.expectedCash -= cashAmountToReverse;
  summary.void_ok += 1;
  summary.sales_voided.push(saleId);
}

async function verifyReports(ctx: SimulationContext, metrics: MetricsCollector, summary: Summary): Promise<void> {
  const afterSummary = await authedGet<DaySummary>(
    ctx.api,
    metrics,
    ctx.supervisorSession.token,
    buildQuery('/reports/day/summary', { site_id: ctx.site.id }),
  );
  const expectedTransactionsDelta = 4 + summary.recharge_ok;
  const actualTransactionsDelta = afterSummary.transactions_count - ctx.beforeSummary.transactions_count;
  const deletedTransactionsDelta = afterSummary.deleted_transactions - ctx.beforeSummary.deleted_transactions;

  if (actualTransactionsDelta < expectedTransactionsDelta) {
    throw new Error(`Expected transactions delta >= ${expectedTransactionsDelta}, got ${actualTransactionsDelta}`);
  }
  if (deletedTransactionsDelta < summary.void_ok) {
    throw new Error(`Expected deleted transactions delta >= ${summary.void_ok}, got ${deletedTransactionsDelta}`);
  }

  const session = await authedGet<CashSessionSnapshot>(
    ctx.api,
    metrics,
    ctx.cashierSession.token,
    `/cash-sessions/${ctx.cashSessionId}`,
  );
  const expectedApiCash = toAmount(session.expected_cash_amount);
  if (Math.abs(expectedApiCash - ctx.expectedCash) > 0.01) {
    throw new Error(`Cash session expected ${expectedApiCash}, script calculated ${ctx.expectedCash}`);
  }

  summary.report_checks_ok = true;
}

async function closeCashSession(ctx: SimulationContext, metrics: MetricsCollector, summary: Summary): Promise<void> {
  const beforeClose = await authedGet<CashSessionSnapshot>(
    ctx.api,
    metrics,
    ctx.cashierSession.token,
    `/cash-sessions/${ctx.cashSessionId}`,
  );
  const closeAmount = beforeClose.expected_cash_amount;
  summary.expected_cash_before_close = toAmount(closeAmount);

  await authedPost(
    ctx.api,
    metrics,
    ctx.cashierSession.token,
    `/cash-sessions/${ctx.cashSessionId}/close`,
    {
      site_id: ctx.site.id,
      closed_by_user_id: ctx.cashier.id,
      closing_cash_amount: closeAmount,
      close_reason: `${ctx.simTag} CLOSE`,
    },
  );

  const afterClose = await authedGet<CashSessionSnapshot>(
    ctx.api,
    metrics,
    ctx.cashierSession.token,
    `/cash-sessions/${ctx.cashSessionId}`,
  );

  if (afterClose.status !== 'CLOSED' || toAmount(afterClose.cash_difference ?? '999') !== 0) {
    throw new Error(`Cash close validation failed: status=${afterClose.status} diff=${afterClose.cash_difference}`);
  }

  summary.cash_close_ok = true;
}

async function runLoadBurst(ctx: SimulationContext, metrics: MetricsCollector, summary: Summary, rng: Lcg): Promise<void> {
  const totalOperations = Math.max(6, Math.round(ctx.options.durationMinutes * ctx.options.salesPerMinute));
  const concurrency = Math.max(1, Math.min(ctx.options.cashiers, 4));
  let cursor = 0;

  const worker = async () => {
    while (cursor < totalOperations) {
      const index = cursor;
      cursor += 1;
      const paymentMethod = pickPaymentMethod(ctx.options, rng);
      const product = rng.next() < 0.5 ? ctx.products.simple : ctx.products.premium;
      const reference = paymentMethod === 'CASH' ? undefined : `${ctx.simTag}-LOAD-${index}`;
      const total = toAmount(product.price);

      try {
        const sale = await createSale(ctx, metrics, summary, {
          site_id: ctx.site.id,
          customer: buildSimCustomer(ctx, `LOAD-${index}`),
          terminal_id: ctx.terminalId,
          cash_session_id: ctx.cashSessionId,
          shift_id: ctx.shiftId,
          items: [{ product_id: product.id, quantity: 1 }],
          payments: [{ method: paymentMethod, amount: formatMoney(total), reference }],
        });
        summary.sales_ok += 1;
        summary.sales_created.push(sale.id);
        if (paymentMethod === 'CASH') {
          ctx.expectedCash += total;
        }

        if (rng.next() * 100 < ctx.options.rechargePct) {
          try {
            await runRechargeScenario(ctx, metrics, summary);
          } catch {
            summary.recharge_error += 1;
          }
        }

        if (paymentMethod === 'CASH' && rng.next() * 100 < ctx.options.voidPct) {
          try {
            await runVoidScenario(ctx, metrics, summary, sale.id, total);
          } catch {
            summary.void_error += 1;
          }
        }
      } catch {
        summary.sales_error += 1;
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

export async function runSimulation(options: CliOptions): Promise<Summary> {
  const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' }).child({ script: 'simulate-pos-usage', mode: options.mode });
  const rng = new Lcg(options.seed);
  const metrics = new MetricsCollector();
  const api = new ApiClient({
    baseUrl: options.baseUrl,
    jwtSecret: process.env.JWT_SECRET ?? 'dev_secret',
    logger,
    timeoutMs: options.timeoutMs,
  });

  const summary: Summary = {
    mode: options.mode,
    seed: options.seed,
    site_code: '',
    cashier: '',
    supervisor: '',
    operations_planned: options.mode === 'smoke' ? 6 : Math.max(6, Math.round(options.durationMinutes * options.salesPerMinute)),
    operations_executed: 0,
    http_error_count: 0,
    p95_ms: 0,
    expected_cash_before_close: 0,
    sales_ok: 0,
    sales_error: 0,
    recharge_ok: 0,
    recharge_error: 0,
    void_ok: 0,
    void_error: 0,
    cash_open_ok: false,
    cash_close_ok: false,
    report_checks_ok: false,
    sales_created: [],
    sales_voided: [],
    recharge_uid: '',
  };

  const ctx = await loginAndDiscoverContext(api, logger, metrics, options, rng);
  summary.site_code = ctx.site.code;
  summary.cashier = ctx.cashier.email;
  summary.supervisor = ctx.supervisor.email;

  await openCashSessionIfNeeded(ctx, metrics);
  summary.cash_open_ok = true;

  const { voidCandidateId } = await runSaleScenario(ctx, metrics, summary);
  summary.recharge_uid = ctx.cardUid;
  await runRechargeScenario(ctx, metrics, summary);
  await runVoidScenario(ctx, metrics, summary, voidCandidateId, toAmount(ctx.products.simple.price));

  if (options.mode === 'load') {
    await runLoadBurst(ctx, metrics, summary, rng);
  }

  await verifyReports(ctx, metrics, summary);
  await closeCashSession(ctx, metrics, summary);

  summary.operations_executed = summary.sales_ok + summary.recharge_ok + summary.void_ok;
  summary.http_error_count = metrics.httpErrors;
  summary.p95_ms = metrics.p95();

  return summary;
}

export async function runCli(defaultMode: 'smoke' | 'load' = 'smoke'): Promise<void> {
  const options = parseArgs(process.argv.slice(2), defaultMode);
  try {
    const summary = await runSimulation(options);
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runCli('smoke');
}
