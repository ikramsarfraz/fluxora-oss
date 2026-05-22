"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveProductAction,
  getProductByIdAction,
  getProductCustomerPricesAction,
  getProductInventorySummaryAction,
  getProductPurchaseIntelligenceAction,
  getProductRecentPurchasesAction,
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

/**
 * Invalidate every `["products", …]` query EXCEPT sku-preview. Used by
 * the lifecycle mutations so:
 *
 *  - `useProducts()` (orders pickers, supplier-invoice review) refreshes
 *    and stops offering an archived product.
 *  - `useProductsPage()` (the products listing) refreshes both the
 *    Active and Archived tabs.
 *  - `useProduct(id)` (detail pages) re-fetches.
 *
 * Skipping `sku-preview` keeps the form's still-mounted preview hook
 * from re-firing a server action against the wrong URL — same race
 * the create-bounce fix addresses.
 */
function invalidateAllProductQueriesExceptSkuPreview(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({
    predicate: q => {
      const k = q.queryKey;
      if (!Array.isArray(k) || k[0] !== "products") return false;
      if (k[1] === "sku-preview") return false;
      return true;
    },
  });
}

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
    onSuccess: () => {
      invalidateAllProductQueriesExceptSkuPreview(queryClient);
    },
  });
}

/** Reverse {@link useArchiveProduct}. */
export function useRestoreProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: restoreProductAction,
    onSuccess: () => {
      invalidateAllProductQueriesExceptSkuPreview(queryClient);
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
      invalidateAllProductQueriesExceptSkuPreview(queryClient);
      // The detail cache for a deleted product can't be re-fetched, so
      // remove it outright instead of marking it stale.
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

// ── Detail-page section hooks ──────────────────────────────────────────────
// Each section gets its own short-staleTime query so the detail page can
// render the product headline immediately and stream in the four heavier
// surfaces (inventory / purchases / customer prices / intel) in parallel.

/** On-hand / in-motion / problem stock buckets for the detail page. */
export function useProductInventorySummary(productId: string) {
  return useQuery({
    queryKey: queryKeys.products.inventorySummary(productId),
    queryFn: () => getProductInventorySummaryAction(productId),
    enabled: !!productId && isUuid(productId),
    staleTime: 1000 * 60,
  });
}

/** Last 5 supplier bills referencing this product. */
export function useProductRecentPurchases(productId: string) {
  return useQuery({
    queryKey: queryKeys.products.recentPurchases(productId),
    queryFn: () => getProductRecentPurchasesAction(productId),
    enabled: !!productId && isUuid(productId),
    staleTime: 1000 * 60,
  });
}

/** Customer-specific price overrides for this product. */
export function useProductCustomerPrices(productId: string) {
  return useQuery({
    queryKey: queryKeys.products.customerPrices(productId),
    queryFn: () => getProductCustomerPricesAction(productId),
    enabled: !!productId && isUuid(productId),
    staleTime: 1000 * 60,
  });
}

/**
 * MVP price intelligence — running average + most recent cost + delta.
 * Returns null when there's no purchase history; the detail page
 * renders the empty-state placeholder in that case.
 */
export function useProductPurchaseIntelligence(productId: string) {
  return useQuery({
    queryKey: queryKeys.products.purchaseIntelligence(productId),
    queryFn: () => getProductPurchaseIntelligenceAction(productId),
    enabled: !!productId && isUuid(productId),
    staleTime: 1000 * 60,
  });
}
