import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutGrid, BookOpen, BarChart3, Settings, Beer, QrCode, Package, Wallet } from 'lucide-react';

const navItems = [
  { path: '/Mesas', icon: LayoutGrid, label: 'Mesas' },
  { path: '/Cardapio', icon: BookOpen, label: 'Cardápio' },
  { path: '/Estoque', icon: Package, label: 'Estoque' },
  { path: '/Caixa', icon: Wallet, label: 'Caixa' },
  { path: '/Relatorios', icon: BarChart3, label: 'Relatórios' },
  { path: '/QRCodes', icon: QrCode, label: 'QR Codes' },
  { path: '/Configuracoes', icon: Settings, label: 'Config.' },
];

// Pages that should render without the admin layout
const PUBLIC_PATHS = ['/MenuPublico', '/menu', '/GarcomLogin', '/GarcomApp'];

export default function Layout({ currentPageName }) {
  const location = useLocation();

  // Render public pages without any wrapper
  if (PUBLIC_PATHS.some(p => location.pathname.toLowerCase() === p.toLowerCase())) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between glass sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Beer className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg text-foreground tracking-tight">BarMaster</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
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
          <span className="font-bold text-lg text-foreground tracking-tight">BarMaster</span>
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
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}