import { getPrisma, setCors, requireRole } from '../_lib/auth.js';
import { callAI, isAIEnabled } from '../_lib/ai.js';

const SYSTEM_PROMPT = `Eres un experto en programas de fidelización de gimnasios. Tu tarea es recomendar recompensas personalizadas para cada socio basándote en su comportamiento y perfil.

Responde con un objeto JSON con esta estructura:

{
  "recommendations": [
    {
      "rewardName": "string (nombre de la recompensa, max 80 chars)",
      "pointsCost": number (entre 50 y 1000),
      "category": "experiencia" | "descuento" | "producto" | "exclusivo",
      "matchScore": number (0-100, qué tan bien encaja con el socio),
      "reasoning": "string (por qué esta recompensa, max 150 chars)",
      "expectedEngagement": "string (impacto esperado, ej: 'Aumenta visitas 20%')"
    }
  ],
  "memberInsights": {
    "profile": "string (resumen del socio, max 200 chars)",
    "preferredActivities": [array de strings],
    "engagementLevel": "alto" | "medio" | "bajo",
    "loyaltyStage": "nuevo" | "establecido" | "leal" | "embajador"
  },
  "personalizedOffer": {
    "title": "string (oferta especial, max 60 chars)",
    "message": "string (mensaje WhatsApp con la oferta, max 250 chars, usar {{firstName}})",
    "validityDays": number (días de vigencia, 7-30)
  }
}

IMPORTANTE:
- Genera 4-6 recomendaciones diversas en categoría
- Las recompensas deben tener costo proporcional al saldo del socio
- Personalizar según género (si es inferible del nombre), edad, patrón de visitas
- El mensaje de oferta debe ser cálido y específico
- Considera la etapa de fidelización del socio`;

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

    const member = await db.member.findFirst({
      where: { id: memberId, tenantId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { plan: true },
          take: 1,
        },
        attendances: {
          orderBy: { timestamp: 'desc' },
          take: 30,
        },
        redemptions: {
          orderBy: { redeemedAt: 'desc' },
          take: 5,
          include: { reward: true },
        },
        pointMovements: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!member) {
      return res.status(404).json({ error: 'Socio no encontrado' });
    }

    // Get available rewards in tenant for context
    const availableRewards = await db.reward.findMany({
      where: { tenantId, isActive: true },
      orderBy: { pointsCost: 'asc' },
    });

    const now = new Date();
    const ageYears = member.dateOfBirth
      ? Math.floor((now.getTime() - new Date(member.dateOfBirth).getTime()) / (365.25 * 86400000))
      : null;

    // Analyze attendance pattern
    const attendanceHours = member.attendances.map((a) => new Date(a.timestamp).getHours());
    const avgHour = attendanceHours.length > 0
      ? Math.round(attendanceHours.reduce((a, b) => a + b, 0) / attendanceHours.length)
      : null;

    const attendanceDays = member.attendances.map((a) => {
      const day = new Date(a.timestamp).getDay();
      return ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][day];
    });

    const profile = {
      nombre: member.firstName,
      edad: ageYears,
      saldoPuntos: member.pointsBalance,
      asistenciasRecientes: member.attendances.length,
      horarioPreferido: avgHour ? `~${avgHour}:00 hrs` : 'desconocido',
      diasMasFrecuentes: [...new Set(attendanceDays)].slice(0, 3),
      planActual: member.memberships[0]?.plan.name,
      diasComoSocio: Math.floor(
        (now.getTime() - new Date(member.createdAt).getTime()) / 86400000
      ),
      canjesAnteriores: member.redemptions.map((r) => ({
        recompensa: r.reward.name,
        costoPuntos: r.pointsSpent,
      })),
    };

    const userPrompt = `Genera recomendaciones de recompensas para este socio:

${JSON.stringify(profile, null, 2)}

Recompensas disponibles actualmente en el gimnasio:
${availableRewards.map((r) => `- ${r.name} (${r.pointsCost} pts, stock: ${r.stock ?? 'ilimitado'})`).join('\n') || 'ninguna'}

Genera la respuesta en formato JSON según el schema indicado. Las recomendaciones pueden ser nuevas (no necesariamente de las disponibles).`;

    const recommendations = await callAI(SYSTEM_PROMPT, userPrompt, {
      temperature: 0.8,
      maxTokens: 2000,
      jsonMode: true,
    });

    return res.status(200).json({
      success: true,
      member: {
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        pointsBalance: member.pointsBalance,
      },
      ...recommendations,
    });
  } catch (err) {
    console.error('AI reward recommendations error:', err);
    return res.status(500).json({
      error: 'Error generando recomendaciones',
      message: err?.message,
    });
  }
}
