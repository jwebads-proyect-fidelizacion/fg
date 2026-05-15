import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Wallet,
  Download,
  Link2,
  Copy,
  CheckCircle2,
  MessageCircle,
  Save,
  ExternalLink,
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

const PAYMENT_LINK_KEY = 'gym-payment-link';

export default function Payments() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [paymentLink, setPaymentLink] = useState('');
  const [paymentLinkInput, setPaymentLinkInput] = useState('');
  const [linkSaved, setLinkSaved] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Load payment link from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(PAYMENT_LINK_KEY);
    if (saved) {
      setPaymentLink(saved);
      setPaymentLinkInput(saved);
    }
  }, []);

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

  const handleSaveLink = () => {
    const trimmed = paymentLinkInput.trim();
    if (trimmed) {
      localStorage.setItem(PAYMENT_LINK_KEY, trimmed);
      setPaymentLink(trimmed);
      setLinkSaved(true);
      setSuccessMessage('Link de pago guardado exitosamente');
      setTimeout(() => {
        setLinkSaved(false);
        setSuccessMessage('');
      }, 3000);
    }
  };

  const handleCopyLink = async () => {
    if (paymentLink) {
      try {
        await navigator.clipboard.writeText(paymentLink);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = paymentLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      }
    }
  };

  const handleSendWhatsApp = () => {
    if (paymentLink) {
      const message = encodeURIComponent(`¡Hola! Aquí está el link para realizar tu pago: ${paymentLink}`);
      window.open(`https://wa.me/?text=${message}`, '_blank');
    }
  };

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

      {/* Success Toast */}
      {successMessage && (
        <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-sm font-medium text-green-700">{successMessage}</p>
        </div>
      )}

      {/* Payment Link Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Link de Pago del Gimnasio</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Pegue aquí su link de pago (MercadoPago, Stripe, etc.) para compartirlo fácilmente con los socios.
        </p>

        <div className="flex gap-3">
          <input
            type="url"
            value={paymentLinkInput}
            onChange={(e) => setPaymentLinkInput(e.target.value)}
            placeholder="https://mpago.la/tu-link o https://buy.stripe.com/..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
          />
          <button
            onClick={handleSaveLink}
            disabled={!paymentLinkInput.trim()}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {linkSaved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {linkSaved ? 'Guardado' : 'Guardar'}
          </button>
        </div>

        {/* Action buttons when link is saved */}
        {paymentLink && (
          <div className="mt-4 flex flex-wrap items-center gap-3 pt-4 border-t border-gray-100">
            <a
              href={paymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir link
            </a>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {linkCopied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              {linkCopied ? 'Copiado' : 'Copiar link'}
            </button>
            <button
              onClick={handleSendWhatsApp}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <MessageCircle className="h-4 w-4" />
              Enviar por WhatsApp
            </button>
          </div>
        )}
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
