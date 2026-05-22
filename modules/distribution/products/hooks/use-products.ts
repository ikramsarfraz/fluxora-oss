"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteProductAction,
  getProductByIdAction,
  getProductsAction,
  getProductsPageAction,
  previewProductSkuAction,
} from "@/modules/distribution/products/actions";
import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import type { ProductListParams } from "@/modules/distribution/products/services/products";

const SKU_PREVIEW_DEBOUNCE_MS = 300;

export function useProducts() {
  return useQuery({
    queryKey: queryKeys.products.all,
    queryFn: getProductsAction,
    staleTime: 1000 * 60 * 5,
  });
}

export function useProductsPage(params: ProductListParams) {
  return useQuery({
    queryKey: queryKeys.products.list(params),
    queryFn: () => getProductsPageAction(params),
    placeholderData: previousData => previousData,
    staleTime: 1000 * 60 * 5,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.products.detail(id),
    queryFn: () => getProductByIdAction(id),
    enabled: !!id && isUuid(id),
    staleTime: 1000 * 60 * 5,
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProductAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
}

/**
 * Resolve the next available SKU for `(name, categoryName)` against the
 * tenant's catalog. Returns `null` until `name` has at least one
 * non-whitespace character — saves a roundtrip on every keystroke
 * before the user has typed anything meaningful. The unique-index on
 * insert is still the source of truth; this preview is for UX only.
 *
 * Inputs are debounced — typing "Whole Chicken" should fire one query
 * after the user pauses, not 13. The 300ms window matches the
 * useUrlPaginationState debounce so behaviour feels consistent across
 * the app. The unique-index retry in createProduct means a slightly
 * stale preview is harmless.
 */
export function useProductSkuPreview(
  name: string,
  categoryName: string | null | undefined,
) {
  const trimmed = name.trim();
  const [debouncedName, setDebouncedName] = useState(trimmed);
  const [debouncedCategory, setDebouncedCategory] = useState(
    categoryName ?? null,
  );

  useEffect(() => {
    // Skip the debounce on empty so the chip clears immediately when the
    // user deletes everything — no awkward stale preview after a clear.
    if (!trimmed) {
      setDebouncedName("");
      setDebouncedCategory(categoryName ?? null);
      return;
    }
    const handle = setTimeout(() => {
      setDebouncedName(trimmed);
      setDebouncedCategory(categoryName ?? null);
    }, SKU_PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [trimmed, categoryName]);

  const enabled = debouncedName.length > 0;
  return useQuery({
    queryKey: queryKeys.products.skuPreview(debouncedName, debouncedCategory),
    queryFn: () =>
      previewProductSkuAction({
        name: debouncedName,
        categoryName: debouncedCategory,
      }),
    enabled,
    // Keep the last preview visible while a new one is in flight so the
    // chip doesn't flicker to "resolving…" between keystrokes inside the
    // debounce window.
    placeholderData: previousData => previousData,
    // Names tend to be edited rapidly while the user is composing — the
    // preview can be a little stale without hurting anything, since the
    // service retries on actual SKU collisions at insert time.
    staleTime: 1000 * 30,
  });
}
