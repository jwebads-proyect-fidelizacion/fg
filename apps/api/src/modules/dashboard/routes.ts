import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requireAdmin } from '../../middleware/rbac.js';
import prisma from '../../lib/prisma.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);

  // GET / - Get dashboard metrics (owner/admin)
  app.get('/', { preHandler: [requireAdmin()] }, async (request) => {
    const tenantId = request.tenantId!;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Active members (with active membership)
    const activeMembers = await prisma.membership.groupBy({
      by: ['memberId'],
      where: { tenantId, status: 'ACTIVE', endDate: { gte: now } },
    });
    const activeMemberCount = activeMembers.length;

    // Total members
    const totalMembers = await prisma.member.count({ where: { tenantId, isActive: true } });

    // New members (last 30 days)
    const newMembers = await prisma.member.count({
      where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
    });

    // New members previous period (for comparison)
    const newMembersPrev = await prisma.member.count({
      where: { tenantId, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    });

    // Retention rate: members who had membership last month and renewed/still active
    const membershipsLastMonth = await prisma.membership.findMany({
      where: {
        tenantId,
        endDate: { gte: thirtyDaysAgo, lte: now },
      },
      select: { memberId: true },
    });
    const lastMonthMemberIds = [...new Set(membershipsLastMonth.map((m) => m.memberId))];

    let retentionRate = 0;
    if (lastMonthMemberIds.length > 0) {
      const renewed = await prisma.membership.groupBy({
        by: ['memberId'],
        where: {
          tenantId,
          memberId: { in: lastMonthMemberIds },
          status: 'ACTIVE',
          endDate: { gte: now },
        },
      });
      retentionRate = Math.round((renewed.length / lastMonthMemberIds.length) * 100);
    }

    // Churn: members whose membership expired and didn't renew
    const churnCount = lastMonthMemberIds.length > 0
      ? lastMonthMemberIds.length - (retentionRate * lastMonthMemberIds.length / 100)
      : 0;
    const churnRate = lastMonthMemberIds.length > 0
      ? 100 - retentionRate
      : 0;

    // At-risk members (HIGH risk level)
    const atRiskMembers = await prisma.member.count({
      where: { tenantId, isActive: true, riskLevel: 'HIGH' },
    });

    // Average attendance (last 30 days)
    const attendanceLast30 = await prisma.attendance.count({
      where: { tenantId, timestamp: { gte: thirtyDaysAgo } },
    });
    const avgAttendancePerMember = activeMemberCount > 0
      ? Math.round((attendanceLast30 / activeMemberCount) * 10) / 10
      : 0;

    // Revenue this month
    const revenueThisMonth = await prisma.payment.aggregate({
      where: {
        tenantId,
        paymentDate: { gte: startOfMonth },
        status: 'PAID',
        isVoided: false,
      },
      _sum: { amount: true },
    });

    // Revenue last month (for projected)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const revenueLastMonth = await prisma.payment.aggregate({
      where: {
        tenantId,
        paymentDate: { gte: startOfLastMonth, lte: endOfLastMonth },
        status: 'PAID',
        isVoided: false,
      },
      _sum: { amount: true },
    });

    // Projected revenue: extrapolate current month based on days elapsed
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentRevenue = Number(revenueThisMonth._sum.amount || 0);
    const projectedRevenue = dayOfMonth > 0
      ? Math.round((currentRevenue / dayOfMonth) * daysInMonth * 100) / 100
      : 0;

    // Attendance today
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const attendanceToday = await prisma.attendance.count({
      where: { tenantId, timestamp: { gte: startOfToday } },
    });

    return {
      members: {
        total: totalMembers,
        active: activeMemberCount,
        new: newMembers,
        newPreviousPeriod: newMembersPrev,
        atRisk: atRiskMembers,
      },
      retention: {
        rate: retentionRate,
        churnRate: Math.round(churnRate),
        churnCount: Math.round(churnCount),
      },
      attendance: {
        today: attendanceToday,
        last30Days: attendanceLast30,
        avgPerMember: avgAttendancePerMember,
      },
      revenue: {
        currentMonth: currentRevenue,
        lastMonth: Number(revenueLastMonth._sum.amount || 0),
        projected: projectedRevenue,
        currency: 'MXN',
      },
      generatedAt: now.toISOString(),
    };
  });

  // GET /export - Export metrics CSV/PDF (owner/admin)
  app.get('/export', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { format = 'csv', startDate, endDate } = request.query as Record<string, string>;
    const tenantId = request.tenantId!;

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();

    // Get payments in range
    const payments = await prisma.payment.findMany({
      where: {
        tenantId,
        paymentDate: { gte: start, lte: end },
        isVoided: false,
      },
      include: {
        membership: {
          include: {
            member: { select: { firstName: true, lastName: true } },
            plan: { select: { name: true } },
          },
        },
      },
      orderBy: { paymentDate: 'asc' },
    });

    // Get attendance in range
    const attendances = await prisma.attendance.count({
      where: { tenantId, timestamp: { gte: start, lte: end } },
    });

    // Get new members in range
    const newMembers = await prisma.member.count({
      where: { tenantId, createdAt: { gte: start, lte: end } },
    });

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    if (format === 'csv') {
      const csvHeaders = 'Métrica,Valor';
      const csvRows = [
        `Período,${start.toISOString().split('T')[0]} a ${end.toISOString().split('T')[0]}`,
        `Ingresos Totales,${totalRevenue.toFixed(2)}`,
        `Total Pagos,${payments.length}`,
        `Asistencias,${attendances}`,
        `Nuevos Socios,${newMembers}`,
        '',
        'Detalle de Pagos',
        'Fecha,Socio,Plan,Monto,Método',
        ...payments.map((p) =>
          [
            p.paymentDate.toISOString().split('T')[0],
            `${p.membership.member.firstName} ${p.membership.member.lastName}`,
            p.membership.plan.name,
            Number(p.amount).toFixed(2),
            p.method,
          ].join(',')
        ),
      ];

      const csv = [csvHeaders, ...csvRows].join('\n');
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="reporte_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}.csv"`);
      return reply.send(csv);
    }

    // JSON format as fallback (PDF generation would require a library)
    return {
      period: { start: start.toISOString(), end: end.toISOString() },
      summary: {
        totalRevenue,
        totalPayments: payments.length,
        totalAttendances: attendances,
        newMembers,
      },
      payments: payments.map((p) => ({
        date: p.paymentDate,
        member: `${p.membership.member.firstName} ${p.membership.member.lastName}`,
        plan: p.membership.plan.name,
        amount: Number(p.amount),
        method: p.method,
      })),
    };
  });
}
