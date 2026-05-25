"use client";

import { useSearchParams } from "next/navigation";

import { SupplierInvoiceForm } from "./supplier-invoice-form";
import { ReviewQueueShell } from "./review/review-queue-shell";

/**
 * Client wrapper for the "new bill" route. When the URL carries a
 * `bulk-import-key` query param (handed over by the bulk-import panel /
 * bulk-landing screen), we hand off to the new Review Queue Carousel —
 * which now reads its data from the server-side bulk_import_files table
 * (added in PR A1). The shell handles "row not found / expired" itself by
 * rendering the empty-queue state. Single-PDF imports go through the
 * carousel too — the queue just has one card.
 *
 * The legacy `fluxora:bulk-import:*` localStorage keys are still recognised
 * by the shell's older code path during the migration window, but no new
 * data is written there post-A2. PR A3 will retire the single-PDF flow's
 * localStorage usage too.
 */
export function SupplierInvoiceCreateShell() {
  const params = useSearchParams();
  const bulkImportKey = params?.get("bulk-import-key") ?? null;

  if (bulkImportKey) {
    return <ReviewQueueShell initialKey={bulkImportKey} />;
  }
  return <SupplierInvoiceForm mode="create" />;
}
