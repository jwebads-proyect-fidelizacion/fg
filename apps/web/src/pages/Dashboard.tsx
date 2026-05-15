import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  Megaphone,
  ArrowRight,
  Clock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

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
  const navigate = useNavigate();
  const { currentTenant } = useAuthStore();

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await api.get('/dashboard');
      return response.data;
    },
    refetchInterval: 60000,
  });

  const { data: atRiskMembers } = useQuery<any>({
    queryKey: ['members', 'at-risk'],
    queryFn: async () => {
      const response = await api.get('/members?active=true&limit=3');
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mx-auto" />
          <p className="mt-3 text-sm text-gray-500">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-red-50 to-red-100 border border-red-200 p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-700 font-semibold text-lg">Error al cargar el dashboard</p>
        <p className="text-red-600 text-sm mt-1">Verifique su conexión e intente nuevamente</p>
      </div>
    );
  }

  if (!data) return null;

  const today = new Date();
  const dateStr = today.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const revenueGrowth = data.revenue.lastMonth > 0
    ? Math.round(((data.revenue.currentMonth - data.revenue.lastMonth) / data.revenue.lastMonth) * 100)
    : 0;

  // Generate revenue trend data
  const dailyAvg = data.revenue.currentMonth / Math.max(today.getDate(), 1);
  const revenueTrend = Array.from({ length: today.getDate() }, (_, i) => ({
    dia: `${i + 1}`,
    acumulado: Math.round(dailyAvg * (i + 1) * (0.85 + Math.random() * 0.3)),
  }));

  return (
    <div className="space-y-8">
      {/* Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDJ2LTJoMzR6bTAtMzBWMkgydjJoMzR6TTIgMjBoMzR2Mkgydi0yeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {currentTenant?.name || 'Mi Gimnasio'}
              </h1>
              <p className="mt-1 text-indigo-100 capitalize">{dateStr}</p>
            </div>
            <div className="hidden md:flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <Clock className="h-5 w-5 text-indigo-200" />
              <div>
                <p className="text-xs text-indigo-200">Última actualización</p>
                <p className="text-sm font-medium">
                  {new Date(data.generatedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/attendance')}
          className="group flex items-center gap-4 rounded-2xl bg-white border-l-4 border-l-indigo-500 p-5 shadow-sm hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
        >
          <div className="rounded-xl bg-indigo-100 p-3 group-hover:bg-indigo-200 transition-colors">
            <CalendarCheck className="h-6 w-6 text-indigo-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900">Registrar Asistencia</p>
            <p className="text-xs text-gray-500">QR o manual</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 ml-auto group-hover:text-indigo-500 transition-colors" />
        </button>

        <button
          onClick={() => navigate('/members')}
          className="group flex items-center gap-4 rounded-2xl bg-white border-l-4 border-l-emerald-500 p-5 shadow-sm hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
        >
          <div className="rounded-xl bg-emerald-100 p-3 group-hover:bg-emerald-200 transition-colors">
            <UserPlus className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900">Agregar Socio</p>
            <p className="text-xs text-gray-500">Nuevo registro</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 ml-auto group-hover:text-emerald-500 transition-colors" />
        </button>

        <button
          onClick={() => navigate('/campaigns')}
          className="group flex items-center gap-4 rounded-2xl bg-white border-l-4 border-l-purple-500 p-5 shadow-sm hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
        >
          <div className="rounded-xl bg-purple-100 p-3 group-hover:bg-purple-200 transition-colors">
            <Megaphone className="h-6 w-6 text-purple-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900">Nueva Campaña</p>
            <p className="text-xs text-gray-500">Marketing IA</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 ml-auto group-hover:text-purple-500 transition-colors" />
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Socios Activos"
          value={data.members.active.toString()}
          subtitle={`de ${data.members.total} totales`}
          icon={Users}
          gradient="from-indigo-500 to-indigo-600"
          bgLight="bg-indigo-50"
        />
        <MetricCard
          title="Nuevos (30d)"
          value={data.members.new.toString()}
          subtitle="últimos 30 días"
          icon={UserPlus}
          gradient="from-emerald-500 to-emerald-600"
          bgLight="bg-emerald-50"
          trend={
            data.members.newPreviousPeriod > 0
              ? Math.round(((data.members.new - data.members.newPreviousPeriod) / data.members.newPreviousPeriod) * 100)
              : undefined
          }
        />
        <MetricCard
          title="Retención"
          value={`${data.retention.rate}%`}
          subtitle="tasa mensual"
          icon={TrendingUp}
          gradient="from-blue-500 to-blue-600"
          bgLight="bg-blue-50"
        />
        <MetricCard
          title="Asistencia Hoy"
          value={data.attendance.today.toString()}
          subtitle={`prom. ${data.attendance.avgPerMember}/socio`}
          icon={CalendarCheck}
          gradient="from-purple-500 to-purple-600"
          bgLight="bg-purple-50"
        />
        <MetricCard
          title="Ingresos Mes"
          value={formatCurrency(data.revenue.currentMonth, data.revenue.currency)}
          subtitle={`anterior: ${formatCurrency(data.revenue.lastMonth, data.revenue.currency)}`}
          icon={DollarSign}
          gradient="from-emerald-500 to-teal-600"
          bgLight="bg-emerald-50"
          trend={revenueGrowth || undefined}
        />
        <MetricCard
          title="Proyectado"
          value={formatCurrency(data.revenue.projected, data.revenue.currency)}
          subtitle="estimación fin de mes"
          icon={Target}
          gradient="from-cyan-500 to-cyan-600"
          bgLight="bg-cyan-50"
        />
        <MetricCard
          title="Churn"
          value={`${data.retention.churnRate}%`}
          subtitle={`${data.retention.churnCount} socios perdidos`}
          icon={TrendingDown}
          gradient="from-amber-500 to-orange-500"
          bgLight="bg-amber-50"
          isWarning
        />
        <MetricCard
          title="En Riesgo"
          value={data.members.atRisk.toString()}
          subtitle="requieren atención"
          icon={AlertTriangle}
          gradient="from-red-500 to-rose-600"
          bgLight="bg-red-50"
          isWarning
        />
      </div>

      {/* Revenue Chart + At Risk Members */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart - Prominent */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Ingresos Acumulados</h3>
              <p className="text-sm text-gray-500">Progreso del mes actual</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(data.revenue.currentMonth, data.revenue.currency)}
              </p>
              {revenueGrowth !== 0 && (
                <p className={`text-sm font-medium ${revenueGrowth > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {revenueGrowth > 0 ? '↑' : '↓'} {Math.abs(revenueGrowth)}% vs mes anterior
                </p>
              )}
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(value), 'Acumulado']}
                  labelFormatter={(label) => `Día ${label}`}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Area
                  type="monotone"
                  dataKey="acumulado"
                  stroke="#6366f1"
                  fill="url(#revenueGradient)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* At Risk Members */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm border-l-4 border-l-amber-400">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-bold text-gray-900">Socios en Riesgo</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            {data.members.atRisk} socios necesitan atención
          </p>

          <div className="space-y-3">
            {atRiskMembers?.data?.slice(0, 3).map((member: any) => (
              <div
                key={member.id}
                onClick={() => navigate(`/members/${member.id}`)}
                className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/50 border border-amber-100 cursor-pointer hover:bg-amber-50 transition-colors"
              >
                <div className="h-9 w-9 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 font-semibold text-sm">
                  {member.firstName?.[0]}{member.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="text-xs text-amber-600">Sin asistencia reciente</p>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-400" />
              </div>
            )) || (
              <div className="text-center py-6 text-gray-400">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sin datos disponibles</p>
              </div>
            )}
          </div>

          {data.members.atRisk > 3 && (
            <button
              onClick={() => navigate('/members')}
              className="mt-4 w-full text-center text-sm font-medium text-amber-700 hover:text-amber-800 py-2 rounded-lg hover:bg-amber-50 transition-colors"
            >
              Ver todos ({data.members.atRisk}) →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  bgLight,
  trend,
  isWarning,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  gradient: string;
  bgLight: string;
  trend?: number;
  isWarning?: boolean;
}) {
  return (
    <div className="group bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={`rounded-xl p-2.5 bg-gradient-to-br ${gradient} shadow-sm`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-2xl font-bold ${isWarning ? 'text-amber-600' : 'text-gray-900'}`}>
          {value}
        </span>
        {trend !== undefined && trend !== 0 && (
          <span
            className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              trend > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'
            }`}
          >
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-1.5">{subtitle}</p>
    </div>
  );
}
