"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Lightbulb,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { DuplicateMatch, PriceDeviation } from "./types";

// Reproduced from:
//   modules/distribution/supplier-invoices/components/review/duplicate-invoice-banner.tsx
//   modules/distribution/supplier-invoices/components/review/price-change-banner.tsx
// JSX + inline styles copied 1:1.

const REVIEW_COLORS = {
  good: "oklch(58% 0.13 155)",
  warn: "oklch(70% 0.16 70)",
  warnSoft: "oklch(96% 0.04 80)",
  danger: "oklch(58% 0.18 25)",
  mutedSoft: "#9a9a93",
} as const;

// ---------- Duplicate invoice banner ----------
export function DuplicateInvoiceBanner({ matches }: { matches: DuplicateMatch[] }) {
  if (matches.length === 0) return null;
  const allSoft = matches.every((m) => m.matchedBy === "date_and_total");
  const isOne = matches.length === 1;

  const headline = allSoft
    ? isOne
      ? "Possible duplicate (same date + amount)"
      : `${matches.length} possible duplicates (same date + amount)`
    : isOne
      ? "Already posted for this supplier"
      : `${matches.length} existing bills with this invoice number`;

  return (
    <div
      className="shrink-0 border-b border-border-default"
      style={{
        background: allSoft
          ? `color-mix(in oklch, ${REVIEW_COLORS.danger} 4%, transparent)`
          : `color-mix(in oklch, ${REVIEW_COLORS.danger} 8%, transparent)`,
      }}
    >
      <div className="flex items-start gap-2.5 px-[22px] py-2.5">
        <AlertTriangle
          className="mt-0.5 size-[16px] shrink-0"
          strokeWidth={2}
          style={{ color: REVIEW_COLORS.danger }}
        />
        <div className="min-w-0 flex-1">
          <div
            className="text-[13px] font-semibold"
            style={{ color: REVIEW_COLORS.danger }}
          >
            {headline}
          </div>
          <ul className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-subtle">
            {matches.map((m) => (
              <li key={m.id} className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-mono text-ink underline decoration-border-default underline-offset-2",
                  )}
                >
                  {m.referenceNumber}
                  <ExternalLink className="size-[10px]" strokeWidth={2} />
                </span>
                <span className="tabular-nums">
                  {m.invoiceDate} · ${Number(m.totalAmount).toFixed(2)}
                </span>
                <StatusPill status={m.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const isFinalized = status !== "draft";
  return (
    <span
      className="rounded px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-[0.04em]"
      style={{
        background: isFinalized
          ? `color-mix(in oklch, ${REVIEW_COLORS.danger} 12%, transparent)`
          : "var(--color-divider)",
        color: isFinalized ? REVIEW_COLORS.danger : "var(--color-subtle)",
      }}
    >
      {status}
    </span>
  );
}

// ---------- Price change banner ----------
export function PriceChangeBanner({ deviations }: { deviations: PriceDeviation[] }) {
  const [expanded, setExpanded] = useState(false);
  if (deviations.length === 0) return null;

  const sorted = [...deviations].sort(
    (a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct),
  );
  const ups = sorted.filter((d) => d.deviationPct > 0).length;
  const downs = sorted.length - ups;

  return (
    <div
      className="shrink-0 border-b border-border-default"
      style={{ background: REVIEW_COLORS.warnSoft }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        data-reel="price-change-toggle"
        className="flex w-full items-center justify-between gap-3 px-[22px] py-2.5 text-left transition-colors hover:bg-[color:var(--color-divider)]"
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
            {deviations.length === 1 ? "price changed" : "prices changed"}{" "}
            <span className="font-normal text-subtle">
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
            "size-[14px] shrink-0 text-subtle transition-transform",
            expanded && "rotate-180",
          )}
          strokeWidth={1.6}
        />
      </button>

      {expanded ? (
        <ul className="border-t border-border-default bg-card">
          {sorted.map((d) => (
            <DeviationRow key={d.productId} deviation={d} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DeviationRow({ deviation }: { deviation: PriceDeviation }) {
  const up = deviation.deviationPct > 0;
  const arrowColor = up ? REVIEW_COLORS.danger : REVIEW_COLORS.good;

  return (
    <li className="flex items-center justify-between gap-3 border-b border-border-default px-[22px] py-2 last:border-b-0">
      <span className="min-w-0 truncate text-[12.5px] text-ink">
        {deviation.productName}
      </span>
      <div className="flex shrink-0 items-center gap-2.5 text-[12px] tabular-nums">
        <span style={{ color: REVIEW_COLORS.mutedSoft }}>
          ${deviation.lastUnitPrice.toFixed(2)}
        </span>
        <span style={{ color: REVIEW_COLORS.mutedSoft }}>→</span>
        <span className="font-semibold text-ink">
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

// ---------- PDF hint (left-half of the bottom bar) ----------
export function PdfHint() {
  return (
    <div className="flex items-center gap-2 border-r border-border-default bg-card px-[22px] py-3 text-[11.5px] text-subtle">
      <Lightbulb className="size-3.5" strokeWidth={1.8} />
      <span>
        Click a line on the right to highlight where it came from on the PDF.
        Keyboard arrows step through the queue.
      </span>
    </div>
  );
}
