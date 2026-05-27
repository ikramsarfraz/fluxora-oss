"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { useBulkImportSupplierInvoices } from "../../hooks/use-supplier-invoices";
import {
  BulkParsingScreen,
  type BulkParseFile,
} from "./bulk-parsing-screen";

const MAX_FILES_PER_BATCH = 10;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const QUEUE_KEY = ["bulk-import-files", "pending"] as const;

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function looksLikePdf(file: File): boolean {
  return /\.pdf$/i.test(file.name) || file.type === "application/pdf";
}

export type InlineDropzoneHandle = {
  /** Opens the underlying <input type="file"> picker. */
  openFilePicker: () => void;
};

/**
 * Inline drag-and-drop / click-to-pick dropzone embedded directly in the
 * Imports tab — the replacement for the old side-sheet upload flow. Owns
 * its own file input + mutation invocation; the Imports list refresh is
 * handled via React Query invalidation, so successful scans show up as
 * new rows without any further plumbing from the host.
 *
 * Two visual variants:
 *  - `"empty"`  — full hero card shown when the Imports list is empty.
 *  - `"compact"` — slim strip rendered above the list once it has rows.
 *
 * The host can grab a ref and call `openFilePicker()` to programmatically
 * open the file picker (used by the page header's "Bulk import" button).
 */
export const InlineDropzone = forwardRef<
  InlineDropzoneHandle,
  { variant: "empty" | "compact" }
>(function InlineDropzone({ variant }, ref) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const mutation = useBulkImportSupplierInvoices();
  const isImporting = mutation.isPending;

  // Full-screen Option-2 batch loader. `null` = hidden; otherwise covers the
  // viewport with the file table + summary metrics while the mutation runs,
  // then flips to a "done" state the user dismisses. Real per-file streaming
  // (with current_stage_id per row) is tracked in #278; until then the per-
  // row state is generic "Scanning…" and the overall bar asymptotes the
  // same way the single-PDF screen's does.
  const [batchOverlay, setBatchOverlay] = useState<{
    files: BulkParseFile[];
    state: "running" | "done";
    startedAt: number;
    overallProgress: number;
    elapsed: number;
  } | null>(null);
  // Set when the user dismisses an in-flight batch via the overlay Cancel
  // button — the action keeps running server-side, but the late onSettled
  // callback below skips flipping the (now-dismissed) overlay back into a
  // done state.
  const cancelledRef = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      openFilePicker: () => inputRef.current?.click(),
    }),
    [],
  );

  // Tick: drive the asymptotic overall progress + elapsed while the batch
  // is in its running phase. Same 100ms rate the single-PDF screen uses so
  // the two loaders feel like one system.
  useEffect(() => {
    if (!batchOverlay || batchOverlay.state !== "running") return;
    const id = setInterval(() => {
      setBatchOverlay(prev => {
        if (!prev || prev.state !== "running") return prev;
        const elapsed = +(((Date.now() - prev.startedAt) / 1000)).toFixed(1);
        const overallProgress =
          prev.overallProgress >= 90
            ? prev.overallProgress
            : +(
                prev.overallProgress +
                Math.max(0.3, (90 - prev.overallProgress) * 0.03)
              ).toFixed(1);
        return { ...prev, elapsed, overallProgress };
      });
    }, 100);
    return () => clearInterval(id);
  }, [batchOverlay]);

  const dismissBatchOverlay = useCallback(() => {
    cancelledRef.current = true;
    setBatchOverlay(null);
  }, []);

  const handleReviewFile = useCallback(
    (bulkImportFileId: string) => {
      cancelledRef.current = true;
      setBatchOverlay(null);
      router.push(
        `/supplier-invoices/new?bulk-import-key=${encodeURIComponent(bulkImportFileId)}`,
      );
    },
    [router],
  );

  const startImport = useCallback(
    async (files: File[]) => {
      // Client-side filter mirrors what BulkImportPanel used to do — server
      // re-validates either way, but rejecting bad files locally keeps the
      // toast actionable instead of a generic 400.
      const usable: File[] = [];
      let rejectedNonPdf = 0;
      let rejectedEmpty = 0;
      let rejectedTooLarge = 0;
      for (const f of files) {
        if (!looksLikePdf(f)) {
          rejectedNonPdf++;
          continue;
        }
        if (f.size === 0) {
          rejectedEmpty++;
          continue;
        }
        if (f.size > MAX_FILE_BYTES) {
          rejectedTooLarge++;
          continue;
        }
        usable.push(f);
      }
      const rejected = rejectedNonPdf + rejectedEmpty + rejectedTooLarge;
      if (rejected > 0) {
        const reasons: string[] = [];
        if (rejectedNonPdf > 0) reasons.push(`${rejectedNonPdf} non-PDF`);
        if (rejectedEmpty > 0) reasons.push(`${rejectedEmpty} empty`);
        if (rejectedTooLarge > 0)
          reasons.push(`${rejectedTooLarge} over ${fmtBytes(MAX_FILE_BYTES)}`);
        toast.error(`Skipped ${rejected} file(s): ${reasons.join(" · ")}.`);
      }
      if (usable.length === 0) return;

      const capped = usable.slice(0, MAX_FILES_PER_BATCH);
      if (usable.length > MAX_FILES_PER_BATCH) {
        toast.error(
          `Only ${MAX_FILES_PER_BATCH} files per batch — extras ignored.`,
        );
      }

      const formData = new FormData();
      for (const f of capped) formData.append("file", f);

      // Mount the full-screen batch loader with the per-file metadata we
      // already have on the client. Real outcomes get spliced in below once
      // the action returns.
      const startedAt = Date.now();
      cancelledRef.current = false;
      setBatchOverlay({
        files: capped.map((f, i) => ({
          id: `${startedAt}:${i}`,
          name: f.name,
          sizeLabel: fmtBytes(f.size),
        })),
        state: "running",
        startedAt,
        overallProgress: 5,
        elapsed: 0,
      });

      try {
        const result = await mutation.mutateAsync(formData);
        const { parsed, errored, duplicate } = result.summary;
        if (parsed > 0) {
          // Happy path — surface as success even when some files errored,
          // so the user knows the parsed ones are queued.
          const parts: string[] = [`${parsed} ready to review`];
          if (duplicate > 0) parts.push(`${duplicate} already imported`);
          if (errored > 0) parts.push(`${errored} couldn't be read`);
          toast.success(parts.join(" · "));
        } else if (duplicate > 0 && errored === 0) {
          // All files were duplicates — not an error, just nothing new to
          // review. Use the neutral toast so the user understands their
          // upload was acknowledged.
          toast.message(
            duplicate === 1
              ? "This PDF was already imported."
              : `${duplicate} PDFs were already imported.`,
            { description: "Open the existing parse from the row below." },
          );
        } else if (errored > 0) {
          // All files failed — promote to an error toast and surface the
          // first failure's actual reason (e.g. "Uploaded PDF is empty",
          // "Persistence failed: …"). Without this the user just sees
          // "1 couldn't be read" with no way to diagnose.
          const erroredItems = result.items.filter(i => i.status === "error");
          const firstReason = erroredItems[0]?.error;
          const heading =
            errored === 1
              ? "Couldn't read this PDF"
              : `Couldn't read ${errored} PDFs`;
          toast.error(heading, {
            description: firstReason ?? undefined,
          });
        } else {
          toast.success("Scan complete.");
        }
        // Imports tab list reads from the bulk_import_files query; new rows
        // landed server-side as part of the action, so a single invalidation
        // pulls them in. No need to seed the cache manually.
        await queryClient.invalidateQueries({ queryKey: QUEUE_KEY });

        // Splice the server's per-file outcomes into the overlay so each row
        // flips from "Scanning…" to Parsed/Errored with its bulkImportFileId.
        // Skip if the user dismissed mid-flight — their intent was to get
        // out of the way, not to be re-presented with the result.
        if (cancelledRef.current) return;
        setBatchOverlay(prev =>
          prev
            ? {
                ...prev,
                state: "done",
                overallProgress: 100,
                files: prev.files.map((f, i) => {
                  const item = result.items[i];
                  if (!item) return { ...f, outcome: "errored", errorMessage: "No result returned" };
                  if (item.status === "parsed") {
                    return {
                      ...f,
                      outcome: "parsed",
                      bulkImportFileId: item.bulkImportFileId,
                    };
                  }
                  if (item.status === "duplicate") {
                    return {
                      ...f,
                      outcome: "duplicate",
                      linkedBulkImportFileId: item.linkedBulkImportFileId,
                      linkedFilename: item.linkedFilename,
                    };
                  }
                  return {
                    ...f,
                    outcome: "errored",
                    errorMessage: item.error,
                  };
                }),
              }
            : prev,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Scan failed.");
        if (!cancelledRef.current) setBatchOverlay(null);
      }
    },
    [mutation, queryClient],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) void startImport(files);
    // Reset so the same filename can be re-picked after a previous batch.
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isImporting) return;
    const files = e.dataTransfer.files
      ? Array.from(e.dataTransfer.files)
      : [];
    if (files.length > 0) void startImport(files);
  };

  const handleClick = () => {
    if (isImporting) return;
    inputRef.current?.click();
  };

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf,.pdf"
      multiple
      onChange={handleFileInput}
      disabled={isImporting}
      className="hidden"
    />
  );

  const overlay = batchOverlay ? (
    <BulkParsingScreen
      files={batchOverlay.files}
      state={batchOverlay.state}
      overallProgress={batchOverlay.overallProgress}
      elapsed={batchOverlay.elapsed}
      onCancel={dismissBatchOverlay}
      onDismiss={dismissBatchOverlay}
      onReviewFile={handleReviewFile}
    />
  ) : null;

  if (variant === "empty") {
    return (
      <>
        {overlay}
        <div
          role="button"
          tabIndex={isImporting ? -1 : 0}
          aria-disabled={isImporting}
          aria-label="Drop PDFs to scan"
          onDragOver={(e) => {
            e.preventDefault();
            if (!isImporting) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (isImporting) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={cn(
            "flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-[12px] border-2 border-dashed p-12 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-forest",
            isDragging
              ? "border-forest-mid bg-divider"
              : "border-border-default bg-card hover:border-divider",
            isImporting && "cursor-not-allowed border-forest-mid bg-divider/40",
          )}
        >
          {isImporting ? (
            <Loader2
              className="mb-3 size-7 animate-spin text-forest"
              strokeWidth={1.8}
            />
          ) : (
            <Upload className="mb-3 size-7 text-subtle" strokeWidth={1.6} />
          )}
          <h2 className="mb-2 text-[16px] font-medium tracking-[-0.005em] text-ink">
            {isImporting
              ? "Scanning your PDFs…"
              : isDragging
                ? "Drop to start scanning"
                : "Drop PDFs to scan"}
          </h2>
          <p className="max-w-[420px] text-[13px] text-subtle">
            {isImporting
              ? "Reading each file with AI. New rows will appear here as scans finish — this can take 10–30 seconds per page."
              : `Drag supplier-invoice PDFs here, or click to pick. Up to ${MAX_FILES_PER_BATCH} per batch, ${fmtBytes(MAX_FILE_BYTES)} each.`}
          </p>
          {!isImporting && (
            <p className="mt-2 max-w-[420px] text-[12px] text-muted">
              One invoice per file — bundled multi-invoice PDFs are read as a
              single bill.
            </p>
          )}
          {hiddenInput}
        </div>
      </>
    );
  }

  // compact variant — slim strip above the file list.
  return (
    <>
      {overlay}
      <div
        role="button"
        tabIndex={isImporting ? -1 : 0}
        aria-disabled={isImporting}
        aria-label="Drop PDFs to add to this batch"
        onDragOver={(e) => {
          e.preventDefault();
          if (!isImporting) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (isImporting) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          "mb-4 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-4 py-3 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-forest",
          isDragging
            ? "border-forest-mid bg-divider text-ink"
            : isImporting
              ? "cursor-not-allowed border-forest-mid bg-divider/50 text-ink"
              : "border-border-default bg-card text-subtle hover:border-divider hover:text-ink",
        )}
      >
        {isImporting ? (
          <Loader2
            className="size-3.5 animate-spin text-forest"
            strokeWidth={1.8}
          />
        ) : (
          <Upload className="size-3.5" strokeWidth={1.6} />
        )}
        <span>
          {isImporting
            ? "Scanning more PDFs…"
            : isDragging
              ? "Drop to add to this batch"
              : "Drop more PDFs here or click to pick"}
        </span>
        {hiddenInput}
      </div>
    </>
  );
});
