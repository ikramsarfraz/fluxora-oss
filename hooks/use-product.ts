"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getProductByIdAction } from "@/actions/products";

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.products.detail(id),
    queryFn: () => getProductByIdAction(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}
