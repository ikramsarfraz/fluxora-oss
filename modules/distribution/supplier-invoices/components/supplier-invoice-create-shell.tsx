"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { SupplierInvoiceForm } from "./supplier-invoice-form";
import { ReviewQueueShell } from "./review/review-queue-shell";
import { readPendingBulkImport } from "../utils/bulk-import-storage";

type BulkImportLoad =
  | { state: "none" }
  | { state: "loading" }
  | { state: "ready"; key: string }
  | { state: "expired" };

/**
 * Client wrapper for the "new bill" route. When the URL carries a
 * `bulk-import-key` query param (handed over by the bulk-import panel /
 * bulk-landing screen), we hand off to the new Review Queue Carousel,
 * which loads every pending bulk-import entry and lets the user sweep
 * through them sequentially without leaving the review view. Single-PDF
 * imports work the same way — the carousel just has one card.
 */
function resolveInitialLoad(bulkImportKey: string | null): BulkImportLoad {
  // Lazy initializer — runs on first client render. localStorage is unavailable
  // during SSR but resolveInitialLoad is only ever called via useState's lazy
  // form below, so we're guaranteed to be in the browser by then.
  if (!bulkImportKey) return { state: "none" };
  if (typeof window === "undefined") return { state: "loading" };
  const entry = readPendingBulkImport(bulkImportKey);
  if (!entry) return { state: "expired" };
  return { state: "ready", key: bulkImportKey };
}

export function SupplierInvoiceCreateShell() {
  const params = useSearchParams();
  const bulkImportKey = params?.get("bulk-import-key") ?? null;
  // Lazy initializer ensures we read localStorage exactly once on mount and
  // never call setState from inside an effect (which the React Compiler
  // flags as a cascading-render hazard).
  const [load] = useState<BulkImportLoad>(() =>
    resolveInitialLoad(bulkImportKey),
  );

  if (load.state === "loading") {
    // Brief flicker before storage reads complete — keep it silent.
    return null;
  }

  if (load.state === "ready") {
    // The queue shell owns the carousel state and renders ReviewContainer
    // internally for the active invoice. PDF blobs are fetched per-invoice
    // from IndexedDB inside the shell.
    return <ReviewQueueShell initialKey={load.key} />;
  }

  return (
    <>
      {load.state === "expired" && (
        <div
          style={{
            margin: "12px 24px 0",
            padding: "10px 14px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 8,
            color: "#92400e",
            fontSize: 12.5,
          }}
        >
          That bulk-import handoff has expired (older than 24 hours or cleared by
          another tab). Upload the PDF here to parse it again.
        </div>
      )}
      <SupplierInvoiceForm mode="create" />
    </>
  );
}
