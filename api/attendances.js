import { getPrisma, setCors, requireAuth } from './_lib/auth.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  const db = getPrisma();
  const tenantId = user.tenantId;

  try {
    if (req.method === 'POST') {
      const { memberId, qrCode } = req.body || {};

      let member;
      if (memberId) {
        member = await db.member.findFirst({ where: { id: memberId, tenantId, isActive: true } });
      } else if (qrCode) {
        member = await db.member.findFirst({ where: { qrCode, tenantId, isActive: true } });
      } else {
        return res.status(400).json({ error: 'memberId o qrCode requerido' });
      }

      if (!member) {
        return res.status(404).json({ error: 'Socio no encontrado o inactivo' });
      }

      // Dedup: check 30 min window
      const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
      const windowMinutes = tenant?.attendanceWindowMinutes || 30;
      const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

      const recent = await db.attendance.findFirst({
        where: { tenantId, memberId: member.id, timestamp: { gte: windowStart } },
      });
      if (recent) {
        return res.status(409).json({
          error: `Ya se registró asistencia en los últimos ${windowMinutes} minutos`,
        });
      }

      const attendance = await db.attendance.create({
        data: {
          tenantId,
          memberId: member.id,
          timestamp: new Date(),
          method: qrCode ? 'QR' : 'MANUAL',
        },
      });

      return res.status(201).json({
        ...attendance,
        member: { firstName: member.firstName, lastName: member.lastName },
      });
    }

    if (req.method === 'GET') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const attendances = await db.attendance.findMany({
        where: { tenantId, timestamp: { gte: today } },
        orderBy: { timestamp: 'desc' },
        include: { member: { select: { firstName: true, lastName: true } } },
        take: 50,
      });
      return res.status(200).json({ data: attendances });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('Attendance error:', err);
    return res.status(500).json({ error: 'Error interno', message: err?.message });
  }
}
