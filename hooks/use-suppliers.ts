"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteSupplier, getSupplier, getSuppliers } from "@/lib/api/suppliers";
import { queryKeys } from "@/lib/query/keys";

export function useSuppliers() {
  return useQuery({
    queryKey: queryKeys.suppliers.all,
    queryFn: getSuppliers,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSupplier(id: number) {
  return useQuery({
    queryKey: queryKeys.suppliers.detail(id),
    queryFn: () => getSupplier(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });
    },
  });
}
