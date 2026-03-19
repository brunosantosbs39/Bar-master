import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDB } from '@/lib/localDB';

export const STOCK_KEY = ['stock'];

export function useStock(filters = {}) {
  return useQuery({
    queryKey: [...STOCK_KEY, filters],
    queryFn: () => localDB.entities.Stock.filter(filters),
  });
}

export function useCreateStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => localDB.entities.Stock.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: STOCK_KEY }),
  });
}

export function useUpdateStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => localDB.entities.Stock.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: STOCK_KEY }),
  });
}
