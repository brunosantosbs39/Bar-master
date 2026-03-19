// server/index.js — BarMaster API Server
// Roda no PC e serve todos os dispositivos na mesma rede WiFi

import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// ── Entidades disponíveis ────────────────────────────────────────────────────
const ENTITIES = ['tables', 'orders', 'products', 'custom_categories', 'waiters', 'stock', 'cashiers', 'settings'];

// ── Helpers de arquivo ────────────────────────────────────────────────────────
function readAll(entity) {
  const file = join(DATA_DIR, `${entity}.json`);
  if (!existsSync(file)) return [];
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return []; }
}

function writeAll(entity, data) {
  writeFileSync(join(DATA_DIR, `${entity}.json`), JSON.stringify(data, null, 2));
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Comparação de filtros com suporte a boolean e número
function matchFilter(item, filters) {
  return Object.entries(filters).every(([k, v]) => {
    const val = item[k];
    if (v === 'true')  return val === true;
    if (v === 'false') return val === false;
    // Tenta comparação numérica
    if (!isNaN(v) && !isNaN(Number(val))) return Number(val) === Number(v);
    return String(val) === String(v);
  });
}

// ── Rotas CRUD genéricas ──────────────────────────────────────────────────────
ENTITIES.forEach(entity => {
  const route = `/api/${entity}`;

  // GET — lista (com filtro via query params)
  app.get(route, (req, res) => {
    let items = readAll(entity);
    const filters = req.query;
    if (Object.keys(filters).length > 0) {
      items = items.filter(item => matchFilter(item, filters));
    }
    res.json(items);
  });

  // GET — item único
  app.get(`${route}/:id`, (req, res) => {
    const item = readAll(entity).find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  });

  // POST — criar
  app.post(route, (req, res) => {
    const now = new Date().toISOString();
    const item = { ...req.body, id: generateId(), created_at: now, updated_at: now };
    const items = readAll(entity);
    items.push(item);
    writeAll(entity, items);
    res.json(item);
  });

  // PUT — atualizar
  app.put(`${route}/:id`, (req, res) => {
    const items = readAll(entity);
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    items[idx] = { ...items[idx], ...req.body, id: req.params.id, updated_at: new Date().toISOString() };
    writeAll(entity, items);
    res.json(items[idx]);
  });

  // DELETE — remover
  app.delete(`${route}/:id`, (req, res) => {
    writeAll(entity, readAll(entity).filter(i => i.id !== req.params.id));
    res.json({ ok: true });
  });
});

// ── Backup ────────────────────────────────────────────────────────────────────

// Exportar tudo
app.get('/api/backup', (req, res) => {
  const backup = {};
  ENTITIES.forEach(e => { backup[e] = readAll(e); });
  res.json(backup);
});

// Importar tudo (substitui dados existentes)
app.post('/api/backup', (req, res) => {
  const data = req.body;
  ENTITIES.forEach(e => {
    if (Array.isArray(data[e])) writeAll(e, data[e]);
  });
  res.json({ ok: true });
});

// Resetar tudo e re-seed
app.delete('/api/backup', async (req, res) => {
  ENTITIES.forEach(e => writeAll(e, []));
  const { seed } = await import('./seed.js');
  seed();
  res.json({ ok: true });
});

// ── IP local para exibir ao usuário ──────────────────────────────────────────
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.values(interfaces)) {
    for (const iface of name) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

// ── Inicialização ─────────────────────────────────────────────────────────────
const PORT = 3001;

app.listen(PORT, '0.0.0.0', async () => {
  const ip = getLocalIP();
  console.log('\n🍺 BarMaster Server iniciado!\n');
  console.log(`   PC (admin):  http://localhost:5173`);
  console.log(`   📱 Garçons:  http://${ip}:5173\n`);

  // Seed automático na primeira execução
  if (readAll('tables').length === 0) {
    const { seed } = await import('./seed.js');
    seed();
  }
});
