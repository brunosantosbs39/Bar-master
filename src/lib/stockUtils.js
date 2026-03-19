import { localDB } from './localDB';

/**
 * Deduz estoque automaticamente ao fechar uma comanda.
 * Para cada item da comanda, busca o StockItem vinculado ao product_id
 * e deduz quantity * deduct_per_sale.
 */
export async function deductStockForOrder(order) {
  if (!order?.items?.length) return;

  const stockItems = await localDB.entities.Stock.filter({ active: true });

  // Map product_id -> stock item
  const stockByProduct = {};
  stockItems.forEach(s => {
    if (s.product_id) stockByProduct[s.product_id] = s;
  });

  const updates = [];

  for (const item of order.items) {
    const stock = stockByProduct[item.product_id];
    if (!stock) continue;

    const deduct = (stock.deduct_per_sale || 1) * item.quantity;
    const before = stock.quantity || 0;
    const after = Math.max(0, before - deduct);

    updates.push({ id: stock.id, quantity: after });
  }

  // Execute all updates in parallel
  await Promise.all(
    updates.map(u => localDB.entities.Stock.update(u.id, { quantity: u.quantity }))
  );
}
