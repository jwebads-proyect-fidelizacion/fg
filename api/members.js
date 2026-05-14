import { getPrisma, setCors, requireAuth, requireRole } from './_lib/auth.js';

function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  const db = getPrisma();
  const tenantId = user.tenantId;

  try {
    if (req.method === 'GET') {
      const { search = '', page = '1', limit = '20', active } = req.query || {};
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const skip = (pageNum - 1) * limitNum;

      const where = { tenantId };
      if (active !== undefined) where.isActive = active === 'true';
      if (search && search.trim()) {
        const term = search.trim();
        where.OR = [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term } },
          { email: { contains: term, mode: 'insensitive' } },
        ];
      }

      const [members, total] = await Promise.all([
        db.member.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
          include: {
            memberships: {
              where: { status: 'ACTIVE' },
              include: { plan: true },
              take: 1,
            },
          },
        }),
        db.member.count({ where }),
      ]);

      return res.status(200).json({
        data: members,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }

    if (req.method === 'POST') {
      const adminUser = requireRole(req, res, ['OWNER', 'ADMIN']);
      if (!adminUser) return;

      const body = req.body || {};
      const { firstName, lastName, phone, email, dateOfBirth, marketingConsent } = body;

      if (!firstName || !lastName || !phone) {
        return res.status(400).json({ error: 'Nombre, apellido y teléfono son requeridos' });
      }

      const existing = await db.member.findUnique({
        where: { tenantId_phone: { tenantId, phone } },
      });
      if (existing) {
        return res.status(409).json({ error: 'Ya existe un socio con este teléfono' });
      }

      const member = await db.member.create({
        data: {
          tenantId,
          firstName,
          lastName,
          phone,
          email: email || null,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          marketingConsent: !!marketingConsent,
          marketingConsentDate: marketingConsent ? new Date() : null,
          marketingConsentChannel: marketingConsent ? 'REGISTRATION' : null,
          referralCode: generateReferralCode(),
        },
      });

      return res.status(201).json(member);
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('Members error:', err);
    return res.status(500).json({ error: 'Error interno', message: err?.message });
  }
}
