import { getPrisma, setCors, requireAuth } from './_lib/auth.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  const db = getPrisma();
  const tenantId = user.tenantId;

  try {
    if (req.method === 'GET') {
      const payments = await db.payment.findMany({
        where: { tenantId },
        orderBy: { paymentDate: 'desc' },
        take: 100,
        include: {
          membership: {
            include: {
              member: { select: { firstName: true, lastName: true } },
              plan: { select: { name: true } },
            },
          },
        },
      });
      return res.status(200).json({ data: payments });
    }

    if (req.method === 'POST') {
      const { membershipId, amount, currency = 'MXN', paymentDate, method, status = 'PAID' } = req.body || {};
      if (!membershipId || !amount || !method) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
      }

      const payment = await db.payment.create({
        data: {
          tenantId,
          membershipId,
          amount: parseFloat(amount),
          currency,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          method,
          status,
        },
      });
      return res.status(201).json(payment);
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('Payments error:', err);
    return res.status(500).json({ error: 'Error interno', message: err?.message });
  }
}
