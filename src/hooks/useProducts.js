import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDB } from '@/lib/localDB';

export const PRODUCT_KEY = ['products'];
export const CATEGORY_KEY = ['categories'];

export function useProducts(filters = {}) {
  return useQuery({
    queryKey: [...PRODUCT_KEY, filters],
    queryFn: () => localDB.entities.Product.filter(filters),
  });
}

export function useCustomCategories() {
  return useQuery({
    queryKey: CATEGORY_KEY,
    queryFn: () => localDB.entities.CustomCategory.list(),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => localDB.entities.Product.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_KEY }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => localDB.entities.Product.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_KEY }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => localDB.entities.Product.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_KEY }),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => localDB.entities.CustomCategory.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORY_KEY }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => localDB.entities.CustomCategory.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORY_KEY }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => localDB.entities.CustomCategory.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORY_KEY }),
  });
}

// Reordena produtos por sort_order — usa for sequencial (não Promise.all)
// porque o servidor salva em products.json com read-modify-write: chamadas
// concorrentes corrompem o arquivo por last-write-wins.
export function useReorderProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates) => {
      for (const { id, sort_order } of updates) {
        await localDB.entities.Product.update(id, { sort_order });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_KEY }),
  });
}
