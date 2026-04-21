"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteProductAction } from "@/actions/products";
import { queryKeys } from "@/lib/query/keys";

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProductAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
}
