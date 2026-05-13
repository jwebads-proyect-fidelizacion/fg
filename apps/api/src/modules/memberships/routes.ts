import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requireAdmin, requireAny } from '../../middleware/rbac.js';
import prisma from '../../lib/prisma.js';
import { z } from 'zod';

const createMembershipSchema = z.object({
  memberId: z.string().uuid('ID de socio inválido'),
  planId: z.string().uuid('ID de plan inválido'),
  startDate: z.coerce.date().optional(),
});

export async function membershipRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);

  // POST / - Assign membership to member (admin+)
  app.post('/', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const parsed = createMembershipSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const { memberId, planId, startDate } = parsed.data;
    const tenantId = request.tenantId!;

    // Verify member exists and belongs to tenant
    const member = await prisma.member.findFirst({ where: { id: memberId, tenantId } });
    if (!member) {
      return reply.status(404).send({ error: 'Socio no encontrado' });
    }
    if (!member.isActive) {
      return reply.status(400).send({ error: 'No se puede asignar membresía a un socio inactivo' });
    }

    // Verify plan exists and is not archived
    const plan = await prisma.plan.findFirst({ where: { id: planId, tenantId } });
    if (!plan) {
      return reply.status(404).send({ error: 'Plan no encontrado' });
    }
    if (plan.isArchived) {
      return reply.status(400).send({ error: 'No se puede asignar un plan archivado' });
    }

    // Check no active membership exists
    const activeMembership = await prisma.membership.findFirst({
      where: { memberId, tenantId, status: 'ACTIVE' },
    });
    if (activeMembership) {
      return reply.status(409).send({
        error: 'El socio ya tiene una membresía activa. Debe cancelarla o esperar a que expire.',
      });
    }

    // Calculate dates
    const start = startDate || new Date();
    const endDate = new Date(start);
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const membership = await prisma.membership.create({
      data: {
        tenantId,
        memberId,
        planId,
        startDate: start,
        endDate,
        status: 'ACTIVE',
      },
      include: { plan: true, member: { select: { firstName: true, lastName: true } } },
    });

    return reply.status(201).send(membership);
  });

  // GET /member/:memberId - List memberships for a member (all roles)
  app.get('/member/:memberId', { preHandler: [requireAny()] }, async (request, reply) => {
    const { memberId } = request.params as { memberId: string };
    const tenantId = request.tenantId!;

    // Verify member belongs to tenant
    const member = await prisma.member.findFirst({ where: { id: memberId, tenantId } });
    if (!member) {
      return reply.status(404).send({ error: 'Socio no encontrado' });
    }

    const memberships = await prisma.membership.findMany({
      where: { memberId, tenantId },
      include: { plan: true },
      orderBy: { startDate: 'desc' },
    });

    return { data: memberships };
  });
}
