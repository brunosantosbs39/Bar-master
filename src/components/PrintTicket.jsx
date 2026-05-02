/**
 * PrintTicket - Componente de impressão para departamentos e conta do cliente
 * Suporta 3 métodos: QZ Tray (USB/local), Rede TCP e Navegador
 */
import { loadPrinterConfig, buildEscPosKitchen, buildEscPosBill, printViaQZTray } from '@/lib/printerConfig';

const categoryDept = {
  cervejas: 'bar',
  destilados: 'bar',
  drinks: 'bar',
  vinhos: 'bar',
  nao_alcoolicos: 'bar',
  bebidas: 'bar',
  petiscos: 'cozinha',
  porcoes: 'cozinha',
  pratos: 'cozinha',
  sobremesas: 'cozinha',
};

// Retorna o departamento do item: usa print_dept do produto se definido, senão usa categoria
function getDept(item, products) {
  const prod = products?.find(p => p.id === item.product_id);
  if (prod?.print_dept && prod.print_dept !== 'nenhum') return prod.print_dept;
  if (prod?.print_dept === 'nenhum') return 'nenhum';
  if (prod?.category) return categoryDept[prod.category] || 'bar';
  return 'bar';
}

// Imprime automaticamente todos os departamentos com itens pendentes
// itemsToPrint: lista opcional de itens a imprimir (se não fornecida, usa os com status 'pendente' ou 'preparando')
export function printAutoByDept(order, products, itemsToPrint) {
  const toPrint = itemsToPrint || (order.items || []).filter(i => i.status === 'pendente' || i.status === 'preparando');

  const barItems = toPrint.filter(i => getDept(i, products) === 'bar');
  const cozinhaItems = toPrint.filter(i => getDept(i, products) === 'cozinha');

  if (barItems.length > 0) {
    _printDept(order, barItems, 'bar');
  }
  if (cozinhaItems.length > 0) {
    const delay = barItems.length > 0 ? 600 : 0;
    setTimeout(() => _printDept(order, cozinhaItems, 'cozinha'), delay);
  }
}

// Internal: roteia impressão para QZ Tray, browser ou servidor TCP
async function _printDept(order, items, dept) {
  const cfg = loadPrinterConfig()[dept];
  const tableLabel = order.table_type === 'delivery' ? 'DELIVERY'
    : order.table_type === 'balcao' ? 'BALCAO'
    : `MESA ${order.table_number || ''}`;
  const deptLabel = dept === 'cozinha' ? 'COZINHA' : 'BAR';

  // USB Windows direto via servidor (sem QZ Tray)
  if (cfg?.enabled && cfg?.method === 'winusb') {
    if (!cfg.name) { _showPrintError(`Impressora ${dept.toUpperCase()}: nome da impressora não configurado`); return; }
    fetch('/api/print-usb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerName: cfg.name, dept, order, items }),
    }).then(r => r.json()).then(data => {
      if (data.error) _showPrintError(`Impressora ${dept.toUpperCase()}: ${data.error}`);
    }).catch(err => console.error('[USB Windows]', err));
    return;
  }

  // QZ Tray — impressora USB/local via WebSocket
  if (cfg?.enabled && cfg?.method === 'qztray') {
    if (!cfg.name) { _showPrintError(`Impressora ${dept.toUpperCase()}: nome da impressora não configurado`); return; }
    try {
      const escPos = buildEscPosKitchen(order, items, deptLabel, tableLabel, { printDensity: cfg.printDensity ?? 4 });
      await printViaQZTray(cfg.name, escPos);
    } catch (err) {
      _showPrintError(`Impressora ${dept.toUpperCase()}: ${err.message}`);
    }
    return;
  }

  // Navegador — popup de impressão
  if (cfg?.enabled && cfg?.method === 'browser') {
    const now = new Date().toLocaleString('pt-BR');
    openPrintWindow(buildKitchenHtml(items, deptLabel, tableLabel, now, order));
    return;
  }

  // Rede TCP via servidor (padrão)
  fetch('/api/print-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order, items, dept }),
  }).then(r => r.json()).then(data => {
    if (data.error) _showPrintError(`Impressora ${dept.toUpperCase()}: ${data.error}`);
  }).catch(err => {
    console.error('[Impressora]', err);
  });
}

export function printKitchenBar(order, products, dept) {
  const items = (order.items || []).filter(item => {
    if (dept === 'todos') return true;
    return getDept(item, products) === dept;
  });
  if (items.length === 0) return;
  _printDept(order, items, dept === 'todos' ? 'bar' : dept);
}

function buildKitchenHtml(items, deptLabel, tableLabel, now, order) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Pedido - ${deptLabel}</title>
      <style>
        @page { size: 80mm auto; margin: 0 !important; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100% !important; }
        body { font-family: 'Courier New', monospace; font-size: 13px; padding: 3mm; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .big { font-size: 18px; font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; padding: 2px 0; }
        .item-name { font-weight: bold; font-size: 15px; }
        .item-qty { font-size: 20px; font-weight: bold; margin-right: 6px; }
        .notes { font-style: italic; color: #444; font-size: 12px; padding-left: 8px; }
        .header-dept { background: #000; color: #fff; padding: 4px 8px; text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 6px; }
        .order-id { font-size: 11px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header-dept">${deptLabel}</div>
      <div class="center bold big">${tableLabel}</div>
      <div class="center order-id">Comanda #${order.id?.slice(-6)?.toUpperCase()}</div>
      <div class="center" style="font-size:11px">${now}</div>
      <div class="divider"></div>
      ${items.map(item => `
        <div style="margin: 8px 0;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="item-qty">${item.quantity}x</span>
            <span class="item-name">${item.product_name}</span>
          </div>
          ${item.notes ? `<div class="notes">⚠️ ${item.notes}</div>` : ''}
        </div>
        <div class="divider"></div>
      `).join('')}
      ${order.notes ? `<div style="margin-top:6px;font-style:italic;">Obs: ${order.notes}</div>` : ''}
    </body>
    </html>
  `;
}

function buildCustomerBillHtml(order) {
  const tableLabel =
    order.table_type === 'delivery' ? 'DELIVERY' :
    order.table_type === 'balcao' ? 'BALCÃO' :
    `MESA ${order.table_number || ''}`;
  const now = new Date().toLocaleString('pt-BR');
  const payLabels = {
    dinheiro: 'Dinheiro', cartao_credito: 'Cartão Crédito',
    cartao_debito: 'Cartão Débito', pix: 'Pix', misto: 'Misto',
  };
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Conta</title>
    <style>
      @page{size:80mm auto;margin:0 !important}
      *{margin:0;padding:0;box-sizing:border-box}
      html,body{width:100% !important}
      body{font-family:'Courier New',monospace;font-size:12px;padding:3mm}
      .center{text-align:center}.bold{font-weight:bold}
      .divider{border-top:1px dashed #000;margin:5px 0}
      .row{display:flex;justify-content:space-between;align-items:baseline;padding:2px 0;width:100%}
      .total-row{display:flex;justify-content:space-between;align-items:baseline;font-size:16px;font-weight:bold;margin-top:4px;width:100%}
      .bar-name{font-size:18px;font-weight:bold;text-align:center;width:100%}
    </style></head><body>
    <div class="bar-name">MEU BAR</div>
    <div class="center" style="font-size:11px;margin-bottom:4px;">Obrigado pela preferência!</div>
    <div class="divider"></div>
    <div class="row"><span class="bold">${tableLabel}</span><span>${now}</span></div>
    ${order.customer_name ? `<div>Cliente: ${order.customer_name}</div>` : ''}
    <div class="divider"></div>
    <div class="row bold"><span>ITEM</span><span>QTD</span><span>TOTAL</span></div>
    <div class="divider"></div>
    ${(order.items || []).map(item => `
      <div class="row">
        <span style="flex:1;overflow:hidden;word-break:break-word;">${item.product_name}</span>
        <span style="margin:0 8px;">${item.quantity}x</span>
        <span>R$ ${(item.total || 0).toFixed(2)}</span>
      </div>
      ${item.notes ? `<div style="font-size:10px;color:#666;padding-left:4px;">↳ ${item.notes}</div>` : ''}
    `).join('')}
    <div class="divider"></div>
    <div class="row"><span>Subtotal</span><span>R$ ${(order.subtotal || 0).toFixed(2)}</span></div>
    <div class="row"><span>Serviço (10%)</span><span>R$ ${(order.service_fee || 0).toFixed(2)}</span></div>
    ${order.discount ? `<div class="row"><span>Desconto</span><span>- R$ ${order.discount.toFixed(2)}</span></div>` : ''}
    <div class="divider"></div>
    <div class="total-row"><span>TOTAL</span><span>R$ ${(order.total || 0).toFixed(2)}</span></div>
    ${order.payment_method ? `<div class="row" style="margin-top:4px;"><span>Pagamento</span><span>${payLabels[order.payment_method] || order.payment_method}</span></div>` : ''}
    <div class="divider"></div>
    <div class="center" style="margin-top:8px;font-size:11px;">*** NÃO É DOCUMENTO FISCAL ***</div>
    </body></html>`;
}

export async function printCustomerBill(order) {
  const printers = loadPrinterConfig();
  // Se 'bar' não está habilitada, usa 'cozinha' como fallback (única impressora)
  const cfg = (printers['bar']?.enabled) ? printers['bar'] : (printers['cozinha'] ?? printers['bar']);

  // USB Windows direto via servidor (sem QZ Tray)
  if (cfg?.enabled && cfg?.method === 'winusb') {
    if (!cfg.name) { _showPrintError('Impressora Bar: nome da impressora não configurado'); return; }
    fetch('/api/print-usb-bill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerName: cfg.name, order }),
    }).then(r => r.json()).then(data => {
      if (data.error) _showPrintError(`Impressora Bar (conta): ${data.error}`);
    }).catch(err => console.error('[USB Windows Bill]', err));
    return;
  }

  // QZ Tray — impressora USB/local via WebSocket
  if (cfg?.enabled && cfg?.method === 'qztray') {
    if (!cfg.name) { _showPrintError('Impressora Bar: nome da impressora não configurado'); return; }
    try {
      const escPos = buildEscPosBill(order, { printDensity: cfg.printDensity ?? 4 });
      await printViaQZTray(cfg.name, escPos);
    } catch (err) {
      _showPrintError(`Impressora Bar (conta): ${err.message}`);
    }
    return;
  }

  // Navegador — popup de impressão
  if (cfg?.enabled && cfg?.method === 'browser') {
    openPrintWindow(buildCustomerBillHtml(order));
    return;
  }

  // Rede TCP via servidor (padrão)
  fetch('/api/print-bill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order }),
  }).then(r => r.json()).then(data => {
    if (data.error) _showPrintError(`Impressora Bar (conta): ${data.error}`);
  }).catch(err => {
    console.error('[Impressora Conta]', err);
  });
}

function _showPrintError(msg) {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;background:#dc2626;color:#fff;padding:10px 18px;border-radius:12px;font-size:13px;font-family:sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.3);max-width:90vw;text-align:center;';
  div.textContent = '⚠️ Erro de impressão: ' + msg;
  document.body.appendChild(div);
  setTimeout(() => { if (document.body.contains(div)) document.body.removeChild(div); }, 5000);
}

function openPrintWindow(html) {
  // Usa injeção no DOM em todos os dispositivos (mobile e desktop)
  // Evita popup bloqueado no desktop e funciona de forma consistente
  const hideId = '__barmaster_print_style__';
  const cssId  = '__barmaster_print_css__';
  const divId  = '__barmaster_print_div__';

  // 1) CSS de ocultação dos outros elementos durante impressão
  let hideEl = document.getElementById(hideId);
  if (!hideEl) {
    hideEl = document.createElement('style');
    hideEl.id = hideId;
    hideEl.textContent = `@media print { body > *:not(#${divId}) { display: none !important; } #${divId} { display: block !important; } } #${divId} { display: none; }`;
    document.head.appendChild(hideEl);
  }

  // 2) CSS do ticket (extrai do HTML gerado e injeta no head — @page, body, etc.)
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  let cssEl = document.getElementById(cssId);
  if (!cssEl) {
    cssEl = document.createElement('style');
    cssEl.id = cssId;
    document.head.appendChild(cssEl);
  }
  cssEl.textContent = styleMatch ? styleMatch[1] : '';

  // 3) Conteúdo do body
  let printDiv = document.getElementById(divId);
  if (!printDiv) {
    printDiv = document.createElement('div');
    printDiv.id = divId;
    document.body.appendChild(printDiv);
  }
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  printDiv.innerHTML = bodyMatch ? bodyMatch[1] : html;

  const cleanup = () => { printDiv.innerHTML = ''; cssEl.textContent = ''; };
  window.onafterprint = cleanup;
  window.print();
}

function getPrinterConfig(dept) {
  try {
    const raw = localStorage.getItem('barmaster_printers');
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    return cfg[dept] || null;
  } catch {
    return null;
  }
}