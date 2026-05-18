"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { useBulkImportSupplierInvoices } from "../../hooks/use-supplier-invoices";

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
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const mutation = useBulkImportSupplierInvoices();
  const isImporting = mutation.isPending;

  useImperativeHandle(
    ref,
    () => ({
      openFilePicker: () => inputRef.current?.click(),
    }),
    [],
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

      try {
        const result = await mutation.mutateAsync(formData);
        const { parsed, errored } = result.summary;
        const parts: string[] = [];
        if (parsed > 0)
          parts.push(`${parsed} ready to review`);
        if (errored > 0) parts.push(`${errored} couldn't be read`);
        toast.success(parts.join(" · ") || "Scan complete.");
        // Imports tab list reads from the bulk_import_files query; new rows
        // landed server-side as part of the action, so a single invalidation
        // pulls them in. No need to seed the cache manually.
        await queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Scan failed.",
        );
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

  if (variant === "empty") {
    return (
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
          "flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-[12px] border-2 border-dashed p-12 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-ink",
          isDragging
            ? "border-stone-ink bg-stone-line2"
            : "border-stone-line bg-stone-surface hover:border-stone-line2",
          isImporting && "cursor-not-allowed opacity-60",
        )}
      >
        <Upload className="mb-3 size-7 text-stone-muted" strokeWidth={1.6} />
        <h2 className="mb-2 text-[16px] font-semibold tracking-[-0.005em] text-stone-ink">
          {isImporting
            ? "Scanning…"
            : isDragging
              ? "Drop to start scanning"
              : "Drop PDFs to scan"}
        </h2>
        <p className="max-w-[420px] text-[13px] text-stone-muted">
          {isImporting
            ? "Files are being read in order — they'll appear here as each one finishes."
            : `Drag supplier-invoice PDFs here, or click to pick. Up to ${MAX_FILES_PER_BATCH} per batch, ${fmtBytes(MAX_FILE_BYTES)} each.`}
        </p>
        {hiddenInput}
      </div>
    );
  }

  // compact variant — slim strip above the file list.
  return (
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
        "mb-4 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-4 py-3 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-ink",
        isDragging
          ? "border-stone-ink bg-stone-line2 text-stone-ink"
          : "border-stone-line bg-stone-surface text-stone-muted hover:border-stone-line2 hover:text-stone-ink",
        isImporting && "cursor-not-allowed opacity-60",
      )}
    >
      <Upload className="size-3.5" strokeWidth={1.6} />
      <span>
        {isImporting
          ? "Scanning more PDFs…"
          : isDragging
            ? "Drop to add to this batch"
            : "Drop more PDFs here or click to pick"}
      </span>
      {hiddenInput}
    </div>
  );
});
