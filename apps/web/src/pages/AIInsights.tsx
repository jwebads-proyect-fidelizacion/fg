import { useState } from 'react';
import {
  Sparkles,
  Brain,
  TrendingUp,
  AlertTriangle,
  Target,
  Lightbulb,
  Loader2,
  Wand2,
  Gift,
  Activity,
  CheckCircle2,
  Send,
} from 'lucide-react';

// Mock data that simulates what the AI would return
const MOCK_INSIGHTS = {
  summary: 'Tu gimnasio muestra un crecimiento saludable con 5 socios activos. La retención es buena pero hay oportunidad de mejorar la frecuencia de asistencia promedio.',
  healthScore: 72,
  strengths: [
    'Base de socios estable con buena retención mensual',
    'Programa de puntos activo con engagement positivo',
    'Diversidad de planes atrae diferentes perfiles',
  ],
  concerns: [
    '1 socio en riesgo alto de abandono requiere atención inmediata',
    'Frecuencia de asistencia promedio por debajo del ideal (3x/semana)',
    'Bajo uso del programa de referidos',
  ],
  opportunities: [
    {
      title: 'Campaña de reactivación para socios inactivos',
      description: 'Enviar oferta especial a socios que no han asistido en 7+ días con descuento del 15% en renovación',
      expectedImpact: '+$4,500/mes',
      priority: 'alta' as const,
      actionType: 'campaña',
    },
    {
      title: 'Programa de referidos con incentivo doble',
      description: 'Duplicar puntos por referido durante 30 días para impulsar crecimiento orgánico',
      expectedImpact: '+3-5 socios/mes',
      priority: 'alta' as const,
      actionType: 'marketing',
    },
    {
      title: 'Clase grupal gratuita los sábados',
      description: 'Ofrecer una clase abierta semanal para atraer prospectos y aumentar asistencia de socios actuales',
      expectedImpact: '+20% asistencia fin de semana',
      priority: 'media' as const,
      actionType: 'operativo',
    },
  ],
  predictions: {
    nextMonthRevenue: '$12,000 - $15,000 MXN',
    churnRisk: '15-20% de socios',
    growthOpportunity: '+25-35% con campañas activas',
  },
  topPriority: {
    action: 'Contactar a Laura Ramírez (riesgo alto) con oferta personalizada de retención',
    rationale: 'Es la socia con mayor lifetime value en riesgo. Retenerla equivale a $8,000 MXN/año.',
  },
};

const MOCK_CAMPAIGN_PROPOSAL = {
  campaignName: 'Reactivación Socios Inactivos',
  objective: 'Recuperar socios que no han asistido en 2+ semanas ofreciendo un incentivo de renovación',
  campaignType: 'REMINDER',
  segmentName: 'Inactivos 14+ días con membresía activa',
  segmentCriteria: {
    lastAttendanceDaysAgo: 14,
    membershipStatus: 'ACTIVE',
  },
  messageVariants: [
    {
      tone: 'casual',
      message: '¡Hey {{firstName}}! 💪 Te extrañamos en el gym. Sabemos que a veces la rutina se complica, pero tu cuerpo te lo agradecerá. ¿Vienes mañana? Te tenemos una sorpresa 🎁',
      predictedConversion: '28-35%',
    },
    {
      tone: 'motivador',
      message: '{{firstName}}, cada día que entrenas es una inversión en ti. Llevas 14 días sin venir y queremos ayudarte a retomar el ritmo. Tu próxima visita tiene 50 puntos extra 🏆',
      predictedConversion: '22-28%',
    },
    {
      tone: 'urgencia',
      message: '{{firstName}}, tu membresía sigue activa pero no la estás aprovechando. Esta semana tienes acceso a todas las clases grupales sin costo adicional. ¡No lo dejes pasar!',
      predictedConversion: '18-24%',
    },
  ],
  bestSendTime: {
    dayOfWeek: 'Martes',
    hour: '10:00',
    reasoning: 'Los martes por la mañana tienen la mayor tasa de apertura (62%) y los socios planifican su semana de ejercicio.',
  },
  expectedResults: {
    predictedReach: '2-3 socios',
    predictedConversion: '25-35%',
    expectedRevenue: '$1,800 - $2,700 MXN',
  },
  tips: [
    'Incluye un CTA claro: "Responde SÍ para reservar tu lugar en la clase"',
    'Envía un recordatorio 48h después a quienes no respondieron',
    'Ofrece puntos extra por las primeras 3 visitas después de reactivarse',
  ],
};

const MOCK_CHURN_ANALYSIS = {
  riskScore: 78,
  riskLevel: 'HIGH',
  topReasons: [
    'No ha asistido en los últimos 12 días (promedio anterior: 4 veces/semana)',
    'Membresía vence en 18 días sin señales de renovación',
    'Patrón similar al de 3 socios que se dieron de baja el mes pasado',
  ],
  recommendedActions: [
    {
      action: 'Llamar personalmente para preguntar cómo se siente y si necesita ajustar su rutina',
      priority: 'alta',
      expectedImpact: 'Reduce riesgo 45%',
    },
    {
      action: 'Ofrecer 1 sesión gratuita con personal trainer para renovar motivación',
      priority: 'alta',
      expectedImpact: 'Aumenta probabilidad de renovación 60%',
    },
    {
      action: 'Enviar mensaje WhatsApp con beneficio exclusivo de renovación anticipada (10% off)',
      priority: 'media',
      expectedImpact: 'Reduce riesgo 25%',
    },
  ],
  personalizedMessage: '¡Hola Laura! 🙌 Notamos que no has venido últimamente y queremos saber cómo estás. Como socia VIP, te regalamos una sesión con nuestro trainer estrella. ¿Te agendamos esta semana?',
  estimatedLifetimeValue: '$8,500 MXN/año',
  urgencyDays: 5,
};

const MOCK_REWARD_RECOMMENDATIONS = {
  recommendations: [
    {
      rewardName: 'Sesión de stretching personalizada',
      pointsCost: 150,
      category: 'experiencia',
      matchScore: 94,
      reasoning: 'Su patrón de visitas matutinas sugiere interés en bienestar integral',
      expectedEngagement: 'Aumenta visitas 30%',
    },
    {
      rewardName: 'Smoothie proteico post-entreno',
      pointsCost: 80,
      category: 'producto',
      matchScore: 88,
      reasoning: 'Asiste frecuentemente en horario de mañana, ideal para nutrición post-gym',
      expectedEngagement: 'Fideliza rutina matutina',
    },
    {
      rewardName: '15% descuento en renovación trimestral',
      pointsCost: 300,
      category: 'descuento',
      matchScore: 82,
      reasoning: 'Su membresía vence pronto y tiene puntos suficientes para este canje',
      expectedEngagement: 'Asegura renovación',
    },
    {
      rewardName: 'Acceso VIP a zona de spa por 1 día',
      pointsCost: 200,
      category: 'exclusivo',
      matchScore: 76,
      reasoning: 'Socia con alta antigüedad que valora experiencias premium',
      expectedEngagement: 'Aumenta satisfacción NPS',
    },
  ],
  memberInsights: {
    profile: 'Socia comprometida con tendencia a entrenar por las mañanas. Valora experiencias de bienestar y tiene alto potencial de embajadora.',
    preferredActivities: ['Cardio matutino', 'Clases grupales', 'Zona de pesas'],
    engagementLevel: 'alto',
    loyaltyStage: 'establecido',
  },
  personalizedOffer: {
    title: '🎁 Oferta exclusiva para Laura',
    message: '¡Hola {{firstName}}! Por ser una de nuestras socias más comprometidas, te desbloqueamos una recompensa especial: Sesión de stretching + smoothie por solo 180 pts (valor normal: 230 pts). Válido 7 días 💫',
    validityDays: 7,
  },
};

export default function AIInsights() {
  const [activeTab, setActiveTab] = useState<'insights' | 'campaign' | 'churn' | 'rewards'>('insights');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [showCampaignResult, setShowCampaignResult] = useState(false);
  const [showChurnResult, setShowChurnResult] = useState(false);
  const [showRewardResult, setShowRewardResult] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState('');

  const simulateAI = (callback: () => void) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      callback();
    }, 2000);
  };

  const tabs = [
    { id: 'insights' as const, label: 'Insights del Negocio', icon: Brain },
    { id: 'campaign' as const, label: 'Asistente de Campañas', icon: Wand2 },
    { id: 'churn' as const, label: 'Análisis de Riesgo', icon: AlertTriangle },
    { id: 'rewards' as const, label: 'Recompensas IA', icon: Gift },
  ];

  const members = [
    { id: '1', name: 'María González', phone: '+5215512345678', points: 150 },
    { id: '2', name: 'Carlos Hernández', phone: '+5215587654321', points: 320 },
    { id: '3', name: 'Ana López', phone: '+5215511223344', points: 80 },
    { id: '4', name: 'Roberto Martínez', phone: '+5215599887766', points: 0 },
    { id: '5', name: 'Laura Ramírez', phone: '+5215544556677', points: 500 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 p-3">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inteligencia Artificial</h1>
          <p className="text-sm text-gray-500">Análisis avanzado y recomendaciones para tu gimnasio</p>
        </div>
        <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">Demo Mode</span>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Insights */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-700 mb-1">Salud del Negocio</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-gray-900">{MOCK_INSIGHTS.healthScore}</span>
                  <span className="text-gray-500">/100</span>
                </div>
              </div>
              <Brain className="h-12 w-12 text-indigo-300" />
            </div>
            <p className="text-gray-700 mt-3">{MOCK_INSIGHTS.summary}</p>
          </div>

          <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-xl p-5">
            <div className="flex items-start gap-3">
              <Target className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Prioridad #1</p>
                <p className="font-semibold text-gray-900 mt-1">{MOCK_INSIGHTS.topPriority.action}</p>
                <p className="text-sm text-gray-700 mt-1">{MOCK_INSIGHTS.topPriority.rationale}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-medium text-gray-600">Ingresos próximo mes</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{MOCK_INSIGHTS.predictions.nextMonthRevenue}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-xs font-medium text-gray-600">Riesgo de churn</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{MOCK_INSIGHTS.predictions.churnRisk}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-medium text-gray-600">Crecimiento posible</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{MOCK_INSIGHTS.predictions.growthOpportunity}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
              <h3 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Fortalezas</h3>
              <ul className="space-y-2">
                {MOCK_INSIGHTS.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-emerald-900 flex items-start gap-2"><span className="text-emerald-600 mt-0.5">•</span>{s}</li>
                ))}
              </ul>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Puntos de atención</h3>
              <ul className="space-y-2">
                {MOCK_INSIGHTS.concerns.map((c, i) => (
                  <li key={i} className="text-sm text-red-900 flex items-start gap-2"><span className="text-red-600 mt-0.5">•</span>{c}</li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-500" />Oportunidades detectadas</h3>
            <div className="space-y-3">
              {MOCK_INSIGHTS.opportunities.map((op, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">{op.title}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${op.priority === 'alta' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{op.priority}</span>
                      </div>
                      <p className="text-sm text-gray-700">{op.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-emerald-600">{op.expectedImpact}</p>
                      <p className="text-xs text-gray-500 mt-1">{op.actionType}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Campaign Assistant */}
      {activeTab === 'campaign' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-2">Describe la campaña que quieres crear</h2>
            <p className="text-sm text-gray-600 mb-4">La IA generará el segmento, mensaje y predicciones automáticamente.</p>
            <textarea
              value={campaignDescription}
              onChange={(e) => setCampaignDescription(e.target.value)}
              placeholder="Ej: Quiero recuperar a los socios que llevan 2 semanas sin venir y ofrecerles un descuento del 15% en renovación"
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
            <button
              onClick={() => simulateAI(() => setShowCampaignResult(true))}
              disabled={campaignDescription.length < 10 || isLoading}
              className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Generando...</> : <><Wand2 className="h-4 w-4" />Generar campaña con IA</>}
            </button>
          </div>

          {showCampaignResult && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5">
                <h3 className="font-bold text-gray-900 text-lg mb-1">{MOCK_CAMPAIGN_PROPOSAL.campaignName}</h3>
                <p className="text-sm text-gray-700">{MOCK_CAMPAIGN_PROPOSAL.objective}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">Tipo: {MOCK_CAMPAIGN_PROPOSAL.campaignType}</span>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Segmento: {MOCK_CAMPAIGN_PROPOSAL.segmentName}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">Alcance estimado</p>
                  <p className="font-semibold text-gray-900">{MOCK_CAMPAIGN_PROPOSAL.expectedResults.predictedReach}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">Conversión predicha</p>
                  <p className="font-semibold text-emerald-600">{MOCK_CAMPAIGN_PROPOSAL.expectedResults.predictedConversion}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">Ingresos esperados</p>
                  <p className="font-semibold text-indigo-600">{MOCK_CAMPAIGN_PROPOSAL.expectedResults.expectedRevenue}</p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="font-semibold text-gray-900 mb-3">📱 Variantes de mensaje</h4>
                <div className="space-y-3">
                  {MOCK_CAMPAIGN_PROPOSAL.messageVariants.map((v, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{v.tone}</span>
                        <span className="text-xs text-emerald-600 font-medium">{v.predictedConversion} conversión</span>
                      </div>
                      <p className="text-sm text-gray-700">{v.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <h4 className="font-semibold text-amber-900 mb-2">⏰ Mejor momento para enviar</h4>
                <p className="text-amber-800 font-medium">{MOCK_CAMPAIGN_PROPOSAL.bestSendTime.dayOfWeek} a las {MOCK_CAMPAIGN_PROPOSAL.bestSendTime.hour}</p>
                <p className="text-sm text-amber-700 mt-1">{MOCK_CAMPAIGN_PROPOSAL.bestSendTime.reasoning}</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="font-semibold text-gray-900 mb-2">💡 Tips estratégicos</h4>
                <ul className="space-y-1.5 text-sm text-gray-700">
                  {MOCK_CAMPAIGN_PROPOSAL.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">→</span>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Churn Analysis */}
      {activeTab === 'churn' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-2">Análisis de riesgo de abandono</h2>
            <p className="text-sm text-gray-600 mb-4">La IA evalúa el perfil completo del socio y da recomendaciones para retenerlo.</p>
            <div className="flex gap-2">
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              >
                <option value="">Selecciona un socio...</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} - {m.phone}</option>
                ))}
              </select>
              <button
                onClick={() => simulateAI(() => setShowChurnResult(true))}
                disabled={!selectedMember || isLoading}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                Analizar
              </button>
            </div>
          </div>

          {showChurnResult && (
            <div className="space-y-4">
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Laura Ramírez</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-gray-900">{MOCK_CHURN_ANALYSIS.riskScore}</span>
                      <span className="text-gray-500">/100 riesgo</span>
                    </div>
                    <span className="inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-200 text-red-800">Nivel {MOCK_CHURN_ANALYSIS.riskLevel}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-600">Actuar en</p>
                    <p className="text-2xl font-bold text-gray-900">{MOCK_CHURN_ANALYSIS.urgencyDays}</p>
                    <p className="text-xs text-gray-600">días</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="font-semibold text-gray-900 mb-3">🎯 Razones principales</h4>
                <ul className="space-y-2">
                  {MOCK_CHURN_ANALYSIS.topReasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="text-red-500 mt-0.5">•</span>{r}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="font-semibold text-gray-900 mb-3">✅ Acciones recomendadas</h4>
                <div className="space-y-3">
                  {MOCK_CHURN_ANALYSIS.recommendedActions.map((a, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">{a.action}</p>
                          <p className="text-xs text-emerald-600 mt-1">{a.expectedImpact}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${a.priority === 'alta' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{a.priority}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
                <h4 className="font-semibold text-indigo-900 mb-2">💬 Mensaje sugerido para WhatsApp</h4>
                <div className="bg-white rounded-lg p-3 border border-indigo-100">
                  <p className="text-sm text-gray-800">{MOCK_CHURN_ANALYSIS.personalizedMessage}</p>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-indigo-700">Valor al retener: <span className="font-semibold">{MOCK_CHURN_ANALYSIS.estimatedLifetimeValue}</span></p>
                  <button className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:text-indigo-900"><Send className="h-3 w-3" />Enviar por WhatsApp</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Reward Recommendations */}
      {activeTab === 'rewards' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-2">Recompensas personalizadas con IA</h2>
            <p className="text-sm text-gray-600 mb-4">La IA analiza el perfil del socio y sugiere recompensas con mayor afinidad.</p>
            <div className="flex gap-2">
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              >
                <option value="">Selecciona un socio...</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.points} pts)</option>
                ))}
              </select>
              <button
                onClick={() => simulateAI(() => setShowRewardResult(true))}
                disabled={!selectedMember || isLoading}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                Generar
              </button>
            </div>
          </div>

          {showRewardResult && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-5">
                <p className="text-sm font-medium text-gray-700 mb-1">Laura Ramírez</p>
                <p className="text-xs text-gray-600">{MOCK_REWARD_RECOMMENDATIONS.memberInsights.profile}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">Engagement: {MOCK_REWARD_RECOMMENDATIONS.memberInsights.engagementLevel}</span>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">Etapa: {MOCK_REWARD_RECOMMENDATIONS.memberInsights.loyaltyStage}</span>
                  {MOCK_REWARD_RECOMMENDATIONS.memberInsights.preferredActivities.map((a, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{a}</span>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-xl p-5">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">🎁 Oferta personalizada</p>
                <h4 className="font-bold text-gray-900 mt-1">{MOCK_REWARD_RECOMMENDATIONS.personalizedOffer.title}</h4>
                <p className="text-sm text-gray-700 mt-2 italic">"{MOCK_REWARD_RECOMMENDATIONS.personalizedOffer.message}"</p>
                <p className="text-xs text-amber-700 mt-2">Vigencia: {MOCK_REWARD_RECOMMENDATIONS.personalizedOffer.validityDays} días</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">✨ Recompensas recomendadas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {MOCK_REWARD_RECOMMENDATIONS.recommendations.map((r, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900 text-sm flex-1">{r.rewardName}</h4>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="text-xs font-bold text-purple-600">{r.matchScore}% match</span>
                          <span className="text-xs text-gray-500">{r.pointsCost} pts</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{r.reasoning}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{r.category}</span>
                        <span className="text-xs text-emerald-600 font-medium">{r.expectedEngagement}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
