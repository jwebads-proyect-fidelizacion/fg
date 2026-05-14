import { getPrisma, setCors, requireRole } from '../_lib/auth.js';
import { callAI, isAIEnabled } from '../_lib/ai.js';

const SYSTEM_PROMPT = `Eres un consultor de negocios experto en gimnasios. Analiza las métricas globales y genera insights ejecutivos accionables.

Responde con un objeto JSON con esta estructura:

{
  "summary": "string (resumen ejecutivo del estado del gimnasio, 2-3 oraciones, max 300 chars)",
  "healthScore": number (0-100, salud general del negocio),
  "strengths": [array de 2-3 fortalezas detectadas, max 100 chars cada una],
  "concerns": [array de 2-3 puntos de atención, max 100 chars cada uno],
  "opportunities": [
    {
      "title": "string (oportunidad detectada, max 80 chars)",
      "description": "string (max 200 chars)",
      "expectedImpact": "string (impacto en MXN o %, ej: '+$15,000/mes')",
      "priority": "alta" | "media" | "baja",
      "actionType": "campaña" | "recompensa" | "operativo" | "marketing"
    }
  ],
  "predictions": {
    "nextMonthRevenue": "string (rango ej: '$45,000-$55,000')",
    "churnRisk": "string (% socios en riesgo, ej: '12-18%')",
    "growthOpportunity": "string (% crecimiento posible, ej: '+15-25%')"
  },
  "topPriority": {
    "action": "string (acción más importante a tomar HOY)",
    "rationale": "string (por qué es prioridad #1)"
  }
}

Sé directo, concreto y orientado a la acción. Habla como un consultor experimentado.`;

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const user = requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  if (!isAIEnabled()) {
    return res.status(503).json({
      error: 'IA no configurada',
      hint: 'Configura OPENAI_API_KEY en las variables de entorno de Vercel',
    });
  }

  try {
    const db = getPrisma();
    const tenantId = user.tenantId;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      activeMemberships,
      totalMembers,
      newMembers,
      atRiskMembers,
      attendanceLast30,
      revenueThisMonth,
      revenueLastMonth,
      activeCampaigns,
      pointMovements,
      redemptions,
      avgPlan,
    ] = await Promise.all([
      db.membership.count({ where: { tenantId, status: 'ACTIVE' } }),
      db.member.count({ where: { tenantId, isActive: true } }),
      db.member.count({ where: { tenantId, createdAt: { gte: thirtyDaysAgo } } }),
      db.member.count({ where: { tenantId, isActive: true, riskLevel: 'HIGH' } }),
      db.attendance.count({ where: { tenantId, timestamp: { gte: thirtyDaysAgo } } }),
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
      db.campaign.count({ where: { tenantId, status: { in: ['RUNNING', 'SCHEDULED'] } } }),
      db.pointMovement.count({ where: { tenantId, createdAt: { gte: thirtyDaysAgo } } }),
      db.redemption.count({ where: { tenantId, redeemedAt: { gte: thirtyDaysAgo } } }),
      db.plan.aggregate({
        where: { tenantId, isArchived: false },
        _avg: { price: true },
      }),
    ]);

    const metrics = {
      sociosActivos: totalMembers,
      membresiasActivas: activeMemberships,
      nuevosSocios30Dias: newMembers,
      sociosEnRiesgoAlto: atRiskMembers,
      asistencias30Dias: attendanceLast30,
      asistenciasPromedioPorSocio: totalMembers > 0
        ? Math.round((attendanceLast30 / totalMembers) * 10) / 10
        : 0,
      ingresosMesActual: Number(revenueThisMonth._sum.amount || 0),
      ingresosMesAnterior: Number(revenueLastMonth._sum.amount || 0),
      campanasActivas: activeCampaigns,
      movimientosPuntos30Dias: pointMovements,
      canjesRecompensas30Dias: redemptions,
      precioPromedioPlan: Number(avgPlan._avg.price || 0),
    };

    const userPrompt = `Analiza estas métricas del gimnasio y genera insights ejecutivos:

${JSON.stringify(metrics, null, 2)}

Genera la respuesta en formato JSON según el schema indicado.`;

    const insights = await callAI(SYSTEM_PROMPT, userPrompt, {
      temperature: 0.5,
      maxTokens: 2000,
      jsonMode: true,
    });

    return res.status(200).json({
      success: true,
      generatedAt: now.toISOString(),
      metrics,
      insights,
    });
  } catch (err) {
    console.error('AI insights error:', err);
    return res.status(500).json({
      error: 'Error generando insights',
      message: err?.message,
    });
  }
}
