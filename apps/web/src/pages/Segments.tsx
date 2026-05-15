import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Loader2,
  X,
  Target,
  Users,
  RefreshCw,
  CheckCircle2,
  Eye,
  Tag,
} from 'lucide-react';
import api from '../lib/api';

interface Segment {
  id: string;
  name: string;
  description: string | null;
  type: string;
  criteria: Record<string, unknown>;
  memberCount: number;
  isActive: boolean;
  lastCalculatedAt: string | null;
  createdAt: string;
}

const typeLabels: Record<string, string> = {
  STATIC: 'Estático',
  DYNAMIC: 'Dinámico',
  MANUAL: 'Manual',
};

const riskLabels: Record<string, string> = {
  LOW: 'Bajo',
  MEDIUM: 'Medio',
  HIGH: 'Alto',
};

const membershipStatusLabels: Record<string, string> = {
  ACTIVE: 'Activa',
  EXPIRED: 'Expirada',
  NONE: 'Sin membresía',
};

function CriteriaBadges({ criteria }: { criteria: Record<string, unknown> }) {
  const badges: { label: string; color: string }[] = [];

  if (criteria.riskLevel) {
    const level = criteria.riskLevel as string;
    const colors: Record<string, string> = {
      LOW: 'bg-green-50 text-green-700',
      MEDIUM: 'bg-yellow-50 text-yellow-700',
      HIGH: 'bg-red-50 text-red-700',
    };
    badges.push({
      label: `Riesgo: ${riskLabels[level] || level}`,
      color: colors[level] || 'bg-gray-100 text-gray-700',
    });
  }

  if (criteria.membershipStatus) {
    const status = criteria.membershipStatus as string;
    badges.push({
      label: `Membresía: ${membershipStatusLabels[status] || status}`,
      color: 'bg-indigo-50 text-indigo-700',
    });
  }

  if (criteria.daysWithoutAttendance) {
    badges.push({
      label: `${criteria.daysWithoutAttendance}+ días sin asistir`,
      color: 'bg-orange-50 text-orange-700',
    });
  }

  if (criteria.minAttendance !== undefined && criteria.minAttendance !== null) {
    badges.push({
      label: `Asist. mín: ${criteria.minAttendance}`,
      color: 'bg-blue-50 text-blue-700',
    });
  }

  if (criteria.maxAttendance !== undefined && criteria.maxAttendance !== null) {
    badges.push({
      label: `Asist. máx: ${criteria.maxAttendance}`,
      color: 'bg-blue-50 text-blue-700',
    });
  }

  if (criteria.minAge) {
    badges.push({
      label: `Edad mín: ${criteria.minAge}`,
      color: 'bg-purple-50 text-purple-700',
    });
  }

  if (criteria.maxAge) {
    badges.push({
      label: `Edad máx: ${criteria.maxAge}`,
      color: 'bg-purple-50 text-purple-700',
    });
  }

  if (badges.length === 0) {
    return <span className="text-xs text-gray-400 italic">Sin criterios definidos</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge, idx) => (
        <span
          key={idx}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}
        >
          <Tag className="h-3 w-3" />
          {badge.label}
        </span>
      ))}
    </div>
  );
}

export default function Segments() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const queryClient = useQueryClient();

  const { data: segments, isLoading, error } = useQuery<Segment[]>({
    queryKey: ['segments'],
    queryFn: async () => {
      const response = await api.get('/segments');
      return response.data.data || response.data;
    },
  });

  const recalculateMutation = useMutation({
    mutationFn: async (segmentId: string) => {
      await api.post(`/segments/${segmentId}/recalculate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      setSuccessMessage('Segmento recalculado exitosamente');
      setTimeout(() => setSuccessMessage(''), 3000);
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
        <p className="text-red-700">Error al cargar los segmentos</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Segmentos</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo Segmento
        </button>
      </div>

      {/* Success Toast */}
      {successMessage && (
        <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-sm font-medium text-green-700">{successMessage}</p>
        </div>
      )}

      {segments && segments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Target className="h-12 w-12 mb-3 text-gray-300" />
          <p className="font-medium">No hay segmentos creados</p>
          <p className="text-sm">Cree segmentos para organizar sus campañas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments?.map((segment) => (
            <div
              key={segment.id}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{segment.name}</h3>
                  {segment.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{segment.description}</p>
                  )}
                </div>
                <span className="ml-2 flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700">
                  {typeLabels[segment.type] || segment.type}
                </span>
              </div>

              {/* Criteria Badges */}
              <div className="mb-4">
                <CriteriaBadges criteria={segment.criteria} />
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-900">
                  {segment.memberCount.toLocaleString()} socios
                </span>
              </div>

              {segment.lastCalculatedAt && (
                <p className="text-xs text-gray-400 mb-4">
                  Última actualización: {new Date(segment.lastCalculatedAt).toLocaleString('es-MX')}
                </p>
              )}

              {segment.type === 'DYNAMIC' && (
                <button
                  onClick={() => recalculateMutation.mutate(segment.id)}
                  disabled={recalculateMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
                  Recalcular
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Segment Modal */}
      {showCreateForm && (
        <CreateSegmentModal
          onClose={() => setShowCreateForm(false)}
          onSuccess={() => {
            setSuccessMessage('Segmento creado exitosamente');
            setTimeout(() => setSuccessMessage(''), 3000);
          }}
        />
      )}
    </div>
  );
}

function CreateSegmentModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'DYNAMIC',
    // Criteria
    daysWithoutAttendance: '',
    membershipStatus: '',
    riskLevel: '',
    minAge: '',
    maxAge: '',
    minAttendance: '',
    maxAttendance: '',
  });
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const buildCriteria = () => {
    const criteria: Record<string, unknown> = {};
    if (form.daysWithoutAttendance) criteria.daysWithoutAttendance = parseInt(form.daysWithoutAttendance);
    if (form.membershipStatus) criteria.membershipStatus = form.membershipStatus;
    if (form.riskLevel) criteria.riskLevel = form.riskLevel;
    if (form.minAge) criteria.minAge = parseInt(form.minAge);
    if (form.maxAge) criteria.maxAge = parseInt(form.maxAge);
    if (form.minAttendance) criteria.minAttendance = parseInt(form.minAttendance);
    if (form.maxAttendance) criteria.maxAttendance = parseInt(form.maxAttendance);
    return criteria;
  };

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await api.post('/segments', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      onClose();
      onSuccess();
    },
  });

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const criteria = buildCriteria();
      const response = await api.post('/segments/preview', { criteria });
      setPreviewCount(response.data.count ?? response.data.memberCount ?? 0);
    } catch {
      setPreviewCount(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const criteria = buildCriteria();

    mutation.mutate({
      name: form.name,
      description: form.description || null,
      type: form.type,
      criteria,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 mx-4 my-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Nuevo Segmento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {mutation.error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {(mutation.error as any)?.response?.data?.error || 'Error al crear el segmento'}
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
              placeholder="Ej: Socios en riesgo alto"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descripción del segmento..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="DYNAMIC">Dinámico (se actualiza automáticamente)</option>
              <option value="STATIC">Estático</option>
              <option value="MANUAL">Manual</option>
            </select>
          </div>

          {/* Criteria Builder */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-indigo-600" />
              Criterios de segmentación
            </p>

            <div className="space-y-3 bg-gray-50 rounded-lg p-4">
              {/* Days without attendance */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Días sin asistir
                </label>
                <input
                  type="number"
                  value={form.daysWithoutAttendance}
                  onChange={(e) => setForm({ ...form, daysWithoutAttendance: e.target.value })}
                  min="0"
                  placeholder="Ej: 7 (socios que no vienen hace 7+ días)"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
                />
              </div>

              {/* Membership status */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Estado de membresía
                </label>
                <select
                  value={form.membershipStatus}
                  onChange={(e) => setForm({ ...form, membershipStatus: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
                >
                  <option value="">Cualquiera</option>
                  <option value="ACTIVE">Activa</option>
                  <option value="EXPIRED">Expirada</option>
                  <option value="NONE">Sin membresía</option>
                </select>
              </div>

              {/* Risk level */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Nivel de riesgo de abandono
                </label>
                <select
                  value={form.riskLevel}
                  onChange={(e) => setForm({ ...form, riskLevel: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
                >
                  <option value="">Cualquiera</option>
                  <option value="LOW">Bajo</option>
                  <option value="MEDIUM">Medio</option>
                  <option value="HIGH">Alto</option>
                </select>
              </div>

              {/* Age range */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Rango de edad
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={form.minAge}
                    onChange={(e) => setForm({ ...form, minAge: e.target.value })}
                    min="0"
                    max="120"
                    placeholder="Edad mínima"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
                  />
                  <input
                    type="number"
                    value={form.maxAge}
                    onChange={(e) => setForm({ ...form, maxAge: e.target.value })}
                    min="0"
                    max="120"
                    placeholder="Edad máxima"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
                  />
                </div>
              </div>

              {/* Attendance range (30 days) */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Asistencias en últimos 30 días
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={form.minAttendance}
                    onChange={(e) => setForm({ ...form, minAttendance: e.target.value })}
                    min="0"
                    placeholder="Mínimo"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
                  />
                  <input
                    type="number"
                    value={form.maxAttendance}
                    onChange={(e) => setForm({ ...form, maxAttendance: e.target.value })}
                    min="0"
                    placeholder="Máximo"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preview Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewLoading}
              className="flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              {previewLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Vista previa
            </button>
            {previewCount !== null && (
              <span className="text-sm text-gray-700">
                <span className="font-semibold text-indigo-700">{previewCount}</span> socios coinciden con estos criterios
              </span>
            )}
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
              Crear Segmento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
