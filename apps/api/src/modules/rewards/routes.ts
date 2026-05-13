import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requireAdmin } from '../../middleware/rbac.js';
import prisma from '../../lib/prisma.js';
import { generateRandomCode } from '../../lib/crypto.js';
import { z } from 'zod';

const createRewardSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100),
  pointsCost: z.number().int().min(1, 'El costo en puntos debe ser al menos 1'),
  stock: z.number().int().min(0).optional().nullable(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isActive: z.boolean().default(true),
});

const updateRewardSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  pointsCost: z.number().int().min(1).optional(),
  stock: z.number().int().min(0).optional().nullable(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

const redeemSchema = z.object({
  memberId: z.string().uuid('ID de socio inválido'),
});

export async function rewardRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);

  // GET / - List rewards (admin+)
  app.get('/', { preHandler: [requireAdmin()] }, async (request) => {
    const { active } = request.query as { active?: string };
    const tenantId = request.tenantId!;

    const where: any = { tenantId };
    if (active === 'true') {
      where.isActive = true;
      where.endDate = { gte: new Date() };
    }

    const rewards = await prisma.reward.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { redemptions: true } },
      },
    });

    return { data: rewards };
  });

  // POST / - Create reward (admin+)
  app.post('/', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const parsed = createRewardSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const body = parsed.data;
    const tenantId = request.tenantId!;

    // Validate dates
    if (body.endDate <= body.startDate) {
      return reply.status(400).send({ error: 'La fecha de fin debe ser posterior a la fecha de inicio' });
    }

    const reward = await prisma.reward.create({
      data: {
        tenantId,
        name: body.name,
        pointsCost: body.pointsCost,
        stock: body.stock ?? undefined,
        startDate: body.startDate,
        endDate: body.endDate,
        isActive: body.isActive,
      },
    });

    return reply.status(201).send(reward);
  });

  // PUT /:id - Update reward (admin+)
  app.put('/:id', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateRewardSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const body = parsed.data;
    const tenantId = request.tenantId!;

    const existing = await prisma.reward.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return reply.status(404).send({ error: 'Recompensa no encontrada' });
    }

    // Validate dates if both provided
    const startDate = body.startDate || existing.startDate;
    const endDate = body.endDate || existing.endDate;
    if (endDate <= startDate) {
      return reply.status(400).send({ error: 'La fecha de fin debe ser posterior a la fecha de inicio' });
    }

    const reward = await prisma.reward.update({ where: { id }, data: body as any });
    return reward;
  });

  // POST /:id/redeem - Redeem reward for a member (admin+)
  app.post('/:id/redeem', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = redeemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const { memberId } = parsed.data;
    const tenantId = request.tenantId!;

    // Verify reward exists and is available
    const reward = await prisma.reward.findFirst({ where: { id, tenantId } });
    if (!reward) {
      return reply.status(404).send({ error: 'Recompensa no encontrada' });
    }
    if (!reward.isActive) {
      return reply.status(400).send({ error: 'La recompensa no está activa' });
    }

    const now = new Date();
    if (now < reward.startDate || now > reward.endDate) {
      return reply.status(400).send({ error: 'La recompensa no está disponible en este momento' });
    }

    // Check stock
    if (reward.stock !== null && reward.stock <= 0) {
      return reply.status(400).send({ error: 'La recompensa no tiene stock disponible' });
    }

    // Verify member exists and is active
    const member = await prisma.member.findFirst({ where: { id: memberId, tenantId, isActive: true } });
    if (!member) {
      return reply.status(404).send({ error: 'Socio no encontrado o inactivo' });
    }

    // Check balance
    if (member.pointsBalance < reward.pointsCost) {
      return reply.status(400).send({
        error: `Puntos insuficientes. Necesita ${reward.pointsCost}, tiene ${member.pointsBalance}`,
      });
    }

    // Atomic transaction: deduct points, decrement stock, create redemption, create point movement
    const code = generateRandomCode(10).toUpperCase();
    const newBalance = member.pointsBalance - reward.pointsCost;

    const result = await prisma.$transaction(async (tx) => {
      // Deduct points from member
      await tx.member.update({
        where: { id: memberId },
        data: { pointsBalance: newBalance },
      });

      // Decrement stock if applicable
      if (reward.stock !== null) {
        const updatedReward = await tx.reward.update({
          where: { id },
          data: { stock: { decrement: 1 } },
        });
        // Double-check stock didn't go negative (race condition protection)
        if (updatedReward.stock !== null && updatedReward.stock < 0) {
          throw new Error('STOCK_EXHAUSTED');
        }
      }

      // Create redemption record
      const redemption = await tx.redemption.create({
        data: {
          tenantId,
          memberId,
          rewardId: id,
          pointsSpent: reward.pointsCost,
          code,
        },
      });

      // Create point movement
      await tx.pointMovement.create({
        data: {
          tenantId,
          memberId,
          type: 'REDEEM',
          points: -reward.pointsCost,
          balance: newBalance,
          event: 'REWARD_REDEMPTION',
          referenceId: redemption.id,
        },
      });

      return redemption;
    });

    return reply.status(201).send({
      message: 'Recompensa canjeada exitosamente',
      redemption: result,
      code,
      newBalance,
    });
  });
}
