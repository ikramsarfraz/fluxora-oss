"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { SupplierInvoiceForm } from "./supplier-invoice-form";
import {
  clearPendingBulkImport,
  readPendingBulkImport,
} from "../utils/bulk-import-storage";
import type { PipelineResult } from "../services/parsing-pipeline";

type BulkImportLoad =
  | { state: "none" }
  | { state: "loading" }
  | { state: "ready"; result: PipelineResult; key: string }
  | { state: "expired" };

/**
 * Client wrapper for the "new bill" route. When the URL carries a
 * `bulk-import-key` query param (handed over by the bulk-import panel), we
 * load the pre-parsed PipelineResult from localStorage and pass it down so
 * the form can seed itself without re-uploading the PDF.
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
    // Read once on mount. localStorage isn't available during SSR, so this
    // can't run earlier than the first client render. setState calls are
    // intentional — we need the parsed result to synchronise to React
    // state, and the effect doesn't depend on anything that would cause it
    // to re-run cascading-style.
    if (!bulkImportKey) {
      setLoad({ state: "none" });
      return;
    }
    const entry = readPendingBulkImport(bulkImportKey);
    if (!entry) {
      setLoad({ state: "expired" });
      return;
    }
    setLoad({
      state: "ready",
      result: entry.item.pipelineResult,
      key: bulkImportKey,
    });
    // Clear the entry so the bulk-import panel can mark this row as
    // reviewed when the user switches back to that tab. We've already
    // captured the parse result in component state so subsequent rerenders
    // here are safe.
    clearPendingBulkImport(bulkImportKey);
  }, [bulkImportKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const prefilled = useMemo(() => {
    if (load.state === "ready") return load.result;
    return undefined;
  }, [load]);

  if (load.state === "loading") {
    // Brief flicker before localStorage read completes — keep it silent.
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
      <SupplierInvoiceForm mode="create" prefilledPipelineResult={prefilled} />
    </>
  );
}
