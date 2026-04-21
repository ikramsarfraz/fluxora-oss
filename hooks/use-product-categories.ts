"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { getProductCategoriesAction } from "@/actions/products";

export function useProductCategories() {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => getProductCategoriesAction(),
    staleTime: 1000 * 60 * 5,
  });
}
