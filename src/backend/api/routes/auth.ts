import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/backend/prisma';
import { ok, fail } from '../utils/response';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (req, reply) => {
    const body = req.body as { user_id: string; code: string };
    if (!body?.user_id || !body?.code) {
      return fail(reply, 'VALIDATION_ERROR', 'user_id y code son requeridos');
    }

    const user = await prisma.user.findUnique({ where: { id: body.user_id } });
    if (!user) return fail(reply, 'NOT_FOUND', 'Usuario no encontrado', 404);

    const authCode = await prisma.userAuthCode.findUnique({ where: { userId: user.id } });
    if (!authCode) return fail(reply, 'AUTH_CODE_MISSING', 'Código no configurado', 401);

    const valid = await bcrypt.compare(body.code, authCode.codeHash);
    if (!valid) {
      await prisma.userAuthCode.update({
        where: { userId: user.id },
        data: { failedAttempts: authCode.failedAttempts + 1 },
      });
      return fail(reply, 'INVALID_CODE', 'Código incorrecto', 401);
    }

    const role = await resolveUserRole(user.id);
    const accessToken = jwt.sign(
      { id: user.id, role },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '8h' }
    );

    const refreshToken = crypto.randomBytes(48).toString('hex');
    const refreshHash = await bcrypt.hash(refreshToken, 10);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.userAuthCode.update({
      where: { userId: user.id },
      data: { lastUsedAt: new Date(), failedAttempts: 0 },
    });

    return ok(reply, {
      token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        name: user.fullName,
        role,
      },
      expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    });
  });

  app.post('/auth/refresh', async (req, reply) => {
    const body = req.body as { refresh_token: string };
    if (!body?.refresh_token) {
      return fail(reply, 'VALIDATION_ERROR', 'refresh_token requerido');
    }

    const tokens = await prisma.refreshToken.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      take: 200,
    });

    let match: typeof tokens[number] | null = null;
    for (const t of tokens) {
      if (await bcrypt.compare(body.refresh_token, t.tokenHash)) {
        match = t;
        break;
      }
    }

    if (!match) return fail(reply, 'INVALID_REFRESH', 'Refresh token inválido', 401);

    const user = await prisma.user.findUnique({ where: { id: match.userId } });
    if (!user) return fail(reply, 'NOT_FOUND', 'Usuario no encontrado', 404);

    const accessToken = jwt.sign(
      { id: user.id, role: await resolveUserRole(user.id) },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '8h' }
    );

    return ok(reply, {
      token: accessToken,
      expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    });
  });

  app.post('/auth/logout', async (req, reply) => {
    const body = req.body as { refresh_token: string };
    if (!body?.refresh_token) {
      return ok(reply, { revoked: true });
    }

    const tokens = await prisma.refreshToken.findMany({
      where: { revokedAt: null },
      take: 200,
    });

    let match: typeof tokens[number] | null = null;
    for (const t of tokens) {
      if (await bcrypt.compare(body.refresh_token, t.tokenHash)) {
        match = t;
        break;
      }
    }

    if (match) {
      await prisma.refreshToken.update({
        where: { id: match.id },
        data: { revokedAt: new Date() },
      });
    }

    return ok(reply, { revoked: true });
  });
}

async function resolveUserRole(userId: string) {
  const assignment = await prisma.userAssignment.findFirst({
    where: { userId, isActive: true },
    include: { role: true },
  });
  const role = assignment?.role?.name ?? 'CASHIER';
  return role === 'ADMIN' ? 'admin' : role === 'SUPERVISOR' ? 'supervisor' : 'cashier';
}
