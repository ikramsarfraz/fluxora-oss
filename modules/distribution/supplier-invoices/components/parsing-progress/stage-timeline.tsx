"use client";

import { FileText } from "lucide-react";

import { ProgressBar, StageList, type StageItem } from "./primitives";
import type { ParseStage } from "./types";

/**
 * Left card of the single-PDF parse screen: file strip on top, overall
 * progress underneath, then the vertical stage list. Pure composition over
 * the parsing primitives — all token + animation behaviour lives there.
 */
export function StageTimeline({
  fileName,
  fileSizeLabel,
  uploadedLabel,
  elapsedSeconds,
  overallProgress,
  stages,
  isDone = false,
}: {
  fileName: string;
  fileSizeLabel: string;
  uploadedLabel: string;
  elapsedSeconds: number;
  overallProgress: number;
  stages: ParseStage[];
  isDone?: boolean;
}) {
  // ParseStage is structurally identical to StageItem — pass directly.
  const items: StageItem[] = stages;
  return (
    <div className="overflow-hidden rounded-[10px] border border-border-default bg-card">
      <FileStrip
        fileName={fileName}
        fileSizeLabel={fileSizeLabel}
        uploadedLabel={uploadedLabel}
        elapsedSeconds={elapsedSeconds}
      />
      <OverallProgress percent={overallProgress} isDone={isDone} />
      <div className="px-3 pb-3.5 pt-4">
        <StageList stages={items} />
      </div>
    </div>
  );
}

function FileStrip({
  fileName,
  fileSizeLabel,
  uploadedLabel,
  elapsedSeconds,
}: {
  fileName: string;
  fileSizeLabel: string;
  uploadedLabel: string;
  elapsedSeconds: number;
}) {
  return (
    <div className="flex items-center gap-3.5 border-b border-border-default px-5 py-3.5">
      <div
        className="flex size-[34px] shrink-0 items-center justify-center rounded-[8px] border border-border-default bg-surface"
        style={{ color: "var(--color-danger-fg)" }}
      >
        <FileText className="size-4" strokeWidth={1.6} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[12.5px] font-medium tabular-nums text-ink">
          {fileName}
        </div>
        <div className="mt-0.5 text-[11px] text-muted">
          {fileSizeLabel}
          {fileSizeLabel ? " · " : ""}
          {uploadedLabel}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-[13px] font-semibold tabular-nums text-ink">
          {elapsedSeconds.toFixed(1)}s
        </div>
        <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
          ELAPSED
        </div>
      </div>
    </div>
  );
}

function OverallProgress({ percent, isDone }: { percent: number; isDone: boolean }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="px-5 pt-4">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-[12.5px] font-medium text-ink">Overall progress</div>
        <div className="font-mono text-[13px] font-semibold tabular-nums text-ink">
          {Math.round(clamped)}%
        </div>
      </div>
      <ProgressBar value={clamped} isDone={isDone} height={8} />
    </div>
  );
}
