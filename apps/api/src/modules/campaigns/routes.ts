import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requireAdmin } from '../../middleware/rbac.js';
import prisma from '../../lib/prisma.js';
import { z } from 'zod';

const createCampaignSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100),
  objective: z.string().min(1, 'Objetivo requerido').max(500),
  type: z.enum(['REMINDER', 'BIRTHDAY', 'RENEWAL', 'PROMO', 'REFERRAL', 'NPS', 'CUSTOM'], {
    errorMap: () => ({ message: 'Tipo de campaña inválido' }),
  }),
  segmentId: z.string().uuid().optional().nullable(),
  templateName: z.string().min(1, 'Template requerido'),
  templateLanguage: z.string().default('es'),
  frequency: z.enum(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'], {
    errorMap: () => ({ message: 'Frecuencia inválida' }),
  }),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional().nullable(),
  attributionDays: z.number().int().min(1).max(90).default(7),
  config: z.record(z.any()).optional().nullable(),
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  objective: z.string().min(1).max(500).optional(),
  segmentId: z.string().uuid().optional().nullable(),
  templateName: z.string().min(1).optional(),
  templateLanguage: z.string().optional(),
  frequency: z.enum(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional().nullable(),
  attributionDays: z.number().int().min(1).max(90).optional(),
  config: z.record(z.any()).optional().nullable(),
});

const statusChangeSchema = z.object({
  status: z.enum(['SCHEDULED', 'RUNNING', 'PAUSED', 'CANCELLED', 'FINISHED'], {
    errorMap: () => ({ message: 'Estado inválido' }),
  }),
});

// Valid status transitions
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['PAUSED', 'CANCELLED', 'FINISHED'],
  PAUSED: ['RUNNING', 'CANCELLED'],
  CANCELLED: [],
  FINISHED: [],
};

export async function campaignRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);

  // GET / - List campaigns (admin+)
  app.get('/', { preHandler: [requireAdmin()] }, async (request) => {
    const { status, type, page = '1', limit = '20' } = request.query as Record<string, string>;
    const tenantId = request.tenantId!;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { tenantId };
    if (status) where.status = status;
    if (type) where.type = type;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          segment: { select: { id: true, name: true } },
          _count: { select: { executions: true } },
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    return {
      data: campaigns,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    };
  });

  // POST / - Create campaign (admin+)
  app.post('/', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const parsed = createCampaignSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const body = parsed.data;
    const tenantId = request.tenantId!;

    // Check duplicate name
    const existing = await prisma.campaign.findUnique({
      where: { tenantId_name: { tenantId, name: body.name } },
    });
    if (existing) {
      return reply.status(409).send({ error: 'Ya existe una campaña con este nombre' });
    }

    // Validate segment if provided
    if (body.segmentId) {
      const segment = await prisma.segment.findFirst({ where: { id: body.segmentId, tenantId } });
      if (!segment) {
        return reply.status(400).send({ error: 'Segmento no encontrado' });
      }
    }

    // Validate dates
    if (body.endAt && body.endAt <= body.startAt) {
      return reply.status(400).send({ error: 'La fecha de fin debe ser posterior a la fecha de inicio' });
    }

    const campaign = await prisma.campaign.create({
      data: {
        tenantId,
        name: body.name,
        objective: body.objective,
        type: body.type,
        segmentId: body.segmentId ?? undefined,
        templateName: body.templateName,
        templateLanguage: body.templateLanguage,
        frequency: body.frequency,
        startAt: body.startAt,
        endAt: body.endAt ?? undefined,
        attributionDays: body.attributionDays,
        config: body.config ?? undefined,
        status: 'DRAFT',
      },
      include: { segment: { select: { id: true, name: true } } },
    });

    return reply.status(201).send(campaign);
  });

  // PUT /:id - Update campaign (admin+)
  app.put('/:id', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateCampaignSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const body = parsed.data;
    const tenantId = request.tenantId!;

    const existing = await prisma.campaign.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return reply.status(404).send({ error: 'Campaña no encontrada' });
    }

    // Only allow editing DRAFT or SCHEDULED campaigns
    if (!['DRAFT', 'SCHEDULED'].includes(existing.status)) {
      return reply.status(400).send({ error: 'Solo se pueden editar campañas en estado Borrador o Programada' });
    }

    // Check name duplicate if changing
    if (body.name && body.name !== existing.name) {
      const dup = await prisma.campaign.findUnique({
        where: { tenantId_name: { tenantId, name: body.name } },
      });
      if (dup) {
        return reply.status(409).send({ error: 'Ya existe una campaña con este nombre' });
      }
    }

    // Validate segment if provided
    if (body.segmentId) {
      const segment = await prisma.segment.findFirst({ where: { id: body.segmentId, tenantId } });
      if (!segment) {
        return reply.status(400).send({ error: 'Segmento no encontrado' });
      }
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: body as any,
      include: { segment: { select: { id: true, name: true } } },
    });

    return campaign;
  });

  // PATCH /:id/status - Change campaign status (admin+)
  app.patch('/:id/status', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = statusChangeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const { status: newStatus } = parsed.data;
    const tenantId = request.tenantId!;

    const campaign = await prisma.campaign.findFirst({ where: { id, tenantId } });
    if (!campaign) {
      return reply.status(404).send({ error: 'Campaña no encontrada' });
    }

    // Validate transition
    const allowed = ALLOWED_TRANSITIONS[campaign.status] || [];
    if (!allowed.includes(newStatus)) {
      return reply.status(400).send({
        error: `Transición no permitida: ${campaign.status} → ${newStatus}. Transiciones válidas: ${allowed.join(', ') || 'ninguna'}`,
      });
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: newStatus as any },
    });

    return { message: `Campaña actualizada a estado: ${newStatus}`, campaign: updated };
  });

  // GET /:id/stats - Campaign stats (admin+)
  app.get('/:id/stats', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenantId!;

    const campaign = await prisma.campaign.findFirst({
      where: { id, tenantId },
      include: { segment: { select: { name: true } } },
    });
    if (!campaign) {
      return reply.status(404).send({ error: 'Campaña no encontrada' });
    }

    const executions = await prisma.campaignExecution.findMany({
      where: { campaignId: id },
      orderBy: { startedAt: 'desc' },
    });

    // Aggregate stats
    const totals = executions.reduce(
      (acc, ex) => ({
        totalTarget: acc.totalTarget + ex.totalTarget,
        sent: acc.sent + ex.sent,
        delivered: acc.delivered + ex.delivered,
        read: acc.read + ex.read,
        failed: acc.failed + ex.failed,
        responded: acc.responded + ex.responded,
        conversions: acc.conversions + ex.conversions,
      }),
      { totalTarget: 0, sent: 0, delivered: 0, read: 0, failed: 0, responded: 0, conversions: 0 }
    );

    const deliveryRate = totals.sent > 0 ? ((totals.delivered / totals.sent) * 100).toFixed(1) : '0';
    const readRate = totals.delivered > 0 ? ((totals.read / totals.delivered) * 100).toFixed(1) : '0';
    const responseRate = totals.delivered > 0 ? ((totals.responded / totals.delivered) * 100).toFixed(1) : '0';
    const conversionRate = totals.delivered > 0 ? ((totals.conversions / totals.delivered) * 100).toFixed(1) : '0';

    return {
      campaign: { id: campaign.id, name: campaign.name, status: campaign.status, type: campaign.type },
      segment: campaign.segment?.name || null,
      totalExecutions: executions.length,
      totals,
      rates: {
        deliveryRate: `${deliveryRate}%`,
        readRate: `${readRate}%`,
        responseRate: `${responseRate}%`,
        conversionRate: `${conversionRate}%`,
      },
      lastExecution: executions[0] || null,
    };
  });

  // GET /effectiveness - Effectiveness report (admin+)
  app.get('/effectiveness', { preHandler: [requireAdmin()] }, async (request) => {
    const { startDate, endDate } = request.query as Record<string, string>;
    const tenantId = request.tenantId!;

    const where: any = { tenantId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        executions: true,
        segment: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const report = campaigns.map((campaign) => {
      const totals = campaign.executions.reduce(
        (acc, ex) => ({
          sent: acc.sent + ex.sent,
          delivered: acc.delivered + ex.delivered,
          read: acc.read + ex.read,
          conversions: acc.conversions + ex.conversions,
        }),
        { sent: 0, delivered: 0, read: 0, conversions: 0 }
      );

      return {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        segment: campaign.segment?.name || null,
        executions: campaign.executions.length,
        sent: totals.sent,
        delivered: totals.delivered,
        read: totals.read,
        conversions: totals.conversions,
        deliveryRate: totals.sent > 0 ? ((totals.delivered / totals.sent) * 100).toFixed(1) + '%' : '0%',
        conversionRate: totals.delivered > 0 ? ((totals.conversions / totals.delivered) * 100).toFixed(1) + '%' : '0%',
      };
    });

    return { data: report };
  });
}
