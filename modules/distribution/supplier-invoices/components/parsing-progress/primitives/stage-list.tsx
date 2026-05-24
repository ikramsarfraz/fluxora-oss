"use client";

import { cn } from "@/lib/utils";

import { StageDot, type StageDotStatus } from "./stage-dot";

export type StageItem = {
  id: string;
  label: string;
  detail?: string;
  status: StageDotStatus;
  /** Right-column elapsed string. `live` while running, `0.9s` once done, empty when queued. */
  time?: string;
};

/**
 * Vertical stage list used by the full single-PDF parse screen. The running
 * row gets a warm surface highlight; other rows are transparent. The detail
 * line tucks in mono when running so the live label feels deliberate.
 */
export function StageList({
  stages,
  className,
}: {
  stages: StageItem[];
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col gap-2", className)}>
      {stages.map(stage => (
        <li key={stage.id}>
          <StageRow stage={stage} />
        </li>
      ))}
    </ol>
  );
}

function StageRow({ stage }: { stage: StageItem }) {
  const running = stage.status === "running";
  const queued = stage.status === "queued";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-200",
        running ? "bg-surface" : "bg-transparent",
      )}
    >
      <StageDot status={stage.status} size={22} />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-[13px] leading-tight",
            queued ? "font-normal text-subtle" : "font-medium text-ink",
          )}
        >
          {stage.label}
        </div>
        {stage.detail ? (
          <div
            className={cn(
              "mt-0.5 text-[11px] text-muted",
              running && "font-mono tabular-nums",
            )}
          >
            {stage.detail}
            {running ? "…" : ""}
          </div>
        ) : null}
      </div>
      <RightSlot status={stage.status} time={stage.time} />
    </div>
  );

  function RightSlot({ status, time }: { status: StageDotStatus; time?: string }) {
    if (status === "queued") {
      return <span className="shrink-0 font-mono text-[11px] text-muted">—</span>;
    }
    if (status === "running") {
      return (
        <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-forest">
          {time || "live"}
        </span>
      );
    }
    return (
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">
        {time || ""}
      </span>
    );
  }
}
