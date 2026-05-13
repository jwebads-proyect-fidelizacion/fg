import { FastifyInstance } from 'fastify';
import prisma from '../../lib/prisma.js';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  TokenPayload,
} from '../../lib/crypto.js';
import { authMiddleware } from '../../middleware/auth.js';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requerido'),
});

const selectTenantSchema = z.object({
  tenantId: z.string().uuid('ID de tenant inválido'),
});

export async function authRoutes(app: FastifyInstance) {
  // POST /login - Authenticate with email/password
  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({ error: 'Credenciales inválidas' });
    }

    // Check account lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return reply.status(423).send({
        error: `Cuenta bloqueada temporalmente. Intente en ${minutesLeft} minuto(s).`,
      });
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      const attempts = user.failedAttempts + 1;
      const update: any = { failedAttempts: attempts };
      if (attempts >= 5) {
        update.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        update.failedAttempts = 0;
      }
      await prisma.user.update({ where: { id: user.id }, data: update });
      return reply.status(401).send({ error: 'Credenciales inválidas' });
    }

    // Reset failed attempts on success
    await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null } });

    // Get user tenants
    const userTenants = await prisma.userTenant.findMany({
      where: { userId: user.id },
      include: { tenant: true },
    });

    if (userTenants.length === 0) {
      return reply.status(403).send({ error: 'No tiene acceso a ningún gimnasio' });
    }

    // Auto-select first tenant
    const selectedTenant = userTenants[0];
    const payload: TokenPayload = {
      userId: user.id,
      tenantId: selectedTenant.tenantId,
      role: selectedTenant.role,
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email },
      tenants: userTenants.map((ut) => ({ id: ut.tenant.id, name: ut.tenant.name, role: ut.role })),
      currentTenant: { id: selectedTenant.tenant.id, name: selectedTenant.tenant.name, role: selectedTenant.role },
    };
  });

  // POST /refresh - Refresh access token
  app.post('/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Refresh token requerido' });
    }

    try {
      const payload = verifyRefreshToken(parsed.data.refreshToken);
      // Verify user still exists and has access
      const userTenant = await prisma.userTenant.findUnique({
        where: { userId_tenantId: { userId: payload.userId, tenantId: payload.tenantId } },
      });
      if (!userTenant) {
        return reply.status(401).send({ error: 'Sesión inválida' });
      }

      const newPayload: TokenPayload = { userId: payload.userId, tenantId: payload.tenantId, role: userTenant.role };
      const accessToken = generateAccessToken(newPayload);
      const refreshToken = generateRefreshToken(newPayload);
      return { accessToken, refreshToken };
    } catch {
      return reply.status(401).send({ error: 'Refresh token inválido o expirado' });
    }
  });

  // POST /logout - Invalidate session (client-side token removal)
  app.post('/logout', async (_request, reply) => {
    // JWT is stateless; client must discard tokens.
    // Future: add token to blacklist in Redis.
    return reply.status(200).send({ message: 'Sesión cerrada exitosamente' });
  });

  // GET /tenants - List user's tenants (requires auth)
  app.get('/tenants', { preHandler: [authMiddleware] }, async (request, reply) => {
    const userTenants = await prisma.userTenant.findMany({
      where: { userId: request.user!.userId },
      include: { tenant: true },
    });

    if (userTenants.length === 0) {
      return reply.status(404).send({ error: 'No se encontraron gimnasios asociados' });
    }

    return {
      tenants: userTenants.map((ut) => ({
        id: ut.tenant.id,
        name: ut.tenant.name,
        role: ut.role,
        timezone: ut.tenant.timezone,
      })),
    };
  });

  // POST /select-tenant - Select active tenant, return new tokens
  app.post('/select-tenant', { preHandler: [authMiddleware] }, async (request, reply) => {
    const parsed = selectTenantSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ID de tenant inválido' });
    }

    const userTenant = await prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId: request.user!.userId, tenantId: parsed.data.tenantId } },
      include: { tenant: true },
    });

    if (!userTenant) {
      return reply.status(403).send({ error: 'No tiene acceso a este gimnasio' });
    }

    const payload: TokenPayload = {
      userId: request.user!.userId,
      tenantId: userTenant.tenantId,
      role: userTenant.role,
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      tenant: { id: userTenant.tenant.id, name: userTenant.tenant.name, role: userTenant.role },
    };
  });
}
