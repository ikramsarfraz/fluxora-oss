"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateSetupChecklistQuery } from "@/lib/query/invalidate-setup-checklist";
import { queryKeys } from "@/lib/query/keys";
import {
  archiveCategoryAction,
  createCategoryAction,
  deleteCategoryAction,
  getCategoriesAction,
  getCategoryByIdAction,
  getCategoryProductCountAction,
  restoreCategoryAction,
  untagAndDeleteCategoryAction,
} from "@/modules/distribution/categories/actions";
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

/**
 * Tenant-scoped count of products still tagged with this category.
 * Loaded alongside `useCategory` on the detail page so the delete
 * dialog can open already routed to the right phase. Short stale time
 * — if the user untags a product elsewhere we want the dialog to know.
 */
export function useCategoryProductCount(id: string) {
  return useQuery({
    queryKey: queryKeys.categories.productCount(id),
    queryFn: () => getCategoryProductCountAction(id),
    enabled: !!id && isUuid(id),
    staleTime: 1000 * 30,
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
    onSuccess: result => {
      // Only invalidate when the category actually went away — the
      // "blocked" branch hasn't mutated anything.
      if (result.status === "deleted") {
        queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      }
    },
  });
}

export function useArchiveCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveCategoryAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}

export function useRestoreCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreCategoryAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}

export function useUntagAndDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: untagAndDeleteCategoryAction,
    onSuccess: () => {
      // Touches both categories and products (product_categories rows
      // were removed), so invalidate both query trees.
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
}
