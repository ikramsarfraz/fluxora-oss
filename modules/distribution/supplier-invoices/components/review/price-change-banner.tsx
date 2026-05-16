"use client";

import { useState } from "react";
import { ChevronDown, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

import { REVIEW_COLORS } from "./tokens";
import type { ParsedPriceDeviation } from "./types";

/**
 * Roll-up banner above the line items section showing how many product
 * prices moved since the supplier's last invoice. Meat prices move
 * week-to-week — surfacing the aggregate ("3 prices changed >5%") nudges
 * the user to compare before posting instead of discovering it on a
 * margin report next month.
 *
 * Collapsed by default. Clicking the row expands to a short list with
 * old → new prices and a percent delta per product.
 */
export function PriceChangeBanner({
  deviations,
}: {
  deviations: ParsedPriceDeviation[];
}) {
  const [expanded, setExpanded] = useState(false);
  if (deviations.length === 0) return null;

  // Sort by absolute movement so the biggest swings are at the top of
  // the expanded list — that's where the user's eye lands first.
  const sorted = [...deviations].sort(
    (a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct),
  );
  const ups = sorted.filter(d => d.deviationPct > 0).length;
  const downs = sorted.length - ups;

  return (
    <div
      className="shrink-0 border-b border-stone-line"
      // Soft warning tone — informational, not blocking.
      style={{ background: REVIEW_COLORS.warnSoft }}
    >
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center justify-between gap-3 px-[22px] py-2.5 text-left transition-colors hover:bg-[color:var(--stone-line2)]"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="inline-flex size-5 items-center justify-center rounded-full"
            style={{ background: "rgba(0,0,0,0.05)" }}
          >
            <TrendingUp
              className="size-[14px]"
              strokeWidth={2}
              style={{ color: REVIEW_COLORS.warn }}
            />
          </span>
          <span
            className="truncate text-[13px] font-medium"
            style={{ color: REVIEW_COLORS.warn }}
          >
            {deviations.length}{" "}
            {deviations.length === 1 ? "price changed" : "prices changed"}
            {" "}
            <span className="font-normal text-stone-muted">
              since the last invoice from this supplier
              {ups > 0 && downs > 0
                ? ` (${ups} up · ${downs} down)`
                : ups > 0
                  ? ` (all up)`
                  : ` (all down)`}
            </span>
          </span>
        </div>
        <ChevronDown
          className={cn(
            "size-[14px] shrink-0 text-stone-muted transition-transform",
            expanded && "rotate-180",
          )}
          strokeWidth={1.6}
        />
      </button>

      {expanded ? (
        <ul className="border-t border-stone-line bg-stone-surface">
          {sorted.map(d => (
            <DeviationRow key={d.productId} deviation={d} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DeviationRow({ deviation }: { deviation: ParsedPriceDeviation }) {
  const up = deviation.deviationPct > 0;
  const arrowColor = up ? REVIEW_COLORS.danger : REVIEW_COLORS.good;

  return (
    <li className="flex items-center justify-between gap-3 border-b border-stone-line px-[22px] py-2 last:border-b-0">
      <span className="min-w-0 truncate text-[12.5px] text-stone-ink">
        {deviation.productName}
      </span>
      <div className="flex shrink-0 items-center gap-2.5 text-[12px] tabular-nums">
        <span style={{ color: REVIEW_COLORS.mutedSoft }}>
          ${deviation.lastUnitPrice.toFixed(2)}
        </span>
        <span style={{ color: REVIEW_COLORS.mutedSoft }}>→</span>
        <span className="font-semibold text-stone-ink">
          ${deviation.parsedUnitPrice.toFixed(2)}
        </span>
        <span
          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold"
          style={{
            background: up
              ? `color-mix(in oklch, ${REVIEW_COLORS.danger} 10%, transparent)`
              : `color-mix(in oklch, ${REVIEW_COLORS.good} 10%, transparent)`,
            color: arrowColor,
          }}
        >
          {up ? (
            <TrendingUp className="size-[10px]" strokeWidth={2.4} />
          ) : (
            <TrendingDown className="size-[10px]" strokeWidth={2.4} />
          )}
          {up ? "+" : ""}
          {deviation.deviationPct.toFixed(1)}%
        </span>
      </div>
    </li>
  );
}
