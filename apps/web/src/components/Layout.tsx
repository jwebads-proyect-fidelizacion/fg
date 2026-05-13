import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  ClipboardList,
  CalendarCheck,
  Wallet,
  Megaphone,
  Target,
  Star,
  Gift,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Dumbbell,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Socios', href: '/members', icon: Users },
  { name: 'Planes', href: '/plans', icon: ClipboardList },
  { name: 'Membresías', href: '/memberships', icon: CreditCard },
  { name: 'Asistencia', href: '/attendance', icon: CalendarCheck },
  { name: 'Pagos', href: '/payments', icon: Wallet },
  { name: 'Campañas', href: '/campaigns', icon: Megaphone },
  { name: 'Segmentos', href: '/segments', icon: Target },
  { name: 'Puntos', href: '/points', icon: Star },
  { name: 'Recompensas', href: '/rewards', icon: Gift },
  { name: 'Alertas', href: '/alerts', icon: Bell },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);
  const location = useLocation();
  const { user, currentTenant, tenants, logout, selectTenant } = useAuthStore();

  const handleLogout = () => {
    logout();
  };

  const handleSelectTenant = async (tenantId: string) => {
    await selectTenant(tenantId);
    setTenantMenuOpen(false);
    window.location.reload();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-slate-900 transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-2 px-6 border-b border-slate-700">
            <Dumbbell className="h-7 w-7 text-indigo-400" />
            <span className="text-lg font-bold text-white">GymFideliza</span>
            <button
              className="ml-auto lg:hidden text-slate-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive =
                item.href === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User info at bottom */}
          <div className="border-t border-slate-700 p-4">
            <div className="text-sm text-slate-400 truncate">{user?.email}</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden text-gray-600 hover:text-gray-900"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Tenant selector */}
            <div className="relative">
              <button
                onClick={() => setTenantMenuOpen(!tenantMenuOpen)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Dumbbell className="h-4 w-4 text-indigo-600" />
                {currentTenant?.name || 'Seleccionar gimnasio'}
                {tenants.length > 1 && <ChevronDown className="h-4 w-4" />}
              </button>

              {tenantMenuOpen && tenants.length > 1 && (
                <div className="absolute left-0 top-full mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-50">
                  {tenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => handleSelectTenant(tenant.id)}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                        tenant.id === currentTenant?.id
                          ? 'font-medium text-indigo-600'
                          : 'text-gray-700'
                      }`}
                    >
                      {tenant.name}
                      <span className="ml-2 text-xs text-gray-400">({tenant.role})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
