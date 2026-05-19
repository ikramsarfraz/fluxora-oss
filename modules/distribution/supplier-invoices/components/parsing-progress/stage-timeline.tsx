"use client";

import { Check, FileText } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ParseStage, StageStatus } from "./types";

const COLORS = {
  good: "var(--color-success-fg)",
  accent: "oklch(58% 0.13 242)",
  accentEnd: "oklch(70% 0.18 242)",
  borderStrong: "var(--color-border-default)",
  mutedSoft: "#9a9a93",
  danger: "var(--color-danger-fg)",
} as const;

export function StageTimeline({
  fileName,
  fileSizeLabel,
  uploadedLabel,
  elapsedSeconds,
  overallProgress,
  stages,
}: {
  fileName: string;
  fileSizeLabel: string;
  uploadedLabel: string;
  elapsedSeconds: number;
  overallProgress: number;
  stages: ParseStage[];
}) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-border-default bg-card">
      <FileStrip
        fileName={fileName}
        fileSizeLabel={fileSizeLabel}
        uploadedLabel={uploadedLabel}
        elapsedSeconds={elapsedSeconds}
      />
      <OverallProgress percent={overallProgress} />
      <div className="px-[14px] pb-[18px] pt-[18px]">
        {stages.map(stage => (
          <StageRow key={stage.id} stage={stage} />
        ))}
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
    <div className="flex items-center gap-[14px] border-b border-border-default px-[22px] py-[16px]">
      <div
        className="flex size-[38px] items-center justify-center rounded-[10px] border border-border-default bg-divider"
        style={{ color: COLORS.danger }}
      >
        <FileText className="size-4" strokeWidth={1.6} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[12.5px] font-medium text-ink">
          {fileName}
        </div>
        <div className="mt-0.5 text-[11px]" style={{ color: COLORS.mutedSoft }}>
          {fileSizeLabel} · {uploadedLabel}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-[12px] text-subtle tabular-nums">
          {elapsedSeconds.toFixed(1)}s
        </div>
        <div className="text-[10px]" style={{ color: COLORS.mutedSoft }}>
          elapsed
        </div>
      </div>
    </div>
  );
}

function OverallProgress({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="px-[22px] pb-[6px] pt-[18px]">
      <div className="mb-[10px] flex items-baseline justify-between">
        <div className="text-[13px] font-medium text-ink">Overall progress</div>
        <div className="font-mono text-[13px] font-semibold tabular-nums">
          {Math.round(clamped)}%
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded bg-divider">
        <div
          className="h-full rounded transition-[width] duration-150"
          style={{
            width: `${clamped}%`,
            background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentEnd})`,
          }}
        />
      </div>
    </div>
  );
}

function StageRow({ stage }: { stage: ParseStage }) {
  const running = stage.status === "running";
  const queued = stage.status === "queued";
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-[10px] py-[10px]",
        running ? "bg-divider" : "bg-transparent",
      )}
    >
      <StageIndicator status={stage.status} />
      <div className="flex flex-1 items-baseline justify-between">
        <div>
          <div
            className={cn(
              "text-[13px]",
              stage.status === "done" ? "font-medium" : "font-semibold",
              queued ? "text-subtle" : "text-ink",
            )}
          >
            {stage.label}
          </div>
          {stage.detail ? (
            <div
              className={cn(
                "mt-px text-[11px]",
                running && "font-mono tabular-nums",
              )}
              style={{ color: COLORS.mutedSoft }}
            >
              {stage.detail}
            </div>
          ) : null}
        </div>
        {stage.time ? (
          <div
            className="font-mono text-[11px] tabular-nums"
            style={{ color: running ? COLORS.accent : COLORS.mutedSoft }}
          >
            {stage.time}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StageIndicator({ status }: { status: StageStatus }) {
  if (status === "done") {
    return (
      <div
        className="flex size-6 items-center justify-center rounded-full text-white"
        style={{ background: COLORS.good }}
      >
        <Check className="size-[14px]" strokeWidth={2.4} />
      </div>
    );
  }
  if (status === "running") {
    return (
      <div
        className="flex size-6 items-center justify-center rounded-full"
        style={{ background: COLORS.accent }}
      >
        <span className="size-[10px] animate-pulse rounded-full bg-card" />
      </div>
    );
  }
  return (
    <div
      className="flex size-6 items-center justify-center rounded-full bg-divider"
      style={{ border: `1px solid ${COLORS.borderStrong}` }}
    >
      <span
        className="size-[6px] rounded-full"
        style={{ background: COLORS.borderStrong }}
      />
    </div>
  );
}
