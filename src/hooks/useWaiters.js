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

export async function validateWaiterPin(pin) {
  const waiters = await localDB.entities.Waiter.filter({ active: true });
  return waiters.find(w => w.pin === pin) || null;
}
