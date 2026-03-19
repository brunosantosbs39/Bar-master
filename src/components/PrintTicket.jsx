/**
 * PrintTicket - Componente de impressão para departamentos e conta do cliente
 * Usa window.print() com CSS @media print para gerar o ticket correto
 */

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

// Internal: prints specific items for a dept
function _printDept(order, items, dept) {
  const tableLabel =
    order.table_type === 'delivery' ? 'DELIVERY' :
    order.table_type === 'balcao' ? 'BALCAO' :
    `MESA ${order.table_number || ''}`;

  const now = new Date().toLocaleString('pt-BR');
  const deptLabel = dept === 'cozinha' ? 'COZINHA' : 'BAR';
  const deptEmoji = dept === 'cozinha' ? '🍳 COZINHA' : '🍺 BAR';

  const printerCfg = getPrinterConfig(dept);
  if (printerCfg?.enabled && printerCfg?.method === 'qztray' && printerCfg?.name) {
    import('@/lib/printerConfig').then(({ printViaQZTray, buildEscPosKitchen }) => {
      const escPos = buildEscPosKitchen(order, items, deptLabel, tableLabel);
      printViaQZTray(printerCfg.name, escPos).catch(() => {
        openPrintWindow(buildKitchenHtml(items, deptEmoji, tableLabel, now, order));
      });
    });
    return;
  }

  openPrintWindow(buildKitchenHtml(items, deptEmoji, tableLabel, now, order));
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
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 13px; padding: 8px; width: 80mm; }
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

export function printCustomerBill(order) {
  const tableLabel =
    order.table_type === 'delivery' ? 'DELIVERY' :
    order.table_type === 'balcao' ? 'BALCÃO' :
    `MESA ${order.table_number || ''}`;

  const now = new Date().toLocaleString('pt-BR');
  const payLabels = {
    dinheiro: 'Dinheiro', cartao_credito: 'Cartão Crédito',
    cartao_debito: 'Cartão Débito', pix: 'Pix', misto: 'Misto'
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Conta do Cliente</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 12px; padding: 8px; width: 80mm; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; padding: 2px 0; }
        .total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-top: 4px; }
        .bar-name { font-size: 18px; font-weight: bold; text-align: center; }
      </style>
    </head>
    <body>
      <div class="bar-name">⭐ MEU BAR</div>
      <div class="center" style="font-size:11px; margin-bottom:4px;">Obrigado pela preferência!</div>
      <div class="divider"></div>
      <div class="row"><span class="bold">${tableLabel}</span><span>${now}</span></div>
      ${order.customer_name ? `<div>Cliente: ${order.customer_name}</div>` : ''}
      <div class="divider"></div>
      <div class="row bold"><span>ITEM</span><span>QTD</span><span>TOTAL</span></div>
      <div class="divider"></div>
      ${(order.items || []).map(item => `
        <div class="row">
          <span style="flex:1;max-width:120px;overflow:hidden;">${item.product_name}</span>
          <span style="margin:0 8px;">${item.quantity}x</span>
          <span>R$ ${item.total.toFixed(2)}</span>
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
      <div class="center" style="margin-top:8px; font-size:11px;">*** NÃO É DOCUMENTO FISCAL ***</div>
    </body>
    </html>
  `;

  openPrintWindow(html);
}

function openPrintWindow(html) {
  const win = window.open('', '_blank', 'width=400,height=600');
  if (!win) {
    alert('Pop-up bloqueado! Permita pop-ups para este site nas configurações do navegador para imprimir.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 300);
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