"use client";

import { cn } from "@/lib/utils";

import type { StageDotStatus } from "./stage-dot";

export type StageTrackItem = {
  id: string;
  label: string;
  status: StageDotStatus;
};

/**
 * Horizontal compact track of stages — used in the re-scan banner. Each stage
 * is an 8px pill: queued/done are 8×8 round; running is a 28×8 rectangle
 * filled forest with a left-to-right gliding highlight.
 */
export function StageTrack({
  stages,
  showLabels = true,
  className,
}: {
  stages: StageTrackItem[];
  showLabels?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-[5px]">
        {stages.map(stage => (
          <StagePill key={stage.id} stage={stage} />
        ))}
      </div>
      {showLabels ? (
        <div className="flex items-start gap-[5px]">
          {stages.map(stage => (
            <span
              key={`${stage.id}-label`}
              title={stage.label}
              className={cn(
                "min-w-0 flex-1 truncate text-left text-[9px] font-medium uppercase leading-tight tracking-[0.06em]",
                stage.status === "running" ? "text-forest" : "text-muted",
              )}
            >
              {firstWord(stage.label)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StagePill({ stage }: { stage: StageTrackItem }) {
  if (stage.status === "running") {
    return (
      <span
        className="parse-bar-glide h-2 w-7 shrink-0 rounded-full"
        style={{ background: "var(--color-forest)" }}
        aria-label={`${stage.label} (running)`}
      />
    );
  }
  return (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{
        background:
          stage.status === "done"
            ? "var(--color-success-fg)"
            : "var(--color-surface)",
      }}
      aria-label={`${stage.label} (${stage.status})`}
    />
  );
}

function firstWord(label: string): string {
  return (label.split(/\s+/)[0] ?? "").toUpperCase();
}
