import { getPrisma, setCors, requireRole } from '../_lib/auth.js';
import { callAI, isAIEnabled } from '../_lib/ai.js';

const SYSTEM_PROMPT = `Eres un experto en marketing y fidelización de gimnasios. Tu tarea es ayudar a crear campañas de WhatsApp efectivas.

Cuando el usuario describa una campaña en lenguaje natural, debes responder con un objeto JSON con esta estructura exacta:

{
  "campaignName": "string (nombre corto y descriptivo, max 50 chars)",
  "objective": "string (descripción del objetivo, max 200 chars)",
  "campaignType": "REMINDER" | "BIRTHDAY" | "RENEWAL" | "PROMO" | "REFERRAL" | "NPS" | "CUSTOM",
  "segmentName": "string (nombre del segmento)",
  "segmentCriteria": {
    "lastAttendanceDaysAgo": number opcional (días sin asistir),
    "membershipStatus": "ACTIVE" | "EXPIRED" | "CANCELLED" opcional,
    "minAge": number opcional,
    "maxAge": number opcional,
    "riskLevel": "LOW" | "MEDIUM" | "HIGH" opcional,
    "tags": [array de strings] opcional
  },
  "messageVariants": [
    {
      "tone": "formal" | "casual" | "motivador" | "urgencia",
      "message": "string (mensaje WhatsApp con personalización {{firstName}}, max 300 chars)",
      "predictedConversion": "string (% estimado, ej: '18-25%')"
    }
  ],
  "bestSendTime": {
    "dayOfWeek": "Lunes" | "Martes" | ... | "Domingo",
    "hour": "string (ej: '10:00')",
    "reasoning": "string (por qué esta hora)"
  },
  "expectedResults": {
    "predictedReach": "string (rango ej: '40-60 socios')",
    "predictedConversion": "string (% ej: '25-35%')",
    "expectedRevenue": "string (estimación en MXN, ej: '$3,000-$5,000')"
  },
  "tips": ["array de 2-3 tips estratégicos cortos"]
}

IMPORTANTE:
- Usa siempre español mexicano natural
- Los mensajes deben ser cálidos pero profesionales
- Personaliza con {{firstName}} cuando sea apropiado
- Incluye 3 variantes de mensaje con tonos diferentes
- Las predicciones deben ser realistas (no exagerar)
- Los criterios deben ser implementables con los campos disponibles`;

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
    const { description } = req.body || {};
    if (!description || description.trim().length < 10) {
      return res.status(400).json({
        error: 'Describe la campaña con al menos 10 caracteres',
      });
    }

    const db = getPrisma();
    const tenantId = user.tenantId;

    // Get context: total members, recent campaigns, etc.
    const [totalMembers, activeMemberships, recentCampaigns] = await Promise.all([
      db.member.count({ where: { tenantId, isActive: true } }),
      db.membership.count({ where: { tenantId, status: 'ACTIVE' } }),
      db.campaign.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { name: true, type: true, status: true },
      }),
    ]);

    const userPrompt = `Contexto del gimnasio:
- Total socios activos: ${totalMembers}
- Membresías activas: ${activeMemberships}
- Campañas recientes: ${recentCampaigns.map((c) => `${c.name} (${c.type})`).join(', ') || 'ninguna'}

Petición del administrador:
"${description}"

Genera la propuesta de campaña en formato JSON.`;

    const result = await callAI(SYSTEM_PROMPT, userPrompt, {
      temperature: 0.7,
      maxTokens: 2000,
      jsonMode: true,
    });

    return res.status(200).json({
      success: true,
      proposal: result,
      context: {
        totalMembers,
        activeMemberships,
      },
    });
  } catch (err) {
    console.error('AI campaign assistant error:', err);
    return res.status(500).json({
      error: 'Error generando propuesta IA',
      message: err?.message,
    });
  }
}
