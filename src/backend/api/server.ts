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
import { stubRoutes } from './routes/stubs';
import { catalogRoutes } from './routes/catalog';
import { fail } from './utils/response';

export async function buildServer() {
  const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  const app = Fastify({
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

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (corsOrigins.length === 0) return cb(null, true);
      const allowed = corsOrigins.some((value) => {
        if (value.startsWith('regex:')) {
          try {
            return new RegExp(value.slice(6)).test(origin);
          } catch {
            return false;
          }
        }
        return value === origin;
      });
      if (allowed) return cb(null, true);
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

  app.setErrorHandler((error, _req, reply) => {
    app.log.error(error);
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
    v1.addHook('preHandler', async (req, reply) => {
      if (req.method === 'OPTIONS') return;
      const demoToken = process.env.DEMO_TOKEN;
      if (!demoToken) return;
      const header = req.headers['x-demo-token'];
      const token = Array.isArray(header) ? header[0] : header;
      if (token !== demoToken) {
        return fail(reply, 'DEMO_TOKEN_REQUIRED', 'Acceso de demo requerido', 401);
      }
    });

    await authRoutes(v1);
    await approvalRoutes(v1);
    await userRoutes(v1);
    await catalogRoutes(v1);
    await cashRoutes(v1);
    await salesRoutes(v1);
    await cardRoutes(v1);
    await stubRoutes(v1);
  }, { prefix: '/api/v1' });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.API_PORT || process.env.PORT || 3001);
  buildServer().then(app => app.listen({ port, host: '0.0.0.0' }));
}
