import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDB } from '@/lib/localDB';

export const SETTINGS_KEY = ['settings'];

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async () => {
      const all = await localDB.entities.Settings.list();
      return all[0] || null;
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const all = await localDB.entities.Settings.list();
      if (all.length === 0) return localDB.entities.Settings.create(data);
      return localDB.entities.Settings.update(all[0].id, data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}
