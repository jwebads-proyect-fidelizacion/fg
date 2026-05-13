import { FastifyRequest, FastifyReply } from 'fastify';

type RoleType = 'OWNER' | 'ADMIN' | 'RECEPTIONIST';

export function requireRoles(...roles: RoleType[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'No autenticado' });
    }
    if (!roles.includes(request.user.role as RoleType)) {
      return reply.status(403).send({ error: 'Permiso insuficiente' });
    }
  };
}

export function requireOwner() {
  return requireRoles('OWNER');
}

export function requireAdmin() {
  return requireRoles('OWNER', 'ADMIN');
}

export function requireAny() {
  return requireRoles('OWNER', 'ADMIN', 'RECEPTIONIST');
}
