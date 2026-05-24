"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type StageDotStatus = "done" | "running" | "queued";
export type StageDotSize = 22 | 16;

const QUEUED_BORDER = "#C9BD9A";

const SIZE_MAP: Record<
  StageDotSize,
  { box: string; checkPx: number; centerDot: string; runStroke: number; runDot: string }
> = {
  22: { box: "size-[22px]", checkPx: 12, centerDot: "size-[4px]", runStroke: 2.4, runDot: "size-[6px]" },
  16: { box: "size-[16px]", checkPx: 9,  centerDot: "size-[3px]", runStroke: 1.8, runDot: "size-[4px]" },
};

/**
 * Status indicator used by StageList (size 22, vertical timeline) and the bulk
 * per-row stage cell (size 16, dense). Running renders a spinning partial-arc
 * ring around a pulsing centre dot; done a filled green check; queued a hollow
 * pill with a small centre dot.
 */
export function StageDot({
  status,
  size = 22,
  className,
}: {
  status: StageDotStatus;
  size?: StageDotSize;
  className?: string;
}) {
  const dims = SIZE_MAP[size];

  if (status === "done") {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full text-white",
          dims.box,
          className,
        )}
        style={{ background: "var(--color-success-fg)" }}
        role="img"
        aria-label="done"
      >
        <Check
          style={{ width: dims.checkPx, height: dims.checkPx }}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </div>
    );
  }

  if (status === "running") {
    const px = size;
    const stroke = dims.runStroke;
    const r = (px - stroke) / 2;
    const c = px / 2;
    const circumference = 2 * Math.PI * r;
    const arc = circumference * 0.28;
    return (
      <div
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center",
          dims.box,
          className,
        )}
        role="img"
        aria-label="running"
      >
        <svg
          width={px}
          height={px}
          viewBox={`0 0 ${px} ${px}`}
          className="absolute inset-0"
          aria-hidden
        >
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke="var(--color-surface)"
            strokeWidth={stroke}
          />
          <g className="parse-ring-spin">
            <circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke="var(--color-forest)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${arc} ${circumference - arc}`}
              transform={`rotate(-90 ${c} ${c})`}
            />
          </g>
        </svg>
        <span
          className={cn("parse-live-dot rounded-full", dims.runDot)}
          style={{ background: "var(--color-forest)" }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        dims.box,
        className,
      )}
      style={{ background: "transparent", border: `1px solid ${QUEUED_BORDER}` }}
      role="img"
      aria-label="queued"
    >
      <span
        className={cn("rounded-full", dims.centerDot)}
        style={{ background: QUEUED_BORDER }}
      />
    </div>
  );
}
