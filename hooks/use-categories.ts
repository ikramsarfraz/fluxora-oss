"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateSetupChecklistQuery } from "@/lib/query/invalidate-setup-checklist";
import { queryKeys } from "@/lib/query/keys";
import {
  createCategoryAction,
  deleteCategoryAction,
  getCategoriesAction,
  getCategoryByIdAction,
} from "@/actions/categories";
import { isUuid } from "@/lib/utils/uuid";

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => getCategoriesAction(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCategory(id: string) {
  return useQuery({
    queryKey: queryKeys.categories.detail(id),
    queryFn: () => getCategoryByIdAction(id),
    enabled: !!id && isUuid(id),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCategoryAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      invalidateSetupChecklistQuery(queryClient);
    },
  });
}

// export function useUpdateCategory() {
//   return useMutation({
//     mutationFn: updateCategoryAction,
//   });
// }

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCategoryAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}
