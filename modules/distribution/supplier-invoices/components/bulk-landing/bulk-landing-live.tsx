"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { softDeleteBulkImportFileAction } from "../../actions";

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
  // Re-parse is parked (see `reparseAll` below) — the pending flag is held
  // at false until the server-side re-parse lands.
  const [reparseAllPending] = useState(false);

  // Dismiss + clear-reviewed both now soft-delete on the server. The
  // underlying R2 object is retained; restore by clearing `deleted_at`.
  // Phase B will add an optimistic UI affordance + a "Restore" action.
  const dismissFile = useCallback(
    async (file: BatchFile) => {
      try {
        await softDeleteBulkImportFileAction(file.id);
      } catch (err) {
        console.warn("[bulk-landing] soft-delete failed", err);
      }
      refresh();
    },
    [refresh],
  );

  const clearReviewed = useCallback(async () => {
    const reviewed = (view?.files ?? []).filter(f => f.status === "reviewed");
    if (reviewed.length === 0) return;
    await Promise.allSettled(
      reviewed.map(f => softDeleteBulkImportFileAction(f.id)),
    );
    refresh();
    toast.success(
      `Cleared ${reviewed.length} reviewed ${reviewed.length === 1 ? "file" : "files"} from the batch.`,
    );
  }, [view, refresh]);

  // Re-parse is parked while the server-side history is the source of truth:
  // the PDF lives in R2 and the legacy local re-parse loop no longer applies.
  // Tracked as a follow-up alongside server-side re-parse.
  const reparseAll = useCallback(async () => {
    toast.info(
      "Re-parse is being rebuilt for the new server-side flow. Delete the row and re-upload the PDF for now.",
    );
  }, []);

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
