import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Gift,
  Loader2,
  X,
  Search,
  Star,
} from 'lucide-react';
import api from '../lib/api';

interface Reward {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  stock: number | null;
  redeemed: number;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
}

interface MemberSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  pointsBalance: number;
}

export default function Rewards() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [redeemingReward, setRedeemingReward] = useState<Reward | null>(null);
  const queryClient = useQueryClient();

  const { data: rewards, isLoading, error } = useQuery<Reward[]>({
    queryKey: ['rewards'],
    queryFn: async () => {
      const response = await api.get('/rewards');
      return response.data.data || response.data;
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
        <p className="text-red-700">Error al cargar las recompensas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Recompensas</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva Recompensa
        </button>
      </div>

      {rewards && rewards.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Gift className="h-12 w-12 mb-3 text-gray-300" />
          <p className="font-medium">No hay recompensas creadas</p>
          <p className="text-sm">Cree recompensas para que los socios canjeen sus puntos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rewards?.map((reward) => (
            <div
              key={reward.id}
              className={`bg-white rounded-xl border p-6 ${
                reward.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{reward.name}</h3>
                  {reward.description && (
                    <p className="text-sm text-gray-500 mt-1">{reward.description}</p>
                  )}
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    reward.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {reward.isActive ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Costo en puntos</span>
                  <span className="font-medium text-indigo-600 flex items-center gap-1">
                    <Star className="h-3.5 w-3.5" />
                    {reward.pointsCost.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Stock</span>
                  <span className="font-medium text-gray-900">
                    {reward.stock !== null ? `${reward.stock - reward.redeemed} disponibles` : 'Ilimitado'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Canjeados</span>
                  <span className="font-medium text-gray-900">{reward.redeemed}</span>
                </div>
                {reward.validUntil && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Válido hasta</span>
                    <span className="font-medium text-gray-900">
                      {new Date(reward.validUntil).toLocaleDateString('es-MX')}
                    </span>
                  </div>
                )}
              </div>

              {reward.isActive && (
                <button
                  onClick={() => setRedeemingReward(reward)}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <Gift className="h-4 w-4" />
                  Canjear
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Reward Modal */}
      {showCreateForm && (
        <CreateRewardModal onClose={() => setShowCreateForm(false)} />
      )}

      {/* Redeem Modal */}
      {redeemingReward && (
        <RedeemModal
          reward={redeemingReward}
          onClose={() => setRedeemingReward(null)}
        />
      )}
    </div>
  );
}

function CreateRewardModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    description: '',
    pointsCost: '',
    stock: '',
    validFrom: '',
    validUntil: '',
  });

  const mutation = useMutation({
    mutationFn: async (data: Record<string, string | number | null>) => {
      const response = await api.post('/rewards', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      name: form.name,
      description: form.description || null,
      pointsCost: parseInt(form.pointsCost),
      stock: form.stock ? parseInt(form.stock) : null,
      validFrom: form.validFrom || null,
      validUntil: form.validUntil || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Nueva Recompensa</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {mutation.error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {(mutation.error as any)?.response?.data?.error || 'Error al crear la recompensa'}
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
              placeholder="Ej: Clase grupal gratis"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Descripción de la recompensa..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo en puntos *</label>
              <input
                type="number"
                value={form.pointsCost}
                onChange={(e) => setForm({ ...form, pointsCost: e.target.value })}
                required
                min="1"
                placeholder="100"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock (vacío = ilimitado)</label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                min="0"
                placeholder="Ilimitado"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Válido desde</label>
              <input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Válido hasta</label>
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
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
              Crear Recompensa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RedeemModal({ reward, onClose }: { reward: Reward; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);

  const { data: searchResults } = useQuery<{ data: MemberSearchResult[] }>({
    queryKey: ['member-search-redeem', searchTerm],
    queryFn: async () => {
      const response = await api.get(`/members?search=${encodeURIComponent(searchTerm)}&limit=5`);
      return response.data;
    },
    enabled: searchTerm.length >= 2,
  });

  const redeemMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await api.post(`/rewards/${reward.id}/redeem`, { memberId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Canjear Recompensa</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-indigo-50 rounded-lg p-4 mb-4">
          <p className="font-medium text-indigo-900">{reward.name}</p>
          <p className="text-sm text-indigo-700 flex items-center gap-1 mt-1">
            <Star className="h-3.5 w-3.5" />
            {reward.pointsCost.toLocaleString()} puntos
          </p>
        </div>

        {redeemMutation.error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {(redeemMutation.error as any)?.response?.data?.error || 'Error al canjear'}
          </div>
        )}

        {/* Search Member */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar socio..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedMember(null);
              }}
              className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>

          {searchResults && searchResults.data.length > 0 && !selectedMember && (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
              {searchResults.data.map((member) => (
                <button
                  key={member.id}
                  onClick={() => {
                    setSelectedMember(member);
                    setSearchTerm(`${member.firstName} ${member.lastName}`);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{member.phone}</p>
                  </div>
                  <span className="text-xs font-medium text-indigo-600">
                    {member.pointsBalance.toLocaleString()} pts
                  </span>
                </button>
              ))}
            </div>
          )}

          {selectedMember && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedMember.firstName} {selectedMember.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{selectedMember.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-indigo-600">
                    {selectedMember.pointsBalance.toLocaleString()} pts
                  </p>
                  {selectedMember.pointsBalance < reward.pointsCost && (
                    <p className="text-xs text-red-600">Puntos insuficientes</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => selectedMember && redeemMutation.mutate(selectedMember.id)}
            disabled={
              !selectedMember ||
              redeemMutation.isPending ||
              (selectedMember?.pointsBalance || 0) < reward.pointsCost
            }
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {redeemMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar Canje
          </button>
        </div>
      </div>
    </div>
  );
}
