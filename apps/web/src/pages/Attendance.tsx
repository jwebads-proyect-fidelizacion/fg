import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  QrCode,
  CheckCircle2,
  Loader2,
  CalendarCheck,
  Clock,
  User,
} from 'lucide-react';
import api from '../lib/api';

interface AttendanceRecord {
  id: string;
  timestamp: string;
  method: string;
  member: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}

interface MemberSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  memberships: Array<{
    status: string;
    plan: { name: string };
  }>;
}

export default function Attendance() {
  const [searchTerm, setSearchTerm] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const queryClient = useQueryClient();

  // Search members
  const { data: searchResults, isLoading: searching } = useQuery<{ data: MemberSearchResult[] }>({
    queryKey: ['member-search', searchTerm],
    queryFn: async () => {
      const response = await api.get(`/members?search=${encodeURIComponent(searchTerm)}&limit=5`);
      return response.data;
    },
    enabled: searchTerm.length >= 2,
  });

  // Today's attendance
  const { data: todayAttendance, isLoading: loadingAttendance } = useQuery<{ data: AttendanceRecord[] }>({
    queryKey: ['attendance-today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await api.get(`/attendance?date=${today}&limit=50`);
      return response.data;
    },
    refetchInterval: 30000,
  });

  // Register attendance
  const registerMutation = useMutation({
    mutationFn: async (data: { memberId: string; method: string }) => {
      const response = await api.post('/attendance', data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      const memberName = selectedMember
        ? `${selectedMember.firstName} ${selectedMember.lastName}`
        : 'Socio';
      setSuccessMessage(`Asistencia registrada para ${memberName}`);
      setSelectedMember(null);
      setSearchTerm('');
      setQrCode('');
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      setTimeout(() => setSuccessMessage(''), 4000);
    },
  });

  // QR registration
  const qrMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await api.post('/attendance/qr', { code });
      return response.data;
    },
    onSuccess: (data) => {
      setSuccessMessage(`Asistencia registrada por QR`);
      setQrCode('');
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      setTimeout(() => setSuccessMessage(''), 4000);
    },
  });

  const handleRegister = () => {
    if (selectedMember) {
      registerMutation.mutate({ memberId: selectedMember.id, method: 'MANUAL' });
    }
  };

  const handleQrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (qrCode.trim()) {
      qrMutation.mutate(qrCode.trim());
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Registro de Asistencia</h1>

      {/* Success Message */}
      {successMessage && (
        <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-sm font-medium text-green-700">{successMessage}</p>
        </div>
      )}

      {/* Error Messages */}
      {registerMutation.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">
            {(registerMutation.error as any)?.response?.data?.error || 'Error al registrar asistencia'}
          </p>
        </div>
      )}
      {qrMutation.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">
            {(qrMutation.error as any)?.response?.data?.error || 'Código QR inválido'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Manual Registration */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-indigo-600" />
            Registro Manual
          </h2>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar socio por nombre o teléfono..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedMember(null);
              }}
              className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>

          {/* Search Results */}
          {searching && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando...
            </div>
          )}

          {searchResults && searchResults.data.length > 0 && !selectedMember && (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 mb-4 max-h-48 overflow-y-auto">
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
                  {member.memberships?.[0] && (
                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                      {member.memberships[0].plan.name}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Selected Member */}
          {selectedMember && (
            <div className="bg-indigo-50 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-indigo-900">
                {selectedMember.firstName} {selectedMember.lastName}
              </p>
              <p className="text-xs text-indigo-700">{selectedMember.phone}</p>
              {selectedMember.memberships?.[0] && (
                <p className="text-xs text-indigo-600 mt-1">
                  Plan: {selectedMember.memberships[0].plan.name}
                </p>
              )}
            </div>
          )}

          {/* Register Button */}
          <button
            onClick={handleRegister}
            disabled={!selectedMember || registerMutation.isPending}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-4 text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {registerMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CalendarCheck className="h-5 w-5" />
            )}
            Registrar Asistencia
          </button>
        </div>

        {/* QR Registration */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <QrCode className="h-5 w-5 text-indigo-600" />
            Registro por QR
          </h2>

          <form onSubmit={handleQrSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código QR del socio
              </label>
              <input
                type="text"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                placeholder="Escanee o ingrese el código QR..."
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={!qrCode.trim() || qrMutation.isPending}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-4 text-base font-semibold text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {qrMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <QrCode className="h-5 w-5" />
              )}
              Registrar con QR
            </button>
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 text-center">
              El lector QR registrará automáticamente la asistencia al escanear el código del socio
            </p>
          </div>
        </div>
      </div>

      {/* Today's Attendance */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            Asistencias de Hoy
          </h2>
          <span className="text-sm text-gray-500">
            {todayAttendance?.data?.length || 0} registros
          </span>
        </div>

        {loadingAttendance ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : todayAttendance?.data && todayAttendance.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Hora</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Socio</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Teléfono</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Método</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {todayAttendance.data.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 py-3 text-gray-900">
                      {new Date(record.timestamp).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {record.member.firstName} {record.member.lastName}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{record.member.phone}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                        {record.method === 'QR' ? 'QR' : record.method === 'MANUAL' ? 'Manual' : record.method}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-gray-500">
            <CalendarCheck className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Sin asistencias hoy</p>
            <p className="text-sm">Las asistencias aparecerán aquí al registrarse</p>
          </div>
        )}
      </div>
    </div>
  );
}
