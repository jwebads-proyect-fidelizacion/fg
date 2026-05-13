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
  SCHEDULED: 'bg-blue-50 text-blue-700',
  RUNNING: 'bg-green-50 text-green-700',
  PAUSED: 'bg-yellow-50 text-yellow-700',
  COMPLETED: 'bg-indigo-50 text-indigo-700',
  CANCELLED: 'bg-red-50 text-red-700',
};

const typeLabels: Record<string, string> = {
  WELCOME: 'Bienvenida',
  RENEWAL: 'Renovación',
  REACTIVATION: 'Reactivación',
  PROMOTION: 'Promoción',
  BIRTHDAY: 'Cumpleaños',
  CUSTOM: 'Personalizada',
};

export default function Campaigns() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedStats, setSelectedStats] = useState<Campaign | null>(null);
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
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
        <p className="text-red-700">Error al cargar las campañas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Campañas</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva Campaña
        </button>
      </div>

      {campaigns && campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Megaphone className="h-12 w-12 mb-3 text-gray-300" />
          <p className="font-medium">No hay campañas creadas</p>
          <p className="text-sm">Cree su primera campaña de marketing</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Canal</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Fecha</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns?.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{campaign.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {typeLabels[campaign.type] || campaign.type}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusColors[campaign.status] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {statusLabels[campaign.status] || campaign.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {campaign.channel === 'WHATSAPP' ? 'WhatsApp' : campaign.channel === 'EMAIL' ? 'Email' : campaign.channel}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                      {campaign.scheduledAt
                        ? new Date(campaign.scheduledAt).toLocaleDateString('es-MX')
                        : campaign.startedAt
                        ? new Date(campaign.startedAt).toLocaleDateString('es-MX')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {campaign.status === 'RUNNING' && (
                          <button
                            onClick={() => statusMutation.mutate({ id: campaign.id, action: 'pause' })}
                            className="rounded p-1.5 text-yellow-600 hover:bg-yellow-50"
                            title="Pausar"
                          >
                            <Pause className="h-4 w-4" />
                          </button>
                        )}
                        {campaign.status === 'PAUSED' && (
                          <button
                            onClick={() => statusMutation.mutate({ id: campaign.id, action: 'resume' })}
                            className="rounded p-1.5 text-green-600 hover:bg-green-50"
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
                            className="rounded p-1.5 text-red-600 hover:bg-red-50"
                            title="Cancelar"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedStats(campaign)}
                          className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50"
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

      {/* Create Campaign Modal */}
      {showCreateForm && (
        <CreateCampaignModal onClose={() => setShowCreateForm(false)} />
      )}

      {/* Stats Modal */}
      {selectedStats && (
        <CampaignStatsModal campaign={selectedStats} onClose={() => setSelectedStats(null)} />
      )}
    </div>
  );
}

function CreateCampaignModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    type: 'PROMOTION',
    channel: 'WHATSAPP',
    message: '',
    scheduledAt: '',
  });

  const mutation = useMutation({
    mutationFn: async (data: Record<string, string | null>) => {
      const response = await api.post('/campaigns', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      name: form.name,
      type: form.type,
      channel: form.channel,
      message: form.message,
      scheduledAt: form.scheduledAt || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Nueva Campaña</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {mutation.error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {(mutation.error as any)?.response?.data?.error || 'Error al crear la campaña'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Ej: Promoción Enero 2024"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Canal</label>
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              >
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje *</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              required
              rows={4}
              placeholder="Escriba el mensaje de la campaña..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha programada (opcional)
            </label>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear Campaña
            </button>
          </div>
        </form>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Estadísticas</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">{campaign.name}</p>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.sent || 0}</p>
              <p className="text-xs text-gray-500">Enviados</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.delivered || 0}</p>
              <p className="text-xs text-gray-500">Entregados</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.opened || 0}</p>
              <p className="text-xs text-gray-500">Abiertos</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.clicked || 0}</p>
              <p className="text-xs text-gray-500">Clicks</p>
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-4">Sin estadísticas disponibles</p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
