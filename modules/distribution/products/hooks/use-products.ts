"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveProductAction,
  getProductByIdAction,
  getProductsAction,
  getProductsPageAction,
  permanentlyDeleteProductAction,
  previewProductSkuAction,
  restoreProductAction,
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

/**
 * Move a product into the archived state. Hides it from order /
 * receiving pickers but keeps the row for historical references.
 * Use this for any product that's been used in business activity.
 */
export function useArchiveProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveProductAction,
    onSuccess: (_data, productId) => {
      queryClient.invalidateQueries({ queryKey: ["products", "list"] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.detail(productId),
      });
    },
  });
}

/** Reverse {@link useArchiveProduct}. */
export function useRestoreProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: restoreProductAction,
    onSuccess: (_data, productId) => {
      queryClient.invalidateQueries({ queryKey: ["products", "list"] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.detail(productId),
      });
    },
  });
}

/**
 * Hard delete. The service throws a human-readable error if the
 * product has any dependent rows; the form catches that and shows it
 * to the user. For products with history, archive instead.
 */
export function usePermanentlyDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: permanentlyDeleteProductAction,
    onSuccess: (_data, productId) => {
      queryClient.invalidateQueries({ queryKey: ["products", "list"] });
      queryClient.removeQueries({
        queryKey: queryKeys.products.detail(productId),
      });
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
