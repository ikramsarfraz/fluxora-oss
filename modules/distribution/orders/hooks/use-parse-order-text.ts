"use client";

import { useMutation } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";
import { parseSalesOrderTextAction } from "@/modules/distribution/orders/actions/parse-order-text";
import type { ParseSalesOrderTextResult } from "@/modules/distribution/orders/actions/parse-order-text.types";

/**
 * React Query mutation wrapping `parseSalesOrderTextAction`. Caller (the
 * `<AiParseTextarea>` component on `/orders/new`) drives it from a button
 * click, applies the result into the form, and renders warnings + the
 * suggested-customer chip. Not cached — every paste is a fresh parse.
 */
export function useParseSalesOrderText() {
  return useMutation<ParseSalesOrderTextResult, Error, { rawText: string }>({
    mutationKey: queryKeys.salesOrders.aiParse,
    mutationFn: input => parseSalesOrderTextAction(input),
  });
}
