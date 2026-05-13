import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requireAdmin } from '../../middleware/rbac.js';
import prisma from '../../lib/prisma.js';
import { z } from 'zod';

const createPlanSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100),
  description: z.string().max(500).optional().nullable(),
  durationDays: z.number().int().min(1, 'Duración mínima: 1 día').max(730),
  price: z.number().min(0, 'Precio no puede ser negativo'),
  currency: z.string().length(3).default('MXN'),
});

const updatePlanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  durationDays: z.number().int().min(1).max(730).optional(),
  price: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
});

export async function planRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);

  // GET / - List plans (admin+)
  app.get('/', { preHandler: [requireAdmin()] }, async (request) => {
    const { includeArchived } = request.query as { includeArchived?: string };
    const tenantId = request.tenantId!;

    const where: any = { tenantId };
    if (includeArchived !== 'true') {
      where.isArchived = false;
    }

    const plans = await prisma.plan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { memberships: { where: { status: 'ACTIVE' } } } },
      },
    });

    return { data: plans };
  });

  // POST / - Create plan (admin+)
  app.post('/', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const parsed = createPlanSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const body = parsed.data;
    const tenantId = request.tenantId!;

    // Check duplicate name
    const existing = await prisma.plan.findFirst({
      where: { tenantId, name: body.name, isArchived: false },
    });
    if (existing) {
      return reply.status(409).send({ error: 'Ya existe un plan activo con este nombre' });
    }

    const plan = await prisma.plan.create({
      data: {
        tenantId,
        name: body.name,
        description: body.description ?? undefined,
        durationDays: body.durationDays,
        price: body.price,
        currency: body.currency,
      },
    });

    return reply.status(201).send(plan);
  });

  // PUT /:id - Update plan (admin+)
  app.put('/:id', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updatePlanSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const body = parsed.data;
    const tenantId = request.tenantId!;

    const existing = await prisma.plan.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return reply.status(404).send({ error: 'Plan no encontrado' });
    }
    if (existing.isArchived) {
      return reply.status(400).send({ error: 'No se puede editar un plan archivado' });
    }

    // Check name duplicate if changing
    if (body.name && body.name !== existing.name) {
      const dup = await prisma.plan.findFirst({
        where: { tenantId, name: body.name, isArchived: false, id: { not: id } },
      });
      if (dup) {
        return reply.status(409).send({ error: 'Ya existe un plan activo con este nombre' });
      }
    }

    const plan = await prisma.plan.update({ where: { id }, data: body });
    return plan;
  });

  // PATCH /:id/archive - Archive plan (admin+)
  app.patch('/:id/archive', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenantId!;

    const existing = await prisma.plan.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return reply.status(404).send({ error: 'Plan no encontrado' });
    }
    if (existing.isArchived) {
      return reply.status(400).send({ error: 'El plan ya está archivado' });
    }

    // Check if plan has active memberships
    const activeMemberships = await prisma.membership.count({
      where: { planId: id, status: 'ACTIVE' },
    });
    if (activeMemberships > 0) {
      return reply.status(400).send({
        error: `No se puede archivar: el plan tiene ${activeMemberships} membresía(s) activa(s)`,
      });
    }

    const plan = await prisma.plan.update({ where: { id }, data: { isArchived: true } });
    return { message: 'Plan archivado exitosamente', plan };
  });
}
