import { getPrisma, setCors, requireRole } from '../_lib/auth.js';
import { callAI, isAIEnabled } from '../_lib/ai.js';

const SYSTEM_PROMPT = `Eres un analista de retención de gimnasios experto. Tu tarea es analizar perfiles de socios y predecir su riesgo de abandono.

Para cada socio, responde con un objeto JSON con esta estructura:

{
  "riskScore": number (0-100),
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "topReasons": [array de 2-3 razones principales del riesgo, máximo 80 chars cada una],
  "recommendedActions": [
    {
      "action": "string (acción concreta, ej: 'Llamar para ofrecer 1 mes gratis')",
      "priority": "alta" | "media" | "baja",
      "expectedImpact": "string (impacto esperado, ej: 'Reduce riesgo 40%')"
    }
  ],
  "personalizedMessage": "string (mensaje WhatsApp personalizado de retención, max 250 chars)",
  "estimatedLifetimeValue": "string (valor proyectado si se retiene, ej: '$8,500 MXN/año')",
  "urgencyDays": number (días en los que actuar, 1-30)
}

Considera estos factores:
- Días desde última asistencia
- Frecuencia de asistencia vs promedio histórico
- Pagos pendientes
- Membresía próxima a vencer
- Tiempo como socio
- Patrón de canjes de recompensas
- Edad y antigüedad

Sé directo y específico. Las acciones deben ser ejecutables hoy mismo.`;

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const user = requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  if (!isAIEnabled()) {
    return res.status(503).json({
      error: 'IA no configurada',
      hint: 'Configura OPENAI_API_KEY en las variables de entorno de Vercel',
    });
  }

  try {
    const { memberId } = req.body || {};
    if (!memberId) {
      return res.status(400).json({ error: 'memberId requerido' });
    }

    const db = getPrisma();
    const tenantId = user.tenantId;

    // Get full member profile
    const member = await db.member.findFirst({
      where: { id: memberId, tenantId },
      include: {
        memberships: {
          orderBy: { startDate: 'desc' },
          take: 5,
          include: { plan: true },
        },
        attendances: {
          orderBy: { timestamp: 'desc' },
          take: 30,
          select: { timestamp: true, method: true },
        },
        pointMovements: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        redemptions: {
          orderBy: { redeemedAt: 'desc' },
          take: 5,
          include: { reward: { select: { name: true, pointsCost: true } } },
        },
      },
    });

    if (!member) {
      return res.status(404).json({ error: 'Socio no encontrado' });
    }

    // Build profile summary
    const now = new Date();
    const lastAttendance = member.attendances[0]?.timestamp;
    const daysSinceLastAttendance = lastAttendance
      ? Math.floor((now.getTime() - new Date(lastAttendance).getTime()) / 86400000)
      : null;

    const last30Days = member.attendances.filter(
      (a) => new Date(a.timestamp).getTime() > now.getTime() - 30 * 86400000
    ).length;

    const activeMembership = member.memberships.find((m) => m.status === 'ACTIVE');
    const daysToExpiry = activeMembership
      ? Math.floor((new Date(activeMembership.endDate).getTime() - now.getTime()) / 86400000)
      : null;

    const ageYears = member.dateOfBirth
      ? Math.floor((now.getTime() - new Date(member.dateOfBirth).getTime()) / (365.25 * 86400000))
      : null;

    const memberAgeDays = Math.floor(
      (now.getTime() - new Date(member.createdAt).getTime()) / 86400000
    );

    const profile = {
      nombre: `${member.firstName} ${member.lastName}`,
      edad: ageYears,
      diasComoSocio: memberAgeDays,
      diasSinAsistir: daysSinceLastAttendance,
      asistenciasUltimos30Dias: last30Days,
      totalAsistenciasHistoricas: member.attendances.length,
      membresiaActiva: activeMembership
        ? {
            plan: activeMembership.plan.name,
            precio: activeMembership.plan.price,
            duracionDias: activeMembership.plan.durationDays,
            diasRestantes: daysToExpiry,
          }
        : null,
      historialMembresias: member.memberships.length,
      saldoPuntos: member.pointsBalance,
      canjesRealizados: member.redemptions.length,
      ultimosCanjes: member.redemptions.map((r) => r.reward.name),
      esReferido: member.isReferred,
      consentimientoMarketing: member.marketingConsent,
      optOut: member.optOut,
    };

    const userPrompt = `Analiza este perfil de socio y predice su riesgo de abandono:

${JSON.stringify(profile, null, 2)}

Genera el análisis en formato JSON según el schema indicado.`;

    const analysis = await callAI(SYSTEM_PROMPT, userPrompt, {
      temperature: 0.4,
      maxTokens: 1500,
      jsonMode: true,
    });

    // Update member's risk score in DB
    if (analysis.riskScore !== undefined && analysis.riskLevel) {
      const validLevel = ['LOW', 'MEDIUM', 'HIGH'].includes(analysis.riskLevel)
        ? analysis.riskLevel
        : analysis.riskLevel === 'CRITICAL'
        ? 'HIGH'
        : 'LOW';

      await db.member.update({
        where: { id: memberId },
        data: {
          riskScore: Math.min(100, Math.max(0, analysis.riskScore)),
          riskLevel: validLevel,
          riskScoreDate: new Date(),
        },
      });
    }

    return res.status(200).json({
      success: true,
      member: {
        id: member.id,
        name: profile.nombre,
        currentRiskScore: member.riskScore,
        currentRiskLevel: member.riskLevel,
      },
      analysis,
      profile,
    });
  } catch (err) {
    console.error('AI churn analysis error:', err);
    return res.status(500).json({
      error: 'Error en análisis IA',
      message: err?.message,
    });
  }
}
