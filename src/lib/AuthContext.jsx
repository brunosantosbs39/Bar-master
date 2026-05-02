import { createContext, useState, useContext, useEffect } from 'react';
import AdminLogin from '@/pages/AdminLogin';

const AuthContext = createContext();
const SESSION_KEY = 'bm_admin_session';

const DEFAULT_PERMISSIONS = {
  proprietario: {
    pages: ['Mesas', 'Cardapio', 'Estoque', 'Caixa', 'Relatorios', 'QRCodes', 'Configuracoes'],
    can_manage_users: true,
    can_manage_waiters: true,
  },
  administrador: {
    pages: ['Mesas', 'Cardapio', 'Estoque', 'Caixa', 'Relatorios', 'QRCodes', 'Configuracoes'],
    can_manage_users: false,
    can_manage_waiters: true,
  },
  caixa: {
    pages: ['Caixa'],
    can_manage_users: false,
    can_manage_waiters: false,
  },
};

export const AuthProvider = ({ children }) => {
  const [adminUser, setAdminUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [needsSetup, setNeedsSetup] = useState(null);

  useEffect(() => {
    fetch('/api/admin_users')
      .then(r => r.json())
      .then(list => setNeedsSetup(list.length === 0))
      .catch(() => setNeedsSetup(false));
  }, []);

  const login = (userData) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData));
    setAdminUser(userData);
    setNeedsSetup(false);
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAdminUser(null);
  };

  const getPermissions = () => {
    if (!adminUser) return { pages: [], can_manage_users: false, can_manage_waiters: false };
    const defaults = DEFAULT_PERMISSIONS[adminUser.role] || DEFAULT_PERMISSIONS.caixa;
    return { ...defaults, ...(adminUser.permissions || {}) };
  };

  const canAccess = (page) => {
    const perms = getPermissions();
    return perms.pages.includes(page);
  };

  if (needsSetup === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!adminUser) {
    return <AdminLogin onLogin={login} needsSetup={needsSetup} />;
  }

  return (
    <AuthContext.Provider value={{
      operator: adminUser.name,
      adminUser,
      role: adminUser.role,
      isAuthenticated: true,
      canAccess,
      getPermissions,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
