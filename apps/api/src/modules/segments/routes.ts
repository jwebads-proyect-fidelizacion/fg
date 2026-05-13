import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requireAdmin } from '../../middleware/rbac.js';
import prisma from '../../lib/prisma.js';
import { z } from 'zod';

const segmentCriteriaSchema = z.object({
  membershipStatus: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED', 'ANY']).optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  minAge: z.number().int().min(0).optional(),
  maxAge: z.number().int().max(120).optional(),
  minAttendanceDays: z.number().int().min(0).optional(),
  maxAttendanceDays: z.number().int().optional(),
  lastAttendanceDaysAgo: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
  planIds: z.array(z.string().uuid()).optional(),
  isReferred: z.boolean().optional(),
  minPointsBalance: z.number().int().optional(),
  maxPointsBalance: z.number().int().optional(),
  registeredAfter: z.coerce.date().optional(),
  registeredBefore: z.coerce.date().optional(),
});

const createSegmentSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100),
  criteria: segmentCriteriaSchema,
});

const updateSegmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  criteria: segmentCriteriaSchema.optional(),
});

export async function segmentRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);

  // GET / - List segments (admin+)
  app.get('/', { preHandler: [requireAdmin()] }, async (request) => {
    const tenantId = request.tenantId!;

    const segments = await prisma.segment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { campaigns: true } },
      },
    });

    return { data: segments };
  });

  // POST / - Create segment (admin+)
  app.post('/', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const parsed = createSegmentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const { name, criteria } = parsed.data;
    const tenantId = request.tenantId!;

    // Check duplicate name
    const existing = await prisma.segment.findFirst({ where: { tenantId, name } });
    if (existing) {
      return reply.status(409).send({ error: 'Ya existe un segmento con este nombre' });
    }

    const segment = await prisma.segment.create({
      data: { tenantId, name, criteria: criteria as any },
    });

    return reply.status(201).send(segment);
  });

  // PUT /:id - Update segment (admin+)
  app.put('/:id', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateSegmentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const body = parsed.data;
    const tenantId = request.tenantId!;

    const existing = await prisma.segment.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return reply.status(404).send({ error: 'Segmento no encontrado' });
    }

    // Check name duplicate if changing
    if (body.name && body.name !== existing.name) {
      const dup = await prisma.segment.findFirst({ where: { tenantId, name: body.name, id: { not: id } } });
      if (dup) {
        return reply.status(409).send({ error: 'Ya existe un segmento con este nombre' });
      }
    }

    const segment = await prisma.segment.update({
      where: { id },
      data: {
        name: body.name,
        criteria: body.criteria ? (body.criteria as any) : undefined,
      },
    });

    return segment;
  });

  // GET /:id/preview - Preview segment (count + sample members) (admin+)
  app.get('/:id/preview', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenantId!;

    const segment = await prisma.segment.findFirst({ where: { id, tenantId } });
    if (!segment) {
      return reply.status(404).send({ error: 'Segmento no encontrado' });
    }

    const criteria = segment.criteria as any;
    const where = buildMemberWhereFromCriteria(tenantId, criteria);

    const [count, sample] = await Promise.all([
      prisma.member.count({ where }),
      prisma.member.findMany({
        where,
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          isActive: true,
          pointsBalance: true,
          riskLevel: true,
          createdAt: true,
        },
      }),
    ]);

    return { segmentId: id, segmentName: segment.name, totalMembers: count, sample };
  });
}

function buildMemberWhereFromCriteria(tenantId: string, criteria: any): any {
  const where: any = { tenantId, isActive: true };

  if (criteria.riskLevel) {
    where.riskLevel = criteria.riskLevel;
  }

  if (criteria.isReferred !== undefined) {
    where.isReferred = criteria.isReferred;
  }

  if (criteria.minPointsBalance !== undefined || criteria.maxPointsBalance !== undefined) {
    where.pointsBalance = {};
    if (criteria.minPointsBalance !== undefined) where.pointsBalance.gte = criteria.minPointsBalance;
    if (criteria.maxPointsBalance !== undefined) where.pointsBalance.lte = criteria.maxPointsBalance;
  }

  if (criteria.registeredAfter || criteria.registeredBefore) {
    where.createdAt = {};
    if (criteria.registeredAfter) where.createdAt.gte = new Date(criteria.registeredAfter);
    if (criteria.registeredBefore) where.createdAt.lte = new Date(criteria.registeredBefore);
  }

  if (criteria.minAge !== undefined || criteria.maxAge !== undefined) {
    where.dateOfBirth = {};
    const now = new Date();
    if (criteria.maxAge !== undefined) {
      const minDate = new Date(now.getFullYear() - criteria.maxAge - 1, now.getMonth(), now.getDate());
      where.dateOfBirth.gte = minDate;
    }
    if (criteria.minAge !== undefined) {
      const maxDate = new Date(now.getFullYear() - criteria.minAge, now.getMonth(), now.getDate());
      where.dateOfBirth.lte = maxDate;
    }
  }

  if (criteria.tags && criteria.tags.length > 0) {
    where.tags = { some: { tag: { in: criteria.tags } } };
  }

  if (criteria.membershipStatus && criteria.membershipStatus !== 'ANY') {
    where.memberships = { some: { status: criteria.membershipStatus } };
  }

  if (criteria.planIds && criteria.planIds.length > 0) {
    where.memberships = {
      ...where.memberships,
      some: { ...where.memberships?.some, planId: { in: criteria.planIds } },
    };
  }

  if (criteria.lastAttendanceDaysAgo !== undefined) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - criteria.lastAttendanceDaysAgo);
    where.attendances = { some: { timestamp: { gte: cutoff } } };
  }

  return where;
}
