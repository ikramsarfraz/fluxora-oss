"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  ProgressBar,
  StatusPill,
} from "../parsing-progress/primitives";

export type BulkParseFile = {
  /** Stable key — typically the index, since user-supplied names can collide. */
  id: string;
  name: string;
  sizeLabel: string;
  /**
   * Unset while the batch is running — per-file outcome only resolves once
   * the bulk action settles (the current server flow is synchronous and
   * doesn't emit per-file events; tracked in #278).
   */
  outcome?: "parsed" | "errored";
  errorMessage?: string;
  /** Set on parsed rows so the Review button can deep-link into that file. */
  bulkImportFileId?: string;
};

export type BulkParseState = "running" | "done";

/**
 * Full-screen bulk-parse loader (Option 2 of the design handoff). Shown
 * while the bulk-import action is in flight and through a "done" beat
 * afterwards so the user can scan the per-file outcomes before dismissing.
 *
 * Per-file granularity is deliberately limited: every running row says
 * "Scanning…" rather than inventing a fake stage-X/7 progression. When the
 * server returns, rows snap to their real parsed/errored outcome and
 * elapsed time. The shared batch progress bar is asymptotic (same pattern
 * the single-PDF screen uses) so the page has visible forward motion.
 *
 * #278 tracks the work to drive per-file rows from a real event stream.
 */
export function BulkParsingScreen({
  files,
  state,
  overallProgress,
  elapsed,
  onCancel,
  onDismiss,
  onReviewFile,
}: {
  files: BulkParseFile[];
  state: BulkParseState;
  overallProgress: number;
  elapsed: number;
  onCancel: () => void;
  /** Called when the user accepts the done state — typically dismisses the overlay. */
  onDismiss: () => void;
  /** Per-row Review handler — receives the bulkImportFileId of the parsed file. */
  onReviewFile?: (bulkImportFileId: string) => void;
}) {
  const total = files.length;
  const done = useMemo(
    () => files.filter(f => f.outcome === "parsed").length,
    [files],
  );
  const errored = useMemo(
    () => files.filter(f => f.outcome === "errored").length,
    [files],
  );
  const isDone = state === "done";
  const scanning = isDone ? 0 : total - done - errored;
  const queued = 0;

  // Portal the overlay into shadcn's SidebarInset (the main-content wrapper)
  // so the app sidebar stays visible and interactive while the batch runs.
  // SidebarInset is `position: relative`, so an `absolute inset-0` child
  // fills exactly the content column, no matter the sidebar's expanded /
  // collapsed state. Falls back to in-place render before the mount node is
  // located (one tick after first paint).
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const node = document.querySelector<HTMLElement>(
      '[data-slot="sidebar-inset"]',
    );
    // Locate the portal mount node post-mount; null until then is fine.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMountNode(node);
  }, []);

  // ETA heuristic — extrapolate from current elapsed/progress. Capped so a
  // near-zero progress doesn't produce minutes-long estimates that the user
  // will only see for one render.
  const etaSeconds = isDone
    ? null
    : overallProgress < 5
      ? null
      : Math.max(
          1,
          Math.min(
            120,
            Math.round((elapsed * (100 - overallProgress)) / overallProgress),
          ),
        );

  const screen = (
    <div
      className={cn(
        "parse-banner-in z-40 flex flex-col overflow-y-auto bg-page",
        mountNode ? "absolute inset-0" : "fixed inset-0 z-50",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={isDone ? "Batch scan complete" : "Scanning your batch"}
    >
      <header className="flex items-start justify-between gap-6 px-8 pb-[18px] pt-[28px]">
        <div className="min-w-0">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
            Bulk import · {total} file{total === 1 ? "" : "s"}
          </div>
          <h1 className="mb-1.5 text-[26px] font-semibold leading-tight tracking-[-0.03em] text-ink">
            {isDone ? "Batch scan complete" : "Scanning your batch"}
          </h1>
          <p className="max-w-[640px] text-[13.5px] text-subtle">
            {isDone
              ? errored > 0
                ? `${done} ready to review · ${errored} couldn't be read. Re-upload the failed PDFs from the imports list to retry.`
                : "Every file parsed cleanly. Pick one to review, or close to see them all in the imports list."
              : "Files are processed sequentially against OCR + AI matching. We'll list them with their outcomes the moment the batch finishes."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isDone ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="h-8 text-[12px]"
            >
              Cancel batch
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={onDismiss}
            disabled={!isDone}
            className={cn(
              "h-8 gap-1.5 border-forest-mid bg-forest-mid text-[12px] text-card-warm hover:bg-forest",
              !isDone && "cursor-not-allowed opacity-50",
            )}
          >
            {isDone && done > 0
              ? `Review ${done} ready file${done === 1 ? "" : "s"}`
              : isDone
                ? "Close"
                : `Review 0 ready files`}
            {isDone && done > 0 ? <ArrowRight className="size-3" strokeWidth={1.8} /> : null}
          </Button>
        </div>
      </header>

      <div className="px-8 pb-[14px]">
        <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_1.7fr] items-center gap-6 rounded-[10px] border border-border-default bg-card px-6 py-4">
          <Metric label="Total files" value={total} />
          <Metric label="Done" value={done} sub={`of ${total}`} tone="success" />
          <Metric
            label={isDone && errored > 0 ? "Errored" : "Scanning"}
            value={isDone ? errored : scanning}
            tone={isDone ? (errored > 0 ? "danger" : undefined) : scanning > 0 ? "warning" : undefined}
          />
          <Metric label="Queued" value={queued} />
          <BatchProgress
            percent={overallProgress}
            isDone={isDone}
            etaSeconds={etaSeconds}
          />
        </div>
      </div>

      <div className="mb-8 px-8">
        <div className="overflow-hidden rounded-[10px] border border-border-default bg-card">
          <div className="flex items-center justify-between border-b border-border-default bg-surface px-6 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="text-[13px] font-semibold text-ink">
                Files in this batch
              </span>
              <StatusPill variant={isDone ? "done" : "live"} />
            </div>
            <span className="text-[11px] text-muted">Sorted by upload order</span>
          </div>

          <div className="grid grid-cols-[1fr_220px_200px_150px] items-center gap-[18px] border-b border-border-default bg-page px-6 py-2.5">
            <ColHead>File</ColHead>
            <ColHead>Stage</ColHead>
            <ColHead>Progress</ColHead>
            <ColHead className="text-right">Action</ColHead>
          </div>

          {files.map((file, i) => (
            <BulkParseRow
              key={file.id}
              file={file}
              state={state}
              elapsed={elapsed}
              overallProgress={overallProgress}
              onReview={onReviewFile}
              isLast={i === files.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return mountNode ? createPortal(screen, mountNode) : screen;
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "success" | "warning" | "danger";
}) {
  const color =
    tone === "success"
      ? "text-success-fg"
      : tone === "warning" && value > 0
        ? "text-warning-fg"
        : tone === "danger" && value > 0
          ? "text-danger-fg"
          : "text-ink";
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </div>
      <div
        className={cn(
          "text-[26px] font-semibold leading-none tabular-nums tracking-[-0.03em]",
          color,
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-[10.5px] text-muted">{sub}</div> : null}
    </div>
  );
}

function BatchProgress({
  percent,
  isDone,
  etaSeconds,
}: {
  percent: number;
  isDone: boolean;
  etaSeconds: number | null;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
          Batch progress
        </span>
        <div className="font-mono text-[12.5px] tabular-nums text-ink">
          {Math.round(percent)}%
          <span className="ml-2 font-normal text-muted">
            {isDone
              ? "complete"
              : etaSeconds != null
                ? `~${etaSeconds}s remaining`
                : ""}
          </span>
        </div>
      </div>
      <ProgressBar value={percent} isDone={isDone} height={8} />
    </div>
  );
}

function ColHead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle",
        className,
      )}
    >
      {children}
    </div>
  );
}

function BulkParseRow({
  file,
  state,
  elapsed,
  overallProgress,
  onReview,
  isLast,
}: {
  file: BulkParseFile;
  state: BulkParseState;
  elapsed: number;
  overallProgress: number;
  onReview?: (bulkImportFileId: string) => void;
  isLast: boolean;
}) {
  const isParsed = file.outcome === "parsed";
  const isErrored = file.outcome === "errored";
  const isRunning = state === "running";

  const rowBg = isRunning ? "bg-card-warm" : "bg-card";
  const stripe = isErrored
    ? "border-l-[3px] border-l-danger-fg"
    : isRunning
      ? "border-l-[3px] border-l-forest"
      : "border-l-[3px] border-l-transparent";

  const fileIconColor = isParsed
    ? "text-success-fg"
    : isErrored
      ? "text-danger-fg"
      : isRunning
        ? "text-forest"
        : "text-muted";

  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_220px_200px_150px] items-center gap-[18px] px-6 py-3.5 transition-colors",
        rowBg,
        stripe,
        !isLast && "border-b border-divider",
        isRunning && "opacity-100",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <FileText
          className={cn("size-4 shrink-0", fileIconColor)}
          strokeWidth={1.6}
        />
        <div className="min-w-0">
          <div className="truncate font-mono text-[12.5px] font-medium tabular-nums text-ink">
            {file.name}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">{file.sizeLabel}</div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {isParsed ? (
          <>
            <span
              className="size-4 shrink-0 rounded-full"
              style={{ background: "var(--color-success-fg)" }}
              aria-hidden
            />
            <span className="text-[12.5px] font-medium text-success-fg">
              Parsed in {elapsed.toFixed(1)}s
            </span>
          </>
        ) : isErrored ? (
          <>
            <span
              className="size-4 shrink-0 rounded-full"
              style={{ background: "var(--color-danger-fg)" }}
              aria-hidden
            />
            <span className="text-[12.5px] font-medium text-danger-fg">
              Couldn&apos;t read
            </span>
          </>
        ) : (
          <>
            <Loader2
              className="size-4 shrink-0 animate-spin text-forest"
              strokeWidth={1.8}
            />
            <span className="text-[12.5px] font-medium text-ink">Scanning…</span>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <ProgressBar
          value={isParsed || isErrored ? 100 : overallProgress}
          isDone={isParsed}
          height={6}
        />
        <div className="flex items-center justify-between gap-2 font-mono text-[10.5px] tabular-nums text-muted">
          <span>
            {isParsed || isErrored ? "100%" : `${Math.round(overallProgress)}%`}
          </span>
          <span>
            {isParsed
              ? "Ready"
              : isErrored
                ? "Error"
                : `${elapsed.toFixed(1)}s`}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end">
        {isParsed && file.bulkImportFileId && onReview ? (
          <Button
            type="button"
            size="sm"
            onClick={() => onReview(file.bulkImportFileId!)}
            className="h-8 gap-1 border-forest-mid bg-forest-mid text-[12px] text-card-warm hover:bg-forest"
          >
            Review
            <ArrowRight className="size-3" strokeWidth={1.8} />
          </Button>
        ) : isErrored ? (
          <span
            className="truncate font-mono text-[11px] text-danger-fg"
            title={file.errorMessage}
          >
            {file.errorMessage ?? "Couldn't read"}
          </span>
        ) : isRunning ? (
          <span className="font-mono text-[11.5px] text-muted">scanning…</span>
        ) : (
          <span className="font-mono text-[11.5px] text-muted">—</span>
        )}
      </div>
    </div>
  );
}
