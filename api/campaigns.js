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
      const campaigns = await db.campaign.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        include: {
          segment: { select: { id: true, name: true } },
          _count: { select: { executions: true } },
        },
      });
      return res.status(200).json({ data: campaigns, pagination: { total: campaigns.length } });
    }

    if (req.method === 'POST') {
      const {
        name, objective, type, segmentId, templateName,
        templateLanguage = 'es', frequency, startAt, endAt,
        attributionDays = 7, config,
      } = req.body || {};

      if (!name || !objective || !type || !templateName || !frequency || !startAt) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
      }

      const campaign = await db.campaign.create({
        data: {
          tenantId,
          name,
          objective,
          type,
          segmentId: segmentId || null,
          templateName,
          templateLanguage,
          frequency,
          startAt: new Date(startAt),
          endAt: endAt ? new Date(endAt) : null,
          attributionDays: parseInt(attributionDays),
          config: config || null,
          status: 'DRAFT',
        },
      });
      return res.status(201).json(campaign);
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('Campaigns error:', err);
    return res.status(500).json({ error: 'Error interno', message: err?.message });
  }
}
