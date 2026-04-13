"use client";

import { useQuery } from "@tanstack/react-query";
import { getProducts } from "@/lib/api/products";
import { queryKeys } from "@/lib/query/keys";

export function useProducts() {
  return useQuery({
    queryKey: queryKeys.products.all,
    queryFn: getProducts,
    staleTime: 1000 * 60 * 5,
  });
}
