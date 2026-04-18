"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteSupplier } from "@/lib/api/suppliers";
import { queryKeys } from "@/lib/query/keys";

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });
    },
  });
}
