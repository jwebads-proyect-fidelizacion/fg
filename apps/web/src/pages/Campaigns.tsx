import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pause,
  Play,
  XCircle,
  BarChart3,
  Loader2,
  X,
  Megaphone,
  Bot,
  Sparkles,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
  ArrowLeft,
  Wand2,
  Users,
  Gift,
  Heart,
  Zap,
  Edit3,
} from 'lucide-react';
import api from '../lib/api';

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  channel: string;
  segmentId: string | null;
  segmentName?: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  stats?: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  };
  createdAt: string;
}

interface AISuggestion {
  messageVariants: string[];
  bestTime: string;
  tips: string[];
  subject?: string;
}

interface CampaignProposal {
  name: string;
  message: string;
  segment: string;
  timing: string;
  type: string;
  channel: string;
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  RUNNING: 'En curso',
  PAUSED: 'Pausada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
};

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SCHEDULED: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  RUNNING: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  PAUSED: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  COMPLETED: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  CANCELLED: 'bg-red-50 text-red-700 ring-1 ring-red-200',
};

const typeLabels: Record<string, string> = {
  WELCOME: 'Bienvenida',
  RENEWAL: 'Renovación',
  REACTIVATION: 'Reactivación',
  PROMOTION: 'Promoción',
  BIRTHDAY: 'Cumpleaños',
  CUSTOM: 'Personalizada',
};

const PRESET_TEMPLATES = [
  {
    id: 'reactivation',
    icon: Users,
    title: 'Recuperar Inactivos',
    description: 'Mensaje motivacional para socios que no asisten hace 2+ semanas',
    color: 'from-orange-500 to-red-500',
    bgLight: 'bg-orange-50',
    prompt: 'Quiero recuperar socios inactivos que no vienen hace más de 2 semanas con un mensaje motivacional y un incentivo para volver',
  },
  {
    id: 'birthday',
    icon: Gift,
    title: 'Felicitar Cumpleaños',
    description: 'Saludo personalizado con descuento especial de cumpleaños',
    color: 'from-pink-500 to-purple-500',
    bgLight: 'bg-pink-50',
    prompt: 'Quiero felicitar a los socios en su cumpleaños con un mensaje cálido y ofrecerles un beneficio especial como regalo',
  },
  {
    id: 'seasonal',
    icon: Zap,
    title: 'Promoción de Temporada',
    description: 'Oferta especial por tiempo limitado para nuevas inscripciones',
    color: 'from-indigo-500 to-blue-500',
    bgLight: 'bg-indigo-50',
    prompt: 'Quiero crear una promoción de temporada con descuento especial por tiempo limitado para atraer nuevos socios y motivar renovaciones',
  },
  {
    id: 'referral',
    icon: Heart,
    title: 'Programa de Referidos',
    description: 'Incentiva a socios actuales a traer amigos con recompensas',
    color: 'from-emerald-500 to-teal-500',
    bgLight: 'bg-emerald-50',
    prompt: 'Quiero incentivar a mis socios actuales a referir amigos ofreciendo recompensas tanto al que refiere como al nuevo socio',
  },
];


export default function Campaigns() {
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [selectedStats, setSelectedStats] = useState<Campaign | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading, error } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const response = await api.get('/campaigns');
      return response.data.data || response.data;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const response = await api.patch(`/campaigns/${id}/status`, { action });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-200 p-8 text-center">
        <p className="text-red-700 font-medium">Error al cargar las campañas</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Campañas</h1>
          <p className="text-sm text-gray-500 mt-1">Crea y gestiona campañas de marketing con IA</p>
        </div>
        <button
          onClick={() => setShowCreateFlow(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg hover:scale-105"
        >
          <Sparkles className="h-4 w-4" />
          Nueva Campaña con IA
        </button>
      </div>

      {/* Success Toast */}
      {successMessage && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-700">{successMessage}</p>
          <button onClick={() => setSuccessMessage('')} className="ml-auto text-emerald-400 hover:text-emerald-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* AI Campaign Creation - Primary CTA when no campaigns */}
      {(!campaigns || campaigns.length === 0) && !showCreateFlow && (
        <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border border-indigo-200 p-10 text-center">
          <div className="rounded-full bg-indigo-100 h-16 w-16 flex items-center justify-center mx-auto mb-4">
            <Bot className="h-8 w-8 text-indigo-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Crea tu primera campaña con IA</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Describe lo que quieres lograr y nuestra IA generará propuestas completas de campaña para ti.
          </p>
          <button
            onClick={() => setShowCreateFlow(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg"
          >
            <Wand2 className="h-4 w-4" />
            Crear Campaña
          </button>
        </div>
      )}

      {/* Campaigns Table */}
      {campaigns && campaigns.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Nombre</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Estado</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider hidden md:table-cell">Canal</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider hidden lg:table-cell">Fecha</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaigns.map((campaign, idx) => (
                  <tr key={campaign.id} className={`hover:bg-indigo-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-5 py-3.5 font-medium text-gray-900">{campaign.name}</td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {typeLabels[campaign.type] || campaign.type}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[campaign.status] || 'bg-gray-100 text-gray-700'}`}>
                        {statusLabels[campaign.status] || campaign.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 hidden md:table-cell">
                      {campaign.channel === 'WHATSAPP' ? '📱 WhatsApp' : campaign.channel === 'EMAIL' ? '📧 Email' : campaign.channel}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 hidden lg:table-cell">
                      {campaign.scheduledAt
                        ? new Date(campaign.scheduledAt).toLocaleDateString('es-MX')
                        : campaign.startedAt
                        ? new Date(campaign.startedAt).toLocaleDateString('es-MX')
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {campaign.status === 'RUNNING' && (
                          <button
                            onClick={() => statusMutation.mutate({ id: campaign.id, action: 'pause' })}
                            className="rounded-lg p-2 text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Pausar"
                          >
                            <Pause className="h-4 w-4" />
                          </button>
                        )}
                        {campaign.status === 'PAUSED' && (
                          <button
                            onClick={() => statusMutation.mutate({ id: campaign.id, action: 'resume' })}
                            className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Reanudar"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        )}
                        {(campaign.status === 'RUNNING' || campaign.status === 'PAUSED' || campaign.status === 'SCHEDULED') && (
                          <button
                            onClick={() => {
                              if (confirm('¿Cancelar esta campaña?')) {
                                statusMutation.mutate({ id: campaign.id, action: 'cancel' });
                              }
                            }}
                            className="rounded-lg p-2 text-red-600 hover:bg-red-50 transition-colors"
                            title="Cancelar"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedStats(campaign)}
                          className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Estadísticas"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Campaign Flow */}
      {showCreateFlow && (
        <CreateCampaignFlow
          onClose={() => setShowCreateFlow(false)}
          onSuccess={() => {
            setSuccessMessage('¡Campaña creada exitosamente!');
            setTimeout(() => setSuccessMessage(''), 5000);
          }}
        />
      )}

      {/* Stats Modal */}
      {selectedStats && (
        <CampaignStatsModal campaign={selectedStats} onClose={() => setSelectedStats(null)} />
      )}
    </div>
  );
}


function CreateCampaignFlow({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [description, setDescription] = useState('');
  const [proposals, setProposals] = useState<CampaignProposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<CampaignProposal | null>(null);
  const [editedProposal, setEditedProposal] = useState<CampaignProposal | null>(null);
  const [scheduledAt, setScheduledAt] = useState('');

  // AI generation mutation
  const aiMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const response = await api.post('/ai/campaign-assistant', {
        description: prompt,
        type: 'CUSTOM',
        channel: 'WHATSAPP',
      });
      return response.data;
    },
    onSuccess: (data: any) => {
      // Generate 3 proposals from AI response
      const suggestions = data.suggestions || data;
      const variants = suggestions?.messageVariants || [];
      const generatedProposals: CampaignProposal[] = [
        {
          name: `Campaña - ${description.slice(0, 30)}...`,
          message: variants[0] || 'Hola {{nombre}}, te extrañamos en el gym. ¡Vuelve y obtén un 20% de descuento!',
          segment: 'Socios inactivos (2+ semanas)',
          timing: suggestions?.bestTime || 'Lunes a las 9:00 AM',
          type: 'REACTIVATION',
          channel: 'WHATSAPP',
        },
        {
          name: `Reactivación - ${description.slice(0, 25)}`,
          message: variants[1] || 'Hey {{nombre}}, ¿sabías que tu cuerpo pierde progreso después de 2 semanas? ¡Regresa hoy!',
          segment: 'Socios con baja asistencia',
          timing: suggestions?.bestTime || 'Miércoles a las 7:00 PM',
          type: 'PROMOTION',
          channel: 'WHATSAPP',
        },
        {
          name: `Motivación - ${description.slice(0, 25)}`,
          message: variants[2] || '{{nombre}}, cada día cuenta. Tu plan te espera con beneficios exclusivos. ¡Nos vemos!',
          segment: 'Todos los socios activos',
          timing: 'Viernes a las 6:00 PM',
          type: 'CUSTOM',
          channel: 'WHATSAPP',
        },
      ];
      setProposals(generatedProposals);
      setStep(2);
    },
  });

  // Create campaign mutation
  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const response = await api.post('/campaigns', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      onClose();
      onSuccess();
    },
  });

  const handleTemplateSelect = (template: typeof PRESET_TEMPLATES[0]) => {
    setDescription(template.prompt);
    aiMutation.mutate(template.prompt);
  };

  const handleGenerateFromDescription = () => {
    if (description.trim()) {
      aiMutation.mutate(description.trim());
    }
  };

  const handleSelectProposal = (proposal: CampaignProposal) => {
    setSelectedProposal(proposal);
    setEditedProposal({ ...proposal });
    setStep(3);
  };

  const handleCreateCampaign = () => {
    if (!editedProposal) return;
    createMutation.mutate({
      name: editedProposal.name,
      type: editedProposal.type,
      channel: editedProposal.channel,
      message: editedProposal.message,
      scheduledAt: scheduledAt || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl mx-4 my-auto animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5">
              <Wand2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Crear Campaña con IA</h2>
              <p className="text-xs text-gray-500">Paso {step} de 4</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-7 pt-5">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`h-2 flex-1 rounded-full transition-colors ${s <= step ? 'bg-indigo-500' : 'bg-gray-200'}`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-gray-400">
            <span>Describir</span>
            <span>Propuestas</span>
            <span>Editar</span>
            <span>Crear</span>
          </div>
        </div>

        <div className="p-7">
          {/* Step 1: Describe or pick template */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  ¿Qué tipo de campaña quieres crear?
                </h3>
                <p className="text-sm text-gray-500">
                  Elige una plantilla o describe tu idea en lenguaje natural.
                </p>
              </div>

              {/* Preset Templates */}
              <div className="grid grid-cols-2 gap-3">
                {PRESET_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    disabled={aiMutation.isPending}
                    className={`text-left p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all group ${template.bgLight}`}
                  >
                    <div className={`rounded-lg bg-gradient-to-br ${template.color} p-2 w-fit mb-3`}>
                      <template.icon className="h-4 w-4 text-white" />
                    </div>
                    <p className="font-semibold text-gray-900 text-sm group-hover:text-indigo-700 transition-colors">
                      {template.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                  </button>
                ))}
              </div>

              {/* Custom description */}
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm font-medium text-gray-700">O describe tu idea:</span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Quiero recuperar socios que no vienen hace 2 semanas con un mensaje motivacional y un descuento del 20%..."
                  rows={3}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
                />
              </div>

              {aiMutation.error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  Error al generar propuestas. Intente nuevamente.
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleGenerateFromDescription}
                  disabled={!description.trim() || aiMutation.isPending}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm hover:shadow-md"
                >
                  {aiMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Generar Propuestas con IA
                </button>
              </div>
            </div>
          )}

          {/* Step 2: AI Proposals */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  La IA generó 3 propuestas
                </h3>
                <p className="text-sm text-gray-500">Elige la que más te guste. Podrás editarla después.</p>
              </div>

              <div className="space-y-4">
                {proposals.map((proposal, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectProposal(proposal)}
                    className="w-full text-left p-5 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                          Propuesta {idx + 1}
                        </span>
                        <h4 className="font-semibold text-gray-900 mt-2 group-hover:text-indigo-700 transition-colors">
                          {proposal.name}
                        </h4>
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                    </div>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mb-3 italic">
                      "{proposal.message}"
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>👥 {proposal.segment}</span>
                      <span>⏰ {proposal.timing}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Edit selected proposal */}
          {step === 3 && editedProposal && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-indigo-500" />
                  Edita tu campaña
                </h3>
                <p className="text-sm text-gray-500">Ajusta cualquier campo antes de crear la campaña.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre de la campaña</label>
                  <input
                    type="text"
                    value={editedProposal.name}
                    onChange={(e) => setEditedProposal({ ...editedProposal, name: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mensaje</label>
                  <textarea
                    value={editedProposal.message}
                    onChange={(e) => setEditedProposal({ ...editedProposal, message: e.target.value })}
                    rows={4}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Variables: {'{{nombre}}'}, {'{{apellido}}'}, {'{{plan}}'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo</label>
                    <select
                      value={editedProposal.type}
                      onChange={(e) => setEditedProposal({ ...editedProposal, type: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    >
                      <option value="WELCOME">Bienvenida</option>
                      <option value="RENEWAL">Renovación</option>
                      <option value="REACTIVATION">Reactivación</option>
                      <option value="PROMOTION">Promoción</option>
                      <option value="BIRTHDAY">Cumpleaños</option>
                      <option value="CUSTOM">Personalizada</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Canal</label>
                    <select
                      value={editedProposal.channel}
                      onChange={(e) => setEditedProposal({ ...editedProposal, channel: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    >
                      <option value="WHATSAPP">WhatsApp</option>
                      <option value="EMAIL">Email</option>
                      <option value="SMS">SMS</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Programar envío (opcional)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>

                <div className="bg-indigo-50 rounded-xl p-4">
                  <p className="text-xs text-indigo-600 font-medium mb-1">💡 Sugerencia IA</p>
                  <p className="text-sm text-indigo-800">
                    Segmento: {editedProposal.segment} • Mejor horario: {editedProposal.timing}
                  </p>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver a propuestas
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-sm"
                >
                  Revisar y Crear
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirm and create */}
          {step === 4 && editedProposal && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Confirmar campaña
                </h3>
                <p className="text-sm text-gray-500">Revisa los detalles y crea tu campaña.</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Nombre</p>
                    <p className="font-semibold text-gray-900 mt-0.5">{editedProposal.name}</p>
                  </div>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                    {typeLabels[editedProposal.type] || editedProposal.type}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Mensaje</p>
                  <p className="text-sm text-gray-800 mt-1 bg-white rounded-lg p-3 border border-gray-200 italic">
                    "{editedProposal.message}"
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Canal</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">
                      {editedProposal.channel === 'WHATSAPP' ? '📱 WhatsApp' : editedProposal.channel === 'EMAIL' ? '📧 Email' : '💬 SMS'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Programación</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">
                      {scheduledAt ? new Date(scheduledAt).toLocaleString('es-MX') : 'Envío inmediato'}
                    </p>
                  </div>
                </div>
              </div>

              {createMutation.error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {(createMutation.error as any)?.response?.data?.error || 'Error al crear la campaña'}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(3)}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Editar
                </button>
                <button
                  onClick={handleCreateCampaign}
                  disabled={createMutation.isPending}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-3 text-sm font-bold text-white hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Megaphone className="h-4 w-4" />
                  )}
                  Crear Campaña
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function CampaignStatsModal({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['campaign-stats', campaign.id],
    queryFn: async () => {
      const response = await api.get(`/campaigns/${campaign.id}/stats`);
      return response.data;
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-7 mx-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Estadísticas</h2>
            <p className="text-sm text-gray-500 mt-0.5">{campaign.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 text-center border border-blue-100">
              <p className="text-2xl font-bold text-gray-900">{stats.sent || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Enviados</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 text-center border border-emerald-100">
              <p className="text-2xl font-bold text-gray-900">{stats.delivered || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Entregados</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 text-center border border-purple-100">
              <p className="text-2xl font-bold text-gray-900">{stats.opened || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Abiertos</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 text-center border border-amber-100">
              <p className="text-2xl font-bold text-gray-900">{stats.clicked || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Clicks</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Sin estadísticas disponibles</p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
