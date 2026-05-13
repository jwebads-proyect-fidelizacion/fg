import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requireAny } from '../../middleware/rbac.js';
import prisma from '../../lib/prisma.js';
import { z } from 'zod';

const manualAttendanceSchema = z.object({
  memberId: z.string().uuid('ID de socio inválido'),
  timestamp: z.coerce.date().optional(),
});

const qrAttendanceSchema = z.object({
  qrCode: z.string().min(1, 'Código QR requerido'),
});

export async function attendanceRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);

  // POST / - Register attendance manually (all roles)
  app.post('/', { preHandler: [requireAny()] }, async (request, reply) => {
    const parsed = manualAttendanceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const { memberId, timestamp } = parsed.data;
    const tenantId = request.tenantId!;

    // Verify member exists and is active
    const member = await prisma.member.findFirst({ where: { id: memberId, tenantId, isActive: true } });
    if (!member) {
      return reply.status(404).send({ error: 'Socio no encontrado o inactivo' });
    }

    // Check active membership
    const activeMembership = await prisma.membership.findFirst({
      where: { memberId, tenantId, status: 'ACTIVE', endDate: { gte: new Date() } },
    });
    if (!activeMembership) {
      return reply.status(400).send({ error: 'El socio no tiene una membresía activa vigente' });
    }

    // Deduplication: check attendance window from tenant config
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const windowMinutes = tenant?.attendanceWindowMinutes || 30;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const recentAttendance = await prisma.attendance.findFirst({
      where: {
        tenantId,
        memberId,
        timestamp: { gte: windowStart },
      },
    });
    if (recentAttendance) {
      return reply.status(409).send({
        error: `Ya se registró asistencia en los últimos ${windowMinutes} minutos`,
      });
    }

    const attendance = await prisma.attendance.create({
      data: {
        tenantId,
        memberId,
        timestamp: timestamp || new Date(),
        method: 'MANUAL',
      },
    });

    // Award points for attendance
    await awardAttendancePoints(tenantId, memberId);

    return reply.status(201).send({
      ...attendance,
      member: { firstName: member.firstName, lastName: member.lastName },
    });
  });

  // POST /qr - Register attendance by QR (all roles)
  app.post('/qr', { preHandler: [requireAny()] }, async (request, reply) => {
    const parsed = qrAttendanceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const { qrCode } = parsed.data;
    const tenantId = request.tenantId!;

    // Find member by QR code
    const member = await prisma.member.findFirst({
      where: { qrCode, tenantId, isActive: true },
    });
    if (!member) {
      return reply.status(404).send({ error: 'Código QR no válido o socio inactivo' });
    }

    // Check active membership
    const activeMembership = await prisma.membership.findFirst({
      where: { memberId: member.id, tenantId, status: 'ACTIVE', endDate: { gte: new Date() } },
    });
    if (!activeMembership) {
      return reply.status(400).send({ error: 'El socio no tiene una membresía activa vigente' });
    }

    // Deduplication window
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const windowMinutes = tenant?.attendanceWindowMinutes || 30;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const recentAttendance = await prisma.attendance.findFirst({
      where: {
        tenantId,
        memberId: member.id,
        timestamp: { gte: windowStart },
      },
    });
    if (recentAttendance) {
      return reply.status(409).send({
        error: `Ya se registró asistencia en los últimos ${windowMinutes} minutos`,
      });
    }

    const attendance = await prisma.attendance.create({
      data: {
        tenantId,
        memberId: member.id,
        timestamp: new Date(),
        method: 'QR',
      },
    });

    // Award points for attendance
    await awardAttendancePoints(tenantId, member.id);

    return reply.status(201).send({
      ...attendance,
      member: { firstName: member.firstName, lastName: member.lastName },
    });
  });
}

async function awardAttendancePoints(tenantId: string, memberId: string): Promise<void> {
  try {
    const pointRule = await prisma.pointRule.findUnique({
      where: { tenantId_event: { tenantId, event: 'ATTENDANCE' } },
    });
    if (pointRule && pointRule.isEnabled) {
      const member = await prisma.member.findUnique({ where: { id: memberId } });
      if (member) {
        const newBalance = member.pointsBalance + pointRule.points;
        await prisma.$transaction([
          prisma.member.update({
            where: { id: memberId },
            data: { pointsBalance: newBalance },
          }),
          prisma.pointMovement.create({
            data: {
              tenantId,
              memberId,
              type: 'EARN',
              points: pointRule.points,
              balance: newBalance,
              event: 'ATTENDANCE',
            },
          }),
        ]);
      }
    }
  } catch {
    // Points failure should not block attendance registration
  }
}
