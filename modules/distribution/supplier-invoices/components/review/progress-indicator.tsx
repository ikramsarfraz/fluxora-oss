"use client";

import { REVIEW_COLORS } from "./tokens";
import type { ReviewCounts } from "./types";

export function ProgressIndicator({ counts }: { counts: ReviewCounts }) {
  const completed = counts.matched + counts.fees;
  const pct = counts.total === 0 ? 0 : (completed / counts.total) * 100;
  const ariaLabel = `Review progress: ${counts.matched} matched, ${counts.needsReview} need review, ${counts.fees} fee. ${Math.round(pct)} percent complete.`;

  return (
    <div
      className="flex items-center gap-3"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={ariaLabel}
    >
      <Dot color={REVIEW_COLORS.good} label={`${counts.matched} matched`} />
      <Dot color={REVIEW_COLORS.danger} label={`${counts.needsReview} needs review`} />
      <Dot color={REVIEW_COLORS.mutedSoft} label={`${counts.fees} fee`} muted />
      <div
        className="ml-1.5 h-[5px] w-[120px] overflow-hidden rounded-[3px] bg-stone-line2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div
          className="h-full rounded-[3px] transition-[width] duration-300 motion-reduce:transition-none"
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
