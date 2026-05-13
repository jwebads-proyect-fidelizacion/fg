import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Archive, Edit, Loader2, X, ClipboardList } from 'lucide-react';
import api from '../lib/api';

interface Plan {
  id: string;
  name: string;
  durationDays: number;
  price: number;
  currency: string;
  pointsPerAttendance: number;
  isActive: boolean;
  createdAt: string;
}

export default function Plans() {
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const queryClient = useQueryClient();

  const { data: plans, isLoading, error } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: async () => {
      const response = await api.get('/plans');
      return response.data.data || response.data;
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (planId: string) => {
      await api.patch(`/plans/${planId}`, { isActive: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  const formatDuration = (days: number) => {
    if (days === 1) return '1 día';
    if (days === 7) return '1 semana';
    if (days === 14) return '2 semanas';
    if (days === 30) return '1 mes';
    if (days === 60) return '2 meses';
    if (days === 90) return '3 meses';
    if (days === 180) return '6 meses';
    if (days === 365) return '1 año';
    return `${days} días`;
  };

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
        <p className="text-red-700">Error al cargar los planes</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Planes</h1>
        <button
          onClick={() => {
            setEditingPlan(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo Plan
        </button>
      </div>

      {plans && plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <ClipboardList className="h-12 w-12 mb-3 text-gray-300" />
          <p className="font-medium">No hay planes creados</p>
          <p className="text-sm">Cree su primer plan de membresía</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans?.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-xl border p-6 ${
                plan.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-gray-500">{formatDuration(plan.durationDays)}</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    plan.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {plan.isActive ? 'Activo' : 'Archivado'}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Precio</span>
                  <span className="font-medium text-gray-900">
                    ${plan.price.toLocaleString()} {plan.currency}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Puntos por asistencia</span>
                  <span className="font-medium text-gray-900">{plan.pointsPerAttendance}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    setEditingPlan(plan);
                    setShowForm(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Editar
                </button>
                {plan.isActive && (
                  <button
                    onClick={() => {
                      if (confirm('¿Archivar este plan? Los socios actuales no se verán afectados.')) {
                        archiveMutation.mutate(plan.id);
                      }
                    }}
                    className="flex items-center justify-center gap-1 rounded-lg border border-orange-200 px-3 py-1.5 text-sm font-medium text-orange-600 hover:bg-orange-50"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plan Form Modal */}
      {showForm && (
        <PlanFormModal
          plan={editingPlan}
          onClose={() => {
            setShowForm(false);
            setEditingPlan(null);
          }}
        />
      )}
    </div>
  );
}

interface PlanFormModalProps {
  plan: Plan | null;
  onClose: () => void;
}

function PlanFormModal({ plan, onClose }: PlanFormModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: plan?.name || '',
    durationDays: plan?.durationDays?.toString() || '30',
    price: plan?.price?.toString() || '',
    currency: plan?.currency || 'MXN',
    pointsPerAttendance: plan?.pointsPerAttendance?.toString() || '10',
  });

  const mutation = useMutation({
    mutationFn: async (data: Record<string, string | number>) => {
      if (plan) {
        const response = await api.put(`/plans/${plan.id}`, data);
        return response.data;
      } else {
        const response = await api.post('/plans', data);
        return response.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      name: form.name,
      durationDays: parseInt(form.durationDays),
      price: parseFloat(form.price),
      currency: form.currency,
      pointsPerAttendance: parseInt(form.pointsPerAttendance),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {plan ? 'Editar Plan' : 'Nuevo Plan'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {mutation.error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {(mutation.error as any)?.response?.data?.error || 'Error al guardar el plan'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del plan *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Ej: Plan Mensual Premium"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duración (días) *</label>
              <select
                value={form.durationDays}
                onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              >
                <option value="1">1 día</option>
                <option value="7">1 semana</option>
                <option value="14">2 semanas</option>
                <option value="30">1 mes</option>
                <option value="60">2 meses</option>
                <option value="90">3 meses</option>
                <option value="180">6 meses</option>
                <option value="365">1 año</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio *</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
                <option value="COP">COP</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Puntos por asistencia</label>
              <input
                type="number"
                value={form.pointsPerAttendance}
                onChange={(e) => setForm({ ...form, pointsPerAttendance: e.target.value })}
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
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
              {plan ? 'Guardar Cambios' : 'Crear Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
