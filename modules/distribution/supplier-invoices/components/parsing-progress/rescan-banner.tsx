"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  ProgressBar,
  StageTrack,
  type StageTrackItem,
  StatusPill,
} from "./primitives";

/** Same shape (and order) the single-PDF flow uses, scoped to the re-scan
 *  surface so the banner stays self-contained. The labels matter: the
 *  StageTrack renders the first word of each as the abbreviation under each
 *  pill, so changing wording here changes what the user sees in the track. */
export const RESCAN_STAGES = [
  { id: "upload",  label: "Upload",            detail: "loading PDF" },
  { id: "extract", label: "Text extraction",   detail: "reading page content" },
  { id: "tables",  label: "Table detection",   detail: "locating line-item table" },
  { id: "lines",   label: "Line items",        detail: "reading rows" },
  { id: "match",   label: "Product matching",  detail: "searching catalog" },
  { id: "fees",    label: "Fees & tax",        detail: "detect freight, fuel, tax" },
  { id: "recon",   label: "Reconciliation",    detail: "cross-check totals" },
] as const;

/**
 * Re-scan progress banner. Mounted above the review form while a rescan
 * mutation is in flight (and through a short "Done" beat afterwards). Layout
 * follows the design handoff: 32×32 icon square, title + subtitle + Live/Done
 * pill, elapsed timer + action button on the right; progress bar + stage
 * track + step counter underneath.
 *
 * The component is presentation-only: stage advancement, elapsed timing, and
 * the done flag come from the host. Cancel hides the banner (the mutation
 * itself can't be aborted — it's a single server call — but the user gets
 * out of the way and the new data still arrives silently).
 */
export function RescanBanner({
  stageIndex,
  elapsed,
  done,
  onCancel,
  onAccept,
  className,
}: {
  stageIndex: number;
  elapsed: number;
  done: boolean;
  onCancel: () => void;
  onAccept: () => void;
  className?: string;
}) {
  const total = RESCAN_STAGES.length;
  const i = Math.max(0, Math.min(total - 1, Math.floor(stageIndex)));
  const stage = RESCAN_STAGES[i];
  const stagePercent = done
    ? 100
    : Math.max(2, Math.min(98, (stageIndex / total) * 100));

  const trackItems: StageTrackItem[] = RESCAN_STAGES.map((s, idx) => ({
    id: s.id,
    label: s.label,
    status: done
      ? "done"
      : idx < i
        ? "done"
        : idx === i
          ? "running"
          : "queued",
  }));

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "parse-banner-in flex shrink-0 flex-col gap-3 border-b border-border-default bg-card px-5 pb-3 pt-3.5 shadow-[0_6px_18px_rgba(26,26,20,0.07)]",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-default bg-surface"
          style={{ color: "var(--color-forest)" }}
        >
          <RefreshCw
            className={cn("size-4", !done && "parse-ring-spin")}
            strokeWidth={1.8}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span className="text-[13.5px] font-semibold text-ink">
              {done ? "Re-scan complete" : "Re-scanning invoice"}
            </span>
            <StatusPill variant={done ? "done" : "live"} />
          </div>
          <div className="mt-0.5 text-[12px] text-subtle">
            {done ? (
              `Parsed in ${elapsed.toFixed(1)}s. Form fields and line matches were refreshed.`
            ) : (
              <span className="font-mono tabular-nums">
                {stage.label} · {stage.detail}…
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <div className="font-mono text-[12.5px] font-semibold tabular-nums text-ink">
              {elapsed.toFixed(1)}s
            </div>
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
              ELAPSED
            </div>
          </div>
          {done ? (
            <Button
              type="button"
              size="sm"
              onClick={onAccept}
              className="h-8 gap-1.5 border-forest-mid bg-forest-mid text-[12px] text-card-warm hover:bg-forest"
            >
              Use new data →
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="h-8 text-[12px]"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <ProgressBar value={stagePercent} isDone={done} height={4} />
        <div className="flex items-end justify-between gap-3">
          <StageTrack stages={trackItems} className="flex-1" />
          <div className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted">
            step {Math.min(i + 1, total)}/{total}
          </div>
        </div>
      </div>
    </div>
  );
}
