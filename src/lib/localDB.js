// src/lib/localDB.js
// Motor CRUD genérico sobre localStorage
// Cada entidade tem sua própria chave: bm_orders, bm_tables, etc.

const PREFIX = 'bm_';

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getAll(entity) {
  try {
    const raw = localStorage.getItem(PREFIX + entity);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setAll(entity, data) {
  localStorage.setItem(PREFIX + entity, JSON.stringify(data));
}

function createEntity(entity, data) {
  const items = getAll(entity);
  const now = new Date().toISOString();
  const item = { ...data, id: generateId(), created_at: now, updated_at: now };
  items.push(item);
  setAll(entity, items);
  return item;
}

function updateEntity(entity, id, data) {
  const items = getAll(entity);
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) throw new Error(`${entity} ${id} not found`);
  const updated = { ...items[idx], ...data, updated_at: new Date().toISOString() };
  items[idx] = updated;
  setAll(entity, items);
  return updated;
}

function deleteEntity(entity, id) {
  const items = getAll(entity).filter(i => i.id !== id);
  setAll(entity, items);
}

function filterEntity(entity, filters = {}) {
  let items = getAll(entity);
  Object.entries(filters).forEach(([key, val]) => {
    items = items.filter(i => i[key] === val);
  });
  return items;
}

function getEntity(entity, id) {
  return getAll(entity).find(i => i.id === id) || null;
}

// Purge records older than 90 days (closed orders only)
function purgeOldOrders() {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const orders = getAll('orders').filter(o => {
    if (o.status !== 'fechada') return true;
    if (!o.closed_at) return true;
    return new Date(o.closed_at).getTime() > cutoff;
  });
  setAll('orders', orders);
}

// Build entity accessor
function makeEntity(name) {
  return {
    list: () => Promise.resolve(getAll(name)),
    filter: (filters) => Promise.resolve(filterEntity(name, filters)),
    get: (id) => Promise.resolve(getEntity(name, id)),
    create: (data) => Promise.resolve(createEntity(name, data)),
    update: (id, data) => Promise.resolve(updateEntity(name, id, data)),
    delete: (id) => { deleteEntity(name, id); return Promise.resolve(); },
  };
}

export const localDB = {
  entities: {
    Table: makeEntity('tables'),
    Order: makeEntity('orders'),
    Product: makeEntity('products'),
    CustomCategory: makeEntity('categories'),
    Waiter: makeEntity('waiters'),
    Stock: makeEntity('stock'),
    Cashier: makeEntity('cashiers'),
    Settings: makeEntity('settings'),
  },
  purgeOldOrders,
  _getAll: getAll,
  _setAll: setAll,
};
