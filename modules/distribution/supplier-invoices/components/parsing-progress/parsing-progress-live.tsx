"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { bulkImportSupplierInvoicesAction } from "../../actions";
import {
  clearPendingBulkImport,
  readPendingPdf,
} from "../../utils/bulk-import-storage";

import { ParsingProgressScreen } from "./parsing-progress-screen";
import type { ParseJobView, ParseStage } from "./types";

/**
 * Live parsing screen for the single-import flow.
 *
 * Reads the uploaded PDF from IndexedDB (the uploader stashed it under
 * `storageKey` before navigating here), runs `parseSupplierInvoicePdfAction`,
 * and redirects to the new Review screen on success.
 *
 * The action is one synchronous server call — there are no real "stages" to
 * stream. The screen animates through them so the user has feedback during
 * the network round trip; the moment the action returns we collapse straight
 * to "all done" and navigate. Cancelling stops the navigation and walks the
 * user back to the uploader (the parse itself can't be aborted from the
 * client, but its result will be discarded).
 */
export function ParsingProgressLive({
  storageKey,
}: {
  storageKey: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [overallProgress, setOverallProgress] = useState(5);
  const [stageIndex, setStageIndex] = useState(0);
  const [done, setDone] = useState(false);
  // Cancelled flag is read by the parse callback to skip the redirect when
  // the user backed out mid-parse.
  const cancelledRef = useRef(false);
  // Track whether the parse has been kicked off so the second StrictMode
  // effect mount doesn't fire it twice (the server-side rate limiter would
  // otherwise reject the duplicate).
  const parseStartedRef = useRef(false);

  // Mount: load the PDF from IndexedDB and start the parse.
  //
  // Cancellation is intentionally tracked only via `cancelledRef`, which only
  // ever flips to true when the user clicks "Cancel parse". We deliberately
  // avoid a local `cancelled` boolean tied to the effect's cleanup — under
  // React strict mode (and any other effect-re-run), the cleanup of the
  // first run would set that flag to true before the second run sees the
  // `parseStartedRef` short-circuit, leaving the in-flight parse stuck:
  // resolved but bailed out of the success branch. Progress would freeze at
  // 90% with no redirect. React 18+ already no-ops setState on unmounted
  // components, so dropping the cleanup-driven cancellation is safe.
  useEffect(() => {
    if (parseStartedRef.current) return;
    parseStartedRef.current = true;

    async function go() {
      const pdfFile = await readPendingPdf(storageKey);
      if (cancelledRef.current) return;
      if (!pdfFile) {
        setError(
          "We couldn't find the PDF for this parse — it may have been cleared. Upload it again from the bulk-import screen.",
        );
        return;
      }
      setFile(pdfFile);

      // Single-file batch — runs the same persistence path the bulk uploader
      // uses, so the resulting row lands in `bulk_import_files` and the
      // Review screen can read it from the server like any other entry.
      const formData = new FormData();
      formData.append("file", pdfFile);

      try {
        const result = await bulkImportSupplierInvoicesAction(formData);
        if (cancelledRef.current) return;
        const item = result.items[0];
        if (!item || item.status !== "parsed" || !item.bulkImportFileId) {
          setError(
            item && item.status === "error"
              ? item.error
              : "Couldn't read this invoice — no bulk-import row was created.",
          );
          return;
        }
        // PDF blob now lives in R2 + bulk_import_files — drop the transient
        // IndexedDB handoff blob so we don't leak quota.
        clearPendingBulkImport(storageKey);
        setOverallProgress(100);
        setDone(true);
        // Brief beat so the user sees the "done" state flash before we
        // navigate. Keep it short — under 350ms feels instant.
        const bulkImportFileId = item.bulkImportFileId;
        setTimeout(() => {
          if (cancelledRef.current) return;
          router.replace(
            `/supplier-invoices/new?bulk-import-key=${encodeURIComponent(bulkImportFileId)}`,
          );
        }, 250);
      } catch (err) {
        if (cancelledRef.current) return;
        setError(err instanceof Error ? err.message : "Couldn't read this invoice.");
      }
    }

    void go();
  }, [storageKey, router]);

  // Tick: drive elapsed time + faux stage progression while the parse runs.
  useEffect(() => {
    if (done || error) return;
    const id = setInterval(() => {
      setElapsed(e => +(e + 0.1).toFixed(1));
      // Bump overall progress asymptotically toward 90 — we hit 100 only
      // when the parse actually returns.
      setOverallProgress(p => {
        if (p >= 90) return p;
        const remaining = 90 - p;
        return +(p + Math.max(0.3, remaining * 0.03)).toFixed(1);
      });
      // Advance through stages roughly every ~1.2s.
      setStageIndex(i => Math.min(STAGE_DEFS.length - 1, i + 0.085));
    }, 100);
    return () => clearInterval(id);
  }, [done, error]);

  const handleCancel = () => {
    cancelledRef.current = true;
    // Drop the stashed PDF + any parse-result entry the server-side call may
    // have already written so the screen doesn't reappear on back navigation.
    clearPendingBulkImport(storageKey);
    toast("Scan cancelled.");
    router.replace("/supplier-invoices/bulk-import");
  };

  if (error) {
    return (
      <main className="-m-4 flex min-w-0 flex-1 flex-col items-center justify-center bg-stone-bg p-12 text-center">
        <div className="max-w-[480px]">
          <h1 className="mb-2 text-[22px] font-medium tracking-[-0.015em] text-stone-ink">
            Couldn&apos;t read this invoice
          </h1>
          <p className="mb-6 text-[14px] text-stone-muted">{error}</p>
          <button
            type="button"
            onClick={() => router.replace("/supplier-invoices/bulk-import")}
            className="rounded-md border border-stone-ink bg-stone-ink px-4 py-2 text-[13px] text-stone-surface hover:bg-stone-ink/90"
          >
            Back to upload
          </button>
        </div>
      </main>
    );
  }

  return (
    <ParsingProgressScreen
      job={buildJobView({
        fileName: file?.name ?? "Loading…",
        fileSize: file?.size ?? 0,
        elapsed,
        overallProgress,
        stageIndex,
        done,
      })}
      onCancel={handleCancel}
    />
  );
}

const STAGE_DEFS: Array<Omit<ParseStage, "status" | "time">> = [
  { id: "upload",  label: "Upload",          detail: "stashing PDF locally" },
  { id: "extract", label: "Text extraction", detail: "reading page content" },
  { id: "tables",  label: "Table detection", detail: "locating line-item table" },
  { id: "lines",   label: "Line items",      detail: "reading rows…" },
  { id: "match",   label: "Product matching",detail: "searching catalog…" },
  { id: "fees",    label: "Fees & tax",      detail: "detect freight, fuel, tax" },
  { id: "recon",   label: "Reconciliation",  detail: "cross-check totals" },
];

function buildJobView({
  fileName,
  fileSize,
  elapsed,
  overallProgress,
  stageIndex,
  done,
}: {
  fileName: string;
  fileSize: number;
  elapsed: number;
  overallProgress: number;
  stageIndex: number;
  done: boolean;
}): ParseJobView {
  const stages: ParseStage[] = STAGE_DEFS.map((def, i) => {
    if (done) {
      return { ...def, status: "done", time: i === 0 ? "0.3s" : `${(elapsed / STAGE_DEFS.length).toFixed(1)}s` };
    }
    if (i < Math.floor(stageIndex)) {
      return { ...def, status: "done", time: `${((i + 1) * 0.4).toFixed(1)}s` };
    }
    if (i === Math.floor(stageIndex)) {
      return { ...def, status: "running", time: "live" };
    }
    return { ...def, status: "queued", time: "" };
  });
  return {
    fileName,
    fileSizeLabel: fileSize > 0 ? formatFileSize(fileSize) : "",
    uploadedLabel: "uploaded just now",
    elapsedSeconds: elapsed,
    overallProgress: done ? 100 : overallProgress,
    stages,
    header: {},
    lines: [],
    lineCountLabel: done ? "ready" : "scanning…",
    averageParseLabel: "Average scan: ~3.2s",
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
