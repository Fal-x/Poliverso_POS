import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { prisma } from '@/backend/prisma';
import { authRoutes } from './routes/auth';
import { approvalRoutes } from './routes/approvals';
import { cashRoutes } from './routes/cash';
import { salesRoutes } from './routes/sales';
import { cardRoutes } from './routes/cards';
import { userRoutes } from './routes/users';
import { catalogRoutes } from './routes/catalog';
import { reportRoutes } from './routes/reports';
import { adminRoutes } from './routes/admin';
import { espRoutes } from './routes/esp';
import { notificationRoutes } from './routes/notifications';
import { programRoutes } from './routes/programs';
import { eventRoutes } from './routes/events';
import { prizeRoutes } from './routes/prizes';
import { fail } from './utils/response';
import { DomainError } from '@/backend/validation/cashSessionValidators';
import type { FastifyReply, FastifyRequest } from 'fastify';

const REQUEST_START_TIME = Symbol('requestStartTime');
const REDACTED = '[redacted]';
const SENSITIVE_KEYS = [
  'authorization',
  'token',
  'refresh_token',
  'code',
  'password',
  'secret',
  'pin',
  'cookie',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function shouldRedactKey(key: string) {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.some((candidate) => normalized.includes(candidate));
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth >= 3) return '[depth-limit]';
  if (Array.isArray(value)) {
    return {
      count: value.length,
      sample: value.slice(0, 5).map((entry) => sanitizeValue(entry, depth + 1)),
    };
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        shouldRedactKey(key) ? REDACTED : sanitizeValue(entry, depth + 1),
      ])
    );
  }
  if (typeof value === 'string') {
    return value.length > 240 ? `${value.slice(0, 240)}...[${value.length} chars]` : value;
  }
  return value;
}

function sanitizeHeaders(headers: FastifyRequest['headers']) {
  return {
    'user-agent': headers['user-agent'],
    origin: headers.origin,
    referer: headers.referer,
    'content-type': headers['content-type'],
    authorization: headers.authorization ? REDACTED : undefined,
  };
}

function summarizeReplyPayload(reply: FastifyReply) {
  const payload = reply.payload;
  if (payload == null) return undefined;
  if (Buffer.isBuffer(payload)) {
    return { type: 'buffer', bytes: payload.byteLength };
  }
  if (typeof payload === 'string') {
    return payload.length > 240 ? `${payload.slice(0, 240)}...[${payload.length} chars]` : payload;
  }
  return sanitizeValue(payload);
}

function getRequestContext(request: FastifyRequest) {
  const authUser = (request as any).authUser as { id?: string; role?: string; siteId?: string } | undefined;
  return {
    requestId: request.id,
    method: request.method,
    route: request.routeOptions.url,
    url: request.url,
    ip: request.ip,
    userId: authUser?.id,
    userRole: authUser?.role,
    siteId: authUser?.siteId,
  };
}

export async function buildServer() {
  const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  const isLocalDevOrigin = (origin: string) => {
    try {
      const parsed = new URL(origin);
      return ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
    } catch {
      return false;
    }
  };

  const isAllowedConfiguredOrigin = (origin: string) => {
    return corsOrigins.some((value) => {
      if (value.startsWith('regex:')) {
        try {
          return new RegExp(value.slice(6)).test(origin);
        } catch {
          return false;
        }
      }
      return value === origin;
    });
  };

  const app = Fastify({
    disableRequestLogging: true,
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    },
  });

  app.addHook('onRequest', async (request) => {
    (request as any)[REQUEST_START_TIME] = process.hrtime.bigint();
    request.log.info(
      {
        ...getRequestContext(request),
        headers: sanitizeHeaders(request.headers),
        query: sanitizeValue(request.query),
      },
      'request start'
    );
  });

  app.addHook('preHandler', async (request) => {
    request.log.info(
      {
        ...getRequestContext(request),
        params: sanitizeValue(request.params),
        body: sanitizeValue(request.body),
      },
      'request input'
    );
  });

  app.addHook('onResponse', async (request, reply) => {
    const startedAt = (request as any)[REQUEST_START_TIME] as bigint | undefined;
    const durationMs = startedAt ? Number(process.hrtime.bigint() - startedAt) / 1_000_000 : undefined;
    request.log.info(
      {
        ...getRequestContext(request),
        statusCode: reply.statusCode,
        durationMs,
        response: summarizeReplyPayload(reply),
      },
      'request completed'
    );
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (isLocalDevOrigin(origin)) {
        return cb(null, true);
      }
      if (corsOrigins.length === 0) return cb(null, true);
      if (isAllowedConfiguredOrigin(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  await app.register(swagger, {
    swagger: {
      info: {
        title: 'POLIVERSE POS API',
        version: '1.0.0',
      },
    },
  });

  await app.register(swaggerUI, { routePrefix: '/docs' });

  app.setErrorHandler((error, req, reply) => {
    req.log.error(
      {
        ...getRequestContext(req),
        params: sanitizeValue(req.params),
        query: sanitizeValue(req.query),
        body: sanitizeValue(req.body),
        err: error,
      },
      'request failed'
    );
    if (error instanceof DomainError) {
      return fail(reply, 'DOMAIN_ERROR', error.message, 409);
    }
    return fail(reply, 'INTERNAL_ERROR', 'Error interno', 500);
  });

  app.get('/health', async (_req, reply) => reply.send({ ok: true }));

  // Validate DB connectivity early to avoid hanging requests.
  const connectTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('DB_CONNECT_TIMEOUT')), 3000)
  );
  try {
    await Promise.race([prisma.$connect(), connectTimeout]);
  } catch (err) {
    app.log.error(err, 'Database connection failed');
  }

  app.register(async (v1) => {
    await authRoutes(v1);
    await approvalRoutes(v1);
    await userRoutes(v1);
    await catalogRoutes(v1);
    await cashRoutes(v1);
    await salesRoutes(v1);
    await cardRoutes(v1);
    await reportRoutes(v1);
    await programRoutes(v1);
    await eventRoutes(v1);
    await prizeRoutes(v1);
    await adminRoutes(v1);
    await espRoutes(v1);
    await notificationRoutes(v1);
  }, { prefix: '/api/v1' });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.API_PORT || process.env.PORT || 3001);
  buildServer().then(app => app.listen({ port, host: '0.0.0.0' }));
}
