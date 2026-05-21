"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import { getFifoAllocationForProductAction } from "@/modules/distribution/inventory/actions";
import { queryKeys } from "@/lib/query/keys";
import type { ProductListItem } from "@/modules/distribution/products/services/products";

import { calculateLineTotal } from "./new-order-line-utils";
import type { NewOrderFormValues } from "./new-order-form.schema";

type LineValues = NewOrderFormValues["lines"][number];

function parseCases(value: string | undefined): number {
  const parsed = value ? Number.parseInt(value, 10) : 0;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Aggregate subtotal that respects real allocated weight on catch-weight
 * lines. Both the right-rail Estimate card and the sticky bottom action
 * bar share this so they agree with each other and with the per-row line
 * total inside `NewOrderLinesTable`.
 *
 * Internals: we issue one `useQueries` batch with the same query keys
 * the line rows already use (`queryKeys.inventory.fifoAllocation`), so
 * React Query dedups against the row-level queries — no extra DB load.
 * For each line we trust the real allocation total only when the
 * returned rows actually cover the requested cases; otherwise we fall
 * back to the conversion-based estimate, which matches what the line
 * row displays during in-flight refetches.
 */
export function useLinesSubtotal(
  lines: LineValues[] | undefined,
  productsById: Map<string, ProductListItem>,
) {
  const safeLines = lines ?? [];

  const fifoQueries = useQueries({
    queries: safeLines.map(line => {
      const productId = line.productId;
      const caseCount = parseCases(line.quantity);
      return {
        queryKey: queryKeys.inventory.fifoAllocation(
          productId ?? "",
          caseCount,
        ),
        queryFn: () =>
          getFifoAllocationForProductAction(productId!, caseCount),
        enabled: !!productId && caseCount > 0,
        staleTime: 1000 * 60 * 2,
      };
    }),
  });

  return useMemo(() => {
    let total = 0;
    let filledLineCount = 0;
    safeLines.forEach((line, index) => {
      if (!line.productId) return;
      filledLineCount += 1;
      const caseCount = parseCases(line.quantity);
      const data = fifoQueries[index]?.data;

      // Mirror the line-row logic in `new-order-lines-table.tsx`:
      // when the user has manually picked specific inventory items,
      // bill on the real weight of those items; otherwise use the FIFO
      // auto-picked rows. Without this, switching to manual pick made
      // the per-row total move while the Estimate card stayed on the
      // FIFO total.
      const manualIds = line.inventoryItemIds ?? [];
      const manualRows =
        manualIds.length > 0
          ? (data?.candidates ?? []).filter(c =>
              manualIds.includes(c.inventoryItemId),
            )
          : [];
      const allocationRows =
        manualRows.length > 0 ? manualRows : (data?.rows ?? []);

      // Trust the real-weight total only when the allocation actually
      // covers the requested cases — otherwise fall back to the
      // synthetic estimate so the displayed total stays in lock-step
      // with whatever case count the user just typed.
      const allocationCovers =
        caseCount > 0 && allocationRows.length === caseCount;
      const realWeight = allocationCovers
        ? allocationRows.reduce((sum, row) => sum + row.weight, 0)
        : null;
      total +=
        calculateLineTotal(
          line,
          productsById.get(line.productId),
          realWeight,
        ) ?? 0;
    });
    return { subtotal: total, filledLineCount };
    // fifoQueries is a new array on every render; depending on its
    // identity is intentional — we want to recompute when any line's
    // FIFO data lands.
  }, [safeLines, productsById, fifoQueries]);
}
