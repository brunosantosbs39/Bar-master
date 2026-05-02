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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDER_KEY });
      qc.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => localDB.entities.Order.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ORDER_KEY }),
  });
}

export async function linkOrderToCashier(orderId) {
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
    // silently fail
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
