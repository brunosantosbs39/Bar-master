# BarMaster — LocalDB + Módulo de Caixa — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o backend Base44 por localStorage e implementar módulo completo de Caixa (abertura/fechamento de turno, sangria, reforço, conferência, histórico).

**Architecture:** Camada `localDB.js` expõe CRUD genérico sobre localStorage. Hooks React Query (`useOrders`, `useTables`, etc.) consomem essa camada e são importados diretamente pelas páginas. O módulo de Caixa é uma nova página `/Caixa` com hook `useCashier`.

**Tech Stack:** React 18, Vite, Tailwind CSS, Radix UI, shadcn/ui, React Query v5, Framer Motion, Lucide React, localStorage (browser-native)

**Spec:** `docs/superpowers/specs/2026-03-19-caixa-localdb-design.md`

---

## Mapa de Arquivos

### Criados
| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/lib/localDB.js` | Motor CRUD genérico sobre localStorage |
| `src/lib/localDB-seed.js` | Dados iniciais para primeira execução |
| `src/hooks/useTables.js` | React Query — mesas |
| `src/hooks/useOrders.js` | React Query — comandas |
| `src/hooks/useProducts.js` | React Query — produtos e categorias |
| `src/hooks/useWaiters.js` | React Query — garçons |
| `src/hooks/useStock.js` | React Query — estoque |
| `src/hooks/useCashier.js` | React Query — caixa/turno |
| `src/hooks/useSettings.js` | React Query — configurações |
| `src/pages/Caixa.jsx` | Módulo completo de caixa |

### Modificados
| Arquivo | Mudança |
|---------|---------|
| `src/lib/AuthContext.jsx` | Substituir Base44 auth por operador local |
| `src/lib/stockUtils.js` | Substituir base44 import por localDB |
| `src/App.jsx` | Remover Base44 imports, adicionar rota /Caixa |
| `src/components/Layout.jsx` | Adicionar item "Caixa" na nav |
| `src/pages/Mesas.jsx` | Migrar para useTables + useOrders |
| `src/pages/Comandas.jsx` | Migrar para useOrders + useTables |
| `src/pages/Cardapio.jsx` | Migrar para useProducts |
| `src/pages/Estoque.jsx` | Migrar para useStock + useProducts |
| `src/pages/Relatorios.jsx` | Migrar para useOrders |
| `src/pages/Configuracoes.jsx` | Migrar para useWaiters + useSettings + backup |
| `src/pages/GarcomLogin.jsx` | Migrar para useWaiters (PIN local) |
| `src/pages/GarcomApp.jsx` | Migrar para useOrders + useProducts + useTables |
| `src/components/MesaDetalhe.jsx` | Migrar para hooks |
| `src/components/GarcomComanda.jsx` | Migrar para hooks |
| `src/components/TransferTableDialog.jsx` | Migrar para useTables |
| `package.json` | Remover @base44/sdk e @base44/vite-plugin |
| `vite.config.js` | Remover plugin Base44 |
| `.env.local` | Simplificar (remover vars Base44) |

### Removidos
| Arquivo | Motivo |
|---------|--------|
| `src/api/base44Client.js` | Substituído por localDB |
| `src/lib/app-params.js` | Dependência do Base44 SDK |

---

## Task 1: Motor localDB.js + Seed

**Arquivos:**
- Criar: `src/lib/localDB.js`
- Criar: `src/lib/localDB-seed.js`

- [ ] **Step 1.1: Criar `src/lib/localDB.js`**

```js
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

// Build entity accessor (matches Base44 interface shape for easy migration)
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
```

- [ ] **Step 1.2: Criar `src/lib/localDB-seed.js`**

```js
// src/lib/localDB-seed.js
// Popula o localStorage com dados de exemplo na primeira execução

import { localDB } from './localDB';

const SEED_KEY = 'bm_seeded_v1';

export function seedIfEmpty() {
  if (localStorage.getItem(SEED_KEY)) return;

  // Tables
  const tableData = [
    { number: 1, type: 'mesa', capacity: 4, status: 'livre', active: true },
    { number: 2, type: 'mesa', capacity: 4, status: 'livre', active: true },
    { number: 3, type: 'mesa', capacity: 6, status: 'livre', active: true },
    { number: 4, type: 'mesa', capacity: 6, status: 'livre', active: true },
    { number: 5, type: 'mesa', capacity: 2, status: 'livre', active: true },
    { number: 6, type: 'mesa', capacity: 8, status: 'livre', active: true },
    { number: 7, type: 'mesa', capacity: 4, status: 'livre', active: true },
    { number: 8, type: 'mesa', capacity: 4, status: 'livre', active: true },
    { number: 1, type: 'balcao', capacity: 6, status: 'livre', active: true },
    { number: 1, type: 'delivery', capacity: 1, status: 'livre', active: true },
  ];
  tableData.forEach(t => localDB.entities.Table.create(t));

  // Products
  const productData = [
    { name: 'Cerveja Lata 350ml', category: 'cervejas', price: 8.00, available: true, print_dept: 'bar', code: 'CL350' },
    { name: 'Cerveja Long Neck', category: 'cervejas', price: 12.00, available: true, print_dept: 'bar', code: 'CLN' },
    { name: 'Cerveja Garrafa 600ml', category: 'cervejas', price: 18.00, available: true, print_dept: 'bar', code: 'CG600' },
    { name: 'Whisky Dose', category: 'destilados', price: 22.00, available: true, print_dept: 'bar', code: 'WD' },
    { name: 'Caipirinha', category: 'drinks', price: 20.00, available: true, print_dept: 'bar', code: 'CAI' },
    { name: 'Água Mineral', category: 'nao_alcoolicos', price: 5.00, available: true, print_dept: 'bar', code: 'AGM' },
    { name: 'Refrigerante Lata', category: 'nao_alcoolicos', price: 7.00, available: true, print_dept: 'bar', code: 'REF' },
    { name: 'Suco Natural', category: 'nao_alcoolicos', price: 12.00, available: true, print_dept: 'bar', code: 'SUC' },
    { name: 'Porção de Batata Frita', category: 'porcoes', price: 30.00, available: true, print_dept: 'cozinha', code: 'PBF' },
    { name: 'Porção de Frango', category: 'porcoes', price: 45.00, available: true, print_dept: 'cozinha', code: 'PFG' },
    { name: 'Bolinho de Bacalhau (6un)', category: 'petiscos', price: 28.00, available: true, print_dept: 'cozinha', code: 'BB6' },
    { name: 'Tábua de Frios', category: 'petiscos', price: 55.00, available: true, print_dept: 'cozinha', code: 'TF' },
    { name: 'Frango Grelhado', category: 'pratos', price: 38.00, available: true, print_dept: 'cozinha', code: 'FGR' },
    { name: 'Picanha na Chapa', category: 'pratos', price: 65.00, available: true, print_dept: 'cozinha', code: 'PIC' },
    { name: 'Pudim', category: 'sobremesas', price: 15.00, available: true, print_dept: 'cozinha', code: 'PUD' },
  ];
  productData.forEach(p => localDB.entities.Product.create(p));

  // Waiters
  localDB.entities.Waiter.create({ name: 'João', nickname: 'João', pin: '1234', active: true });
  localDB.entities.Waiter.create({ name: 'Maria', nickname: 'Maria', pin: '5678', active: true });

  // Stock (50 units each product)
  const products = localDB._getAll('products');
  products.forEach(p => {
    localDB.entities.Stock.create({
      product_id: p.id,
      product_name: p.name,
      quantity: 50,
      unit: 'un',
      min_quantity: 5,
    });
  });

  // One closed cashier (yesterday) for history testing
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  localDB.entities.Cashier.create({
    status: 'fechado',
    turno: 'noite',
    operador: 'Admin',
    saldo_inicial: 150.00,
    aberto_em: yesterday,
    fechado_em: new Date(Date.now() - 3600000).toISOString(),
    movimentacoes: [
      { id: '1', tipo: 'sangria', valor: 50, motivo: 'Troco', hora: yesterday, operador: 'Admin' }
    ],
    resumo_pagamentos: { dinheiro: 320, pix: 180, cartao_credito: 95, cartao_debito: 60, misto: 0 },
    total_comandas: 8,
    total_itens: 34,
    saldo_esperado: 420.00,
    saldo_real: 415.00,
    diferenca: -5.00,
  });

  // Default settings
  localDB.entities.Settings.create({
    service_fee_percent: 10,
    happy_hour_enabled: false,
    happy_hour_discount: 20,
    happy_hour_start: '17:00',
    happy_hour_end: '19:00',
    cashier_blocks_orders: false,
  });

  localStorage.setItem(SEED_KEY, '1');
}
```

- [ ] **Step 1.3: Verificar no browser console**

Abrir browser dev tools e executar:
```js
// Após npm run dev — abrir http://localhost:5173 e no console:
JSON.parse(localStorage.getItem('bm_tables')).length // esperado: 10
JSON.parse(localStorage.getItem('bm_products')).length // esperado: 15
JSON.parse(localStorage.getItem('bm_waiters')).length // esperado: 2
```

- [ ] **Step 1.4: Commit**
```bash
git add src/lib/localDB.js src/lib/localDB-seed.js
git commit -m "feat: add localDB motor and seed data"
```

---

## Task 2: Remover Base44 + AuthContext Simplificado

**Arquivos:**
- Modificar: `src/lib/AuthContext.jsx`
- Modificar: `package.json`
- Modificar: `vite.config.js`
- Remover: `src/api/base44Client.js`
- Remover: `src/lib/app-params.js`

- [ ] **Step 2.1: Remover dependências Base44 do package.json**

```bash
cd "C:\Users\User\Downloads\able-smart-bar-flow"
npm uninstall @base44/sdk @base44/vite-plugin
```

- [ ] **Step 2.2: Atualizar `vite.config.js`**

Ler o arquivo atual e remover qualquer import/uso do `@base44/vite-plugin`. O arquivo resultante deve ser:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 2.3: Criar `.env.local` mínimo**
```bash
echo "VITE_APP_NAME=BarMaster" > "C:\Users\User\Downloads\able-smart-bar-flow\.env.local"
```

- [ ] **Step 2.4: Substituir `src/lib/AuthContext.jsx` completo**

```jsx
// src/lib/AuthContext.jsx
// Auth simplificado — operador local por nome, sem Base44
import React, { createContext, useState, useContext, useEffect } from 'react';
import { seedIfEmpty } from './localDB-seed';
import { localDB } from './localDB';

const AuthContext = createContext();
const OPERATOR_KEY = 'bm_operator';

export const AuthProvider = ({ children }) => {
  const [operator, setOperator] = useState(() => localStorage.getItem(OPERATOR_KEY) || null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Seed data on first run
    seedIfEmpty();
    // Purge orders older than 90 days
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
```

- [ ] **Step 2.5: Atualizar `src/App.jsx`**

Remover todos os imports do Base44 e simplificar. O arquivo resultante:

```jsx
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import { WaiterSessionProvider } from '@/lib/WaiterSessionContext';
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

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <WaiterSessionProvider>
          <Router>
            <Routes>
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
                <Route path="/Caixa" element={<Caixa />} />
              </Route>
              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </Router>
          <Toaster />
        </WaiterSessionProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
```

- [ ] **Step 2.6: Verificar importações residuais antes de deletar**

```bash
cd "C:\Users\User\Downloads\able-smart-bar-flow"
grep -r "base44Client\|app-params\|@base44" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx"
```

Todos os arquivos retornados devem estar cobertos pela lista de migração desta task. Se houver arquivos não listados, adicionar à task antes de continuar.

- [ ] **Step 2.7: Deletar arquivos removidos**
```bash
rm "C:\Users\User\Downloads\able-smart-bar-flow\src\api\base44Client.js"
rm "C:\Users\User\Downloads\able-smart-bar-flow\src\lib\app-params.js"
```

- [ ] **Step 2.7: Executar `npm install` e verificar que o app inicia**
```bash
cd "C:\Users\User\Downloads\able-smart-bar-flow"
npm install
npm run dev
```
Esperado: app abre em http://localhost:5173 mostrando tela de login com campo "Seu nome".

- [ ] **Step 2.8: Renomear numeração dos steps anteriores**

O step 2.6 (verificação) e 2.7 (deleção) foram inseridos — ajustar mentalmente: o antigo 2.6 vira 2.8 (commit).

- [ ] **Step 2.8: Commit**
```bash
git add -A
git commit -m "feat: replace Base44 auth with local operator login"
```

---

## Task 3: Hook useTables + Migrar Mesas.jsx

**Arquivos:**
- Criar: `src/hooks/useTables.js`
- Modificar: `src/pages/Mesas.jsx`
- Modificar: `src/components/MesaDetalhe.jsx`
- Modificar: `src/components/TransferTableDialog.jsx`

- [ ] **Step 3.1: Criar `src/hooks/useTables.js`**

> **IMPORTANTE:** `useTables` NÃO importa `useOrders`. O status ocupado/livre de uma mesa é lido diretamente do campo `table.status` em `localDB.entities.Table`, que é atualizado por `useOrders.useCloseOrder` (Task 4) e `useOrders.useCreateOrder` (Task 4). Hooks não têm dependência cruzada entre si — apenas sobre `localDB`.

```js
// src/hooks/useTables.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDB } from '@/lib/localDB';

export const TABLE_KEY = ['tables'];

export function useTables(filters = {}) {
  return useQuery({
    queryKey: [...TABLE_KEY, filters],
    queryFn: () => localDB.entities.Table.filter(filters),
  });
}

export function useCreateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => localDB.entities.Table.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TABLE_KEY }),
  });
}

export function useUpdateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => localDB.entities.Table.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TABLE_KEY }),
  });
}

export function useDeleteTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => localDB.entities.Table.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: TABLE_KEY }),
  });
}
```

- [ ] **Step 3.2: Migrar `src/pages/Mesas.jsx`**

Substituir todas as referências a `base44.entities.Table` e `base44.entities.Order` pelos hooks. O padrão de substituição:

```jsx
// ANTES (topo do arquivo):
import { base44 } from '@/api/base44Client';
// ...
const loadData = async () => {
  setLoading(true);
  const [t, o] = await Promise.all([
    base44.entities.Table.list(),
    base44.entities.Order.filter({ status: 'aberta' })
  ]);
  setTables(t); setOrders(o); setLoading(false);
};
const createTable = async () => {
  await base44.entities.Table.create({...});
  loadData();
};

// DEPOIS:
import { useTables, useCreateTable } from '@/hooks/useTables';
import { useOrders } from '@/hooks/useOrders';
// ...
const { data: tables = [], isLoading: loadingTables } = useTables();
const { data: orders = [], isLoading: loadingOrders } = useOrders({ status: 'aberta' });
const createTableMutation = useCreateTable();
const loading = loadingTables || loadingOrders;
// ...
const createTable = async () => {
  if (!newTable.number || !newTable.type) return;
  await createTableMutation.mutateAsync({
    number: Number(newTable.number),
    type: newTable.type,
    capacity: Number(newTable.capacity) || 4,
    status: 'livre',
    active: true
  });
  setShowNew(false);
  setNewTable({ number: '', type: 'mesa', capacity: '' });
};
```

- [ ] **Step 3.3: Migrar `src/components/TransferTableDialog.jsx`**

Substituir `base44.entities.Table.list()` e `base44.entities.Order.update()` pelos hooks correspondentes.

- [ ] **Step 3.4: Verificar no browser**

Navegar para http://localhost:5173/Mesas — deve mostrar 10 mesas do seed. Clicar em uma mesa deve abrir o MesaDetalhe.

- [ ] **Step 3.5: Commit**
```bash
git add src/hooks/useTables.js src/pages/Mesas.jsx src/components/TransferTableDialog.jsx
git commit -m "feat: migrate Mesas to useTables hook"
```

---

## Task 4: Hook useOrders + Migrar Comandas.jsx + GarcomApp

**Arquivos:**
- Criar: `src/hooks/useOrders.js`
- Modificar: `src/pages/Comandas.jsx`
- Modificar: `src/lib/stockUtils.js`
- Modificar: `src/pages/GarcomApp.jsx`
- Modificar: `src/components/GarcomComanda.jsx`
- Modificar: `src/components/MesaDetalhe.jsx`

- [ ] **Step 4.1: Criar `src/hooks/useOrders.js`**

```js
// src/hooks/useOrders.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDB } from '@/lib/localDB';

export const ORDER_KEY = ['orders'];

export function useOrders(filters = {}) {
  return useQuery({
    queryKey: [...ORDER_KEY, filters],
    queryFn: () => localDB.entities.Order.filter(filters),
  });
}

export function useOrder(id) {
  return useQuery({
    queryKey: [...ORDER_KEY, id],
    queryFn: () => localDB.entities.Order.get(id),
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => localDB.entities.Order.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ORDER_KEY }),
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => localDB.entities.Order.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDER_KEY });
    },
  });
}

// Link order to active cashier on close
async function linkOrderToCashier(orderId) {
  try {
    const cashiers = await localDB.entities.Cashier.filter({ status: 'aberto' });
    if (cashiers.length === 0) return;
    const cashier = cashiers[0];
    const linkedOrders = cashier.linked_order_ids || [];
    if (!linkedOrders.includes(orderId)) {
      await localDB.entities.Cashier.update(cashier.id, {
        linked_order_ids: [...linkedOrders, orderId],
      });
    }
  } catch {
    // silently fail — cashier link is non-critical
  }
}

export function useCloseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paymentMethod, discount, tableId }) => {
      const updated = await localDB.entities.Order.update(id, {
        status: 'fechada',
        payment_method: paymentMethod,
        discount: discount || 0,
        closed_at: new Date().toISOString(),
      });
      if (tableId) {
        await localDB.entities.Table.update(tableId, { status: 'livre' });
      }
      await linkOrderToCashier(id);
      return updated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDER_KEY });
      qc.invalidateQueries({ queryKey: ['tables'] });
      qc.invalidateQueries({ queryKey: ['cashiers'] });
    },
  });
}
```

- [ ] **Step 4.2: Migrar `src/lib/stockUtils.js`**

Substituir `import { base44 } from '@/api/base44Client'` por `import { localDB } from './localDB'` e adaptar chamadas.

Padrão de substituição:
```js
// ANTES:
import { base44 } from '@/api/base44Client';
// base44.entities.Stock.filter(...)
// base44.entities.Stock.update(id, ...)

// DEPOIS:
import { localDB } from './localDB';
// localDB.entities.Stock.filter(...)
// localDB.entities.Stock.update(id, ...)
```

- [ ] **Step 4.3: Migrar `src/pages/Comandas.jsx`**

Substituir todas as chamadas `base44.entities.*` pelos hooks `useOrders`, `useUpdateOrder`, `useCloseOrder`, `useTables`.

Padrão principal:
```jsx
// ANTES:
import { base44 } from '@/api/base44Client';
// ...
const [orders, setOrders] = useState([]);
const loadAll = async () => {
  const [o, p, w] = await Promise.all([
    base44.entities.Order.filter({ status: 'aberta' }),
    base44.entities.Product.filter({ available: true }),
    base44.entities.Waiter.filter({ active: true })
  ]);
  setOrders(o); setProducts(p); setWaiters(w);
};

// DEPOIS:
import { useOrders, useCreateOrder, useUpdateOrder, useCloseOrder } from '@/hooks/useOrders';
import { useProducts } from '@/hooks/useProducts';
import { useWaiters } from '@/hooks/useWaiters';
// ...
const { data: orders = [] } = useOrders({ status: 'aberta' });
const { data: products = [] } = useProducts({ available: true });
const { data: waiters = [] } = useWaiters({ active: true });
const updateOrderMutation = useUpdateOrder();
const closeOrderMutation = useCloseOrder();
```

- [ ] **Step 4.4: Migrar `src/components/MesaDetalhe.jsx`**

Substituir chamadas Base44 pelos hooks de orders e tables.

- [ ] **Step 4.5: Migrar `src/pages/GarcomApp.jsx` e `src/components/GarcomComanda.jsx`**

Substituir chamadas Base44 pelos hooks correspondentes.

- [ ] **Step 4.6: Verificar no browser**

- Abrir uma mesa → criar comanda → adicionar itens → enviar para cozinha → fechar comanda com pagamento
- Fluxo deve funcionar sem erros no console

- [ ] **Step 4.7: Commit**
```bash
git add src/hooks/useOrders.js src/pages/Comandas.jsx src/lib/stockUtils.js src/pages/GarcomApp.jsx src/components/GarcomComanda.jsx src/components/MesaDetalhe.jsx
git commit -m "feat: migrate Comandas and GarcomApp to useOrders hook"
```

---

## Task 5: Hooks useProducts + useWaiters + Migrar Cardápio e GarcomLogin

**Arquivos:**
- Criar: `src/hooks/useProducts.js`
- Criar: `src/hooks/useWaiters.js`
- Modificar: `src/pages/Cardapio.jsx`
- Modificar: `src/pages/GarcomLogin.jsx`
- Modificar: `src/components/CategoriesManager.jsx`
- Modificar: `src/components/BannersManager.jsx` (se usar Base44)

- [ ] **Step 5.1: Criar `src/hooks/useProducts.js`**

```js
// src/hooks/useProducts.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDB } from '@/lib/localDB';

export const PRODUCT_KEY = ['products'];
export const CATEGORY_KEY = ['categories'];

export function useProducts(filters = {}) {
  return useQuery({
    queryKey: [...PRODUCT_KEY, filters],
    queryFn: () => localDB.entities.Product.filter(filters),
  });
}

export function useCustomCategories() {
  return useQuery({
    queryKey: CATEGORY_KEY,
    queryFn: () => localDB.entities.CustomCategory.list(),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => localDB.entities.Product.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_KEY }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => localDB.entities.Product.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_KEY }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => localDB.entities.Product.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_KEY }),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => localDB.entities.CustomCategory.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORY_KEY }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => localDB.entities.CustomCategory.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORY_KEY }),
  });
}
```

- [ ] **Step 5.2: Criar `src/hooks/useWaiters.js`**

```js
// src/hooks/useWaiters.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDB } from '@/lib/localDB';

export const WAITER_KEY = ['waiters'];

export function useWaiters(filters = {}) {
  return useQuery({
    queryKey: [...WAITER_KEY, filters],
    queryFn: () => localDB.entities.Waiter.filter(filters),
  });
}

export function useCreateWaiter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => localDB.entities.Waiter.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: WAITER_KEY }),
  });
}

export function useUpdateWaiter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => localDB.entities.Waiter.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: WAITER_KEY }),
  });
}

export function useDeleteWaiter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => localDB.entities.Waiter.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: WAITER_KEY }),
  });
}

// Validate PIN for GarcomLogin
export async function validateWaiterPin(pin) {
  const waiters = await localDB.entities.Waiter.filter({ active: true });
  return waiters.find(w => w.pin === pin) || null;
}
```

- [ ] **Step 5.3: Migrar `src/pages/Cardapio.jsx`**

Substituir `base44.entities.Product` e `base44.entities.CustomCategory` pelos hooks. Remover lógica de upload de imagem do Base44 — imagens passam a ser URLs externas (campo `image_url` livre).

- [ ] **Step 5.4: Migrar `src/pages/GarcomLogin.jsx`**

Substituir `base44.entities.Waiter.filter` por `validateWaiterPin` do hook.

- [ ] **Step 5.5: Migrar `src/components/CategoriesManager.jsx`**

Substituir chamadas Base44 pelos hooks `useCustomCategories`, `useCreateCategory`, `useUpdateCategory`.

- [ ] **Step 5.6: Verificar no browser**

- Navegar para /Cardapio — deve mostrar 15 produtos do seed
- Criar um novo produto → deve aparecer na lista
- Acessar /GarcomLogin → digitar PIN 1234 → deve logar como João

- [ ] **Step 5.7: Commit**
```bash
git add src/hooks/useProducts.js src/hooks/useWaiters.js src/pages/Cardapio.jsx src/pages/GarcomLogin.jsx src/components/CategoriesManager.jsx
git commit -m "feat: migrate Cardapio and GarcomLogin to local hooks"
```

---

## Task 6: Hook useStock + useSettings + Migrar Estoque, Relatórios, Configurações

**Arquivos:**
- Criar: `src/hooks/useStock.js`
- Criar: `src/hooks/useSettings.js`
- Modificar: `src/pages/Estoque.jsx`
- Modificar: `src/pages/Relatorios.jsx`
- Modificar: `src/pages/Configuracoes.jsx`

- [ ] **Step 6.1: Criar `src/hooks/useStock.js`**

```js
// src/hooks/useStock.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDB } from '@/lib/localDB';

export const STOCK_KEY = ['stock'];

export function useStock(filters = {}) {
  return useQuery({
    queryKey: [...STOCK_KEY, filters],
    queryFn: () => localDB.entities.Stock.filter(filters),
  });
}

export function useCreateStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => localDB.entities.Stock.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: STOCK_KEY }),
  });
}

export function useUpdateStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => localDB.entities.Stock.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: STOCK_KEY }),
  });
}
```

- [ ] **Step 6.2: Criar `src/hooks/useSettings.js`**

```js
// src/hooks/useSettings.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDB } from '@/lib/localDB';

export const SETTINGS_KEY = ['settings'];

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async () => {
      const all = await localDB.entities.Settings.list();
      return all[0] || null;
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const all = await localDB.entities.Settings.list();
      if (all.length === 0) return localDB.entities.Settings.create(data);
      return localDB.entities.Settings.update(all[0].id, data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}
```

- [ ] **Step 6.3: Migrar `src/pages/Estoque.jsx`**

Substituir `base44.entities.Stock` e `base44.entities.Product` pelos hooks `useStock` e `useProducts`.

- [ ] **Step 6.4: Migrar `src/pages/Relatorios.jsx`**

Substituir `base44.entities.Order.filter({ status: 'fechada' })` por `useOrders({ status: 'fechada' })`.

- [ ] **Step 6.5: Migrar `src/pages/Configuracoes.jsx`**

Substituir `base44.entities.Waiter` e `base44.entities.Settings` pelos hooks `useWaiters`, `useCreateWaiter`, `useUpdateWaiter`, `useDeleteWaiter`, `useSettings`, `useUpdateSettings`.

- [ ] **Step 6.6: Verificar no browser**

- /Estoque → deve listar produtos com 50 unidades
- /Relatorios → deve mostrar o caixa fechado do seed nas estatísticas
- /Configuracoes → deve mostrar garçons e permitir editar configurações

- [ ] **Step 6.7: Commit**
```bash
git add src/hooks/useStock.js src/hooks/useSettings.js src/pages/Estoque.jsx src/pages/Relatorios.jsx src/pages/Configuracoes.jsx
git commit -m "feat: migrate Estoque, Relatorios and Configuracoes to local hooks"
```

---

## Task 7: Módulo de Caixa Completo

**Arquivos:**
- Criar: `src/hooks/useCashier.js`
- Criar: `src/pages/Caixa.jsx`
- Modificar: `src/components/Layout.jsx`

- [ ] **Step 7.1: Criar `src/hooks/useCashier.js`**

```js
// src/hooks/useCashier.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDB } from '@/lib/localDB';

export const CASHIER_KEY = ['cashiers'];

export function useCashiers(filters = {}) {
  return useQuery({
    queryKey: [...CASHIER_KEY, filters],
    queryFn: () => localDB.entities.Cashier.filter(filters),
  });
}

// Returns the currently open cashier (or null)
export function useActiveCashier() {
  return useQuery({
    queryKey: [...CASHIER_KEY, 'active'],
    queryFn: async () => {
      const open = await localDB.entities.Cashier.filter({ status: 'aberto' });
      return open[0] || null;
    },
  });
}

export function useOpenCashier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ operador, turno, saldo_inicial }) =>
      localDB.entities.Cashier.create({
        status: 'aberto',
        turno,
        operador,
        saldo_inicial: parseFloat(saldo_inicial) || 0,
        aberto_em: new Date().toISOString(),
        fechado_em: null,
        movimentacoes: [],
        linked_order_ids: [],
        resumo_pagamentos: { dinheiro: 0, pix: 0, cartao_credito: 0, cartao_debito: 0, misto: 0 },
        total_comandas: 0,
        total_itens: 0,
        saldo_esperado: 0,
        saldo_real: 0,
        diferenca: 0,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CASHIER_KEY }),
  });
}

export function useAddMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cashierId, tipo, valor, motivo, operador }) => {
      const cashier = await localDB.entities.Cashier.get(cashierId);
      const movimentacao = {
        id: `${Date.now()}`,
        tipo,
        valor: parseFloat(valor),
        motivo,
        hora: new Date().toISOString(),
        operador,
      };
      return localDB.entities.Cashier.update(cashierId, {
        movimentacoes: [...(cashier.movimentacoes || []), movimentacao],
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CASHIER_KEY }),
  });
}

// NOTA: useCloseOrder (em useOrders.js) já chama:
//   qc.invalidateQueries({ queryKey: ['tables'] })
// Isso garante que useTables re-renderize ao fechar uma comanda.
// useCashier acessa localDB.entities.Table diretamente (sem importar useTables),
// o que é seguro porque React Query invalida a query ['tables'] no onSuccess,
// causando refetch automático em todos os componentes que usam useTables.

export function useCloseCashier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cashierId, saldo_real }) => {
      // Snapshot before write (atomic safety)
      const snapshot = await localDB.entities.Cashier.get(cashierId);

      try {
        // Collect linked orders
        const linkedIds = snapshot.linked_order_ids || [];
        const allOrders = await localDB.entities.Order.filter({ status: 'fechada' });
        const orders = allOrders.filter(o => linkedIds.includes(o.id));

        // Compute payment summary
        const resumo = { dinheiro: 0, pix: 0, cartao_credito: 0, cartao_debito: 0, misto: 0 };
        let total_itens = 0;
        orders.forEach(o => {
          const method = o.payment_method || 'dinheiro';
          if (method in resumo) resumo[method] += (o.total || 0);
          total_itens += o.items?.reduce((s, i) => s + i.quantity, 0) || 0;
        });

        // Compute expected balance
        const movs = snapshot.movimentacoes || [];
        const totalReforcos = movs.filter(m => m.tipo === 'reforco').reduce((s, m) => s + m.valor, 0);
        const totalSangrias = movs.filter(m => m.tipo === 'sangria').reduce((s, m) => s + m.valor, 0);
        const saldo_esperado = snapshot.saldo_inicial + resumo.dinheiro + totalReforcos - totalSangrias;
        const saldoReal = parseFloat(saldo_real) || 0;

        return localDB.entities.Cashier.update(cashierId, {
          status: 'fechado',
          fechado_em: new Date().toISOString(),
          resumo_pagamentos: resumo,
          total_comandas: orders.length,
          total_itens,
          saldo_esperado: parseFloat(saldo_esperado.toFixed(2)),
          saldo_real: saldoReal,
          diferenca: parseFloat((saldoReal - saldo_esperado).toFixed(2)),
        });
      } catch (err) {
        // Restore snapshot on failure
        await localDB.entities.Cashier.update(cashierId, snapshot);
        throw err;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CASHIER_KEY }),
  });
}

// Calculate running totals for open cashier dashboard
export function useCashierTotals(cashier) {
  if (!cashier) return { totalVendas: 0, totalDinheiro: 0, saldoAtual: 0, totalReforcos: 0, totalSangrias: 0 };

  // We can't easily join orders here without making this async
  // The Caixa page will calculate this from linked orders
  const movs = cashier.movimentacoes || [];
  const totalReforcos = movs.filter(m => m.tipo === 'reforco').reduce((s, m) => s + m.valor, 0);
  const totalSangrias = movs.filter(m => m.tipo === 'sangria').reduce((s, m) => s + m.valor, 0);

  return { totalReforcos, totalSangrias };
}
```

- [ ] **Step 7.2: Criar `src/pages/Caixa.jsx`**

```jsx
// src/pages/Caixa.jsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, TrendingUp, TrendingDown, Clock, CheckCircle2, History, Plus, Minus, X, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useActiveCashier, useOpenCashier, useAddMovement, useCloseCashier, useCashiers } from '@/hooks/useCashier';
import { useOrders } from '@/hooks/useOrders';
import { useAuth } from '@/lib/AuthContext';

const TURNO_LABELS = { manha: '🌅 Manhã', tarde: '☀️ Tarde', noite: '🌙 Noite' };
const PAY_LABELS = { dinheiro: '💵 Dinheiro', pix: '⚡ Pix', cartao_credito: '💳 Crédito', cartao_debito: '💳 Débito', misto: '🔀 Misto' };

export default function Caixa() {
  const [tab, setTab] = useState('caixa');
  const { data: activeCashier, isLoading } = useActiveCashier();
  const { data: allOrders = [] } = useOrders({ status: 'fechada' });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Caixa</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeCashier ? `Turno ${TURNO_LABELS[activeCashier.turno]} — ${activeCashier.operador}` : 'Nenhum caixa aberto'}
          </p>
        </div>
        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          {[['caixa', 'Caixa'], ['historico', 'Histórico']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {tab === 'caixa' && (
        activeCashier
          ? <CaixaAberto cashier={activeCashier} allOrders={allOrders} />
          : <CaixaFechado />
      )}
      {tab === 'historico' && <CaixaHistorico />}
    </div>
  );
}

function CaixaFechado() {
  const [showOpen, setShowOpen] = useState(false);
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4 text-4xl">🏦</div>
      <h2 className="text-xl font-bold text-foreground mb-2">Caixa Fechado</h2>
      <p className="text-muted-foreground mb-6 text-sm">Abra o caixa para registrar vendas e movimentações</p>
      <Button onClick={() => setShowOpen(true)} className="gap-2">
        <Plus className="w-4 h-4" /> Abrir Caixa
      </Button>
      <AbrirCaixaDialog open={showOpen} onClose={() => setShowOpen(false)} />
    </div>
  );
}

function CaixaAberto({ cashier, allOrders }) {
  const { operator } = useAuth();
  const [showSangria, setShowSangria] = useState(false);
  const [showReforco, setShowReforco] = useState(false);
  const [showFechar, setShowFechar] = useState(false);

  // Calculate totals from linked orders
  const linkedOrders = allOrders.filter(o => (cashier.linked_order_ids || []).includes(o.id));
  const totalVendas = linkedOrders.reduce((s, o) => s + (o.total || 0), 0);
  const totalDinheiro = linkedOrders.filter(o => o.payment_method === 'dinheiro').reduce((s, o) => s + (o.total || 0), 0);
  const movs = cashier.movimentacoes || [];
  const totalReforcos = movs.filter(m => m.tipo === 'reforco').reduce((s, m) => s + m.valor, 0);
  const totalSangrias = movs.filter(m => m.tipo === 'sangria').reduce((s, m) => s + m.valor, 0);
  const saldoAtual = cashier.saldo_inicial + totalDinheiro + totalReforcos - totalSangrias;

  const abertoHa = () => {
    const diff = Date.now() - new Date(cashier.aberto_em).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const stats = [
    { label: 'Total Vendas', value: `R$ ${totalVendas.toFixed(2)}`, icon: TrendingUp, color: 'text-emerald-400' },
    { label: 'Saldo em Caixa', value: `R$ ${saldoAtual.toFixed(2)}`, icon: DollarSign, color: 'text-amber-400' },
    { label: 'Reforços', value: `R$ ${totalReforcos.toFixed(2)}`, icon: Plus, color: 'text-blue-400' },
    { label: 'Sangrias', value: `R$ ${totalSangrias.toFixed(2)}`, icon: Minus, color: 'text-red-400' },
  ];

  // Payment breakdown
  const payBreakdown = {};
  linkedOrders.forEach(o => {
    const m = o.payment_method || 'dinheiro';
    payBreakdown[m] = (payBreakdown[m] || 0) + (o.total || 0);
  });

  return (
    <div className="space-y-5">
      {/* Status bar */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
        <div className="flex-1">
          <span className="text-sm font-semibold text-emerald-400">Caixa Aberto</span>
          <span className="text-xs text-muted-foreground ml-2">há {abertoHa()} · Saldo inicial: R$ {cashier.saldo_inicial.toFixed(2)}</span>
        </div>
        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">{TURNO_LABELS[cashier.turno]}</Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-4 rounded-xl border border-border bg-card"
          >
            <div className={`w-8 h-8 rounded-lg bg-secondary flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Payment breakdown */}
      {linkedOrders.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Vendas por Forma de Pagamento</h3>
          <div className="space-y-2">
            {Object.entries(payBreakdown).map(([method, val]) => (
              <div key={method} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{PAY_LABELS[method] || method}</span>
                <span className="font-semibold text-foreground">R$ {val.toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 flex justify-between font-bold">
              <span className="text-foreground">Total</span>
              <span className="text-primary">R$ {totalVendas.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Movements */}
      {movs.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Movimentações</h3>
          <div className="space-y-2">
            {movs.map((m) => (
              <div key={m.id} className="flex items-center gap-3 text-sm">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${m.tipo === 'sangria' ? 'bg-red-500/15 text-red-400' : 'bg-blue-500/15 text-blue-400'}`}>
                  {m.tipo === 'sangria' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                </div>
                <div className="flex-1">
                  <span className="text-foreground capitalize">{m.tipo}</span>
                  {m.motivo && <span className="text-muted-foreground ml-1.5">· {m.motivo}</span>}
                </div>
                <span className={`font-semibold ${m.tipo === 'sangria' ? 'text-red-400' : 'text-blue-400'}`}>
                  {m.tipo === 'sangria' ? '-' : '+'} R$ {m.valor.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="gap-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10" onClick={() => setShowReforco(true)}>
          <TrendingUp className="w-4 h-4" /> Reforço
        </Button>
        <Button variant="outline" className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => setShowSangria(true)}>
          <TrendingDown className="w-4 h-4" /> Sangria
        </Button>
        <Button variant="outline" className="gap-2 ml-auto border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={() => setShowFechar(true)}>
          <CheckCircle2 className="w-4 h-4" /> Fechar Caixa
        </Button>
      </div>

      {/* Dialogs */}
      <MovimentacaoDialog
        open={showSangria}
        onClose={() => setShowSangria(false)}
        tipo="sangria"
        cashierId={cashier.id}
        operador={operator}
      />
      <MovimentacaoDialog
        open={showReforco}
        onClose={() => setShowReforco(false)}
        tipo="reforco"
        cashierId={cashier.id}
        operador={operator}
      />
      <FecharCaixaDialog
        open={showFechar}
        onClose={() => setShowFechar(false)}
        cashier={cashier}
        totalVendas={totalVendas}
        totalDinheiro={totalDinheiro}
        totalReforcos={totalReforcos}
        totalSangrias={totalSangrias}
        saldoAtual={saldoAtual}
        payBreakdown={payBreakdown}
        linkedOrders={linkedOrders}
      />
    </div>
  );
}

function AbrirCaixaDialog({ open, onClose }) {
  const { operator } = useAuth();
  const [form, setForm] = useState({ operador: '', turno: 'manha', saldo_inicial: '' });
  const openCashier = useOpenCashier();

  useEffect(() => {
    if (open) setForm(f => ({ ...f, operador: operator || '' }));
  }, [open, operator]);

  const handleSubmit = async () => {
    if (!form.operador || !form.turno) return;
    await openCashier.mutateAsync(form);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle>Abrir Caixa</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Operador</Label>
            <Input value={form.operador} onChange={e => setForm(f => ({ ...f, operador: e.target.value }))} className="bg-secondary border-border" />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Turno</Label>
            <Select value={form.turno} onValueChange={v => setForm(f => ({ ...f, turno: v }))}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manha">🌅 Manhã</SelectItem>
                <SelectItem value="tarde">☀️ Tarde</SelectItem>
                <SelectItem value="noite">🌙 Noite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Saldo Inicial (R$)</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={form.saldo_inicial}
              onChange={e => setForm(f => ({ ...f, saldo_inicial: e.target.value }))}
              className="bg-secondary border-border"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleSubmit} disabled={openCashier.isPending}>
              {openCashier.isPending ? 'Abrindo...' : 'Abrir Caixa'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MovimentacaoDialog({ open, onClose, tipo, cashierId, operador }) {
  const [form, setForm] = useState({ valor: '', motivo: '' });
  const addMovement = useAddMovement();
  const isSangria = tipo === 'sangria';

  const handleSubmit = async () => {
    if (!form.valor || parseFloat(form.valor) <= 0) return;
    await addMovement.mutateAsync({ cashierId, tipo, valor: form.valor, motivo: form.motivo, operador });
    setForm({ valor: '', motivo: '' });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className={isSangria ? 'text-red-400' : 'text-blue-400'}>
            {isSangria ? '💸 Sangria de Caixa' : '💰 Reforço de Caixa'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Valor (R$)</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={form.valor}
              onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
              className="bg-secondary border-border"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Motivo (opcional)</Label>
            <Input
              placeholder={isSangria ? 'Ex: Troco, pagamento fornecedor...' : 'Ex: Reposição de troco...'}
              value={form.motivo}
              onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
              className="bg-secondary border-border"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button
              className={`flex-1 ${isSangria ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              onClick={handleSubmit}
              disabled={addMovement.isPending}
            >
              Registrar {isSangria ? 'Sangria' : 'Reforço'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FecharCaixaDialog({ open, onClose, cashier, totalVendas, totalDinheiro, totalReforcos, totalSangrias, saldoAtual, payBreakdown, linkedOrders }) {
  const [saldoReal, setSaldoReal] = useState('');
  const closeCashier = useCloseCashier();

  const saldoRealNum = parseFloat(saldoReal) || 0;
  const diferenca = saldoRealNum - saldoAtual;

  const handleClose = async () => {
    await closeCashier.mutateAsync({ cashierId: cashier.id, saldo_real: saldoReal });
    setSaldoReal('');
    onClose();
  };

  const handlePrint = () => {
    const lines = [
      '================================',
      '         FECHAMENTO DE CAIXA',
      '================================',
      `Turno: ${TURNO_LABELS[cashier.turno]}`,
      `Operador: ${cashier.operador}`,
      `Abertura: ${new Date(cashier.aberto_em).toLocaleString('pt-BR')}`,
      `Fechamento: ${new Date().toLocaleString('pt-BR')}`,
      '--------------------------------',
      `Saldo Inicial:    R$ ${cashier.saldo_inicial.toFixed(2)}`,
      `Reforços:         R$ ${totalReforcos.toFixed(2)}`,
      `Sangrias:         R$ ${totalSangrias.toFixed(2)}`,
      '--------------------------------',
      'VENDAS POR PAGAMENTO:',
      ...Object.entries(payBreakdown).map(([k, v]) => `  ${PAY_LABELS[k] || k}: R$ ${v.toFixed(2)}`),
      `Total Vendas:     R$ ${totalVendas.toFixed(2)}`,
      '--------------------------------',
      `Comandas:         ${linkedOrders.length}`,
      `Saldo Esperado:   R$ ${saldoAtual.toFixed(2)}`,
      `Saldo Real:       R$ ${saldoRealNum.toFixed(2)}`,
      `Diferença:        R$ ${diferenca.toFixed(2)}`,
      '================================',
    ].join('\n');
    const win = window.open('', '_blank');
    win.document.write(`<pre style="font-family:monospace;font-size:14px;padding:20px">${lines}</pre>`);
    win.print();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader><DialogTitle>Fechar Caixa</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl bg-secondary p-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Saldo Inicial</span><span>R$ {cashier.saldo_inicial.toFixed(2)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>+ Reforços</span><span>R$ {totalReforcos.toFixed(2)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>- Sangrias</span><span>R$ {totalSangrias.toFixed(2)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>+ Dinheiro recebido</span><span>R$ {totalDinheiro.toFixed(2)}</span></div>
            <div className="border-t border-border pt-2 flex justify-between font-bold text-foreground">
              <span>Saldo Esperado</span><span className="text-primary">R$ {saldoAtual.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-1">
            {Object.entries(payBreakdown).map(([method, val]) => (
              <div key={method} className="flex justify-between text-sm text-muted-foreground">
                <span>{PAY_LABELS[method] || method}</span>
                <span>R$ {val.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold text-foreground border-t border-border pt-1">
              <span>Total Vendas ({linkedOrders.length} comandas)</span>
              <span>R$ {totalVendas.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Saldo real em caixa (R$)</Label>
            <Input
              type="number"
              placeholder="Conte o dinheiro e informe o valor"
              value={saldoReal}
              onChange={e => setSaldoReal(e.target.value)}
              className="bg-secondary border-border"
            />
            {saldoReal && (
              <p className={`text-xs mt-1.5 font-semibold ${diferenca >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {diferenca >= 0 ? `✓ Sobra de R$ ${diferenca.toFixed(2)}` : `✗ Falta de R$ ${Math.abs(diferenca).toFixed(2)}`}
              </p>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-1.5 border-purple-500/30 text-purple-400 hover:bg-purple-500/10" onClick={handlePrint}>
              <Printer className="w-4 h-4" /> Imprimir
            </Button>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleClose} disabled={closeCashier.isPending}>
              {closeCashier.isPending ? 'Fechando...' : 'Confirmar Fechamento'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CaixaHistorico() {
  const { data: cashiers = [], isLoading } = useCashiers({ status: 'fechado' });
  const sorted = [...cashiers].sort((a, b) => new Date(b.fechado_em) - new Date(a.fechado_em));

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  if (sorted.length === 0) return (
    <div className="text-center py-16">
      <History className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
      <p className="text-muted-foreground">Nenhum caixa fechado ainda</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {sorted.map((c, i) => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="p-4 rounded-xl border border-border bg-card"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold text-foreground">{TURNO_LABELS[c.turno]} · {c.operador}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {new Date(c.aberto_em).toLocaleDateString('pt-BR')} · {new Date(c.aberto_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} – {new Date(c.fechado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-primary">R$ {(Object.values(c.resumo_pagamentos || {}).reduce((s, v) => s + v, 0)).toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">{c.total_comandas} comandas</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-secondary text-center">
              <div className="text-muted-foreground">Esperado</div>
              <div className="font-semibold text-foreground">R$ {(c.saldo_esperado || 0).toFixed(2)}</div>
            </div>
            <div className="p-2 rounded-lg bg-secondary text-center">
              <div className="text-muted-foreground">Real</div>
              <div className="font-semibold text-foreground">R$ {(c.saldo_real || 0).toFixed(2)}</div>
            </div>
            <div className={`p-2 rounded-lg text-center ${(c.diferenca || 0) >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
              <div className="text-muted-foreground">Diferença</div>
              <div className={`font-semibold ${(c.diferenca || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {(c.diferenca || 0) >= 0 ? '+' : ''}R$ {(c.diferenca || 0).toFixed(2)}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
```

- [ ] **Step 7.3: Adicionar Caixa na nav — `src/components/Layout.jsx`**

```jsx
// Adicionar no array navItems:
import { Wallet } from 'lucide-react'; // adicionar no import existente

const navItems = [
  { path: '/Mesas', icon: LayoutGrid, label: 'Mesas' },
  { path: '/Cardapio', icon: BookOpen, label: 'Cardápio' },
  { path: '/Caixa', icon: Wallet, label: 'Caixa' },       // ← NOVO
  { path: '/Estoque', icon: Package, label: 'Estoque' },
  { path: '/Relatorios', icon: BarChart3, label: 'Relatórios' },
  { path: '/QRCodes', icon: QrCode, label: 'QR Codes' },
  { path: '/Configuracoes', icon: Settings, label: 'Config.' },
];
```

- [ ] **Step 7.4: Verificar no browser**

- Navegar para /Caixa → deve mostrar tela "Caixa Fechado"
- Clicar "Abrir Caixa" → preencher e confirmar → deve aparecer dashboard do caixa ativo
- Registrar uma sangria e um reforço → devem aparecer na lista
- Aba Histórico → deve mostrar o caixa fechado do seed
- Fechar uma comanda em /Comandas → voltar ao /Caixa → total de vendas deve atualizar
- Fechar caixa → digitar saldo real → diferença calculada corretamente

- [ ] **Step 7.5: Commit**
```bash
git add src/hooks/useCashier.js src/pages/Caixa.jsx src/components/Layout.jsx
git commit -m "feat: add complete Caixa module with open/close/movements/history"
```

---

## Task 8: Backup Export/Import em Configurações

**Arquivos:**
- Criar: `src/lib/backup.js`
- Modificar: `src/pages/Configuracoes.jsx`

- [ ] **Step 8.1: Criar `src/lib/backup.js`**

```js
// src/lib/backup.js
import { localDB } from './localDB';

const ENTITIES = ['tables', 'orders', 'products', 'categories', 'waiters', 'stock', 'cashiers', 'settings'];

export async function exportBackup() {
  const data = {};
  for (const entity of ENTITIES) {
    data[entity] = localDB._getAll(entity);
  }
  const json = JSON.stringify({ version: 1, exported_at: new Date().toISOString(), data }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bm-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed.version || !parsed.data) {
          reject(new Error('Arquivo inválido: formato não reconhecido'));
          return;
        }
        // Validate structure before writing
        for (const entity of ENTITIES) {
          if (parsed.data[entity] && !Array.isArray(parsed.data[entity])) {
            reject(new Error(`Arquivo inválido: ${entity} deve ser uma lista`));
            return;
          }
        }
        // Write all entities
        for (const entity of ENTITIES) {
          if (parsed.data[entity]) {
            localDB._setAll(entity, parsed.data[entity]);
          }
        }
        resolve({ success: true, exported_at: parsed.exported_at });
      } catch (err) {
        reject(new Error('Arquivo inválido: JSON corrompido'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file);
  });
}

export function resetAllData() {
  const PREFIX = 'bm_';
  const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
  keys.forEach(k => localStorage.removeItem(k));
  localStorage.removeItem('bm_seeded_v1');
  window.location.reload();
}
```

- [ ] **Step 8.2: Adicionar seção de Backup em `src/pages/Configuracoes.jsx`**

Adicionar uma aba ou seção "Dados & Backup" na página de configurações com:
- Botão "Exportar JSON" → chama `exportBackup()`
- Input de arquivo "Importar JSON" → chama `importBackup(file)` com confirmação
- Botão "Limpar Dados" → pede que o usuário digite "LIMPAR" e chama `resetAllData()`

```jsx
// Adicionar no componente de Configurações:
import { exportBackup, importBackup, resetAllData } from '@/lib/backup';
import { useRef, useState } from 'react';

function BackupSection() {
  const fileRef = useRef(null);
  const [resetConfirm, setResetConfirm] = useState('');
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm('Isso vai SUBSTITUIR todos os dados atuais. Continuar?')) return;
    setImporting(true);
    try {
      const result = await importBackup(file);
      setMsg({ type: 'success', text: `Importado com sucesso (backup de ${new Date(result.exported_at).toLocaleDateString('pt-BR')})` });
      window.location.reload();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
    setImporting(false);
  };

  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
      <h3 className="font-semibold text-foreground">Backup & Dados</h3>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="gap-2" onClick={exportBackup}>
          ⬇️ Exportar JSON
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()} disabled={importing}>
          ⬆️ {importing ? 'Importando...' : 'Importar JSON'}
        </Button>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      </div>

      {msg && (
        <p className={`text-sm ${msg.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>
      )}

      <div className="border-t border-border pt-4">
        <p className="text-xs text-muted-foreground mb-2">Para limpar todos os dados, digite <code className="bg-secondary px-1 rounded">LIMPAR</code> abaixo:</p>
        <div className="flex gap-2">
          <Input
            placeholder="LIMPAR"
            value={resetConfirm}
            onChange={e => setResetConfirm(e.target.value)}
            className="bg-secondary border-border max-w-[160px]"
          />
          <Button
            variant="destructive"
            disabled={resetConfirm !== 'LIMPAR'}
            onClick={resetAllData}
          >
            Limpar Tudo
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8.3: Verificar no browser**

- /Configuracoes → seção "Dados & Backup" visível
- Clicar "Exportar JSON" → baixar arquivo .json com todos os dados
- Clicar "Limpar Tudo" sem digitar LIMPAR → botão deve estar desabilitado
- Digitar LIMPAR → clicar → app reinicia com seed

- [ ] **Step 8.4: Commit**
```bash
git add src/lib/backup.js src/pages/Configuracoes.jsx
git commit -m "feat: add backup export/import and data reset in Configuracoes"
```

---

## Task 9: Testes Finais e App Pronto

- [ ] **Step 9.1: Executar lint**
```bash
cd "C:\Users\User\Downloads\able-smart-bar-flow"
npm run lint
```
Corrigir todos os erros reportados.

- [ ] **Step 9.2: Build de produção**
```bash
npm run build
```
Esperado: build sem erros em `dist/`.

- [ ] **Step 9.3: Teste end-to-end manual — fluxo principal**

Seguir o fluxo completo:
1. Login com "Admin"
2. /Caixa → Tela "Caixa Fechado" deve aparecer
3. Abrir Caixa (turno Noite, saldo inicial R$ 200) → dashboard aparece com saldo R$ 200
4. /Mesas → Clicar Mesa 1 → Criar Comanda → Garçom João
5. Adicionar: Cerveja Lata (x2) + Porcão de Frango (x1)
6. Enviar pedido → Fechar comanda com Pix
7. Mesa 1 deve voltar ao status **Livre** imediatamente (valida Issue-03)
8. /Caixa → Total de vendas deve exibir o valor da comanda fechada
9. Registrar Sangria R$ 50 (motivo: troco) → aparece na lista de movimentações
10. Registrar Reforço R$ 100 → aparece na lista
11. Fechar Caixa → digitar saldo real → diferença calculada = saldo_real - saldo_esperado

- [ ] **Step 9.4: Teste end-to-end — persistência e histórico**

12. **Fechar e reabrir o browser** → acessar http://localhost:5173
13. /Caixa → Aba Histórico → caixa fechado deve aparecer com valores corretos
14. Dados do seed (caixa do dia anterior) também deve aparecer no histórico
15. /Relatorios → produtos vendidos e formas de pagamento da sessão devem aparecer
16. /Configuracoes → Exportar JSON → verificar que arquivo .json é baixado e contém todos os dados

- [ ] **Step 9.5: Teste de reset (opcional, destrói dados)**

17. /Configuracoes → digitar "LIMPAR" → clicar "Limpar Tudo"
18. App reinicia → seed é aplicado novamente → 10 mesas, 15 produtos visíveis
19. Importar o backup exportado no step 16 → dados restaurados

- [ ] **Step 9.6: Commit final**
```bash
git add -A
git commit -m "feat: BarMaster fully migrated to LocalDB with complete Caixa module"
```

---

## Referências

- Spec: `docs/superpowers/specs/2026-03-19-caixa-localdb-design.md`
- React Query docs: https://tanstack.com/query/latest
- Projeto: `C:\Users\User\Downloads\able-smart-bar-flow`
