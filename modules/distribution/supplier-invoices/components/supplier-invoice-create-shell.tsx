"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { SupplierInvoiceForm } from "./supplier-invoice-form";
import { ReviewContainer } from "./review/review-container";
import {
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
      // Entry is intentionally NOT cleared here — the new bulk-landing screen
      // (phase 5b) needs it to stay around so the row can flip to "Reviewed"
      // after submit. ReviewContainer calls markBulkImportReviewed on success
      // and the 24h TTL handles eventual cleanup. The legacy bulk-import
      // panel's "row reviewed?" signal is therefore no longer accurate, but
      // that panel is being retired in 5g.
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [bulkImportKey]);

  if (load.state === "loading") {
    // Brief flicker before storage reads complete — keep it silent.
    return null;
  }

  // Bulk-import handoff with a parsed result → render the new Review screen.
  // The legacy SupplierInvoiceForm path still serves manual-create and the
  // expired-handoff fallback so users can re-upload a PDF.
  if (load.state === "ready") {
    return (
      <ReviewBulkImport
        fileName={load.pdfFile?.name ?? load.result.prefillResult.sourceFilename}
        pdfFile={load.pdfFile}
        result={load.result}
        bulkImportKey={load.key}
      />
    );
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

function ReviewBulkImport({
  fileName,
  pdfFile,
  result,
  bulkImportKey,
}: {
  fileName: string;
  pdfFile: File | null;
  result: PipelineResult;
  bulkImportKey: string;
}) {
  // Build the blob URL once. URL.createObjectURL is browser-only and lazy —
  // useMemo gives us a stable URL across rerenders and an effect releases it
  // on unmount so the blob can be GC'd.
  const pdfUrl = useMemo(() => {
    if (!pdfFile) return null;
    if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
      return null;
    }
    return URL.createObjectURL(pdfFile);
  }, [pdfFile]);

  useEffect(() => {
    if (!pdfUrl) return;
    return () => {
      URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const fileSize = useMemo(() => formatFileSize(pdfFile?.size), [pdfFile?.size]);

  return (
    <ReviewContainer
      fileName={fileName}
      fileSize={fileSize}
      pipelineResult={result}
      pdfUrl={pdfUrl}
      bulkImportKey={bulkImportKey}
    />
  );
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
