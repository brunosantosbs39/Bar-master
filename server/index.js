// server/index.js — BarMaster API Server
// Roda no PC e serve todos os dispositivos na mesma rede WiFi

import 'dotenv/config';
import { ensureWorkerConfig } from './setup.js';
try { ensureWorkerConfig(); } catch (e) { console.warn('Worker config setup falhou:', e.message); }

import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname, extname } from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import os from 'os';
import net from 'net';
import { spawnSync } from 'child_process';
import { startTunnel, getTunnelUrl } from './tunnel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const PUBLIC_DIR = join(__dirname, '../public');
if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// ── Upload de imagens (logo e banner) ────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido'));
  },
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// ── Entidades disponíveis ────────────────────────────────────────────────────
const ENTITIES = ['tables', 'orders', 'products', 'custom_categories', 'waiters', 'stock', 'cashiers', 'settings', 'admin_users', 'banners'];

// ── Login de Admin (registrado antes do CRUD genérico) ─────────────────────
app.post('/api/admin_users/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Dados incompletos' });
  const users = readAll('admin_users');
  const user = users.find(u => u.username === username && u.password === password && u.active !== false);
  if (!user) return res.status(401).json({ error: 'Usuário ou senha incorretos' });
  const { password: _pwd, ...safeUser } = user;
  res.json(safeUser);
});

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

// Comparação de filtros com suporte a boolean, número e múltiplos valores (pipe-separated)
function matchFilter(item, filters) {
  return Object.entries(filters).every(([k, v]) => {
    const val = item[k];
    // Múltiplos valores separados por pipe: status=aberta|em_recebimento
    if (String(v).includes('|')) {
      const options = String(v).split('|');
      return options.some(opt => {
        if (opt === 'true')  return val === true;
        if (opt === 'false') return val === false;
        if (!isNaN(opt) && !isNaN(Number(val))) return Number(val) === Number(opt);
        return String(val) === opt;
      });
    }
    if (v === 'true')  return val === true;
    if (v === 'false') return val === false;
    // Tenta comparação numérica
    if (!isNaN(v) && !isNaN(Number(val))) return Number(val) === Number(v);
    return String(val) === String(v);
  });
}

// ── Upload de logo/banner ─────────────────────────────────────────────────────
app.post('/api/upload', upload.single('file'), (req, res) => {
  const { type } = req.body;
  if (!type || !['logo', 'banner'].includes(type)) {
    return res.status(400).json({ error: 'Parâmetro type deve ser "logo" ou "banner"' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Arquivo não enviado' });
  }

  // Remove arquivos anteriores do mesmo tipo
  try {
    const existing = readdirSync(PUBLIC_DIR).filter(f => f.startsWith(`${type}-cliente`));
    existing.forEach(f => unlinkSync(join(PUBLIC_DIR, f)));
  } catch { /* ignora se não houver */ }

  // Salva com timestamp para cache-busting
  const ext = extname(req.file.originalname) || (req.file.mimetype === 'image/webp' ? '.webp' : '.png');
  const filename = `${type}-cliente-${Date.now()}${ext}`;
  const filepath = join(PUBLIC_DIR, filename);
  writeFileSync(filepath, req.file.buffer);

  res.json({ url: `/${filename}` });
});

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

// ── Endpoint: IP local da máquina ────────────────────────────────────────────
app.get('/api/local-ip', (req, res) => {
  res.json({ ip: getLocalIP() });
});

// ── URL pública do túnel (localtunnel ou cloudflare) ─────────────────────────

app.get('/api/public-url', (req, res) => {
  // 1. Worker URL permanente (se configurado) — strip trailing slash para evitar /menu/menu
  const workerUrl = (process.env.WORKER_URL || '').replace(/\/$/, '');
  if (workerUrl) return res.json({ url: workerUrl });

  // 2. URL do tunnel em memória
  const tunnelUrl = getTunnelUrl();
  if (tunnelUrl) return res.json({ url: tunnelUrl });

  // 3. Legado: cloudflare.log
  const logFile = join(__dirname, '..', 'cloudflare.log');
  if (existsSync(logFile)) {
    try {
      const content = readFileSync(logFile, 'utf8');
      const match = content.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) return res.json({ url: match[0] });
    } catch { /* ignora */ }
  }

  res.json({ url: null });
});

// ── Impressão via TCP (impressoras térmicas de rede) ─────────────────────────
app.post('/api/print-network', (req, res) => {
  const { ip, port, bytes } = req.body;
  if (!ip || !port || !Array.isArray(bytes)) {
    return res.status(400).json({ error: 'ip, port e bytes são obrigatórios' });
  }
  const buf = Buffer.from(bytes);
  const client = new net.Socket();
  let responded = false;

  client.setTimeout(4000);
  client.connect(parseInt(port), ip, () => {
    client.write(buf);
    client.end();
  });
  client.on('close', () => {
    if (!responded) { responded = true; res.json({ ok: true }); }
  });
  client.on('error', (err) => {
    if (!responded) { responded = true; res.status(500).json({ error: err.message }); }
  });
  client.on('timeout', () => {
    client.destroy();
    if (!responded) { responded = true; res.status(500).json({ error: 'Timeout — verifique o IP e a porta da impressora' }); }
  });
});

// ── Config de impressoras (server-side) ──────────────────────────────────────
const DEFAULT_PRINTERS_CFG = {
  bar:     { enabled: false, method: 'network', name: '', ip: '', port: '9100', printDensity: 4 },
  cozinha: { enabled: false, method: 'network', name: '', ip: '', port: '9100', printDensity: 4 },
};

function readPrinters() {
  const settings = readAll('settings')[0] || {};
  return { ...DEFAULT_PRINTERS_CFG, ...(settings.printers_config || {}) };
}

app.get('/api/printers', (_req, res) => res.json(readPrinters()));

app.post('/api/printers', (req, res) => {
  const items = readAll('settings');
  if (!items.length) return res.status(404).json({ error: 'Settings não encontrado' });
  items[0] = { ...items[0], printers_config: req.body, updated_at: new Date().toISOString() };
  writeAll('settings', items);
  res.json({ ok: true });
});

// ESC/POS helpers (server-side)
function _dens(d = 4) {
  const l = Math.max(0, Math.min(8, Math.round(d)));
  return `\x1D\x28\x45\x02\x00\x07${String.fromCharCode(l)}`;
}

// Remove acentos e converte para ASCII puro (compatível com qualquer code page ESC/POS)
function toAscii(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '?');
}

function buildKitchenEscPos(order, items, deptLabel, tableLabel, density = 4) {
  const now = new Date().toLocaleString('pt-BR');
  const id = (order.id || '').slice(-6).toUpperCase() || '------';
  let t = `\x1B\x40${_dens(density)}\x1B\x61\x01`;
  t += `\x1B\x21\x30${deptLabel}\x1B\x21\x00\n`;
  t += `\x1B\x21\x10${tableLabel}\x1B\x21\x00\n`;
  t += `Comanda #${id}\n${now}\n`;
  t += `--------------------------------\n\x1B\x61\x00`;
  items.forEach(i => {
    t += `\x1B\x21\x08${i.quantity}x ${i.product_name}\x1B\x21\x00\n`;
    if (i.notes) t += `   >> ${i.notes}\n`;
  });
  t += `--------------------------------\n`;
  if (order.notes) t += `Obs: ${order.notes}\n`;
  t += `\x1B\x64\x04\x1D\x56\x41\x00`;
  return t;
}

function buildBillEscPos(order, barName = 'MEU BAR', density = 4) {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const tableLabel = order.table_type === 'delivery' ? 'DELIVERY'
    : order.table_type === 'balcao' ? 'BALCAO'
    : `MESA ${order.table_number || ''}`;
  const payL = { dinheiro: 'Dinheiro', cartao_credito: 'Cartao Credito', cartao_debito: 'Cartao Debito', pix: 'Pix', misto: 'Misto' };
  // 42 colunas = largura total do papel 80mm em fonte normal (Font A)
  const SEP = `------------------------------------------\n`; // 42 traços
  let t = `\x1B\x40${_dens(density)}\x1B\x61\x01`;
  t += `\x1B\x21\x30${toAscii(barName)}\x1B\x21\x00\nObrigado pela preferencia!\n\x1B\x61\x00`;
  t += SEP;
  t += `${tableLabel.padEnd(24)}${dateStr}\n`; // 24+18=42
  if (order.customer_name) t += `Cliente: ${toAscii(order.customer_name)}\n`;
  t += SEP;
  t += `${'ITEM'.padEnd(28)}${'QTD'.padStart(4)}${'TOTAL'.padStart(10)}\n`; // 28+4+10=42
  t += SEP;
  (order.items || []).forEach(i => {
    const n = toAscii(i.product_name || '').substring(0, 28).padEnd(28);
    t += `${n}${`${i.quantity}x`.padStart(4)}${`R$${(i.total||0).toFixed(2)}`.padStart(10)}\n`;
    if (i.notes) t += `  >> ${toAscii(i.notes)}\n`;
  });
  t += SEP;
  t += `${'Subtotal'.padEnd(32)}R$${(order.subtotal||0).toFixed(2).padStart(8)}\n`;
  t += `${'Servico (10%)'.padEnd(32)}R$${(order.service_fee||0).toFixed(2).padStart(8)}\n`;
  if (order.discount) t += `${'Desconto'.padEnd(32)}-R$${order.discount.toFixed(2).padStart(7)}\n`;
  t += SEP;
  t += `\x1B\x21\x10${'TOTAL'.padEnd(32)}R$${(order.total||0).toFixed(2).padStart(8)}\x1B\x21\x00\n`;
  if (order.payment_method) t += `Pagamento: ${payL[order.payment_method] || order.payment_method}\n`;
  t += SEP;
  t += `\x1B\x61\x01*** NAO E DOCUMENTO FISCAL ***\n\x1B\x61\x00`;
  t += `\x1B\x64\x04\x1D\x56\x41\x00`;
  return t;
}

function printToTcp(ip, port, escPosText) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(Array.from(escPosText).map(c => c.charCodeAt(0) & 0xFF));
    const sock = new net.Socket();
    let done = false;
    const fin = fn => { if (!done) { done = true; fn(); } };
    sock.setTimeout(4000);
    sock.connect(parseInt(port) || 9100, ip, () => { sock.write(buf); sock.end(); });
    sock.on('close',   ()    => fin(resolve));
    sock.on('error',   err   => fin(() => reject(err)));
    sock.on('timeout', ()    => { sock.destroy(); fin(() => reject(new Error('Timeout — impressora não encontrada'))); });
  });
}

// Imprime itens do pedido direto na impressora térmica (server-side, sem browser)
app.post('/api/print-order', async (req, res) => {
  const { order, items, dept } = req.body;
  if (!order || !Array.isArray(items) || !dept) {
    return res.status(400).json({ error: 'order, items e dept são obrigatórios' });
  }
  const cfg = readPrinters()[dept];
  if (!cfg?.enabled) return res.json({ ok: true, skipped: true });

  const tableLabel = order.table_type === 'delivery' ? 'DELIVERY'
    : order.table_type === 'balcao' ? 'BALCAO'
    : `MESA ${order.table_number || ''}`;
  const deptLabel = dept === 'cozinha' ? 'COZINHA' : 'BAR';
  const escPos = buildKitchenEscPos(order, items, deptLabel, tableLabel, cfg.printDensity ?? 4);

  try {
    if (cfg.method === 'winusb') {
      if (!cfg.name) return res.json({ ok: true, skipped: true });
      await printRawWindows(cfg.name, escPos);
    } else {
      if (!cfg.ip) return res.json({ ok: true, skipped: true });
      await printToTcp(cfg.ip, cfg.port || '9100', escPos);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(`[Impressora ${dept.toUpperCase()}] ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Imprime conta do cliente
app.post('/api/print-bill', async (req, res) => {
  const { order } = req.body;
  if (!order) return res.status(400).json({ error: 'order é obrigatório' });
  const printers = readPrinters();
  const cfg = (printers['bar']?.enabled) ? printers['bar'] : (printers['cozinha'] ?? printers['bar']);
  if (!cfg?.enabled) return res.json({ ok: true, skipped: true });
  const settings = readAll('settings')[0] || {};
  const escPos = buildBillEscPos(order, settings.bar_name || 'MEU BAR', cfg.printDensity ?? 4);

  try {
    if (cfg.method === 'winusb') {
      if (!cfg.name) return res.json({ ok: true, skipped: true });
      await printRawWindows(cfg.name, escPos);
    } else {
      if (!cfg.ip) return res.json({ ok: true, skipped: true });
      await printToTcp(cfg.ip, cfg.port || '9100', escPos);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(`[Impressora BAR-CONTA] ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── Impressão USB direto via Windows API (sem QZ Tray) ───────────────────────
function printRawWindows(printerName, escPosText) {
  return new Promise((resolve, reject) => {
    // Converte ESC/POS string para bytes
    const bytes = Array.from(escPosText).map(c => c.charCodeAt(0) & 0xFF);
    const byteArray = bytes.join(',');

    // PowerShell inline: usa winspool.drv para enviar bytes RAW diretamente
    const ps = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public struct DOCINFOA {
  [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
  [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
  [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
}
public class RawPrint {
  [DllImport("winspool.Drv",EntryPoint="OpenPrinterA",SetLastError=true)]
  public static extern bool OpenPrinter(string n,out IntPtr h,IntPtr p);
  [DllImport("winspool.Drv",EntryPoint="ClosePrinter")]
  public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="StartDocPrinterA",SetLastError=true)]
  public static extern int StartDocPrinter(IntPtr h,int l,ref DOCINFOA d);
  [DllImport("winspool.Drv",EntryPoint="EndDocPrinter")]
  public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="StartPagePrinter")]
  public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="EndPagePrinter")]
  public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv",EntryPoint="WritePrinter",SetLastError=true)]
  public static extern bool WritePrinter(IntPtr h,IntPtr b,int n,out int w);
}
"@
$bytes = [byte[]]@(${byteArray})
$printerName = "${printerName.replace(/"/g, '\\"')}"
$hPrinter = [IntPtr]::Zero
if (-not [RawPrint]::OpenPrinter($printerName, [ref]$hPrinter, [IntPtr]::Zero)) { throw "Impressora nao encontrada: $printerName" }
$di = New-Object DOCINFOA
$di.pDocName = "BarMaster"
$di.pDataType = "RAW"
[RawPrint]::StartDocPrinter($hPrinter,1,[ref]$di) | Out-Null
[RawPrint]::StartPagePrinter($hPrinter) | Out-Null
$ptr = [System.Runtime.InteropServices.Marshal]::AllocCoTaskMem($bytes.Length)
[System.Runtime.InteropServices.Marshal]::Copy($bytes,0,$ptr,$bytes.Length)
$written = 0
[RawPrint]::WritePrinter($hPrinter,$ptr,$bytes.Length,[ref]$written) | Out-Null
[System.Runtime.InteropServices.Marshal]::FreeCoTaskMem($ptr)
[RawPrint]::EndPagePrinter($hPrinter) | Out-Null
[RawPrint]::EndDocPrinter($hPrinter) | Out-Null
[RawPrint]::ClosePrinter($hPrinter) | Out-Null
Write-Output "OK:$written"
`;

    const result = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      timeout: 8000,
      encoding: 'utf8',
    });

    if (result.error) return reject(new Error('PowerShell não encontrado: ' + result.error.message));
    if (result.status !== 0) {
      const errMsg = (result.stderr || result.stdout || 'Erro desconhecido').trim();
      return reject(new Error(errMsg));
    }
    resolve();
  });
}

// Lista impressoras Windows instaladas
app.get('/api/printers-list', (_req, res) => {
  const result = spawnSync('powershell', [
    '-NoProfile', '-NonInteractive', '-Command',
    'Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json'
  ], { timeout: 5000, encoding: 'utf8' });

  if (result.status !== 0) return res.json({ printers: [] });
  try {
    const raw = JSON.parse(result.stdout || '[]');
    const list = Array.isArray(raw) ? raw : [raw];
    res.json({ printers: list });
  } catch {
    res.json({ printers: [] });
  }
});

// Imprime bytes RAW direto na impressora Windows pelo nome (sem QZ Tray)
app.post('/api/print-usb', async (req, res) => {
  const { printerName, dept, order, items } = req.body;
  if (!printerName) return res.status(400).json({ error: 'printerName é obrigatório' });

  const cfg = readPrinters()[dept] || {};
  let escPos;
  if (order && items && dept) {
    const tableLabel = order.table_type === 'delivery' ? 'DELIVERY'
      : order.table_type === 'balcao' ? 'BALCAO'
      : `MESA ${order.table_number || ''}`;
    const deptLabel = dept === 'cozinha' ? 'COZINHA' : 'BAR';
    escPos = buildKitchenEscPos(order, items, deptLabel, tableLabel, cfg.printDensity ?? 4);
  } else {
    return res.status(400).json({ error: 'order, items e dept são obrigatórios' });
  }

  try {
    await printRawWindows(printerName, escPos);
    res.json({ ok: true });
  } catch (err) {
    console.error('[USB Print]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Imprime conta via USB Windows
app.post('/api/print-usb-bill', async (req, res) => {
  const { printerName, order } = req.body;
  if (!printerName || !order) return res.status(400).json({ error: 'printerName e order são obrigatórios' });
  const printers = readPrinters();
  const cfg = (printers['bar']?.enabled) ? printers['bar'] : (printers['cozinha'] ?? {});
  const settings = readAll('settings')[0] || {};
  try {
    await printRawWindows(printerName, buildBillEscPos(order, settings.bar_name || 'MEU BAR', cfg.printDensity ?? 4));
    res.json({ ok: true });
  } catch (err) {
    console.error('[USB Print Bill]', err.message);
    res.status(500).json({ error: err.message });
  }
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

// ── Error handler global (deve vir após todas as rotas) ──────────────────────
app.use((err, _req, res, _next) => {
  if (err.message === 'Tipo de arquivo não permitido') {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Arquivo muito grande. Máximo 5MB.' });
  }
  res.status(500).json({ error: err.message });
});

// ── Inicialização ─────────────────────────────────────────────────────────────
const PORT = 3001;
const VITE_PORT = 5173;

app.listen(PORT, '0.0.0.0', async () => {
  const ip = getLocalIP();
  console.log('\n🍺 BarMaster Server iniciado!\n');
  console.log(`   PC (admin):  http://localhost:${VITE_PORT}`);
  console.log(`   📱 Rede Wi-Fi:  http://${ip}:${VITE_PORT}\n`);

  // Seed automático na primeira execução
  if (readAll('tables').length === 0) {
    const { seed } = await import('./seed.js');
    seed();
  }

  // ── Túnal público (cloudflared sem tela de senha) ───────────────────
  await startTunnel(VITE_PORT);
});
