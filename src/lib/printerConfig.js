/**
 * Printer configuration management
 * Stores printer settings in localStorage
 * Supports QZ Tray for network printing and fallback to window.print()
 */

const STORAGE_KEY = 'barmaster_printers';

export const defaultPrinterConfig = {
  bar: {
    enabled: false,
    name: '',       // printer name as seen by QZ Tray / OS
    method: 'browser', // 'browser' | 'qztray'
  },
  cozinha: {
    enabled: false,
    name: '',
    method: 'browser',
  },
};

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

/**
 * Check if QZ Tray is available (WebSocket on port 8181/8182)
 * Returns a promise<boolean>
 */
export async function isQZTrayAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    // qz-tray exposes window.qz after loading the qz-tray.js script
    if (window.qz && typeof window.qz.websocket?.connect === 'function') {
      if (!window.qz.websocket.isActive()) {
        await window.qz.websocket.connect({ retries: 1, delay: 0.5 });
      }
      return window.qz.websocket.isActive();
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Send raw ESC/POS text to a printer via QZ Tray
 */
export async function printViaQZTray(printerName, escPosText) {
  if (!window.qz) throw new Error('QZ Tray não encontrado');
  if (!window.qz.websocket.isActive()) {
    await window.qz.websocket.connect();
  }
  const config = window.qz.configs.create(printerName);
  const data = [{ type: 'raw', format: 'plain', data: escPosText }];
  await window.qz.print(config, data);
}

/**
 * Build ESC/POS plain text for kitchen/bar ticket
 */
export function buildEscPosKitchen(order, items, deptLabel, tableLabel) {
  const now = new Date().toLocaleString('pt-BR');
  const id = order.id?.slice(-6)?.toUpperCase() || '------';
  let txt = '';
  txt += `\x1B\x40`; // init
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