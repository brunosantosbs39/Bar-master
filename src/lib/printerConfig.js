/**
 * Printer configuration management
 * Stores printer settings in localStorage
 * Supports QZ Tray for network printing and fallback to window.print()
 */

const STORAGE_KEY = 'barmaster_printers';

// Modelos Epson TM com densidade padrão recomendada (0–8, padrão=4)
export const EPSON_MODELS = [
  { id: 'TM-T20',   label: 'TM-T20 / T20II / T20III', defaultDensity: 4 },
  { id: 'TM-T82',   label: 'TM-T82 / T82III',          defaultDensity: 4 },
  { id: 'TM-T88',   label: 'TM-T88V / T88VI',          defaultDensity: 5 },
  { id: 'TM-T70',   label: 'TM-T70 / T70II',           defaultDensity: 4 },
  { id: 'TM-L90',   label: 'TM-L90',                   defaultDensity: 4 },
  { id: 'other',    label: 'Outro modelo',              defaultDensity: 4 },
];

export const defaultPrinterConfig = {
  bar: {
    enabled: false,
    name: '',
    method: 'browser', // 'browser' | 'qztray' | 'network' | 'winusb'
    ip: '',
    port: '9100',
    model: '',        // ID do modelo Epson
    printDensity: 4,  // 0=mais claro … 8=mais escuro (padrão ESC/POS = 4)
  },
  cozinha: {
    enabled: false,
    name: '',
    method: 'browser',
    ip: '',
    port: '9100',
    model: '',
    printDensity: 4,
  },
};

/**
 * Retorna o comando ESC/POS GS ( E para ajustar a densidade de impressão.
 * Suportado por Epson TM-T20, T82, T88, T70 e compatíveis.
 * density: 0 (mais claro) … 4 (padrão) … 8 (mais escuro)
 */
export function buildDensityCommand(density = 4) {
  const level = Math.max(0, Math.min(8, Math.round(density)));
  // GS ( E pL pH m fn n  →  1D 28 45 02 00 07 <level>
  return `\x1D\x28\x45\x02\x00\x07${String.fromCharCode(level)}`;
}

export function loadPrinterConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrinterConfig;
    return { ...defaultPrinterConfig, ...JSON.parse(raw) };
  } catch {
    return defaultPrinterConfig;
  }
}

export function savePrinterConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// Timeout máximo para handshake do QZ Tray (ms)
const QZ_CONNECT_TIMEOUT_MS = 6000;

// Flag: connect() promise resolveu — handshake completo, conexão pronta
let _qzReady = false;

/**
 * Registra callbacks de segurança no QZ Tray (idempotente).
 * Modo sem assinatura: resolve certificate e signature com string vazia.
 * Requer allow-unsigned=true no qz-tray.properties.
 */
function setupQZSecurity() {
  if (!window.qz) return;
  window.qz.security.setCertificatePromise((resolve) => resolve(''));
  window.qz.security.setSignaturePromise((_toSign) => (resolve) => resolve(''));
}

/**
 * Cancela conexão pendente/presa e aguarda limpeza do socket.
 * Seguro mesmo sem conexão ativa.
 */
async function qzDisconnect() {
  try { window.qz.websocket.disconnect(); } catch { /* sem conexão — ok */ }
  await new Promise(r => setTimeout(r, 300));
}

/**
 * Garante conexão com QZ Tray. Usa discovery nativo (multi-porta/host).
 *
 * Bugs corrigidos vs. código anterior:
 * - isActive() retorna true para CONNECTING *e* OPEN. Usamos _qzReady para
 *   saber se o handshake realmente completou.
 * - Se _qzReady=false mas isActive()=true, há socket preso → desconectar antes.
 * - Timeout de 6s captura o caso "QZ Tray aberto mas aguardando Allow".
 */
async function qzConnect() {
  // Conexão já confirmada pelo resolve() anterior
  if (_qzReady && window.qz.websocket.isActive()) return;

  // Socket preso em CONNECTING/OPEN sem handshake completo — limpar
  _qzReady = false;
  if (window.qz.websocket.isActive()) {
    await qzDisconnect();
  }

  // Registra segurança antes de cada tentativa de conexão
  setupQZSecurity();

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), QZ_CONNECT_TIMEOUT_MS);
    // Tenta WSS (8181) e WS (8182) — cobrir ambos os modos do QZ Tray
    window.qz.websocket.connect({ retries: 0, delay: 0 })
      .then(() => { clearTimeout(timer); resolve(); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });

  _qzReady = true;
}

/**
 * Check if QZ Tray is available.
 * Returns a promise<boolean>
 */
export async function isQZTrayAvailable() {
  if (typeof window === 'undefined' || !window.qz) return false;
  try {
    await qzConnect();
    return true;
  } catch {
    return false;
  }
}

/**
 * Detailed QZ Tray status check.
 * Returns { available: boolean, reason: string }
 * Reasons: 'active' | 'no_script' | 'not_running' | 'timeout' | 'security_error'
 */
export async function checkQZTrayStatus() {
  if (typeof window === 'undefined' || !window.qz) {
    return { available: false, reason: 'no_script', rawError: null };
  }
  try {
    await qzConnect();
    return { available: true, reason: 'active', rawError: null };
  } catch (e) {
    const msg = String(e?.message || e || '').toLowerCase();
    const rawError = String(e?.message || e || 'erro desconhecido');
    console.error('[QZ Tray] Erro de conexão:', rawError);
    if (msg === 'timeout') {
      return { available: false, reason: 'timeout', rawError };
    }
    if (msg.includes('blocked')) {
      return { available: false, reason: 'blocked', rawError };
    }
    if (
      msg.includes('security') || msg.includes('certificate') ||
      msg.includes('unsigned') || msg.includes('sign') ||
      msg.includes('trust') || msg.includes('cert') ||
      msg.includes('denied') || msg.includes('reject')
    ) {
      return { available: false, reason: 'security_error', rawError };
    }
    return { available: false, reason: 'not_running', rawError };
  }
}

/**
 * Send raw ESC/POS text to a printer via QZ Tray
 */
export async function printViaQZTray(printerName, escPosText) {
  if (!window.qz) throw new Error('QZ Tray não encontrado — instale e abra o app');
  await qzConnect();
  const cfg = window.qz.configs.create(printerName);
  const data = [{ type: 'raw', format: 'plain', data: escPosText }];
  await window.qz.print(cfg, data);
}

/**
 * Send ESC/POS text to a network printer via TCP (through the local server)
 */
export async function printViaNetwork(ip, port, escPosText) {
  // Converte string ESC/POS para array de bytes (Latin-1)
  const bytes = Array.from(escPosText).map(c => c.charCodeAt(0) & 0xFF);
  const res = await fetch('/api/print-network', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip, port: parseInt(port) || 9100, bytes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao imprimir via rede');
  }
}

// Remove acentos e converte para ASCII puro (compatível com qualquer code page ESC/POS)
function toAscii(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '?');
}

/**
 * Build ESC/POS customer bill (conta do cliente)
 * opts.barName: nome do bar; opts.printDensity: 0–8
 */
export function buildEscPosBill(order, opts = {}) {
  const barName = toAscii(opts.barName || 'MEU BAR');
  const density = opts.printDensity ?? 4;
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const tableLabel =
    order.table_type === 'delivery' ? 'DELIVERY' :
    order.table_type === 'balcao'   ? 'BALCAO' :
    `MESA ${order.table_number || ''}`;
  const payLabels = {
    dinheiro: 'Dinheiro', cartao_credito: 'Cartao Credito',
    cartao_debito: 'Cartao Debito', pix: 'Pix', misto: 'Misto',
  };

  // 42 colunas = largura total do papel 80mm em fonte normal (Font A)
  const SEP = `------------------------------------------\n`; // 42 traços

  let txt = '';
  txt += `\x1B\x40`; // init
  txt += buildDensityCommand(density);
  txt += `\x1B\x61\x01`; // center
  txt += `\x1B\x21\x30${barName}\x1B\x21\x00\n`;
  txt += `Obrigado pela preferencia!\n`;
  txt += `\x1B\x61\x00`; // left
  txt += SEP;
  txt += `${tableLabel.padEnd(24)}${dateStr}\n`; // 24+18=42
  if (order.customer_name) txt += `Cliente: ${toAscii(order.customer_name)}\n`;
  txt += SEP;
  txt += `${'ITEM'.padEnd(28)}${'QTD'.padStart(4)}${'TOTAL'.padStart(10)}\n`; // 28+4+10=42
  txt += SEP;
  (order.items || []).forEach(item => {
    const name = toAscii(item.product_name || '').substring(0, 28).padEnd(28);
    const qty  = `${item.quantity}x`.padStart(4);
    const tot  = `R$${(item.total || 0).toFixed(2)}`.padStart(10);
    txt += `${name}${qty}${tot}\n`;
    if (item.notes) txt += `  >> ${toAscii(item.notes)}\n`;
  });
  txt += SEP;
  txt += `${'Subtotal'.padEnd(32)}R$${(order.subtotal || 0).toFixed(2).padStart(8)}\n`;
  txt += `${'Servico (10%)'.padEnd(32)}R$${(order.service_fee || 0).toFixed(2).padStart(8)}\n`;
  if (order.discount) {
    txt += `${'Desconto'.padEnd(32)}-R$${order.discount.toFixed(2).padStart(7)}\n`;
  }
  txt += SEP;
  txt += `\x1B\x21\x10${'TOTAL'.padEnd(32)}R$${(order.total || 0).toFixed(2).padStart(8)}\x1B\x21\x00\n`;
  if (order.payment_method) {
    txt += `Pagamento: ${payLabels[order.payment_method] || order.payment_method}\n`;
  }
  txt += SEP;
  txt += `\x1B\x61\x01*** NAO E DOCUMENTO FISCAL ***\n`;
  txt += `\x1B\x61\x00`;
  txt += `\x1B\x64\x04`; // feed 4 lines
  txt += `\x1D\x56\x41\x00`; // cut
  return txt;
}

/**
 * Build ESC/POS plain text for kitchen/bar ticket
 * opts.printDensity: 0–8 (padrão 4) — aplica GS ( E se diferente de 4
 */
export function buildEscPosKitchen(order, items, deptLabel, tableLabel, opts = {}) {
  const now = new Date().toLocaleString('pt-BR');
  const id = order.id?.slice(-6)?.toUpperCase() || '------';
  let txt = '';
  txt += `\x1B\x40`; // init
  // Ajusta densidade se configurada
  const density = opts.printDensity ?? 4;
  txt += buildDensityCommand(density);
  txt += `\x1B\x61\x01`; // center
  txt += `\x1B\x21\x30${deptLabel}\x1B\x21\x00\n`; // double size
  txt += `\x1B\x21\x10${tableLabel}\x1B\x21\x00\n`;
  txt += `Comanda #${id}\n`;
  txt += `${now}\n`;
  txt += `--------------------------------\n`;
  txt += `\x1B\x61\x00`; // left
  items.forEach(item => {
    txt += `\x1B\x21\x08${item.quantity}x ${item.product_name}\x1B\x21\x00\n`;
    if (item.notes) txt += `   >> ${item.notes}\n`;
  });
  txt += `--------------------------------\n`;
  if (order.notes) txt += `Obs: ${order.notes}\n`;
  txt += `\x1B\x64\x04`; // feed 4 lines
  txt += `\x1D\x56\x41\x00`; // cut
  return txt;
}