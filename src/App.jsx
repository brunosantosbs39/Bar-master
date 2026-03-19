import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { WaiterSessionProvider } from '@/lib/WaiterSessionContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from '@/components/Layout';
import Mesas from '@/pages/Mesas';
import Cardapio from '@/pages/Cardapio';
import Relatorios from '@/pages/Relatorios';
import Configuracoes from '@/pages/Configuracoes.jsx';
import QRCodes from '@/pages/QRCodes';
import MenuPublico from '@/pages/MenuPublico';
import GarcomLogin from '@/pages/GarcomLogin';
import GarcomApp from '@/pages/GarcomApp';
import Estoque from '@/pages/Estoque';

const PUBLIC_PATHS = ['/menu', '/GarcomLogin', '/GarcomApp'];

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

  const isPublicPath = PUBLIC_PATHS.some(p => location.pathname.startsWith(p));

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Carregando...</span>
        </div>
      </div>
    );
  }

  if (authError && !isPublicPath) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      {/* Public routes - no auth required */}
      <Route path="/menu" element={<MenuPublico />} />
      <Route path="/GarcomLogin" element={<GarcomLogin />} />
      <Route path="/GarcomApp" element={<GarcomApp />} />

      <Route path="/" element={<Navigate to="/Mesas" replace />} />
      <Route element={<Layout />}>
        <Route path="/Mesas" element={<Mesas />} />
        <Route path="/Cardapio" element={<Cardapio />} />
        <Route path="/Relatorios" element={<Relatorios />} />
        <Route path="/Configuracoes" element={<Configuracoes />} />
        <Route path="/Estoque" element={<Estoque />} />
        <Route path="/QRCodes" element={<QRCodes />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <WaiterSessionProvider>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </WaiterSessionProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App