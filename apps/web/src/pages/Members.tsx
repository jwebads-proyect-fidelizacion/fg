import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Users,
  CheckCircle2,
  UserPlus,
  AlertCircle,
} from 'lucide-react';
import api from '../lib/api';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  pointsBalance: number;
  memberships: Array<{
    status: string;
    plan: { name: string };
  }>;
}

interface MembersResponse {
  data: Member[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function Members() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<MembersResponse>({
    queryKey: ['members', search, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', page.toString());
      params.set('limit', '20');
      const response = await api.get(`/members?${params}`);
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (memberData: Record<string, any>) => {
      const response = await api.post('/members', memberData);
      return response.data;
    },
    onSuccess: (newMember: any) => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setShowCreateModal(false);
      setSuccessMessage(`¡Socio "${newMember.firstName} ${newMember.lastName}" creado exitosamente!`);
      setTimeout(() => setSuccessMessage(''), 5000);
    },
  });

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Socios</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data?.pagination.total ? `${data.pagination.total} socios registrados` : 'Gestión de socios'}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          Nuevo Socio
        </button>
      </div>

      {/* Success Toast */}
      {successMessage && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 shadow-sm animate-in fade-in">
          <div className="rounded-full bg-emerald-100 p-1.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="text-sm font-medium text-emerald-700 flex-1">{successMessage}</p>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-400 hover:text-emerald-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, teléfono o email..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full rounded-2xl border border-gray-200 bg-white pl-12 pr-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none shadow-sm transition-shadow hover:shadow-md"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-8 text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-700 font-medium">Error al cargar los socios</p>
          <p className="text-red-500 text-sm mt-1">Verifique su conexión e intente nuevamente</p>
        </div>
      ) : data && data.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-2xl bg-gradient-to-br from-gray-50 to-indigo-50/30 border border-gray-200">
          <Users className="h-14 w-14 mb-3 text-gray-300" />
          <p className="font-semibold text-gray-600">No se encontraron socios</p>
          <p className="text-sm text-gray-400 mt-1">Intente con otro término de búsqueda</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Nombre</th>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Teléfono</th>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider hidden md:table-cell">Email</th>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Estado</th>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider hidden lg:table-cell">Membresía</th>
                    <th className="text-right px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Puntos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.data.map((member, idx) => (
                    <tr
                      key={member.id}
                      onClick={() => navigate(`/members/${member.id}`)}
                      className={`hover:bg-indigo-50/50 cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs">
                            {member.firstName[0]}{member.lastName[0]}
                          </div>
                          <span className="font-medium text-gray-900">
                            {member.firstName} {member.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">{member.phone}</td>
                      <td className="px-5 py-3.5 text-gray-500 hidden md:table-cell">
                        {member.email || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            member.isActive
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                              : 'bg-gray-100 text-gray-500 ring-1 ring-gray-200'
                          }`}
                        >
                          {member.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 hidden lg:table-cell">
                        {member.memberships?.[0]?.plan?.name || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-semibold text-gray-900">{member.pointsBalance.toLocaleString()}</span>
                        <span className="text-gray-400 text-xs ml-1">pts</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Mostrando {(data.pagination.page - 1) * data.pagination.limit + 1} a{' '}
                {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} de{' '}
                {data.pagination.total} socios
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="rounded-xl border border-gray-200 p-2.5 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-600 px-3 py-1 bg-gray-50 rounded-lg">
                  {page} / {data.pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= data.pagination.totalPages}
                  className="rounded-xl border border-gray-200 p-2.5 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-sm"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Member Modal */}
      {showCreateModal && (
        <CreateMemberModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={(data: any) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
          error={createMutation.error}
        />
      )}
    </div>
  );
}

interface CreateMemberModalProps {
  onClose: () => void;
  onSubmit: (data: Record<string, any>) => void;
  isLoading: boolean;
  error: Error | null;
}

function CreateMemberModal({ onClose, onSubmit, isLoading, error }: CreateMemberModalProps) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    dateOfBirth: '',
  });
  const [phoneError, setPhoneError] = useState('');

  const validatePhone = (phone: string): boolean => {
    const e164Regex = /^\+[1-9]\d{7,14}$/;
    return e164Regex.test(phone);
  };

  const getApiErrorMessage = (err: any): string => {
    if (!err) return '';
    const responseData = err?.response?.data;
    if (responseData?.error) return responseData.error;
    if (responseData?.details) {
      const fields = responseData.details;
      const messages: string[] = [];
      Object.entries(fields).forEach(([key, value]: [string, any]) => {
        if (Array.isArray(value)) {
          messages.push(`${key}: ${value.join(', ')}`);
        }
      });
      if (messages.length > 0) return messages.join('. ');
    }
    if (err.message) return err.message;
    return 'Error al crear el socio. Verifique los datos e intente nuevamente.';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');

    if (!validatePhone(form.phone)) {
      setPhoneError('El teléfono debe estar en formato E.164 (ej: +5491123456789)');
      return;
    }

    onSubmit({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      dateOfBirth: form.dateOfBirth || null,
      marketingConsent: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-7 mx-4 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-100 p-2.5">
              <UserPlus className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Agregar Nuevo Socio</h2>
              <p className="text-xs text-gray-500">Complete los datos del nuevo miembro</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-5 rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Error al crear socio</p>
              <p className="text-sm text-red-600 mt-0.5">{getApiErrorMessage(error)}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre *</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
                placeholder="Ej: Juan Carlos"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Apellido *</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
                placeholder="Ej: Pérez García"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Teléfono (formato internacional) *
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => {
                setForm({ ...form, phone: e.target.value });
                if (phoneError) setPhoneError('');
              }}
              required
              placeholder="Ej: +5491123456789"
              className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:ring-2 outline-none transition-all ${
                phoneError
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/20'
              }`}
            />
            {phoneError && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {phoneError}
              </p>
            )}
            <p className="mt-1.5 text-xs text-gray-400">
              Formato: + código de país + número, sin espacios ni guiones
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email (opcional)</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Ej: juan.perez@gmail.com"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Fecha de nacimiento (opcional)
            </label>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
            <p className="mt-1.5 text-xs text-gray-400">
              Se usará para campañas de cumpleaños automáticas
            </p>
          </div>

          {/* Consent notice */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
            <p className="text-xs text-gray-500">
              <CheckCircle2 className="h-3.5 w-3.5 inline mr-1 text-emerald-500" />
              Al registrar al socio, se acepta el consentimiento para recibir comunicaciones de marketing.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-all hover:shadow-md"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Agregar Socio
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
