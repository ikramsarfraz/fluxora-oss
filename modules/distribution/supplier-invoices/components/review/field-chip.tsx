"use client";

import { REVIEW_COLORS } from "./tokens";
import { confidenceLevel, type FieldConfidenceStatus } from "./types";

const LEVEL_COLOR: Record<ReturnType<typeof confidenceLevel>, string> = {
  high: REVIEW_COLORS.good,
  medium: REVIEW_COLORS.warn,
  low: REVIEW_COLORS.danger,
};

const LEVEL_LABEL: Record<ReturnType<typeof confidenceLevel>, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function FieldChip({
  confidence,
  status,
  sourceHint,
}: {
  /** 0–100. */
  confidence: number;
  /** Force warn tone regardless of number — used when the parser flagged the field. */
  status?: FieldConfidenceStatus;
  sourceHint?: string;
}) {
  const level = confidenceLevel(confidence, status);
  const color = status === "warn" ? REVIEW_COLORS.warn : LEVEL_COLOR[level];
  const label = status === "warn" ? "Low" : LEVEL_LABEL[level];

  return (
    <div className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-subtle">
      <span className="size-[5px] rounded-full" style={{ background: color }} />
      <span className="font-mono tabular-nums text-subtle">{confidence}%</span>
      <span style={{ color: REVIEW_COLORS.mutedSoft }}>{label} confidence</span>
      {sourceHint ? (
        <span style={{ color: REVIEW_COLORS.mutedSoft }}>· {sourceHint}</span>
      ) : null}
    </div>
  );
}
