import { useQuery } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CalendarCheck,
  DollarSign,
  Target,
  Loader2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import api from '../lib/api';

interface DashboardData {
  members: {
    total: number;
    active: number;
    new: number;
    newPreviousPeriod: number;
    atRisk: number;
  };
  retention: {
    rate: number;
    churnRate: number;
    churnCount: number;
  };
  attendance: {
    today: number;
    last30Days: number;
    avgPerMember: number;
  };
  revenue: {
    currentMonth: number;
    lastMonth: number;
    projected: number;
    currency: string;
  };
  generatedAt: string;
}

function formatCurrency(amount: number, currency: string = 'MXN') {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Dashboard() {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await api.get('/dashboard');
      return response.data;
    },
    refetchInterval: 60000,
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
        <p className="text-red-700 font-medium">Error al cargar el dashboard</p>
        <p className="text-red-600 text-sm mt-1">Verifique su conexión e intente nuevamente</p>
      </div>
    );
  }

  if (!data) return null;

  const metrics = [
    {
      name: 'Socios Activos',
      value: data.members.active,
      total: data.members.total,
      icon: Users,
      color: 'bg-indigo-50 text-indigo-600',
      description: `de ${data.members.total} totales`,
    },
    {
      name: 'Nuevos Socios',
      value: data.members.new,
      icon: UserPlus,
      color: 'bg-green-50 text-green-600',
      trend: data.members.newPreviousPeriod > 0
        ? Math.round(((data.members.new - data.members.newPreviousPeriod) / data.members.newPreviousPeriod) * 100)
        : 0,
      description: 'últimos 30 días',
    },
    {
      name: 'Retención',
      value: `${data.retention.rate}%`,
      icon: TrendingUp,
      color: 'bg-blue-50 text-blue-600',
      description: 'tasa mensual',
    },
    {
      name: 'Churn',
      value: `${data.retention.churnRate}%`,
      icon: TrendingDown,
      color: 'bg-orange-50 text-orange-600',
      description: `${data.retention.churnCount} socios perdidos`,
    },
    {
      name: 'En Riesgo',
      value: data.members.atRisk,
      icon: AlertTriangle,
      color: 'bg-red-50 text-red-600',
      description: 'requieren atención',
    },
    {
      name: 'Asistencia Hoy',
      value: data.attendance.today,
      icon: CalendarCheck,
      color: 'bg-purple-50 text-purple-600',
      description: `promedio ${data.attendance.avgPerMember}/socio`,
    },
    {
      name: 'Ingresos Mes',
      value: formatCurrency(data.revenue.currentMonth, data.revenue.currency),
      icon: DollarSign,
      color: 'bg-emerald-50 text-emerald-600',
      description: `anterior: ${formatCurrency(data.revenue.lastMonth, data.revenue.currency)}`,
    },
    {
      name: 'Ingresos Proyectados',
      value: formatCurrency(data.revenue.projected, data.revenue.currency),
      icon: Target,
      color: 'bg-cyan-50 text-cyan-600',
      description: 'estimación fin de mes',
    },
  ];

  // Generate mock revenue trend data based on current month revenue
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dailyAvg = data.revenue.currentMonth / Math.max(new Date().getDate(), 1);
  const revenueTrend = Array.from({ length: new Date().getDate() }, (_, i) => ({
    dia: `${i + 1}`,
    ingresos: Math.round(dailyAvg * (0.7 + Math.random() * 0.6) * (i + 1) * 100) / 100,
    acumulado: Math.round((dailyAvg * (i + 1)) * 100) / 100,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Actualizado: {new Date(data.generatedAt).toLocaleString('es-MX')}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div
            key={metric.name}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">{metric.name}</span>
              <div className={`rounded-lg p-2 ${metric.color}`}>
                <metric.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-gray-900">{metric.value}</span>
              {'trend' in metric && metric.trend !== undefined && metric.trend !== 0 && (
                <span
                  className={`text-xs font-medium ${
                    metric.trend > 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {metric.trend > 0 ? '+' : ''}{metric.trend}%
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">{metric.description}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ingresos Acumulados del Mes</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Acumulado']}
                  labelFormatter={(label) => `Día ${label}`}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Area
                  type="monotone"
                  dataKey="acumulado"
                  stroke="#4f46e5"
                  fill="#eef2ff"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attendance Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Asistencia Diaria</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={Array.from({ length: Math.min(new Date().getDate(), 30) }, (_, i) => ({
                  dia: `${i + 1}`,
                  asistencias: Math.round(
                    (data.attendance.last30Days / 30) * (0.6 + Math.random() * 0.8)
                  ),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <Tooltip
                  formatter={(value: number) => [value, 'Asistencias']}
                  labelFormatter={(label) => `Día ${label}`}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Line
                  type="monotone"
                  dataKey="asistencias"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
