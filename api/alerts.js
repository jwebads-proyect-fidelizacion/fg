import { getPrisma, setCors, requireRole } from './_lib/auth.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  const db = getPrisma();
  const tenantId = user.tenantId;

  try {
    if (req.method === 'GET') {
      const alerts = await db.alert.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      const unreadCount = await db.alert.count({ where: { tenantId, isRead: false } });
      return res.status(200).json({ data: alerts, unreadCount });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('Alerts error:', err);
    return res.status(500).json({ error: 'Error interno', message: err?.message });
  }
}
