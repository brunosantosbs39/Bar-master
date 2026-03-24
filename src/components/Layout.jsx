import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutGrid, BookOpen, BarChart3, Settings, Beer, QrCode, Package, Wallet, LogOut, Crown, ShieldCheck, Lock } from 'lucide-react';
import { useWaiterSession } from '@/lib/WaiterSessionContext';
import { useAuth } from '@/lib/AuthContext';
import { useBranding } from '@/lib/useBranding';

const ALL_NAV_ITEMS = [
  { path: '/Mesas',        page: 'Mesas',        icon: LayoutGrid, label: 'Mesas' },
  { path: '/Cardapio',     page: 'Cardapio',      icon: BookOpen,   label: 'Cardápio' },
  { path: '/Estoque',      page: 'Estoque',       icon: Package,    label: 'Estoque' },
  { path: '/Caixa',        page: 'Caixa',         icon: Wallet,     label: 'Caixa' },
  { path: '/Relatorios',   page: 'Relatorios',    icon: BarChart3,  label: 'Relatórios' },
  { path: '/QRCodes',      page: 'QRCodes',       icon: QrCode,     label: 'QR Codes' },
  { path: '/Configuracoes',page: 'Configuracoes', icon: Settings,   label: 'Config.' },
];

const ROLE_ICONS = {
  proprietario: { icon: Crown,        color: 'text-yellow-400', label: 'Proprietário' },
  administrador: { icon: ShieldCheck, color: 'text-blue-400',   label: 'Administrador' },
  caixa:         { icon: Lock,        color: 'text-emerald-400',label: 'Caixa' },
};

const PUBLIC_PATHS = ['/MenuPublico', '/menu', '/GarcomLogin', '/GarcomApp'];

export default function Layout() {
  const location = useLocation();
  const { waiter } = useWaiterSession();
  const { canAccess, role, adminUser, logout } = useAuth();
  const { barName } = useBranding();

  if (PUBLIC_PATHS.some(p => location.pathname.toLowerCase() === p.toLowerCase())) {
    return <Outlet />;
  }

  // Garçom com sessão ativa não acessa área admin
  if (waiter) {
    return <Navigate to="/GarcomApp" replace />;
  }

  // Filtrar nav por permissões do usuário logado
  const navItems = ALL_NAV_ITEMS.filter(item => canAccess(item.page));

  // Se não tem acesso à página atual, redireciona para primeira permitida
  const currentPage = ALL_NAV_ITEMS.find(i => i.path === location.pathname);
  if (currentPage && !canAccess(currentPage.page)) {
    const first = navItems[0];
    return <Navigate to={first ? first.path : '/GarcomLogin'} replace />;
  }

  const roleInfo = ROLE_ICONS[role] || ROLE_ICONS.administrador;
  const RoleIcon = roleInfo.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between glass sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Beer className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg text-foreground tracking-tight">{barName}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RoleIcon className={`w-3.5 h-3.5 ${roleInfo.color}`} />
            <span>{adminUser?.name || roleInfo.label}</span>
          </div>
          <button
            onClick={logout}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0 md:pl-60">
        <Outlet />
      </main>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-60 border-r border-border bg-card pt-16 z-40">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Beer className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <span className="font-bold text-base text-foreground tracking-tight block">{barName}</span>
            <div className="flex items-center gap-1">
              <RoleIcon className={`w-3 h-3 ${roleInfo.color}`} />
              <span className="text-xs text-muted-foreground">{roleInfo.label}</span>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 pb-4 border-t border-border pt-3">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 flex">
        {navItems.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-xs font-medium transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
