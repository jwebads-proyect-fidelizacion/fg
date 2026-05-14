import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Sparkles,
  Brain,
  TrendingUp,
  AlertTriangle,
  Target,
  Lightbulb,
  Send,
  Loader2,
  Wand2,
  Gift,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import api from '../lib/api';

interface Insights {
  success: boolean;
  metrics: any;
  insights: {
    summary: string;
    healthScore: number;
    strengths: string[];
    concerns: string[];
    opportunities: Array<{
      title: string;
      description: string;
      expectedImpact: string;
      priority: 'alta' | 'media' | 'baja';
      actionType: string;
    }>;
    predictions: {
      nextMonthRevenue: string;
      churnRisk: string;
      growthOpportunity: string;
    };
    topPriority: {
      action: string;
      rationale: string;
    };
  };
}

export default function AIInsights() {
  const [activeTab, setActiveTab] = useState<'insights' | 'campaign' | 'churn' | 'rewards'>(
    'insights'
  );
  const [campaignDescription, setCampaignDescription] = useState('');
  const [campaignProposal, setCampaignProposal] = useState<any>(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [churnAnalysis, setChurnAnalysis] = useState<any>(null);
  const [rewardRecommendations, setRewardRecommendations] = useState<any>(null);

  // Fetch global insights
  const insightsQuery = useQuery<Insights>({
    queryKey: ['ai-insights'],
    queryFn: async () => {
      const r = await api.get('/ai/insights');
      return r.data;
    },
    enabled: activeTab === 'insights',
    refetchOnMount: true,
  });

  // Members list for selectors
  const membersQuery = useQuery<{ data: any[] }>({
    queryKey: ['members-for-ai'],
    queryFn: async () => {
      const r = await api.get('/members?limit=50');
      return r.data;
    },
  });

  // Campaign assistant mutation
  const campaignMutation = useMutation({
    mutationFn: async (description: string) => {
      const r = await api.post('/ai/campaign-assistant', { description });
      return r.data;
    },
    onSuccess: (data) => setCampaignProposal(data),
  });

  // Churn analysis mutation
  const churnMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const r = await api.post('/ai/churn-analysis', { memberId });
      return r.data;
    },
    onSuccess: (data) => setChurnAnalysis(data),
  });

  // Reward recommendations mutation
  const rewardMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const r = await api.post('/ai/reward-recommendations', { memberId });
      return r.data;
    },
    onSuccess: (data) => setRewardRecommendations(data),
  });

  const tabs = [
    { id: 'insights', label: 'Insights del Negocio', icon: Brain },
    { id: 'campaign', label: 'Asistente de Campañas', icon: Wand2 },
    { id: 'churn', label: 'Análisis de Riesgo', icon: AlertTriangle },
    { id: 'rewards', label: 'Recompensas Personalizadas', icon: Gift },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 p-3">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inteligencia Artificial</h1>
          <p className="text-sm text-gray-500">
            Análisis avanzado y recomendaciones inteligentes para tu gimnasio
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200">
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
        <div>
          {insightsQuery.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <span className="ml-3 text-gray-600">Analizando tu negocio con IA...</span>
            </div>
          ) : insightsQuery.error ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-6">
              <h3 className="font-semibold text-amber-900 mb-2">⚠️ IA no configurada</h3>
              <p className="text-amber-800 text-sm">
                Para usar las funcionalidades de IA, configura la variable{' '}
                <code className="bg-amber-100 px-1.5 py-0.5 rounded">OPENAI_API_KEY</code> en
                Vercel.
              </p>
              <p className="text-amber-700 text-xs mt-2">
                Obtén tu API key en{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-medium"
                >
                  platform.openai.com/api-keys
                </a>
              </p>
            </div>
          ) : insightsQuery.data ? (
            <div className="space-y-6">
              {/* Health Score */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-indigo-700 mb-1">
                      Salud del Negocio
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-gray-900">
                        {insightsQuery.data.insights.healthScore}
                      </span>
                      <span className="text-gray-500">/100</span>
                    </div>
                  </div>
                  <Brain className="h-12 w-12 text-indigo-300" />
                </div>
                <p className="text-gray-700 mt-3">{insightsQuery.data.insights.summary}</p>
              </div>

              {/* Top Priority */}
              <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-xl p-5">
                <div className="flex items-start gap-3">
                  <Target className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                      Prioridad #1
                    </p>
                    <p className="font-semibold text-gray-900 mt-1">
                      {insightsQuery.data.insights.topPriority.action}
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      {insightsQuery.data.insights.topPriority.rationale}
                    </p>
                  </div>
                </div>
              </div>

              {/* Predictions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-medium text-gray-600">
                      Ingresos próximo mes
                    </span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {insightsQuery.data.insights.predictions.nextMonthRevenue}
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-xs font-medium text-gray-600">Riesgo de churn</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {insightsQuery.data.insights.predictions.churnRisk}
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-indigo-600" />
                    <span className="text-xs font-medium text-gray-600">
                      Crecimiento posible
                    </span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {insightsQuery.data.insights.predictions.growthOpportunity}
                  </p>
                </div>
              </div>

              {/* Strengths & Concerns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                  <h3 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Fortalezas
                  </h3>
                  <ul className="space-y-2">
                    {insightsQuery.data.insights.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-emerald-900 flex items-start gap-2">
                        <span className="text-emerald-600 mt-0.5">•</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                  <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Puntos de atención
                  </h3>
                  <ul className="space-y-2">
                    {insightsQuery.data.insights.concerns.map((c, i) => (
                      <li key={i} className="text-sm text-red-900 flex items-start gap-2">
                        <span className="text-red-600 mt-0.5">•</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Opportunities */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Oportunidades detectadas
                </h3>
                <div className="space-y-3">
                  {insightsQuery.data.insights.opportunities.map((op, i) => (
                    <div
                      key={i}
                      className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-gray-900">{op.title}</h4>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                op.priority === 'alta'
                                  ? 'bg-red-100 text-red-700'
                                  : op.priority === 'media'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {op.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{op.description}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-emerald-600">
                            {op.expectedImpact}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{op.actionType}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => insightsQuery.refetch()}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                🔄 Regenerar análisis
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Tab: Campaign Assistant */}
      {activeTab === 'campaign' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-2">
              Describe la campaña que quieres crear
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              La IA generará el segmento, mensaje y predicciones automáticamente.
            </p>
            <textarea
              value={campaignDescription}
              onChange={(e) => setCampaignDescription(e.target.value)}
              placeholder="Ej: Quiero recuperar a los socios que llevan 2 semanas sin venir y ofrecerles un descuento del 15% en renovación"
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
            <button
              onClick={() => campaignMutation.mutate(campaignDescription)}
              disabled={campaignDescription.length < 10 || campaignMutation.isPending}
              className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {campaignMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generar campaña con IA
                </>
              )}
            </button>
          </div>

          {campaignMutation.error ? (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {(campaignMutation.error as any)?.response?.data?.error ||
                'Error generando campaña'}
            </div>
          ) : null}

          {campaignProposal?.proposal && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5">
                <h3 className="font-bold text-gray-900 text-lg mb-1">
                  {campaignProposal.proposal.campaignName}
                </h3>
                <p className="text-sm text-gray-700">{campaignProposal.proposal.objective}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">Alcance estimado</p>
                  <p className="font-semibold text-gray-900">
                    {campaignProposal.proposal.expectedResults?.predictedReach}
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">Conversión predicha</p>
                  <p className="font-semibold text-emerald-600">
                    {campaignProposal.proposal.expectedResults?.predictedConversion}
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">Ingresos esperados</p>
                  <p className="font-semibold text-indigo-600">
                    {campaignProposal.proposal.expectedResults?.expectedRevenue}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="font-semibold text-gray-900 mb-3">📱 Variantes de mensaje</h4>
                <div className="space-y-3">
                  {campaignProposal.proposal.messageVariants?.map((v: any, i: number) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                          {v.tone}
                        </span>
                        <span className="text-xs text-emerald-600 font-medium">
                          {v.predictedConversion}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{v.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <h4 className="font-semibold text-amber-900 mb-2">⏰ Mejor momento para enviar</h4>
                <p className="text-amber-800 font-medium">
                  {campaignProposal.proposal.bestSendTime?.dayOfWeek} a las{' '}
                  {campaignProposal.proposal.bestSendTime?.hour}
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  {campaignProposal.proposal.bestSendTime?.reasoning}
                </p>
              </div>

              {campaignProposal.proposal.tips && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h4 className="font-semibold text-gray-900 mb-2">💡 Tips estratégicos</h4>
                  <ul className="space-y-1.5 text-sm text-gray-700">
                    {campaignProposal.proposal.tips.map((tip: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-indigo-500 mt-0.5">→</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Churn Analysis */}
      {activeTab === 'churn' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-2">
              Selecciona un socio para análisis de riesgo
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              La IA evaluará su perfil completo y dará recomendaciones para retenerlo.
            </p>
            <div className="flex gap-2">
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              >
                <option value="">Selecciona un socio...</option>
                {membersQuery.data?.data?.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName} - {m.phone}
                  </option>
                ))}
              </select>
              <button
                onClick={() => selectedMemberId && churnMutation.mutate(selectedMemberId)}
                disabled={!selectedMemberId || churnMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {churnMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                Analizar
              </button>
            </div>
          </div>

          {churnAnalysis?.analysis && (
            <div className="space-y-4">
              <div
                className={`rounded-xl p-6 border-2 ${
                  churnAnalysis.analysis.riskLevel === 'CRITICAL' ||
                  churnAnalysis.analysis.riskLevel === 'HIGH'
                    ? 'bg-red-50 border-red-300'
                    : churnAnalysis.analysis.riskLevel === 'MEDIUM'
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-emerald-50 border-emerald-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      {churnAnalysis.member?.name}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-gray-900">
                        {churnAnalysis.analysis.riskScore}
                      </span>
                      <span className="text-gray-500">/100 riesgo</span>
                    </div>
                    <span
                      className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        churnAnalysis.analysis.riskLevel === 'CRITICAL' ||
                        churnAnalysis.analysis.riskLevel === 'HIGH'
                          ? 'bg-red-200 text-red-800'
                          : churnAnalysis.analysis.riskLevel === 'MEDIUM'
                          ? 'bg-amber-200 text-amber-800'
                          : 'bg-emerald-200 text-emerald-800'
                      }`}
                    >
                      Nivel {churnAnalysis.analysis.riskLevel}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-600">Actuar en</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {churnAnalysis.analysis.urgencyDays}
                    </p>
                    <p className="text-xs text-gray-600">días</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="font-semibold text-gray-900 mb-3">🎯 Razones principales</h4>
                <ul className="space-y-2">
                  {churnAnalysis.analysis.topReasons?.map((r: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-red-500 mt-0.5">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="font-semibold text-gray-900 mb-3">✅ Acciones recomendadas</h4>
                <div className="space-y-3">
                  {churnAnalysis.analysis.recommendedActions?.map((a: any, i: number) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">{a.action}</p>
                          <p className="text-xs text-emerald-600 mt-1">
                            {a.expectedImpact}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                            a.priority === 'alta'
                              ? 'bg-red-100 text-red-700'
                              : a.priority === 'media'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {a.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
                <h4 className="font-semibold text-indigo-900 mb-2">💬 Mensaje sugerido</h4>
                <div className="bg-white rounded-lg p-3 border border-indigo-100">
                  <p className="text-sm text-gray-800">
                    {churnAnalysis.analysis.personalizedMessage}
                  </p>
                </div>
                <p className="text-xs text-indigo-700 mt-2">
                  Valor estimado al retener:{' '}
                  <span className="font-semibold">
                    {churnAnalysis.analysis.estimatedLifetimeValue}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Reward Recommendations */}
      {activeTab === 'rewards' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-2">
              Recomendaciones personalizadas de recompensas
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              La IA analiza el perfil del socio y sugiere recompensas con mayor afinidad.
            </p>
            <div className="flex gap-2">
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              >
                <option value="">Selecciona un socio...</option>
                {membersQuery.data?.data?.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName} ({m.pointsBalance} pts)
                  </option>
                ))}
              </select>
              <button
                onClick={() => selectedMemberId && rewardMutation.mutate(selectedMemberId)}
                disabled={!selectedMemberId || rewardMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {rewardMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Gift className="h-4 w-4" />
                )}
                Generar
              </button>
            </div>
          </div>

          {rewardRecommendations && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-5">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  {rewardRecommendations.member?.name}
                </p>
                <p className="text-xs text-gray-600">
                  {rewardRecommendations.memberInsights?.profile}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                    Engagement: {rewardRecommendations.memberInsights?.engagementLevel}
                  </span>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">
                    {rewardRecommendations.memberInsights?.loyaltyStage}
                  </span>
                </div>
              </div>

              {rewardRecommendations.personalizedOffer && (
                <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-xl p-5">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                    🎁 Oferta personalizada
                  </p>
                  <h4 className="font-bold text-gray-900 mt-1">
                    {rewardRecommendations.personalizedOffer.title}
                  </h4>
                  <p className="text-sm text-gray-700 mt-2 italic">
                    "{rewardRecommendations.personalizedOffer.message}"
                  </p>
                  <p className="text-xs text-amber-700 mt-2">
                    Vigencia: {rewardRecommendations.personalizedOffer.validityDays} días
                  </p>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">
                  ✨ Recompensas recomendadas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {rewardRecommendations.recommendations?.map((r: any, i: number) => (
                    <div
                      key={i}
                      className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900 text-sm flex-1">
                          {r.rewardName}
                        </h4>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="text-xs font-bold text-purple-600">
                            {r.matchScore}% match
                          </span>
                          <span className="text-xs text-gray-500">{r.pointsCost} pts</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{r.reasoning}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                          {r.category}
                        </span>
                        <span className="text-xs text-emerald-600 font-medium">
                          {r.expectedEngagement}
                        </span>
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
