"use client";

import { useMutation } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";
import { parseBillTextAction } from "@/modules/distribution/supplier-invoices/actions/parse-bill-text";

/**
 * React Query mutation wrapping `parseBillTextAction`. Caller (the
 * `<AiParseBillTextarea>` component on `/supplier-invoices/new`) drives
 * it from a button click and hands the resulting `PipelineResult` to the
 * form's existing `seedFromPipelineResult` machinery — the same code path
 * the PDF upload uses.
 */
export function useParseBillText() {
  return useMutation({
    mutationKey: queryKeys.supplierInvoices.aiParse,
    mutationFn: (input: { rawText: string }) => parseBillTextAction(input),
  });
}
