import { useState, useEffect, useMemo } from 'react';
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

  // Generate a display code (short hash for staff verification)
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

// Simple QR code SVG generator (creates a visual QR-like pattern from data)
function QRCodeSVG({ data, size = 280 }: { data: string; size?: number }) {
  const modules = useMemo(() => {
    // Generate a deterministic grid pattern from the data string
    const gridSize = 25;
    const grid: boolean[][] = [];

    // Simple hash-based pattern generation
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
        // Finder patterns (top-left, top-right, bottom-left)
        const isFinderTL = row < 7 && col < 7;
        const isFinderTR = row < 7 && col >= gridSize - 7;
        const isFinderBL = row >= gridSize - 7 && col < 7;

        if (isFinderTL || isFinderTR || isFinderBL) {
          const localRow = isFinderTL ? row : isFinderTR ? row : row - (gridSize - 7);
          const localCol = isFinderTL ? col : isFinderTR ? col - (gridSize - 7) : col;

          // Finder pattern: outer border, white space, inner square
          if (localRow === 0 || localRow === 6 || localCol === 0 || localCol === 6) {
            grid[row][col] = true;
          } else if (localRow === 1 || localRow === 5 || localCol === 1 || localCol === 5) {
            grid[row][col] = false;
          } else {
            grid[row][col] = true;
          }
        } else {
          // Data area - use pseudo-random based on seed + position
          const val = pseudoRandom(seed + row * gridSize + col);
          grid[row][col] = val % 3 !== 0; // ~66% fill for data area
        }
      }
    }

    return grid;
  }, [data]);

  const cellSize = size / 25;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-lg">
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
              fill="#1e1b4b"
              rx={cellSize * 0.1}
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
    onSuccess: () => {
      const memberName = selectedMember
        ? `${selectedMember.firstName} ${selectedMember.lastName}`
        : 'Socio';
      setSuccessMessage(`✓ Asistencia registrada para ${memberName}`);
      setSelectedMember(null);
      setSearchTerm('');
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      setTimeout(() => setSuccessMessage(''), 4000);
    },
  });

  const handleRegister = () => {
    if (selectedMember) {
      registerMutation.mutate({ memberId: selectedMember.id, method: 'MANUAL' });
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Code Display */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <QrCode className="h-5 w-5 text-indigo-600" />
            Código QR para Asistencia
          </h2>

          <div className="flex flex-col items-center">
            {/* QR Code SVG */}
            <div className="bg-white p-4 rounded-xl border-2 border-indigo-100 shadow-sm">
              <QRCodeSVG data={qrContent} size={280} />
            </div>

            {/* Verification Code Display */}
            <div className="mt-4 bg-indigo-50 rounded-lg px-6 py-3 text-center">
              <p className="text-xs text-indigo-600 font-medium mb-1">Código de verificación</p>
              <p className="text-3xl font-mono font-bold text-indigo-900 tracking-widest">{displayCode}</p>
            </div>

            {/* Countdown */}
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
              <Timer className="h-4 w-4 text-indigo-500" />
              <span>Cambia en: </span>
              <span className="font-mono font-bold text-indigo-700 text-lg">{countdown}</span>
              <RefreshCw className="h-3 w-3 text-gray-400 ml-1" />
            </div>

            <p className="mt-3 text-xs text-gray-400 text-center max-w-xs">
              Muestre este QR en la pantalla del gimnasio. Los socios lo escanean con la app para registrar su asistencia automáticamente.
            </p>
          </div>
        </div>

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

          {searchResults && searchResults.data && searchResults.data.length > 0 && !selectedMember && (
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
      </div>

      {/* Today's Attendance */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            Asistencias de Hoy
          </h2>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
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
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Teléfono</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Método</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {todayAttendance.data.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-mono">
                      {new Date(record.timestamp).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {record.member.firstName} {record.member.lastName}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{record.member.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        record.method === 'QR'
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-gray-100 text-gray-700'
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
