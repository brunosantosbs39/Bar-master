// src/lib/localDB.js
// Interface CRUD — faz chamadas HTTP para o servidor local (server/index.js)
// Interface idêntica à versão localStorage, sem quebrar nenhum hook ou página.

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function apiFetch(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${path} → ${res.status}: ${text}`);
    }
    return res.json();
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error(`Servidor não respondeu (${path}). Verifique a conexão.`);
    throw e;
  }
}

function makeEntity(name) {
  const base = `/api/${name}`;
  return {
    list: () => apiFetch(base),

    filter: (filters = {}) => {
      if (!filters || Object.keys(filters).length === 0) return apiFetch(base);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => params.set(k, String(v)));
      return apiFetch(`${base}?${params}`);
    },

    get: (id) => apiFetch(`${base}/${id}`),

    create: (data) => apiFetch(base, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

    update: (id, data) => apiFetch(`${base}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

    delete: (id) => apiFetch(`${base}/${id}`, { method: 'DELETE' }),
  };
}

export const localDB = {
  entities: {
    Table:          makeEntity('tables'),
    Order:          makeEntity('orders'),
    Product:        makeEntity('products'),
    CustomCategory: makeEntity('custom_categories'),
    Waiter:         makeEntity('waiters'),
    Stock:          makeEntity('stock'),
    Cashier:        makeEntity('cashiers'),
    Settings:       makeEntity('settings'),
    Banner:         makeEntity('banners'),
  },
  // Mantidos por compatibilidade — não fazem mais nada (limpeza é no servidor)
  purgeOldOrders: () => Promise.resolve(),
  _getAll: () => [],
  _setAll: () => {},
};
