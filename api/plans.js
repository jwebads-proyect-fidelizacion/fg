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
      const plans = await db.plan.findMany({
        where: { tenantId, isArchived: false },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { memberships: { where: { status: 'ACTIVE' } } } },
        },
      });
      return res.status(200).json({ data: plans });
    }

    if (req.method === 'POST') {
      const { name, description, durationDays, price, currency = 'MXN' } = req.body || {};
      if (!name || !durationDays || price === undefined) {
        return res.status(400).json({ error: 'Nombre, duración y precio son requeridos' });
      }

      const plan = await db.plan.create({
        data: {
          tenantId,
          name,
          description: description || null,
          durationDays: parseInt(durationDays),
          price: parseFloat(price),
          currency,
        },
      });
      return res.status(201).json(plan);
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('Plans error:', err);
    return res.status(500).json({ error: 'Error interno', message: err?.message });
  }
}
