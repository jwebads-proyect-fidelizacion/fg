import { getPrisma, setCors, requireRole } from './_lib/auth.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const user = requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  try {
    const db = getPrisma();
    const tenantId = user.tenantId;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      activeMemberships,
      totalMembers,
      newMembers,
      newMembersPrev,
      atRiskMembers,
      attendanceLast30,
      attendanceToday,
      revenueThisMonth,
      revenueLastMonth,
    ] = await Promise.all([
      db.membership.findMany({
        where: { tenantId, status: 'ACTIVE', endDate: { gte: now } },
        select: { memberId: true },
        distinct: ['memberId'],
      }),
      db.member.count({ where: { tenantId, isActive: true } }),
      db.member.count({ where: { tenantId, createdAt: { gte: thirtyDaysAgo } } }),
      db.member.count({ where: { tenantId, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
      db.member.count({ where: { tenantId, isActive: true, riskLevel: 'HIGH' } }),
      db.attendance.count({ where: { tenantId, timestamp: { gte: thirtyDaysAgo } } }),
      db.attendance.count({ where: { tenantId, timestamp: { gte: startOfToday } } }),
      db.payment.aggregate({
        where: { tenantId, paymentDate: { gte: startOfMonth }, status: 'PAID', isVoided: false },
        _sum: { amount: true },
      }),
      db.payment.aggregate({
        where: {
          tenantId,
          paymentDate: { gte: startOfLastMonth, lte: endOfLastMonth },
          status: 'PAID',
          isVoided: false,
        },
        _sum: { amount: true },
      }),
    ]);

    const activeMemberCount = activeMemberships.length;
    const avgAttendancePerMember = activeMemberCount > 0
      ? Math.round((attendanceLast30 / activeMemberCount) * 10) / 10
      : 0;
    const currentRevenue = Number(revenueThisMonth._sum.amount || 0);
    const lastMonthRev = Number(revenueLastMonth._sum.amount || 0);
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedRevenue = dayOfMonth > 0
      ? Math.round((currentRevenue / dayOfMonth) * daysInMonth * 100) / 100
      : 0;

    return res.status(200).json({
      members: {
        total: totalMembers,
        active: activeMemberCount,
        new: newMembers,
        newPreviousPeriod: newMembersPrev,
        atRisk: atRiskMembers,
      },
      retention: {
        rate: 0,
        churnRate: 0,
        churnCount: 0,
      },
      attendance: {
        today: attendanceToday,
        last30Days: attendanceLast30,
        avgPerMember: avgAttendancePerMember,
      },
      revenue: {
        currentMonth: currentRevenue,
        lastMonth: lastMonthRev,
        projected: projectedRevenue,
        currency: 'MXN',
      },
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: 'Error interno', message: err?.message });
  }
}
