import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Wallet,
  Download,
} from 'lucide-react';
import api from '../lib/api';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  paymentDate: string;
  isVoided: boolean;
  membership: {
    member: {
      firstName: string;
      lastName: string;
    };
    plan: {
      name: string;
    };
  };
}

interface PaymentsResponse {
  data: Payment[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const methodLabels: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

const statusLabels: Record<string, string> = {
  PAID: 'Pagado',
  PENDING: 'Pendiente',
  OVERDUE: 'Vencido',
  VOIDED: 'Anulado',
};

const statusColors: Record<string, string> = {
  PAID: 'bg-green-50 text-green-700',
  PENDING: 'bg-yellow-50 text-yellow-700',
  OVERDUE: 'bg-red-50 text-red-700',
  VOIDED: 'bg-gray-100 text-gray-600',
};

export default function Payments() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery<PaymentsResponse>({
    queryKey: ['payments', search, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', page.toString());
      params.set('limit', '20');
      const response = await api.get(`/payments?${params}`);
      return response.data;
    },
  });

  const handleExport = async () => {
    try {
      const response = await api.get('/dashboard/export?format=csv', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `pagos_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Error al exportar los pagos');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por socio..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
          <p className="text-red-700">Error al cargar los pagos</p>
        </div>
      ) : data && data.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Wallet className="h-12 w-12 mb-3 text-gray-300" />
          <p className="font-medium">No se encontraron pagos</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Socio</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Plan</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Método</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.data.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(payment.paymentDate).toLocaleDateString('es-MX')}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {payment.membership.member.firstName} {payment.membership.member.lastName}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                        {payment.membership.plan.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {methodLabels[payment.method] || payment.method}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            statusColors[payment.status] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {statusLabels[payment.status] || payment.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        ${payment.amount.toLocaleString()} {payment.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Mostrando {(data.pagination.page - 1) * data.pagination.limit + 1} a{' '}
                {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} de{' '}
                {data.pagination.total} pagos
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-600">
                  {page} / {data.pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= data.pagination.totalPages}
                  className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
