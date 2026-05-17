"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  restoreBulkImportFileAction,
  softDeleteBulkImportFileAction,
} from "../../actions";
import type { BulkImportFileRow } from "../../services/bulk-import-history";

import { BulkLandingScreen } from "./bulk-landing-screen";
import type { BatchFile } from "./types";
import { useBulkBatchView } from "./use-bulk-batch-view";

const QUEUE_KEY = ["bulk-import-files", "pending"] as const;

/**
 * The bulk-landing screen wired to the server-side bulk-import history
 * table (PR A1 + A2). Dismiss + clear-reviewed are **optimistic** — the
 * row vanishes from the list immediately while the server call runs in
 * the background. A toast surfaces the action with an Undo affordance
 * that restores the row by clearing `deleted_at`.
 *
 * Each Review action opens in a new tab — the handoff README calls this
 * out as required ("Each file opens in a new tab so you don't lose this
 * list"). The link points at the existing
 * `/supplier-invoices/new?bulk-import-key=…` route, which now branches
 * to the new Review screen (see phase 5a).
 */
export function BulkLandingLive({
  embedded = false,
  onImportMore,
  onParseErrorClick,
}: {
  /** Render as a panel inside SupplierBillsShell rather than a standalone page. */
  embedded?: boolean;
  /**
   * Click handler for "Import more" + the empty-state CTA. When the shell
   * embeds this it passes a callback that opens the BulkImportSheet instead
   * of routing to the (now-redirected) /supplier-invoices/bulk-import page.
   */
  onImportMore?: () => void;
  /** Per-row click handler for parse-error rows — opens the ParseErrorDialog. */
  onParseErrorClick?: (file: BatchFile) => void;
} = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { view } = useBulkBatchView();
  // Re-parse is parked (see `reparseAll` below) — the pending flag is held
  // at false until the server-side re-parse lands.
  const [reparseAllPending] = useState(false);

  // ── Optimistic dismiss ──
  // onMutate: cache the previous list snapshot, write the trimmed list
  //           through `setQueryData` so the row disappears instantly.
  // onError:  restore the snapshot — the soft-delete didn't actually run.
  // onSettled (success or error): refetch to reconcile with the server.
  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      await softDeleteBulkImportFileAction(id);
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: QUEUE_KEY });
      const previous = queryClient.getQueryData<BulkImportFileRow[]>(QUEUE_KEY);
      queryClient.setQueryData<BulkImportFileRow[]>(
        QUEUE_KEY,
        (rows) => (rows ?? []).filter((r) => r.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUEUE_KEY, context.previous);
      }
      toast.error("Couldn't dismiss that file. Please try again.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
    },
  });

  // Restore is the inverse — also optimistic so undoing feels instant.
  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      await restoreBulkImportFileAction(id);
    },
    onError: () => {
      toast.error("Couldn't restore that file. Please reload the page.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
    },
  });

  const dismissFile = useCallback(
    (file: BatchFile) => {
      dismissMutation.mutate(file.id);
      toast(`Dismissed "${file.name}".`, {
        // Sonner's action prop renders an in-toast button. Clicking it
        // restores the row — the user gets ~6s before the toast auto-
        // dismisses. PDF blob stays in R2 either way, so undo is free.
        duration: 6000,
        action: {
          label: "Undo",
          onClick: () => restoreMutation.mutate(file.id),
        },
      });
    },
    [dismissMutation, restoreMutation],
  );

  const clearReviewed = useCallback(() => {
    const reviewed = (view?.files ?? []).filter((f) => f.status === "reviewed");
    if (reviewed.length === 0) return;
    const ids = reviewed.map((f) => f.id);

    // Optimistic remove of all reviewed rows in one pass — same pattern as
    // the single-row dismiss above, just over a set.
    void (async () => {
      await queryClient.cancelQueries({ queryKey: QUEUE_KEY });
      const previous = queryClient.getQueryData<BulkImportFileRow[]>(QUEUE_KEY);
      queryClient.setQueryData<BulkImportFileRow[]>(
        QUEUE_KEY,
        (rows) => (rows ?? []).filter((r) => !ids.includes(r.id)),
      );
      const settled = await Promise.allSettled(
        ids.map((id) => softDeleteBulkImportFileAction(id)),
      );
      const failed = settled.filter((s) => s.status === "rejected").length;
      void queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
      if (failed === 0) {
        toast(
          `Cleared ${ids.length} reviewed ${ids.length === 1 ? "file" : "files"}.`,
          {
            duration: 6000,
            action: {
              label: "Undo",
              // Best-effort restore: fire all in parallel; whatever lands
              // wins. The query invalidation downstream cleans up display.
              onClick: () => {
                void Promise.allSettled(
                  ids.map((id) => restoreBulkImportFileAction(id)),
                ).then(() => {
                  void queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
                });
              },
            },
          },
        );
      } else {
        // Roll back the cache; some deletes didn't run.
        if (previous) queryClient.setQueryData(QUEUE_KEY, previous);
        toast.error(
          `Couldn't clear ${failed} of ${ids.length} files. Reloaded the list.`,
        );
      }
    })();
  }, [view, queryClient]);

  // Re-parse is parked while the server-side history is the source of truth:
  // the PDF lives in R2 and the legacy local re-parse loop no longer applies.
  // Tracked as a follow-up alongside server-side re-parse.
  const reparseAll = useCallback(async () => {
    toast.info(
      "Re-parse is being rebuilt for the new server-side flow. Delete the row and re-upload the PDF for now.",
    );
  }, []);

  // Pre-mount flash: server query hasn't completed yet. Keep silent.
  if (view === null) return null;

  // Empty batch — there's nothing to review. Push the user to the uploader.
  // In embedded mode the shell renders the empty state itself (so the tab
  // strip + page header stay visible); here we only render an empty state
  // on the legacy standalone route.
  if (view.files.length === 0) {
    if (embedded) {
      return (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[12px] border border-dashed border-stone-line bg-stone-surface p-12 text-center">
          <div className="max-w-[420px]">
            <h2 className="mb-2 text-[16px] font-semibold tracking-[-0.005em] text-stone-ink">
              Inbox is empty
            </h2>
            <p className="mb-5 text-[13px] text-stone-muted">
              Upload supplier-invoice PDFs to start a batch. Parsed files will
              appear here once they&apos;re ready to review.
            </p>
            <button
              type="button"
              onClick={onImportMore ?? (() => router.push("/supplier-invoices/bulk-import"))}
              className="rounded-md border border-stone-ink bg-stone-ink px-4 py-2 text-[13px] text-stone-surface hover:bg-stone-ink/90"
            >
              Bulk import PDFs
            </button>
          </div>
        </div>
      );
    }
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
      hideHeader={embedded}
      openFileHref={(file: BatchFile) =>
        `/supplier-invoices/new?bulk-import-key=${encodeURIComponent(file.id)}`
      }
      onImportMore={
        onImportMore ?? (() => router.push("/supplier-invoices/bulk-import"))
      }
      onDismissFile={dismissFile}
      onClearReviewed={clearReviewed}
      onReparseAll={reparseAll}
      reparseAllPending={reparseAllPending}
      onParseErrorClick={onParseErrorClick}
    />
  );
}
