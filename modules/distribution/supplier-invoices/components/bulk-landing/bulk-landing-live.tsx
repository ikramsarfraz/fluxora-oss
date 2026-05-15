"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { parseSupplierInvoicePdfAction } from "../../actions";
import {
  clearPendingBulkImport,
  clearPendingBulkImportResultOnly,
  readPendingPdf,
  storePendingBulkImport,
} from "../../utils/bulk-import-storage";

import { BulkLandingScreen } from "./bulk-landing-screen";
import type { BatchFile } from "./types";
import { useBulkBatchView } from "./use-bulk-batch-view";

/**
 * The bulk-landing screen wired to real localStorage handoffs. When the
 * scan returns no entries we route the user to the bulk-import uploader
 * so they have somewhere to start; otherwise we render the parsed files
 * with the new design.
 *
 * Each Review action opens in a new tab — the handoff README calls this
 * out as required ("Each file opens in a new tab so you don't lose this
 * list"). The link points at the existing
 * `/supplier-invoices/new?bulk-import-key=…` route, which now branches
 * to the new Review screen (see phase 5a).
 */
export function BulkLandingLive() {
  const router = useRouter();
  const { view, refresh } = useBulkBatchView();
  const [reparseAllPending, setReparseAllPending] = useState(false);

  const dismissFile = useCallback(
    (file: BatchFile) => {
      clearPendingBulkImport(file.id);
      refresh();
    },
    [refresh],
  );

  const clearReviewed = useCallback(() => {
    const reviewed = (view?.files ?? []).filter(f => f.status === "reviewed");
    if (reviewed.length === 0) return;
    for (const file of reviewed) {
      clearPendingBulkImport(file.id);
    }
    refresh();
    toast.success(
      `Cleared ${reviewed.length} reviewed ${reviewed.length === 1 ? "file" : "files"} from the batch.`,
    );
  }, [view, refresh]);

  const reparseAll = useCallback(async () => {
    if (!view || reparseAllPending) return;
    const files = view.files;
    if (files.length === 0) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Re-parse ${files.length} ${files.length === 1 ? "file" : "files"}? Any manual edits you've made via Review will be reset.`,
      )
    ) {
      return;
    }
    setReparseAllPending(true);
    let succeeded = 0;
    let failed = 0;
    // Sequential to keep server load + rate limiting predictable. The toast at
    // the end summarises rather than spamming one per file.
    for (const file of files) {
      try {
        const pdf = await readPendingPdf(file.id);
        if (!pdf) {
          failed++;
          continue;
        }
        clearPendingBulkImportResultOnly(file.id);
        const formData = new FormData();
        formData.append("file", pdf);
        const pipelineResult = await parseSupplierInvoicePdfAction(formData);
        storePendingBulkImport(
          {
            filename: pdf.name,
            status: "parsed",
            pipelineResult,
            supplierName:
              pipelineResult.proposedProfile?.supplierId
                ? null
                : pipelineResult.prefillResult.unmatchedSupplierCandidates[0] ?? null,
            supplierMatched: Boolean(pipelineResult.prefillResult.values.supplierId),
            lineCount: pipelineResult.prefillResult.values.lines.length,
            unmatchedLineCount: pipelineResult.unresolvedLines.length,
            computedLineTotal: pipelineResult.prefillResult.totalComparison.computedLineTotal,
            warnings: pipelineResult.warnings,
          },
          file.id,
        );
        succeeded++;
      } catch (err) {
        console.error("[bulk-landing] re-parse failed for", file.id, err);
        failed++;
      }
    }
    setReparseAllPending(false);
    refresh();
    if (failed === 0) {
      toast.success(`Re-parsed ${succeeded} ${succeeded === 1 ? "file" : "files"}.`);
    } else if (succeeded === 0) {
      toast.error(`Re-parse failed for all ${failed} files.`);
    } else {
      toast(
        `Re-parsed ${succeeded} ${succeeded === 1 ? "file" : "files"}, ${failed} failed.`,
      );
    }
  }, [view, reparseAllPending, refresh]);

  // Pre-mount flash: localStorage hasn't been read yet. Keep silent.
  if (view === null) return null;

  // Empty batch — there's nothing to review. Push the user to the uploader.
  if (view.files.length === 0) {
    return (
      <main className="-m-4 flex min-w-0 flex-1 flex-col items-center justify-center bg-stone-bg p-12 text-center">
        <div className="max-w-[420px]">
          <h1 className="mb-2 text-[22px] font-semibold tracking-[-0.015em] text-stone-ink">
            No batch in progress
          </h1>
          <p className="mb-6 text-[14px] text-stone-muted">
            Upload supplier-invoice PDFs to start a batch. Parsed files will appear
            here once they&apos;re ready to review.
          </p>
          <button
            type="button"
            onClick={() => router.push("/supplier-invoices/bulk-import")}
            className="rounded-md border border-stone-ink bg-stone-ink px-4 py-2 text-[13px] text-stone-surface hover:bg-stone-ink/90"
          >
            Upload invoices
          </button>
        </div>
      </main>
    );
  }

  return (
    <BulkLandingScreen
      view={view}
      openInNewTab
      openFileHref={(file: BatchFile) =>
        `/supplier-invoices/new?bulk-import-key=${encodeURIComponent(file.id)}`
      }
      onImportMore={() => router.push("/supplier-invoices/bulk-import")}
      onDismissFile={dismissFile}
      onClearReviewed={clearReviewed}
      onReparseAll={reparseAll}
      reparseAllPending={reparseAllPending}
    />
  );
}
