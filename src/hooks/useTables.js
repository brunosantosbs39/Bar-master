import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDB } from '@/lib/localDB';

export const TABLE_KEY = ['tables'];

export function useTables(filters = {}) {
  return useQuery({
    queryKey: [...TABLE_KEY, filters],
    queryFn: () => localDB.entities.Table.filter(filters),
  });
}

export function useCreateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => localDB.entities.Table.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TABLE_KEY }),
  });
}

export function useUpdateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => localDB.entities.Table.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TABLE_KEY }),
  });
}

export function useDeleteTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => localDB.entities.Table.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: TABLE_KEY }),
  });
}
