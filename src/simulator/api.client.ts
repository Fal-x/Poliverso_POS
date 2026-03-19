import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { PaymentMethod } from '@prisma/client';
import pino from 'pino';

export type ApiIdentity = {
  userId: string;
  role: 'cashier' | 'supervisor' | 'admin';
};

export type ReaderAuthContext = {
  readerCode: string;
  apiToken: string;
  hmacSecret: string;
};

export type ApiRequestResult<T> = {
  ok: boolean;
  status: number;
  durationMs: number;
  data?: T;
  error?: string;
  message?: string;
};

export type AuthSession = {
  token: string;
  refreshToken?: string;
  expiresAt?: string;
  user: {
    id: string;
    name: string;
    role: 'cashier' | 'supervisor' | 'admin';
  };
};

type ApiClientOptions = {
  baseUrl: string;
  jwtSecret: string;
  logger: pino.Logger;
  timeoutMs?: number;
};

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: unknown;
  message?: string;
};

function normalizeError(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const code = 'code' in value ? (value as { code?: unknown }).code : undefined;
    const message = 'message' in value ? (value as { message?: unknown }).message : undefined;
    if (typeof code === 'string' && typeof message === 'string') {
      return `${code}: ${message}`;
    }
    if (typeof message === 'string') return message;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return value == null ? undefined : String(value);
}

function buildBearerToken(identity: ApiIdentity, jwtSecret: string): string {
  return jwt.sign({ id: identity.userId, role: identity.role }, jwtSecret, { expiresIn: '8h' });
}

function hashBody(payload: string): string {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function signPayload(payload: string, hmacSecret: string): string {
  return crypto.createHmac('sha256', hmacSecret).update(hashBody(payload)).digest('base64');
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly jwtSecret: string;
  private readonly timeoutMs: number;
  private readonly logger: pino.Logger;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.jwtSecret = options.jwtSecret;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.logger = options.logger.child({ module: 'api-client' });
  }

  async openCashSession(params: {
    identity: ApiIdentity;
    siteId: string;
    terminalId: string;
    cashRegisterId: string;
    openedByUserId: string;
    openingCashAmount: number;
    shiftId?: string;
  }): Promise<{ id: string; status: string } | null> {
    const response = await this.request<{ id: string; status: string }>(
      '/cash-sessions/open',
      'POST',
      params.identity,
      {
        site_id: params.siteId,
        terminal_id: params.terminalId,
        cash_register_id: params.cashRegisterId,
        opened_by_user_id: params.openedByUserId,
        opening_cash_amount: params.openingCashAmount.toFixed(2),
        shift_id: params.shiftId,
      },
    );

    if (!response.ok || !response.data) return null;
    return response.data;
  }

  async closeCashSession(params: {
    identity: ApiIdentity;
    siteId: string;
    cashSessionId: string;
    closedByUserId: string;
    closingCashAmount: number;
    closeReason?: string;
  }): Promise<boolean> {
    const response = await this.request(
      `/cash-sessions/${params.cashSessionId}/close`,
      'POST',
      params.identity,
      {
        site_id: params.siteId,
        closed_by_user_id: params.closedByUserId,
        closing_cash_amount: params.closingCashAmount.toFixed(2),
        close_reason: params.closeReason,
      },
    );
    return response.ok;
  }

  async rechargeCard(params: {
    identity: ApiIdentity;
    cardUid: string;
    siteId: string;
    customerId?: string;
    terminalId: string;
    shiftId: string;
    cashSessionId: string;
    createdByUserId: string;
    amount: number;
    paymentMethod: PaymentMethod;
  }): Promise<boolean> {
    const response = await this.request(
      `/cards/${encodeURIComponent(params.cardUid)}/recharge`,
      'POST',
      params.identity,
      {
        site_id: params.siteId,
        customer_id: params.customerId,
        amount: params.amount.toFixed(2),
        payment_method: params.paymentMethod,
        terminal_id: params.terminalId,
        shift_id: params.shiftId,
        cash_session_id: params.cashSessionId,
        created_by_user_id: params.createdByUserId,
      },
    );
    return response.ok;
  }

  async readerValidate(params: {
    reader: ReaderAuthContext;
    uid: string;
    requestId: string;
    timestampSec?: number;
  }): Promise<{ allowed: boolean; reason?: string | null } | null> {
    const payload = {
      uid: params.uid,
      timestamp: params.timestampSec ?? Math.floor(Date.now() / 1000),
      requestId: params.requestId,
    };
    const canonical = JSON.stringify(payload);

    const response = await this.unsignedRequest<{ allowed: boolean; reason?: string | null }>(
      '/reader/validate',
      'POST',
      payload,
      {
        'x-reader-id': params.reader.readerCode,
        'x-api-token': params.reader.apiToken,
        'x-signature': signPayload(canonical, params.reader.hmacSecret),
      },
    );

    if (!response.ok || !response.data) return null;
    return response.data;
  }

  async loginWithCode(params: {
    userId: string;
    code: string;
  }): Promise<ApiRequestResult<AuthSession>> {
    const response = await this.unsignedRequest<{
      token: string;
      refresh_token?: string;
      expires_at?: string;
      user: AuthSession['user'];
    }>('/auth/login', 'POST', {
      user_id: params.userId,
      code: params.code,
    });

    return {
      ...response,
      data: response.data
        ? {
            token: response.data.token,
            refreshToken: response.data.refresh_token,
            expiresAt: response.data.expires_at,
            user: response.data.user,
          }
        : undefined,
    };
  }

  async requestWithToken<T>(
    token: string,
    path: string,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
  ): Promise<ApiRequestResult<T>> {
    return this.unsignedRequest<T>(path, method, body, {
      Authorization: `Bearer ${token}`,
    });
  }

  async requestAsIdentity<T>(
    identity: ApiIdentity,
    path: string,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
  ): Promise<ApiRequestResult<T>> {
    return this.request(path, method, identity, body);
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'POST',
    identity: ApiIdentity,
    body?: Record<string, unknown>,
  ): Promise<ApiRequestResult<T>> {
    return this.unsignedRequest<T>(path, method, body, {
      Authorization: `Bearer ${buildBearerToken(identity, this.jwtSecret)}`,
    });
  }

  private async unsignedRequest<T>(
    path: string,
    method: 'GET' | 'POST',
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<ApiRequestResult<T>> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(extraHeaders ?? {}),
        },
        body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
        signal: controller.signal,
      });

      const json = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
      if (!response.ok || json.ok === false) {
        this.logger.warn({ url, method, status: response.status, error: json.error, message: json.message }, 'api request failed');
        return {
          ok: false,
          status: response.status,
          durationMs: Date.now() - startedAt,
          error: normalizeError(json.error) ?? 'API_ERROR',
          message: json.message,
        };
      }
      return {
        ok: true,
        status: response.status,
        durationMs: Date.now() - startedAt,
        data: json.data,
      };
    } catch (error) {
      this.logger.error({ err: error, url, method }, 'api request exception');
      return {
        ok: false,
        status: 0,
        durationMs: Date.now() - startedAt,
        error: 'NETWORK_ERROR',
        message: String(error),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
