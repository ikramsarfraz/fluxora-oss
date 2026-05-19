"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import type { ReviewCounts, ReviewFilter } from "./types";

// Reproduced from:
//   modules/distribution/supplier-invoices/components/review/review-footer-strip.tsx
//   modules/distribution/supplier-invoices/components/review/filter-segmented.tsx

const REVIEW_COLORS = {
  good: "oklch(58% 0.13 155)",
  warn: "oklch(70% 0.16 70)",
} as const;

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString("en-US");

// ---------- Review footer strip ----------
export function ReviewFooterStrip({
  totalLineCount,
  totalCases,
  totalWeightLbs,
  chargesTotal,
  billTotal,
}: {
  totalLineCount: number;
  totalCases: number;
  totalWeightLbs: number;
  chargesTotal: number;
  billTotal: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3.5 border-t border-border-default bg-card px-[22px] py-3">
      <label className="flex cursor-pointer items-center gap-2 text-[12px] text-subtle">
        <Checkbox defaultChecked />
        Remember my product mappings as aliases for this supplier
      </label>

      <div className="flex items-center gap-5">
        <FooterStat
          label={totalLineCount === 1 ? "Line" : "Lines"}
          value={fmtInt(totalLineCount)}
        />
        <FooterStat label="Cases" value={fmtInt(totalCases)} />
        <FooterStat label="Total weight" value={`${fmt(totalWeightLbs)} lb`} />
        {chargesTotal !== 0 ? (
          <FooterStat label="Charges" value={`$${fmt(chargesTotal)}`} />
        ) : null}

        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Bill total
          </div>
          <div className="font-mono text-[18px] font-bold tabular-nums text-ink">
            ${fmt(billTotal)}
          </div>
        </div>
      </div>
    </div>
  );
}

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {label}
      </div>
      <div className="font-mono text-[13px] font-medium tabular-nums text-ink">
        {value}
      </div>
    </div>
  );
}

// ---------- Filter segmented (production 1:1) ----------
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
  counts: ReviewCounts;
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
