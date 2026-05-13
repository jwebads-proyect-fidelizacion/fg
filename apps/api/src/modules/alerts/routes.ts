import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requireAdmin } from '../../middleware/rbac.js';
import prisma from '../../lib/prisma.js';

export async function alertRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);

  // GET / - List alerts (admin+)
  app.get('/', { preHandler: [requireAdmin()] }, async (request) => {
    const { page = '1', limit = '20', unreadOnly } = request.query as Record<string, string>;
    const tenantId = request.tenantId!;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { tenantId };
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const [alerts, total, unreadCount] = await Promise.all([
      prisma.alert.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.alert.count({ where }),
      prisma.alert.count({ where: { tenantId, isRead: false } }),
    ]);

    return {
      data: alerts,
      unreadCount,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  });

  // PATCH /:id/read - Mark alert as read (admin+)
  app.patch('/:id/read', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenantId!;

    const alert = await prisma.alert.findFirst({ where: { id, tenantId } });
    if (!alert) {
      return reply.status(404).send({ error: 'Alerta no encontrada' });
    }
    if (alert.isRead) {
      return reply.status(400).send({ error: 'La alerta ya fue marcada como leída' });
    }

    const updated = await prisma.alert.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    return { message: 'Alerta marcada como leída', alert: updated };
  });
}
