"use client";

import { cn } from "@/lib/utils";

import { REVIEW_COLORS } from "./tokens";
import type { ReviewFilter } from "./types";

type Tone = "good" | "warn" | "neutral";

const TONE_FG: Record<Tone, string | undefined> = {
  good: REVIEW_COLORS.good,
  warn: REVIEW_COLORS.warn,
  neutral: undefined,
};

export function FilterSegmented({
  filter,
  counts,
  onChange,
}: {
  filter: ReviewFilter;
  counts: { needsReview: number; matched: number; fees: number; total: number };
  onChange: (filter: ReviewFilter) => void;
}) {
  return (
    <div className="flex gap-1 rounded-[7px] border border-border-default bg-divider p-[3px]">
      <FilterBtn
        active={filter === "all"}
        onClick={() => onChange("all")}
        count={counts.total}
      >
        All
      </FilterBtn>
      <FilterBtn
        active={filter === "needs"}
        onClick={() => onChange("needs")}
        count={counts.needsReview}
        tone="warn"
      >
        Needs review
      </FilterBtn>
      <FilterBtn
        active={filter === "matched"}
        onClick={() => onChange("matched")}
        count={counts.matched}
        tone="good"
      >
        Matched
      </FilterBtn>
      {/* Hide the Fees tab when no fees were detected — keeps the segmented
          control compact on the typical case (no extra charges). */}
      {counts.fees > 0 ? (
        <FilterBtn
          active={filter === "fees"}
          onClick={() => onChange("fees")}
          count={counts.fees}
        >
          Fees
        </FilterBtn>
      ) : null}
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  count,
  tone = "neutral",
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  tone?: Tone;
  children: React.ReactNode;
}) {
  const fg = TONE_FG[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-[5px] text-[12px] font-medium transition-colors",
        active
          ? "bg-forest-mid text-card-warm"
          : "bg-transparent text-subtle hover:text-ink",
      )}
    >
      {children}
      <span
        className="rounded-[3px] px-1.5 py-px font-mono text-[10.5px] font-semibold tabular-nums"
        style={{
          background: active
            ? "rgba(255,255,255,0.2)"
            : fg
              ? `color-mix(in oklch, ${fg} 12%, transparent)`
              : "var(--color-divider)",
          color: active ? "var(--color-card)" : (fg ?? "var(--color-subtle)"),
        }}
      >
        {count}
      </span>
    </button>
  );
}
