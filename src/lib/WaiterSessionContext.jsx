import { createContext, useContext, useState, useEffect } from 'react';

const WaiterSessionContext = createContext(null);

export function WaiterSessionProvider({ children }) {
  const [waiter, setWaiter] = useState(() => {
    try {
      const stored = sessionStorage.getItem('waiter_session');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const login = (waiterData) => {
    sessionStorage.setItem('waiter_session', JSON.stringify(waiterData));
    setWaiter(waiterData);
  };

  const logout = () => {
    sessionStorage.removeItem('waiter_session');
    setWaiter(null);
  };

  return (
    <WaiterSessionContext.Provider value={{ waiter, login, logout }}>
      {children}
    </WaiterSessionContext.Provider>
  );
}

export function useWaiterSession() {
  return useContext(WaiterSessionContext);
}