import type { FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { fail } from '../utils/response';

export type UserRole = 'cashier' | 'supervisor' | 'admin';

export interface AuthUser {
  id: string;
  role: UserRole;
  siteId?: string;
}

export function requireAuth(req: FastifyRequest, reply: any, done: any) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);
  }
  const token = header.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret') as AuthUser;
    (req as any).authUser = payload;
    done();
  } catch {
    return fail(reply, 'UNAUTHORIZED', 'Token inválido', 401);
  }
}

export function requireRole(minRole: UserRole) {
  const rank: Record<UserRole, number> = { cashier: 1, supervisor: 2, admin: 3 };
  return (req: FastifyRequest, reply: any, done: any) => {
    const user = (req as any).authUser as AuthUser | undefined;
    if (!user) return fail(reply, 'UNAUTHORIZED', 'Token requerido', 401);
    if (rank[user.role] < rank[minRole]) {
      return fail(reply, 'FORBIDDEN', 'Permisos insuficientes', 403);
    }
    done();
  };
}
