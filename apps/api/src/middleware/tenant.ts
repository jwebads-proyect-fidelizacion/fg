import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
  }
}

export async function tenantMiddleware(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    return reply.status(401).send({ error: 'No autenticado' });
  }
  request.tenantId = request.user.tenantId;
  if (!request.tenantId) {
    return reply.status(400).send({ error: 'Tenant no seleccionado' });
  }
}
