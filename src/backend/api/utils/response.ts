import type { FastifyReply } from 'fastify';

export function ok<T>(reply: FastifyReply, data: T, meta?: Record<string, unknown>) {
  return reply.send({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: reply.request.id,
      ...meta,
    },
  });
}

export function fail(reply: FastifyReply, code: string, message: string, status = 400) {
  return reply.status(status).send({
    success: false,
    error: {
      code,
      message,
    },
  });
}
