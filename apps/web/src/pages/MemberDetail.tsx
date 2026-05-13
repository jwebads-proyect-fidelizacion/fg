import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit,
  UserX,
  CreditCard,
  CalendarCheck,
  Star,
  Wallet,
  Loader2,
  Phone,
  Mail,
  Hash,
  Calendar,
} from 'lucide-react';
import api from '../lib/api';

interface MemberDetail {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  dateOfBirth: string | null;
  documentId: string | null;
  isActive: boolean;
  pointsBalance: number;
  referralCode: string;
  riskLevel: string | null;
  marketingConsent: boolean;
  createdAt: string;
  memberships: Array<{
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    plan: { name: string; durationDays: number; price: number };
  }>;
  attendances: Array<{
    id: string;
    timestamp: string;
    method: string;
  }>;
  pointMovements: Array<{
    id: string;
    type: string;
    amount: number;
    reason: string;
    createdAt: string;
  }>;
  tags: Array<{ id: string; tag: string }>;
}

const tabs = [
  { id: 'memberships', label: 'Membresías', icon: CreditCard },
  { id: 'attendance', label: 'Asistencias', icon: CalendarCheck },
  { id: 'points', label: 'Puntos', icon: Star },
  { id: 'payments', label: 'Pagos', icon: Wallet },
];

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('memberships');
  const [editing, setEditing] = useState(false);

  const { data: member, isLoading, error } = useQuery<MemberDetail>({
    queryKey: ['member', id],
    queryFn: async () => {
      const response = await api.get(`/members/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member', id] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, string | boolean | null>) => {
      const response = await api.put(`/members/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member', id] });
      setEditing(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/members')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Volver a socios
        </button>
        <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
          <p className="text-red-700">Socio no encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/members')}
          className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {member.firstName} {member.lastName}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                member.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {member.isActive ? 'Activo' : 'Inactivo'}
            </span>
            {member.riskLevel && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  member.riskLevel === 'HIGH'
                    ? 'bg-red-50 text-red-700'
                    : member.riskLevel === 'MEDIUM'
                    ? 'bg-yellow-50 text-yellow-700'
                    : 'bg-green-50 text-green-700'
                }`}
              >
                Riesgo: {member.riskLevel === 'HIGH' ? 'Alto' : member.riskLevel === 'MEDIUM' ? 'Medio' : 'Bajo'}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Edit className="h-4 w-4" />
            Editar
          </button>
          {member.isActive && (
            <button
              onClick={() => {
                if (confirm('¿Está seguro de dar de baja a este socio?')) {
                  deactivateMutation.mutate();
                }
              }}
              className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <UserX className="h-4 w-4" />
              Dar de baja
            </button>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Teléfono</p>
              <p className="text-sm font-medium text-gray-900">{member.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm font-medium text-gray-900">{member.email || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Hash className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Código de referido</p>
              <p className="text-sm font-medium text-gray-900">{member.referralCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Miembro desde</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(member.createdAt).toLocaleDateString('es-MX')}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100 flex items-center gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-600">{member.pointsBalance.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Puntos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{member.memberships.length}</p>
            <p className="text-xs text-gray-500">Membresías</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{member.attendances.length}</p>
            <p className="text-xs text-gray-500">Asistencias recientes</p>
          </div>
          {member.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 ml-auto">
              {member.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                >
                  {tag.tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {activeTab === 'memberships' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Inicio</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fin</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {member.memberships.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Sin membresías registradas
                    </td>
                  </tr>
                ) : (
                  member.memberships.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">{m.plan.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            m.status === 'ACTIVE'
                              ? 'bg-green-50 text-green-700'
                              : m.status === 'EXPIRED'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-yellow-50 text-yellow-700'
                          }`}
                        >
                          {m.status === 'ACTIVE' ? 'Activa' : m.status === 'EXPIRED' ? 'Expirada' : m.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(m.startDate).toLocaleDateString('es-MX')}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(m.endDate).toLocaleDateString('es-MX')}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        ${m.plan.price.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha y Hora</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Método</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {member.attendances.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-gray-500">
                      Sin asistencias registradas
                    </td>
                  </tr>
                ) : (
                  member.attendances.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-3 text-gray-900">
                        {new Date(a.timestamp).toLocaleString('es-MX')}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {a.method === 'QR' ? 'Código QR' : a.method === 'MANUAL' ? 'Manual' : a.method}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'points' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Razón</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Puntos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {member.pointMovements.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      Sin movimientos de puntos
                    </td>
                  </tr>
                ) : (
                  member.pointMovements.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(p.createdAt).toLocaleDateString('es-MX')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.type === 'EARN' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {p.type === 'EARN' ? 'Ganado' : 'Canjeado'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.reason}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        <span className={p.type === 'EARN' ? 'text-green-600' : 'text-red-600'}>
                          {p.type === 'EARN' ? '+' : '-'}{Math.abs(p.amount)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="p-8 text-center text-gray-500">
            <Wallet className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Historial de pagos</p>
            <p className="text-sm">Los pagos se muestran asociados a cada membresía</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <EditMemberModal
          member={member}
          onClose={() => setEditing(false)}
          onSubmit={(data) => updateMutation.mutate(data)}
          isLoading={updateMutation.isPending}
          error={updateMutation.error}
        />
      )}
    </div>
  );
}

interface EditMemberModalProps {
  member: MemberDetail;
  onClose: () => void;
  onSubmit: (data: Record<string, string | boolean | null>) => void;
  isLoading: boolean;
  error: Error | null;
}

function EditMemberModal({ member, onClose, onSubmit, isLoading, error }: EditMemberModalProps) {
  const [form, setForm] = useState({
    firstName: member.firstName,
    lastName: member.lastName,
    phone: member.phone,
    email: member.email || '',
    documentId: member.documentId || '',
    marketingConsent: member.marketingConsent,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      email: form.email || null,
      documentId: form.documentId || null,
      marketingConsent: form.marketingConsent,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Editar Socio</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="sr-only">Cerrar</span>✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {(error as any)?.response?.data?.error || 'Error al actualizar'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="editMarketingConsent"
              checked={form.marketingConsent}
              onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="editMarketingConsent" className="text-sm text-gray-700">
              Acepta comunicaciones de marketing
            </label>
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
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
