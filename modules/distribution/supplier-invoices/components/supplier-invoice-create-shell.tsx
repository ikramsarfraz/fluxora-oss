"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { SupplierInvoiceForm } from "./supplier-invoice-form";
import {
  clearPendingBulkImport,
  readPendingBulkImport,
  readPendingPdf,
} from "../utils/bulk-import-storage";
import type { PipelineResult } from "../services/parsing-pipeline";

type BulkImportLoad =
  | { state: "none" }
  | { state: "loading" }
  | {
      state: "ready";
      result: PipelineResult;
      pdfFile: File | null;
      key: string;
    }
  | { state: "expired" };

/**
 * Client wrapper for the "new bill" route. When the URL carries a
 * `bulk-import-key` query param (handed over by the bulk-import panel), we
 * load the pre-parsed PipelineResult from localStorage AND the original PDF
 * blob from IndexedDB, then pass both down so the form can seed itself
 * without re-uploading the PDF and still render the PDF preview pane +
 * attach the file when the draft is saved.
 *
 * The localStorage entry is cleared as soon as we've read it — re-loading
 * the same review tab won't double-consume, and the bulk-import panel
 * notices the empty key on visibility-change and flips that row to
 * "Reviewed".
 */
export function SupplierInvoiceCreateShell() {
  const params = useSearchParams();
  const bulkImportKey = params?.get("bulk-import-key") ?? null;
  const [load, setLoad] = useState<BulkImportLoad>(
    bulkImportKey ? { state: "loading" } : { state: "none" },
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // localStorage/IndexedDB aren't available during SSR; this can't run
    // earlier than first client render. The setState calls are intentional —
    // we're synchronising external storage into React state once on mount.
    let cancelled = false;

    async function load() {
      if (!bulkImportKey) {
        setLoad({ state: "none" });
        return;
      }
      const entry = readPendingBulkImport(bulkImportKey);
      if (!entry) {
        if (!cancelled) setLoad({ state: "expired" });
        return;
      }
      const pdfFile = await readPendingPdf(bulkImportKey);
      if (cancelled) return;
      setLoad({
        state: "ready",
        result: entry.item.pipelineResult,
        pdfFile,
        key: bulkImportKey,
      });
      // Clear the localStorage entry so the bulk-import panel can flip the
      // row to "Reviewed" once the user switches back. The PDF blob in
      // IndexedDB is cleared by clearPendingBulkImport too (fire-and-forget
      // inside that helper). We've already captured the parse result and
      // file in component state, so subsequent rerenders here are safe.
      clearPendingBulkImport(bulkImportKey);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [bulkImportKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (load.state === "loading") {
    // Brief flicker before storage reads complete — keep it silent.
    return null;
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
      <SupplierInvoiceForm
        mode="create"
        prefilledPipelineResult={load.state === "ready" ? load.result : undefined}
        prefilledPdfFile={load.state === "ready" ? load.pdfFile : null}
      />
    </>
  );
}
