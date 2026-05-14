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
      const segments = await db.segment.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { campaigns: true } } },
      });
      return res.status(200).json({ data: segments });
    }

    if (req.method === 'POST') {
      const { name, criteria } = req.body || {};
      if (!name) return res.status(400).json({ error: 'Nombre requerido' });

      const segment = await db.segment.create({
        data: { tenantId, name, criteria: criteria || {} },
      });
      return res.status(201).json(segment);
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('Segments error:', err);
    return res.status(500).json({ error: 'Error interno', message: err?.message });
  }
}
