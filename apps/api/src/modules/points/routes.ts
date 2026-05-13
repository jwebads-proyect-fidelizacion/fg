import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requireAdmin } from '../../middleware/rbac.js';
import prisma from '../../lib/prisma.js';
import { z } from 'zod';

const pointRuleSchema = z.object({
  rules: z.array(
    z.object({
      event: z.enum(['ATTENDANCE', 'PAYMENT', 'REFERRAL', 'NPS_RESPONSE'], {
        errorMap: () => ({ message: 'Evento inválido' }),
      }),
      points: z.number().int().min(0, 'Los puntos deben ser 0 o más'),
      isEnabled: z.boolean(),
    })
  ).min(1, 'Debe incluir al menos una regla'),
});

export async function pointRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);

  // GET /rules - List point rules (admin+)
  app.get('/rules', { preHandler: [requireAdmin()] }, async (request) => {
    const tenantId = request.tenantId!;

    const rules = await prisma.pointRule.findMany({
      where: { tenantId },
      orderBy: { event: 'asc' },
    });

    // If no rules exist, return defaults
    if (rules.length === 0) {
      const defaultEvents = ['ATTENDANCE', 'PAYMENT', 'REFERRAL', 'NPS_RESPONSE'] as const;
      return {
        data: defaultEvents.map((event) => ({
          event,
          points: 0,
          isEnabled: false,
          tenantId,
        })),
      };
    }

    return { data: rules };
  });

  // PUT /rules - Update point rules (admin+)
  app.put('/rules', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const parsed = pointRuleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const { rules } = parsed.data;
    const tenantId = request.tenantId!;

    // Upsert all rules in a transaction
    const operations = rules.map((rule) =>
      prisma.pointRule.upsert({
        where: { tenantId_event: { tenantId, event: rule.event } },
        create: {
          tenantId,
          event: rule.event,
          points: rule.points,
          isEnabled: rule.isEnabled,
        },
        update: {
          points: rule.points,
          isEnabled: rule.isEnabled,
        },
      })
    );

    const updatedRules = await prisma.$transaction(operations);

    return { message: 'Reglas de puntos actualizadas', data: updatedRules };
  });

  // GET /member/:memberId - Get point movements for member (admin+)
  app.get('/member/:memberId', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { memberId } = request.params as { memberId: string };
    const { page = '1', limit = '20' } = request.query as Record<string, string>;
    const tenantId = request.tenantId!;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Verify member belongs to tenant
    const member = await prisma.member.findFirst({
      where: { id: memberId, tenantId },
      select: { id: true, firstName: true, lastName: true, pointsBalance: true },
    });
    if (!member) {
      return reply.status(404).send({ error: 'Socio no encontrado' });
    }

    const [movements, total] = await Promise.all([
      prisma.pointMovement.findMany({
        where: { tenantId, memberId },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.pointMovement.count({ where: { tenantId, memberId } }),
    ]);

    return {
      member: {
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        currentBalance: member.pointsBalance,
      },
      movements,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  });
}
