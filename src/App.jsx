import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import { WaiterSessionProvider, useWaiterSession } from '@/lib/WaiterSessionContext';
import Layout from '@/components/Layout';
import Mesas from '@/pages/Mesas';
import Cardapio from '@/pages/Cardapio';
import Relatorios from '@/pages/Relatorios';
import Configuracoes from '@/pages/Configuracoes';
import QRCodes from '@/pages/QRCodes';
import MenuPublico from '@/pages/MenuPublico';
import GarcomLogin from '@/pages/GarcomLogin';
import GarcomApp from '@/pages/GarcomApp';
import Estoque from '@/pages/Estoque';
import Caixa from '@/pages/Caixa';

function RootRedirect() {
  const { waiter } = useWaiterSession();
  return <Navigate to={waiter ? '/GarcomApp' : '/GarcomLogin'} replace />;
}

// Rotas admin — ficam dentro do AuthProvider (exige login de operador)
function AdminRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route element={<Layout />}>
          <Route path="/Mesas" element={<Mesas />} />
          <Route path="/Cardapio" element={<Cardapio />} />
          <Route path="/Relatorios" element={<Relatorios />} />
          <Route path="/Configuracoes" element={<Configuracoes />} />
          <Route path="/Estoque" element={<Estoque />} />
          <Route path="/QRCodes" element={<QRCodes />} />
          <Route path="/Caixa" element={<Caixa />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </AuthProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <WaiterSessionProvider>
        <Router>
          <Routes>
            {/* Rotas públicas — sem AuthProvider */}
            <Route path="/menu" element={<MenuPublico />} />
            <Route path="/GarcomLogin" element={<GarcomLogin />} />
            <Route path="/GarcomApp" element={<GarcomApp />} />
            {/* /AdminLogin redireciona para admin — AuthProvider exibe o login */}
            <Route path="/AdminLogin" element={<Navigate to="/Mesas" replace />} />

            {/* Tudo mais → admin com autenticação */}
            <Route path="*" element={<AdminRoutes />} />
          </Routes>
        </Router>
        <Toaster />
      </WaiterSessionProvider>
    </QueryClientProvider>
  )
}

export default App
