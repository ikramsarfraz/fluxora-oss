"use client";

import { ArrowRight, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { FileRow } from "./file-row";
import { MetricCard } from "./leaf";
import { fmtAmount } from "./mock-data";
import { useReel } from "./reel-state";

// Reproduced from
// modules/distribution/supplier-invoices/components/bulk-landing/{inline-dropzone,bulk-landing-screen}.tsx
// JSX + classes verbatim. Wired to the reel state instead of the production
// upload mutation.

const MAX_FILES_PER_BATCH = 10;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BulkLanding() {
  const { state } = useReel();
  const isEmpty = state.view.files.length === 0;
  const isScanning = state.step === "imports-scanning";

  if (isEmpty || isScanning) {
    return <EmptyDropzone scanning={isScanning} />;
  }

  return <PopulatedQueue />;
}

function EmptyDropzone({ scanning }: { scanning: boolean }) {
  return (
    <div
      role="button"
      data-reel="dropzone"
      aria-disabled={scanning}
      className={cn(
        "flex min-h-[280px] flex-col items-center justify-center rounded-[12px] border-2 border-dashed p-12 text-center transition-colors",
        "border-border-default bg-card",
        scanning && "border-forest-mid bg-divider",
      )}
    >
      {scanning ? (
        <Loader2 className="mb-3 size-7 animate-spin text-forest-mid" strokeWidth={1.6} />
      ) : (
        <Upload className="mb-3 size-7 text-subtle" strokeWidth={1.6} />
      )}
      <h2 className="mb-2 text-[16px] font-medium tracking-[-0.005em] text-ink">
        {scanning ? "Scanning…" : "Drop PDFs to scan"}
      </h2>
      <p className="max-w-[420px] text-[13px] text-subtle">
        {scanning
          ? "Files are being read in order — they'll appear here as each one finishes."
          : `Drag supplier-invoice PDFs here, or click to pick. Up to ${MAX_FILES_PER_BATCH} per batch, ${fmtBytes(MAX_FILE_BYTES)} each.`}
      </p>
    </div>
  );
}

function PopulatedQueue() {
  const { state, dispatch } = useReel();
  const { view } = state;
  const focusedId = view.files[0]?.id ?? null;

  const nextFile = view.files.find((f) => f.status !== "reviewed") ?? null;

  return (
    <>
      {/* Compact dropzone strip above the list */}
      <div className="mb-4 flex items-center justify-center gap-2 rounded-md border border-dashed border-border-default bg-card px-4 py-3 text-[13px] text-subtle">
        <Upload className="size-3.5" strokeWidth={1.6} />
        <span>Drop more PDFs here or click to pick</span>
      </div>

      {/* Summary strip */}
      <SummaryStrip />

      <div className="mb-7 overflow-hidden rounded-[12px] border border-border-default bg-card">
        <FilesCardHeader />
        <ColumnHeader />
        {view.files.map((file) => (
          <FileRow
            key={file.id}
            file={file}
            isFocused={focusedId === file.id}
            onFocus={() => {}}
            onOpen={() => dispatch({ type: "OPEN_REVIEW" })}
            reelTarget={`file-row-${file.id}`}
          />
        ))}
        <CardFooter />
      </div>

      {/* "Start with X" bar at the bottom mirrors production header secondary CTA */}
      {nextFile ? (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            size="sm"
            data-reel="start-with-file"
            onClick={() => dispatch({ type: "OPEN_REVIEW" })}
            className="h-9 gap-1.5 border-forest-mid bg-forest-mid text-[13px] text-card-warm hover:bg-forest"
          >
            Start with {shortName(nextFile.name)}
            <ArrowRight className="size-3" strokeWidth={1.8} />
          </Button>
        </div>
      ) : null}
    </>
  );
}

function SummaryStrip() {
  const { state } = useReel();
  const { summary } = state.view;
  const ratio =
    summary.filesProcessed === 0 ? 0 : summary.readyToPost / summary.filesProcessed;
  return (
    <div
      className="mb-[18px] grid items-center gap-6 rounded-[12px] border border-border-default bg-card px-6 py-[18px]"
      style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr auto" }}
    >
      <MetricCard label="Files processed" value={summary.filesProcessed} />
      <MetricCard
        label="Ready to post"
        value={summary.readyToPost}
        sub={`of ${summary.filesProcessed}`}
        tone={summary.readyToPost === summary.filesProcessed ? "good" : "neutral"}
      />
      <MetricCard
        label="Needs your review"
        value={summary.needsReview}
        tone={summary.needsReview > 0 ? "warn" : "good"}
      />
      <MetricCard
        label="Combined value"
        value={`$${fmtAmount(summary.combinedValue)}`}
        mono
      />
      <div className="flex flex-col items-end gap-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
          Batch progress
        </div>
        <div className="h-1.5 w-40 overflow-hidden rounded-md bg-divider">
          <div
            className="h-full rounded-md"
            style={{
              width: `${ratio * 100}%`,
              background: "var(--color-success-fg)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function FilesCardHeader() {
  return (
    <div className="flex items-center justify-between border-b border-border-default bg-divider px-[22px] py-3">
      <div className="flex items-center gap-3.5">
        <div className="text-[13px] font-semibold text-ink">Files in this batch</div>
        <div className="flex gap-1 rounded-[7px] border border-border-default bg-card p-[3px]">
          {["All", "Needs review", "Reviewed"].map((label, i) => (
            <button
              key={label}
              type="button"
              className={cn(
                "rounded-[5px] px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                i === 0
                  ? "bg-forest-mid text-card-warm"
                  : "text-subtle hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="text-[12px] text-subtle">
        Sorted by: <span className="font-medium text-ink">Lowest confidence first</span>
      </div>
    </div>
  );
}

function ColumnHeader() {
  return (
    <div
      className="grid gap-[18px] border-b border-border-default bg-page px-[22px] py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle"
      style={{ gridTemplateColumns: "1fr 180px 180px 130px 130px" }}
    >
      <div className="pl-[3px]">File · supplier · invoice</div>
      <div>Status</div>
      <div>Confidence</div>
      <div>Issues</div>
      <div className="text-right">Action</div>
    </div>
  );
}

function CardFooter() {
  const { state } = useReel();
  const { readyToPost, filesProcessed } = state.view.summary;
  return (
    <div className="flex items-center justify-end bg-page px-[22px] py-3.5">
      <div className="flex items-center gap-2.5">
        <span className="text-[12px] text-subtle">Bulk:</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={readyToPost === 0}
          className="h-8 text-[12px]"
        >
          Clear {readyToPost} reviewed
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={filesProcessed === 0}
          className="h-8 text-[12px]"
        >
          Re-scan all ({filesProcessed})
        </Button>
      </div>
    </div>
  );
}

function shortName(name: string): string {
  const head = name.split("_")[0] ?? name;
  return head.length > 12 ? `${head.slice(0, 12)}…` : head;
}
