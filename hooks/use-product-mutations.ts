"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteProduct } from "@/lib/api/products";
import { queryKeys } from "@/lib/query/keys";

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
}
