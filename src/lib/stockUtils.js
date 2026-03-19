import { base44 } from '@/api/base44Client';

/**
 * Deduz estoque automaticamente ao fechar uma comanda.
 * Para cada item da comanda, busca o StockItem vinculado ao product_id
 * e deduz quantity * deduct_per_sale.
 */
export async function deductStockForOrder(order) {
  if (!order?.items?.length) return;

  const stockItems = await base44.entities.StockItem.filter({ active: true });

  // Map product_id -> stock item
  const stockByProduct = {};
  stockItems.forEach(s => {
    if (s.product_id) stockByProduct[s.product_id] = s;
  });

  const updates = [];
  const movements = [];

  for (const item of order.items) {
    const stock = stockByProduct[item.product_id];
    if (!stock) continue;

    const deduct = (stock.deduct_per_sale || 1) * item.quantity;
    const before = stock.quantity || 0;
    const after = Math.max(0, before - deduct);

    updates.push({ id: stock.id, quantity: after });
    movements.push({
      stock_item_id: stock.id,
      stock_item_name: stock.name,
      type: 'saida',
      quantity: deduct,
      quantity_before: before,
      quantity_after: after,
      order_id: order.id,
      notes: `Baixa automática - Comanda #${order.id?.slice(-6)?.toUpperCase()} - ${item.product_name} x${item.quantity}`,
    });
  }

  // Execute all updates and movements in parallel
  await Promise.all([
    ...updates.map(u => base44.entities.StockItem.update(u.id, { quantity: u.quantity })),
    ...movements.map(m => base44.entities.StockMovement.create(m)),
  ]);
}