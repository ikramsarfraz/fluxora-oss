"use client";

import { REVIEW_COLORS } from "./tokens";
import type { ReviewCounts } from "./types";

export function ProgressIndicator({ counts }: { counts: ReviewCounts }) {
  const completed = counts.matched + counts.fees;
  const pct = counts.total === 0 ? 0 : (completed / counts.total) * 100;

  return (
    <div className="flex items-center gap-3">
      <Dot color={REVIEW_COLORS.good} label={`${counts.matched} matched`} />
      <Dot color={REVIEW_COLORS.danger} label={`${counts.needsReview} needs review`} />
      <Dot color={REVIEW_COLORS.mutedSoft} label={`${counts.fees} fee`} muted />
      <div className="ml-1.5 h-[5px] w-[120px] overflow-hidden rounded-[3px] bg-stone-line2">
        <div
          className="h-full rounded-[3px] transition-[width] duration-300"
          style={{ width: `${pct}%`, background: REVIEW_COLORS.good }}
        />
      </div>
    </div>
  );
}

function Dot({
  color,
  label,
  muted,
}: {
  color: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-[7px] rounded-full" style={{ background: color }} />
      <span
        className={
          muted
            ? "text-[12.5px] font-medium text-stone-muted"
            : "text-[12.5px] font-medium text-stone-ink"
        }
      >
        {label}
      </span>
    </div>
  );
}
