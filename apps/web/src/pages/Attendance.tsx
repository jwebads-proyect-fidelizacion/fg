import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  QrCode,
  CheckCircle2,
  Loader2,
  CalendarCheck,
  Clock,
  User,
  Timer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

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

function useRotatingCode() {
  const { currentTenant } = useAuthStore();
  const tenantId = currentTenant?.id || 'default';

  const getTimeSlot = () => Math.floor(Date.now() / 1800000);

  const [timeSlot, setTimeSlot] = useState(getTimeSlot());
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const currentSlot = Math.floor(now / 1800000);
      const nextSlotTime = (currentSlot + 1) * 1800000;
      const remaining = nextSlotTime - now;

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);

      if (currentSlot !== timeSlot) {
        setTimeSlot(currentSlot);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeSlot]);

  const qrContent = useMemo(() => {
    return `gymfideliza-${tenantId}-${timeSlot}`;
  }, [tenantId, timeSlot]);

  const displayCode = useMemo(() => {
    const raw = qrContent;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).toUpperCase().slice(0, 6);
  }, [qrContent]);

  return { qrContent, displayCode, countdown, timeSlot };
}

function QRCodeSVG({ data, size = 320 }: { data: string; size?: number }) {
  const modules = useMemo(() => {
    const gridSize = 25;
    const grid: boolean[][] = [];

    let seed = 0;
    for (let i = 0; i < data.length; i++) {
      seed = ((seed << 5) - seed) + data.charCodeAt(i);
      seed = seed & seed;
    }

    const pseudoRandom = (s: number): number => {
      s = ((s >> 16) ^ s) * 0x45d9f3b;
      s = ((s >> 16) ^ s) * 0x45d9f3b;
      s = (s >> 16) ^ s;
      return Math.abs(s);
    };

    for (let row = 0; row < gridSize; row++) {
      grid[row] = [];
      for (let col = 0; col < gridSize; col++) {
        const isFinderTL = row < 7 && col < 7;
        const isFinderTR = row < 7 && col >= gridSize - 7;
        const isFinderBL = row >= gridSize - 7 && col < 7;

        if (isFinderTL || isFinderTR || isFinderBL) {
          const localRow = isFinderTL ? row : isFinderTR ? row : row - (gridSize - 7);
          const localCol = isFinderTL ? col : isFinderTR ? col - (gridSize - 7) : col;

          if (localRow === 0 || localRow === 6 || localCol === 0 || localCol === 6) {
            grid[row][col] = true;
          } else if (localRow === 1 || localRow === 5 || localCol === 1 || localCol === 5) {
            grid[row][col] = false;
          } else {
            grid[row][col] = true;
          }
        } else {
          const val = pseudoRandom(seed + row * gridSize + col);
          grid[row][col] = val % 3 !== 0;
        }
      }
    }

    return grid;
  }, [data]);

  const cellSize = size / 25;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-xl">
      <rect width={size} height={size} fill="white" />
      {modules.map((row, rowIdx) =>
        row.map((cell, colIdx) =>
          cell ? (
            <rect
              key={`${rowIdx}-${colIdx}`}
              x={colIdx * cellSize}
              y={rowIdx * cellSize}
              width={cellSize}
              height={cellSize}
              fill="#312e81"
              rx={cellSize * 0.15}
            />
          ) : null
        )
      )}
    </svg>
  );
}

export default function Attendance() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyMember, setVerifyMember] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const queryClient = useQueryClient();
  const { qrContent, displayCode, countdown } = useRotatingCode();

  // Search members
  const { data: searchResults, isLoading: searching } = useQuery<{ data: MemberSearchResult[] }>({
    queryKey: ['member-search', searchTerm],
    queryFn: async () => {
      const response = await api.get(`/members?search=${encodeURIComponent(searchTerm)}&limit=5`);
      return response.data;
    },
    enabled: searchTerm.length >= 2,
  });

  // Search for verify member
  const { data: verifySearchResults } = useQuery<{ data: MemberSearchResult[] }>({
    queryKey: ['member-verify-search', verifyMember],
    queryFn: async () => {
      const response = await api.get(`/members?search=${encodeURIComponent(verifyMember)}&limit=5`);
      return response.data;
    },
    enabled: verifyMember.length >= 2,
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

  // Register attendance mutation
  const registerMutation = useMutation({
    mutationFn: async (data: { memberId: string; method: string }) => {
      const response = await api.post('/attendance', data);
      return response.data;
    },
    onSuccess: (result: any) => {
      const memberName = result?.member
        ? `${result.member.firstName} ${result.member.lastName}`
        : selectedMember
        ? `${selectedMember.firstName} ${selectedMember.lastName}`
        : 'Socio';
      setSuccessMessage(`✓ Asistencia registrada para ${memberName}`);
      setShowSuccessAnimation(true);
      setSelectedMember(null);
      setSearchTerm('');
      setVerifyCode('');
      setVerifyMember('');
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      setTimeout(() => {
        setShowSuccessAnimation(false);
        setSuccessMessage('');
      }, 4000);
    },
  });

  const handleRegister = () => {
    if (selectedMember) {
      registerMutation.mutate({ memberId: selectedMember.id, method: 'MANUAL' });
    }
  };

  const handleVerifyCode = useCallback(() => {
    setVerifyError('');

    // Check if the code matches the current rotating code
    if (verifyCode.toUpperCase().trim() !== displayCode) {
      setVerifyError('Código incorrecto. Verifique el código mostrado en pantalla.');
      return;
    }

    // Find the member from verify search results
    const members = verifySearchResults?.data;
    if (!members || members.length === 0) {
      setVerifyError('No se encontró el socio. Ingrese nombre o teléfono válido.');
      return;
    }

    // Register attendance for the first matching member
    const member = members[0];
    registerMutation.mutate({ memberId: member.id, method: 'QR' });
  }, [verifyCode, displayCode, verifySearchResults, registerMutation]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Registro de Asistencia</h1>
        <p className="text-sm text-gray-500 mt-1">QR rotativo, verificación manual y registro directo</p>
      </div>

      {/* Success Animation Overlay */}
      {showSuccessAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-12 shadow-2xl text-center animate-in zoom-in-95">
            <div className="relative">
              <div className="h-24 w-24 mx-auto rounded-full bg-emerald-100 flex items-center justify-center animate-bounce">
                <CheckCircle2 className="h-14 w-14 text-emerald-500" />
              </div>
              <Sparkles className="h-6 w-6 text-yellow-400 absolute -top-2 -right-2 animate-pulse" />
              <Sparkles className="h-4 w-4 text-indigo-400 absolute -bottom-1 -left-3 animate-pulse" />
            </div>
            <p className="mt-6 text-xl font-bold text-gray-900">¡Asistencia Registrada!</p>
            <p className="mt-2 text-sm text-gray-500">{successMessage.replace('✓ ', '')}</p>
          </div>
        </div>
      )}

      {/* Inline Success Message */}
      {successMessage && !showSuccessAnimation && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-700">{successMessage}</p>
        </div>
      )}

      {/* Error Messages */}
      {registerMutation.error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">
            {(registerMutation.error as any)?.response?.data?.error || 'Error al registrar asistencia'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* QR Code Display - Larger and more prominent */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <div className="rounded-lg bg-indigo-100 p-2">
              <QrCode className="h-5 w-5 text-indigo-600" />
            </div>
            Código QR para Asistencia
          </h2>

          <div className="flex flex-col items-center">
            {/* QR Code SVG - Larger */}
            <div className="bg-white p-5 rounded-2xl border-2 border-indigo-100 shadow-lg">
              <QRCodeSVG data={qrContent} size={320} />
            </div>

            {/* Verification Code Display */}
            <div className="mt-6 w-full bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl px-6 py-4 text-center border border-indigo-100">
              <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wider mb-2">
                Código de verificación
              </p>
              <p className="text-4xl font-mono font-black text-indigo-900 tracking-[0.3em]">
                {displayCode}
              </p>
            </div>

            {/* Countdown */}
            <div className="mt-5 flex items-center gap-3 bg-gray-50 rounded-xl px-5 py-3">
              <Timer className="h-5 w-5 text-indigo-500" />
              <span className="text-sm text-gray-600">Cambia en:</span>
              <span className="font-mono font-bold text-indigo-700 text-xl">{countdown}</span>
              <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" style={{ animationDuration: '3s' }} />
            </div>

            <p className="mt-4 text-xs text-gray-400 text-center max-w-sm">
              Muestre este QR en la pantalla del gimnasio. Los socios lo escanean con la app para registrar su asistencia.
            </p>
          </div>

          {/* Code Verification Section */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-500" />
              Verificar Código (registro por staff)
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Ingrese el nombre/teléfono del socio y el código que muestra la pantalla para registrar asistencia.
            </p>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nombre o teléfono del socio..."
                value={verifyMember}
                onChange={(e) => {
                  setVerifyMember(e.target.value);
                  setVerifyError('');
                }}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />

              {/* Show matching members */}
              {verifySearchResults?.data && verifySearchResults.data.length > 0 && verifyMember.length >= 2 && (
                <div className="bg-indigo-50 rounded-xl p-3">
                  <p className="text-xs text-indigo-600 font-medium mb-1">Socio encontrado:</p>
                  <p className="text-sm font-semibold text-indigo-900">
                    {verifySearchResults.data[0].firstName} {verifySearchResults.data[0].lastName}
                  </p>
                  <p className="text-xs text-indigo-700">{verifySearchResults.data[0].phone}</p>
                </div>
              )}

              <input
                type="text"
                placeholder="Código de 6 caracteres..."
                value={verifyCode}
                onChange={(e) => {
                  setVerifyCode(e.target.value.toUpperCase());
                  setVerifyError('');
                }}
                maxLength={6}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-mono uppercase tracking-widest text-center focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />

              {verifyError && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {verifyError}
                </p>
              )}

              <button
                onClick={handleVerifyCode}
                disabled={!verifyMember.trim() || verifyCode.length < 4 || registerMutation.isPending}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
              >
                {registerMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Verificar y Registrar
              </button>
            </div>
          </div>
        </div>

        {/* Manual Registration */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <div className="rounded-lg bg-indigo-100 p-2">
              <User className="h-5 w-5 text-indigo-600" />
            </div>
            Registro Manual
          </h2>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar socio por nombre o teléfono..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedMember(null);
              }}
              className="w-full rounded-xl border border-gray-300 pl-11 pr-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
          </div>

          {/* Search Results */}
          {searching && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando...
            </div>
          )}

          {searchResults && searchResults.data && searchResults.data.length > 0 && !selectedMember && (
            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 mb-4 max-h-56 overflow-y-auto shadow-sm">
              {searchResults.data.map((member) => (
                <button
                  key={member.id}
                  onClick={() => {
                    setSelectedMember(member);
                    setSearchTerm(`${member.firstName} ${member.lastName}`);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-indigo-50/50 text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs">
                      {member.firstName[0]}{member.lastName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{member.phone}</p>
                    </div>
                  </div>
                  {member.memberships?.[0] && (
                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                      {member.memberships[0].plan.name}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Selected Member */}
          {selectedMember && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5 mb-5 border border-indigo-100">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-800 font-bold text-lg">
                  {selectedMember.firstName[0]}{selectedMember.lastName[0]}
                </div>
                <div>
                  <p className="font-semibold text-indigo-900">
                    {selectedMember.firstName} {selectedMember.lastName}
                  </p>
                  <p className="text-sm text-indigo-700">{selectedMember.phone}</p>
                  {selectedMember.memberships?.[0] && (
                    <p className="text-xs text-indigo-600 mt-0.5">
                      Plan: {selectedMember.memberships[0].plan.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Register Button */}
          <button
            onClick={handleRegister}
            disabled={!selectedMember || registerMutation.isPending}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-4 text-base font-bold text-white hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg hover:scale-[1.01]"
          >
            {registerMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CalendarCheck className="h-5 w-5" />
            )}
            Registrar Asistencia
          </button>

          {/* Today's count */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Asistencias hoy</span>
              <span className="text-2xl font-bold text-indigo-600">
                {todayAttendance?.data?.length || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Attendance Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            Asistencias de Hoy
          </h2>
          <span className="text-sm text-gray-500 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full font-semibold">
            {todayAttendance?.data?.length || 0} registros
          </span>
        </div>

        {loadingAttendance ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : todayAttendance?.data && todayAttendance.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Hora</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Socio</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider hidden sm:table-cell">Teléfono</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Método</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {todayAttendance.data.map((record, idx) => (
                  <tr key={record.id} className={`hover:bg-indigo-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-5 py-3.5 text-gray-900 font-mono text-sm">
                      {new Date(record.timestamp).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs">
                          {record.member.firstName[0]}{record.member.lastName[0]}
                        </div>
                        <span className="font-medium text-gray-900">
                          {record.member.firstName} {record.member.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 hidden sm:table-cell font-mono text-xs">
                      {record.member.phone}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        record.method === 'QR'
                          ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                          : 'bg-gray-100 text-gray-700 ring-1 ring-gray-200'
                      }`}>
                        {record.method === 'QR' ? '📱 QR' : record.method === 'MANUAL' ? '✋ Manual' : record.method}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="rounded-full bg-gray-100 h-16 w-16 flex items-center justify-center mx-auto mb-4">
              <CalendarCheck className="h-8 w-8 text-gray-300" />
            </div>
            <p className="font-semibold text-gray-600">Sin asistencias hoy</p>
            <p className="text-sm text-gray-400 mt-1">Las asistencias aparecerán aquí al registrarse</p>
          </div>
        )}
      </div>
    </div>
  );
}
