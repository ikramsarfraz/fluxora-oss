"use client";

import { useMutation } from "@tanstack/react-query";

import { captureClientEvent } from "@/lib/posthog-client";

import { parseExpenseReceiptAction } from "@/modules/distribution/expenses/actions";

/**
 * Mutation hook that POSTs a single receipt file to the server-side OCR
 * action and returns the prefill fields. The form invokes this on file
 * selection; on success it copies the returned vendor/date/amount into the
 * react-hook-form state and remembers the file so it can auto-attach the
 * receipt after the expense row is created.
 */
export function useParseExpenseReceipt() {
  return useMutation({
    mutationFn: async (file: File) => {
      captureClientEvent("expense_receipt.uploaded", {
        file_size_kb: Math.round(file.size / 1024),
        mime_type: file.type,
      });
      const formData = new FormData();
      formData.set("file", file);
      return await parseExpenseReceiptAction(formData);
    },
  });
}
