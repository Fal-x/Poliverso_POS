import crypto from 'crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { fail } from '../utils/response';
import { parseAuthUserFromToken, requireAuth, type AuthUser } from '../middleware/auth';
import { sanitizeToken, sanitizeUuid } from '@/backend/utils/sanitize';
import { subscribeSiteNotifications, type NotificationPayload } from '../realtime/notificationHub';

type AuthenticatedRequest = FastifyRequest & { authUser?: AuthUser };

function resolveSseCorsOrigin(originHeader: string | undefined): string | null {
  if (!originHeader) return null;
  if (/^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?$/i.test(originHeader)) {
    return originHeader;
  }

  const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  if (configuredOrigins.length === 0) return originHeader;

  const isAllowed = configuredOrigins.some((value) => {
    if (value.startsWith('regex:')) {
      try {
        return new RegExp(value.slice(6)).test(originHeader);
      } catch {
        return false;
      }
    }

    return value === originHeader;
  });

  return isAllowed ? originHeader : null;
}

function writeSseEvent(write: (chunk: string) => void, payload: NotificationPayload) {
  write(`event: ${payload.type}\n`);
  write(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/notifications/stream', async (req, reply) => {
    const authReq = req as AuthenticatedRequest;
    const query = req.query as { site_id?: string; token?: string };
    const siteId = sanitizeUuid(query.site_id);
    const queryToken = sanitizeToken(query.token, 4096);

    if (!siteId) {
      return fail(reply, 'VALIDATION_ERROR', 'site_id es requerido');
    }

    if (queryToken) {
      const authUser = parseAuthUserFromToken(queryToken);
      if (!authUser) return fail(reply, 'UNAUTHORIZED', 'Token inválido', 401);
      authReq.authUser = authUser;
    } else {
      let hasAuthError = false;
      requireAuth(authReq, reply, () => undefined);
      if (!authReq.authUser) {
        hasAuthError = true;
      }
      if (hasAuthError) return;
    }

    reply.hijack();
    const corsOrigin = resolveSseCorsOrigin(req.headers.origin);
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...(corsOrigin
        ? {
            'Access-Control-Allow-Origin': corsOrigin,
            Vary: 'Origin',
          }
        : {}),
    });

    const write = (chunk: string) => reply.raw.write(chunk);
    const clientId = crypto.randomUUID();

    write('retry: 5000\n\n');
    writeSseEvent(write, {
      type: 'cash_session_opened',
      site_id: siteId,
      created_at: new Date().toISOString(),
      message: 'Canal de notificaciones conectado',
      data: { connected: true },
    });

    const unsubscribe = subscribeSiteNotifications(siteId, clientId, (payload) => {
      writeSseEvent(write, payload);
    });

    const heartbeat = setInterval(() => {
      write(`: heartbeat ${Date.now()}\n\n`);
    }, 25000);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      reply.raw.end();
    });
  });
}
