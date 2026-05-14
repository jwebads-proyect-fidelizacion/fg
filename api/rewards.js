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
      const rewards = await db.reward.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { redemptions: true } } },
      });
      return res.status(200).json({ data: rewards });
    }

    if (req.method === 'POST') {
      const { name, pointsCost, stock, startDate, endDate, isActive = true } = req.body || {};
      if (!name || !pointsCost || !startDate || !endDate) {
        return res.status(400).json({ error: 'Nombre, costo en puntos y fechas son requeridos' });
      }

      const reward = await db.reward.create({
        data: {
          tenantId,
          name,
          pointsCost: parseInt(pointsCost),
          stock: stock !== undefined && stock !== null ? parseInt(stock) : null,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          isActive: !!isActive,
        },
      });
      return res.status(201).json(reward);
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('Rewards error:', err);
    return res.status(500).json({ error: 'Error interno', message: err?.message });
  }
}
