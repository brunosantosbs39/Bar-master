import React, { createContext, useState, useContext, useEffect } from 'react';
import { seedIfEmpty } from './localDB-seed';
import { localDB } from './localDB';

const AuthContext = createContext();
const OPERATOR_KEY = 'bm_operator';

export const AuthProvider = ({ children }) => {
  const [operator, setOperator] = useState(() => localStorage.getItem(OPERATOR_KEY) || null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    seedIfEmpty();
    localDB.purgeOldOrders();
    setReady(true);
  }, []);

  const login = (name) => {
    localStorage.setItem(OPERATOR_KEY, name);
    setOperator(name);
  };

  const logout = () => {
    localStorage.removeItem(OPERATOR_KEY);
    setOperator(null);
  };

  if (!ready) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!operator) {
    return <OperatorLogin onLogin={login} />;
  }

  return (
    <AuthContext.Provider value={{
      operator,
      isAuthenticated: true,
      isLoadingAuth: false,
      isLoadingPublicSettings: false,
      authError: null,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

function OperatorLogin({ onLogin }) {
  const [name, setName] = useState('');
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-full max-w-sm p-6 rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-xl">🍺</div>
          <div>
            <h1 className="text-xl font-bold text-foreground">BarMaster</h1>
            <p className="text-xs text-muted-foreground">Sistema de Gestão</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Seu nome</label>
            <input
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Ex: Admin, Carlos..."
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name.trim() && onLogin(name.trim())}
              autoFocus
            />
          </div>
          <button
            onClick={() => name.trim() && onLogin(name.trim())}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            disabled={!name.trim()}
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
