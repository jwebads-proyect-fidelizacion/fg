import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requireAdmin, requireAny } from '../../middleware/rbac.js';
import prisma from '../../lib/prisma.js';
import { z } from 'zod';

const createPaymentSchema = z.object({
  membershipId: z.string().uuid('ID de membresía inválido'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  currency: z.string().length(3).default('MXN'),
  paymentDate: z.coerce.date().optional(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'DEBIT_CARD', 'CREDIT_CARD', 'OTHER'], {
    errorMap: () => ({ message: 'Método de pago inválido' }),
  }),
  status: z.enum(['PAID', 'PENDING']).default('PAID'),
});

const voidPaymentSchema = z.object({
  reason: z.string().min(5, 'La razón debe tener al menos 5 caracteres').max(500, 'La razón no puede exceder 500 caracteres'),
});

export async function paymentRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);

  // POST / - Register payment (all roles)
  app.post('/', { preHandler: [requireAny()] }, async (request, reply) => {
    const parsed = createPaymentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const body = parsed.data;
    const tenantId = request.tenantId!;

    // Verify membership exists and belongs to tenant
    const membership = await prisma.membership.findFirst({
      where: { id: body.membershipId, tenantId },
    });
    if (!membership) {
      return reply.status(404).send({ error: 'Membresía no encontrada' });
    }

    const payment = await prisma.payment.create({
      data: {
        tenantId,
        membershipId: body.membershipId,
        amount: body.amount,
        currency: body.currency,
        paymentDate: body.paymentDate || new Date(),
        method: body.method,
        status: body.status,
      },
      include: {
        membership: { include: { member: { select: { firstName: true, lastName: true } }, plan: true } },
      },
    });

    // Award points for payment if rule exists
    try {
      const pointRule = await prisma.pointRule.findUnique({
        where: { tenantId_event: { tenantId, event: 'PAYMENT' } },
      });
      if (pointRule && pointRule.isEnabled && body.status === 'PAID') {
        const member = await prisma.member.findUnique({ where: { id: membership.memberId } });
        if (member) {
          const newBalance = member.pointsBalance + pointRule.points;
          await prisma.$transaction([
            prisma.member.update({
              where: { id: member.id },
              data: { pointsBalance: newBalance },
            }),
            prisma.pointMovement.create({
              data: {
                tenantId,
                memberId: member.id,
                type: 'EARN',
                points: pointRule.points,
                balance: newBalance,
                event: 'PAYMENT',
                referenceId: payment.id,
              },
            }),
          ]);
        }
      }
    } catch {
      // Points award failure should not block payment creation
    }

    return reply.status(201).send(payment);
  });

  // PATCH /:id/void - Void payment (admin+)
  app.patch('/:id/void', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = voidPaymentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const { reason } = parsed.data;
    const tenantId = request.tenantId!;

    const payment = await prisma.payment.findFirst({ where: { id, tenantId } });
    if (!payment) {
      return reply.status(404).send({ error: 'Pago no encontrado' });
    }
    if (payment.isVoided) {
      return reply.status(400).send({ error: 'El pago ya fue anulado' });
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        isVoided: true,
        voidedAt: new Date(),
        voidedBy: request.user!.userId,
        voidReason: reason,
      },
    });

    return { message: 'Pago anulado exitosamente', payment: updated };
  });

  // GET /export - Export payments CSV (admin+)
  app.get('/export', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { startDate, endDate, method } = request.query as Record<string, string>;
    const tenantId = request.tenantId!;

    const where: any = { tenantId, isVoided: false };
    if (startDate) {
      where.paymentDate = { ...where.paymentDate, gte: new Date(startDate) };
    }
    if (endDate) {
      where.paymentDate = { ...where.paymentDate, lte: new Date(endDate) };
    }
    if (method) {
      where.method = method;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        membership: {
          include: {
            member: { select: { firstName: true, lastName: true, phone: true } },
            plan: { select: { name: true } },
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    // Generate CSV
    const csvHeaders = 'Fecha,Socio,Teléfono,Plan,Monto,Moneda,Método,Estado';
    const csvRows = payments.map((p) => {
      const member = p.membership.member;
      return [
        p.paymentDate.toISOString().split('T')[0],
        `${member.firstName} ${member.lastName}`,
        member.phone,
        p.membership.plan.name,
        p.amount.toString(),
        p.currency,
        p.method,
        p.status,
      ].join(',');
    });

    const csv = [csvHeaders, ...csvRows].join('\n');

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="pagos_${new Date().toISOString().split('T')[0]}.csv"`);
    return reply.send(csv);
  });
}
