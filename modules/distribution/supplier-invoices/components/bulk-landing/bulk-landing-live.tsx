"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { captureClientEvent } from "@/lib/posthog-client";

import {
  rescanBulkImportFileAction,
  restoreBulkImportFileAction,
  softDeleteBulkImportFileAction,
} from "../../actions";
import type { BulkImportFileRow } from "../../services/bulk-import-history";
import { clearReviewOverrides } from "../../utils/review-overrides-storage";

import { BulkLandingScreen } from "./bulk-landing-screen";
import { InlineDropzone, type InlineDropzoneHandle } from "./inline-dropzone";
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
 * Review actions navigate in the same tab — the review surface is itself
 * a multi-file queue carousel, so opening each file in a separate tab
 * would duplicate the queue's own prev/next navigation. The link points
 * at `/supplier-invoices/new?bulk-import-key=…`, which branches to the
 * Review screen.
 *
 * Uploads happen inline via `InlineDropzone`: the dropzone IS the empty
 * state, and a slim "drop more PDFs" strip sits above the list once it
 * has rows. The shell's "Bulk import" header button triggers the same
 * file picker via `pickFilesIntent`.
 */
export function BulkLandingLive({
  embedded = false,
  pickFilesIntent = false,
  onPickFilesIntentHandled,
  onParseErrorClick,
}: {
  /** Render as a panel inside SupplierBillsShell rather than a standalone page. */
  embedded?: boolean;
  /**
   * When true, the embedded InlineDropzone fires its file picker on the next
   * render — used by the shell's "Bulk import" header button so the button
   * works from any tab (the shell first switches to Imports, then flips this
   * flag). The host should reset the flag via `onPickFilesIntentHandled`
   * once we've consumed it so the picker doesn't re-trigger on every render.
   */
  pickFilesIntent?: boolean;
  onPickFilesIntentHandled?: () => void;
  /** Per-row click handler for parse-error rows — opens the ParseErrorDialog. */
  onParseErrorClick?: (file: BatchFile) => void;
} = {}) {
  const queryClient = useQueryClient();
  const { view } = useBulkBatchView();
  // Bulk Re-scan-all runs every pending file's PDF back through the
  // AI pipeline in parallel. We mirror `reparseAllPending` to the
  // batch's in-flight state so the footer button can disable + show
  // "Re-scanning…" until every per-row mutation has settled.
  const [reparseAllPending, setReparseAllPending] = useState(false);

  // Ref the InlineDropzone exposes so we can trigger the native file picker
  // from outside (e.g. the page header's "Bulk import" button). We fire it
  // whenever `pickFilesIntent` flips to true, then notify the shell so it
  // can reset the flag — keeps the picker from re-opening on every render.
  const dropzoneRef = useRef<InlineDropzoneHandle>(null);
  useEffect(() => {
    if (!pickFilesIntent) return;
    dropzoneRef.current?.openFilePicker();
    onPickFilesIntentHandled?.();
  }, [pickFilesIntent, onPickFilesIntentHandled]);

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

  // Re-scan every pending file in this batch in parallel. We don't
  // gate on "confirm" — the footer button label already shows the
  // count, so clicking it IS the confirmation. Per-row overrides
  // (sessionStorage snapshots) get cleared for each id since the new
  // pipelineResult may shift line ids.
  const reparseAll = useCallback(async () => {
    const pending =
      view?.files.filter(f => f.status !== "reviewed") ?? [];
    if (pending.length === 0) return;
    setReparseAllPending(true);
    captureClientEvent("review.rescan_triggered", {
      scope: "bulk",
      file_count: pending.length,
    });
    try {
      const settled = await Promise.allSettled(
        pending.map(file => {
          clearReviewOverrides(file.id);
          return rescanBulkImportFileAction(file.id);
        }),
      );
      const failed = settled.filter(s => s.status === "rejected").length;
      void queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
      if (failed === 0) {
        toast.success(
          `Re-scanned ${pending.length} file${pending.length === 1 ? "" : "s"}.`,
        );
      } else {
        toast.error(
          `Re-scanned ${pending.length - failed} of ${pending.length}; ${failed} failed.`,
        );
      }
    } finally {
      setReparseAllPending(false);
    }
  }, [view, queryClient]);

  // Pre-mount flash: server query hasn't completed yet. Keep silent.
  if (view === null) return null;

  // Empty batch — the InlineDropzone IS the empty state. Drag + drop or
  // click anywhere on the card to start a scan; rows land in this same
  // surface as they finish, so there's no separate "upload screen" mode.
  if (view.files.length === 0) {
    if (embedded) {
      return <InlineDropzone ref={dropzoneRef} variant="empty" />;
    }
    return (
      <main className="-m-4 flex min-w-0 flex-1 flex-col bg-page p-12">
        <InlineDropzone ref={dropzoneRef} variant="empty" />
      </main>
    );
  }

  return (
    <>
      <InlineDropzone ref={dropzoneRef} variant="compact" />
      <BulkLandingScreen
        view={view}
        hideHeader={embedded}
        openFileHref={(file: BatchFile) =>
          `/supplier-invoices/new?bulk-import-key=${encodeURIComponent(file.id)}`
        }
        onImportMore={() => dropzoneRef.current?.openFilePicker()}
        onDismissFile={dismissFile}
        onClearReviewed={clearReviewed}
        onReparseAll={reparseAll}
        reparseAllPending={reparseAllPending}
        onParseErrorClick={onParseErrorClick}
      />
    </>
  );
}
