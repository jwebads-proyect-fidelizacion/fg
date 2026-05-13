import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Check,
  CheckCheck,
  Loader2,
  AlertTriangle,
  Info,
  XCircle,
} from 'lucide-react';
import api from '../lib/api';

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl: string | null;
  createdAt: string;
}

const severityIcons: Record<string, typeof AlertTriangle> = {
  HIGH: XCircle,
  MEDIUM: AlertTriangle,
  LOW: Info,
};

const severityColors: Record<string, string> = {
  HIGH: 'text-red-600 bg-red-50',
  MEDIUM: 'text-yellow-600 bg-yellow-50',
  LOW: 'text-blue-600 bg-blue-50',
};

const typeLabels: Record<string, string> = {
  CHURN_RISK: 'Riesgo de abandono',
  MEMBERSHIP_EXPIRING: 'Membresía por vencer',
  PAYMENT_OVERDUE: 'Pago vencido',
  LOW_ATTENDANCE: 'Baja asistencia',
  BIRTHDAY: 'Cumpleaños',
  MILESTONE: 'Hito alcanzado',
  SYSTEM: 'Sistema',
};

export default function Alerts() {
  const queryClient = useQueryClient();

  const { data: alerts, isLoading, error } = useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: async () => {
      const response = await api.get('/alerts');
      return response.data.data || response.data;
    },
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await api.patch(`/alerts/${alertId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/alerts/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const unreadCount = alerts?.filter((a) => !a.isRead).length || 0;

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
        <p className="text-red-700">Error al cargar las alertas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Alertas</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
              {unreadCount} sin leer
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <CheckCheck className="h-4 w-4" />
            Marcar todas como leídas
          </button>
        )}
      </div>

      {alerts && alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Bell className="h-12 w-12 mb-3 text-gray-300" />
          <p className="font-medium">No hay alertas</p>
          <p className="text-sm">Las alertas aparecerán aquí cuando se generen</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts?.map((alert) => {
            const SeverityIcon = severityIcons[alert.severity] || Info;
            const colorClass = severityColors[alert.severity] || 'text-gray-600 bg-gray-50';

            return (
              <div
                key={alert.id}
                className={`bg-white rounded-xl border p-4 transition-colors ${
                  alert.isRead ? 'border-gray-100 opacity-70' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`rounded-lg p-2 flex-shrink-0 ${colorClass}`}>
                    <SeverityIcon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className={`text-sm font-medium ${alert.isRead ? 'text-gray-600' : 'text-gray-900'}`}>
                          {alert.title}
                        </h3>
                        <p className="text-sm text-gray-500 mt-0.5">{alert.message}</p>
                      </div>
                      {!alert.isRead && (
                        <button
                          onClick={() => markReadMutation.mutate(alert.id)}
                          className="flex-shrink-0 rounded p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                          title="Marcar como leída"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-gray-400">
                        {new Date(alert.createdAt).toLocaleString('es-MX')}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {typeLabels[alert.type] || alert.type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
