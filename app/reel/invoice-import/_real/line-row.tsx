"use client";

import {
  AlertCircle,
  Calendar,
  Check,
  ChevronDown,
  Plus,
  Scale,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { useReel } from "./reel-state";
import type { FeeCategory, ReviewLine, ReviewLineMatchState } from "./types";

// Reproduced from
//   modules/distribution/supplier-invoices/components/review/line-row.tsx
//   modules/distribution/supplier-invoices/components/review/tokens.ts
// JSX, classes, and inline-style colors copied 1:1 so the reel matches the
// real LineRow + its tone-coded backgrounds. The interactive bits (weight
// editor, lot/expiry editor) collapse to chip buttons only — no expanded
// trays — since the reel never opens them.

const REVIEW_COLORS = {
  accent: "oklch(58% 0.13 242)",
  good: "oklch(58% 0.13 155)",
  goodSoft: "oklch(96% 0.03 155)",
  warn: "oklch(70% 0.16 70)",
  warnSoft: "oklch(96% 0.04 80)",
  danger: "oklch(58% 0.18 25)",
  mutedSoft: "#9a9a93",
  borderStrong: "#d4d1c7",
} as const;

type Tone = "good" | "warn" | "danger" | "fee";

function lineTone(match: ReviewLineMatchState): Tone {
  if (match.kind === "fee") return "fee";
  if (match.kind === "matched") return match.warning ? "warn" : "good";
  if (match.kind === "candidates") return "warn";
  return "danger";
}

function toneColors(tone: Tone, active: boolean) {
  switch (tone) {
    case "good":
      return {
        bar: REVIEW_COLORS.good,
        bg: active ? REVIEW_COLORS.goodSoft : "var(--stone-surface)",
        border: active ? REVIEW_COLORS.good : "var(--stone-line)",
      };
    case "warn":
      return {
        bar: REVIEW_COLORS.warn,
        bg: active ? REVIEW_COLORS.warnSoft : "var(--stone-surface)",
        border: active ? REVIEW_COLORS.warn : "var(--stone-line)",
      };
    case "danger":
      return {
        bar: REVIEW_COLORS.danger,
        bg: active ? "oklch(96% 0.03 25)" : "var(--stone-surface)",
        border: active ? REVIEW_COLORS.danger : "var(--stone-line)",
      };
    case "fee":
      return {
        bar: REVIEW_COLORS.mutedSoft,
        bg: active ? "var(--stone-line2)" : "var(--stone-surface)",
        border: active ? REVIEW_COLORS.borderStrong : "var(--stone-line)",
      };
  }
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const FEE_CATEGORY_LABEL: Record<FeeCategory, string> = {
  fuel: "Fuel surcharge",
  freight: "Freight / delivery",
  processing: "Processing fee",
  inspection: "Inspection fee",
  cod: "COD handling",
  refrigeration: "Refrigeration",
  other: "Other charge",
};

export function LineRow({ line }: { line: ReviewLine }) {
  const { state, dispatch } = useReel();
  const isActive = state.activeLineId === line.id;
  const match = line.match;
  const isFee = match.kind === "fee";
  const isMatched = match.kind === "matched";
  const isWarn = isMatched && match.warning === true;
  const tone = lineTone(match);
  const palette = toneColors(tone, isActive);
  const missingCost = line.unitCost == null && !isFee;

  return (
    <div
      role="button"
      tabIndex={0}
      data-reel={`review-line-${line.id}`}
      aria-current={isActive ? "true" : undefined}
      onClick={() => dispatch({ type: "SET_ACTIVE_LINE", lineId: line.id })}
      className="flex cursor-pointer flex-col border-b border-border-default transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--color-forest-mid)]"
      style={{
        background: palette.bg,
        borderLeft: `3px solid ${isActive ? palette.bar : "transparent"}`,
      }}
    >
      {/* Missing-cost banner above the row, when the line failed to parse a cost */}
      {missingCost ? (
        <div
          role="alert"
          aria-live="polite"
          onClick={(e) => e.stopPropagation()}
          className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-[12px]"
          style={{
            background: "oklch(95% 0.05 25 / 0.55)",
            borderColor: "oklch(48% 0.18 25 / 0.3)",
            color: "oklch(48% 0.18 25)",
          }}
        >
          <AlertCircle className="size-[12px] shrink-0" strokeWidth={1.8} />
          <span className="font-semibold">1 issue:</span>
          <span>Unit cost missing</span>
          <button
            type="button"
            data-reel={`line-${line.id}-fill-cost`}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "FILL_LINE_COST", lineId: line.id, unitCost: 6.15 });
            }}
            className="ml-auto rounded border border-current/30 px-1.5 py-0.5 text-[11px] font-medium hover:bg-white/40"
          >
            Fill from history (6.15)
          </button>
        </div>
      ) : null}

      {/* Cost-diff banner (V-belt jumped 25%) */}
      {line.costDeltaPct != null && line.costDeltaPct >= 18 && isMatched ? (
        <CostDiffStrip
          recordedCost={line.unitCost! / (1 + line.costDeltaPct / 100)}
          liveCost={line.unitCost!}
          productName={match.kind === "matched" ? match.productName : ""}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col gap-2.5 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3.5">
          <div className="min-w-0 flex-1">
            <RawText id={line.id} raw={line.raw} />
            {line.description ? (
              <DescriptionText description={line.description} />
            ) : null}
            {!isFee ? (
              isMatched ? (
                <MatchedStatus match={match} warn={isWarn} />
              ) : (
                <UnmatchedStatus />
              )
            ) : (
              <FeeStatus category={line.feeCategory ?? null} />
            )}
          </div>
          <NumericSnapshot line={line} />
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            title="Remove this line from the bill"
            className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-subtle transition-colors hover:bg-divider hover:text-ink"
          >
            <X className="size-[14px]" strokeWidth={1.8} />
          </button>
        </div>

        {!isFee ? (
          <div className="flex flex-wrap items-stretch gap-2">
            <ProductPicker line={line} />
            {match.kind === "candidates"
              ? match.suggestions.map((c, i) => (
                  <CandidateButton
                    key={i}
                    productName={c.productName}
                    score={c.score}
                    reelTarget={`line-${line.id}-candidate-${i}`}
                    onClick={() =>
                      dispatch({
                        type: "CONFIRM_SUGGESTION",
                        lineId: line.id,
                        productId: c.productId,
                      })
                    }
                  />
                ))
              : null}
            <CreateNewButton
              reelTarget={`line-${line.id}-create`}
              onClick={() =>
                dispatch({
                  type: "OPEN_DIALOG",
                  dialog: {
                    kind: "create-product",
                    lineId: line.id,
                    prefillName: line.description,
                  },
                })
              }
            />
            <WeightChipButton />
            <LotExpiryChipButton />
            {!isMatched ? <SkipButton /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------- Helpers ----------

function RawText({ id, raw }: { id: number; raw: string }) {
  return (
    <div className="mb-1 font-mono text-[11.5px] leading-[1.4] text-subtle">
      <span className="mr-1.5 rounded bg-divider px-1.5 py-px text-[10.5px] font-semibold">
        L{id}
      </span>
      {raw}
    </div>
  );
}

function DescriptionText({ description }: { description: string }) {
  return (
    <div className="mb-1 pl-[26px] text-[11.5px] italic leading-[1.4] text-subtle">
      {description}
    </div>
  );
}

function MatchedStatus({
  match,
  warn,
}: {
  match: Extract<ReviewLineMatchState, { kind: "matched" }>;
  warn: boolean;
}) {
  const color = warn ? REVIEW_COLORS.warn : REVIEW_COLORS.good;
  const bg = warn ? REVIEW_COLORS.warnSoft : REVIEW_COLORS.goodSoft;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="inline-flex items-center gap-1 text-[12px] font-medium"
        style={{ color }}
      >
        {warn ? (
          <TriangleAlert className="size-[14px]" strokeWidth={1.6} />
        ) : (
          <Check className="size-[14px]" strokeWidth={2.4} />
        )}
        {warn ? "Low-confidence match" : "Matched"}
      </span>
      <span className="text-[12px]" style={{ color: REVIEW_COLORS.mutedSoft }}>
        →
      </span>
      <span className="text-[13px] font-semibold text-ink">{match.productName}</span>
      <span className="font-mono text-[11px]" style={{ color: REVIEW_COLORS.mutedSoft }}>
        {match.sku}
      </span>
      <span
        className="rounded px-1.5 py-px font-mono text-[11px] font-semibold tabular-nums"
        style={{ background: bg, color }}
      >
        {match.score}% match
      </span>
      {match.aliasAdded ? (
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-medium text-forest"
          style={{ background: "var(--color-forest-tint)" }}
        >
          <Sparkles className="size-[10px]" strokeWidth={1.8} />
          alias added
        </span>
      ) : null}
    </div>
  );
}

function UnmatchedStatus() {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex items-center gap-1 text-[12px] font-medium"
        style={{ color: REVIEW_COLORS.danger }}
      >
        <AlertCircle className="size-[14px]" strokeWidth={1.6} />
        No match found
      </span>
      <span className="text-[12px] text-subtle">
        · Pick a product or create new
      </span>
    </div>
  );
}

function FeeStatus({ category }: { category: FeeCategory | null }) {
  const label = category ? FEE_CATEGORY_LABEL[category] : "Non-inventory charge";
  return (
    <div className="inline-flex items-center gap-1.5 text-[12px] font-medium text-subtle">
      <span>{label}</span>
      <span className="rounded bg-divider px-1.5 py-px text-[11px]">
        {category ? "Fee" : "Uncategorized"}
      </span>
    </div>
  );
}

function NumericSnapshot({ line }: { line: ReviewLine }) {
  const isFee = line.match.kind === "fee";
  const missing = line.unitCost == null && !isFee;
  return (
    <div className="flex shrink-0 flex-col items-end pl-3.5 text-right">
      <div
        className={cn(
          "font-mono text-[15px] font-semibold tabular-nums",
          missing ? "text-danger-fg" : "text-ink",
        )}
      >
        {missing ? "—" : `$${fmt(line.total)}`}
      </div>
      <div
        className="mt-0.5 flex items-center gap-1 font-mono text-[11px] tabular-nums"
        style={{ color: REVIEW_COLORS.mutedSoft }}
      >
        <span>{line.cases}</span>
        <span>×</span>
        <span>
          {line.weight > 0
            ? `${line.weight.toFixed(2)}lb`
            : isFee
              ? "flat"
              : `${line.cases}${line.unit === "box" ? "bx" : "cs"}`}
        </span>
        <span>@ ${missing ? "0.00" : line.unitPrice.toFixed(2)}</span>
        <span>{line.weight > 0 ? "/lb" : `/${line.unit === "box" ? "bx" : "cs"}`}</span>
      </div>
    </div>
  );
}

// ---------- Product picker (reel uses a static-looking input — production
// uses base-UI Combobox which is heavy to mock; the visual reads the same) ----------
function ProductPicker({ line }: { line: ReviewLine }) {
  const match = line.match;
  const isMatched = match.kind === "matched";
  const placeholder = isMatched
    ? `Confirmed: ${match.productName}`
    : "Search product or paste SKU…";
  return (
    <div
      data-reel={`line-${line.id}-picker`}
      className={cn(
        "flex h-9 min-w-[260px] flex-1 items-center gap-2 rounded-[7px] border bg-card px-3 text-[12.5px] transition-colors",
        isMatched
          ? "border-border-default text-ink"
          : "border-border-default text-subtle",
      )}
    >
      <span className="truncate">{placeholder}</span>
      <ChevronDown className="ml-auto size-[14px] shrink-0 text-subtle" />
    </div>
  );
}

function CandidateButton({
  productName,
  score,
  reelTarget,
  onClick,
}: {
  productName: string;
  score: number;
  reelTarget: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-reel={reelTarget}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-2 rounded-[7px] border border-border-default bg-card py-1 pl-2.5 pr-1 text-[12px] text-ink transition-colors hover:bg-divider"
    >
      <Sparkles
        className="size-[12px]"
        strokeWidth={1.6}
        style={{ color: REVIEW_COLORS.accent }}
      />
      <span className="font-medium">{productName}</span>
      <span className="rounded bg-divider px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums text-subtle">
        {score}%
      </span>
    </button>
  );
}

function CreateNewButton({
  reelTarget,
  onClick,
}: {
  reelTarget: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-reel={reelTarget}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-1 rounded-[7px] bg-card px-2.5 py-1 text-[12px] text-subtle transition-colors hover:text-ink"
      style={{ border: `1px dashed ${REVIEW_COLORS.borderStrong}` }}
    >
      <Plus className="size-[12px]" strokeWidth={1.8} />
      Create new
    </button>
  );
}

function SkipButton() {
  return (
    <button
      type="button"
      onClick={(e) => e.stopPropagation()}
      className="bg-transparent px-2.5 py-1 text-[12px] transition-colors hover:text-ink"
      style={{ color: REVIEW_COLORS.mutedSoft }}
    >
      Skip this line
    </button>
  );
}

function WeightChipButton() {
  return (
    <button
      type="button"
      onClick={(e) => e.stopPropagation()}
      title="Edit per-case weights"
      className="inline-flex items-center gap-1 rounded-[7px] border border-border-default bg-card px-2.5 py-1 text-[12px] text-subtle transition-colors hover:text-ink"
    >
      <Scale className="size-[12px]" strokeWidth={1.8} />
      Set weights
      <ChevronDown className="size-[12px]" strokeWidth={1.8} />
    </button>
  );
}

function LotExpiryChipButton() {
  return (
    <button
      type="button"
      onClick={(e) => e.stopPropagation()}
      title="Edit lot number and expiry"
      className="inline-flex items-center gap-1 rounded-[7px] border border-border-default bg-card px-2.5 py-1 text-[12px] text-subtle transition-colors hover:text-ink"
    >
      <Calendar className="size-[12px]" strokeWidth={1.8} />
      Set lot / expiry
      <ChevronDown className="size-[12px]" strokeWidth={1.8} />
    </button>
  );
}

// ---------- Cost-diff banner (slim variant rendered ABOVE the row) ----------
function CostDiffStrip({
  recordedCost,
  liveCost,
  productName,
}: {
  recordedCost: number;
  liveCost: number;
  productName: string;
}) {
  const deltaPct = ((liveCost - recordedCost) / recordedCost) * 100;
  const accent = "oklch(60% 0.16 35)";
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex flex-wrap items-center gap-3 border-b px-4 py-2 text-[12px]"
      style={{
        background: "color-mix(in oklch, var(--color-warning-bg) 90%, transparent)",
        borderColor: "color-mix(in oklch, var(--color-warning-fg) 30%, transparent)",
        color: "var(--color-forest-mid)",
      }}
    >
      <div className="inline-flex items-center gap-1.5 font-medium">
        <TriangleAlert
          className="size-[12px] shrink-0"
          strokeWidth={1.8}
          style={{ color: accent }}
        />
        <span>
          Cost changed for this supplier
          {productName ? (
            <span className="text-subtle"> · {productName}</span>
          ) : null}
        </span>
      </div>
      <div className="inline-flex items-baseline gap-1.5 font-mono tabular-nums">
        <span className="text-subtle">${recordedCost.toFixed(4)}</span>
        <span className="text-subtle">→</span>
        <span className="font-semibold">${liveCost.toFixed(4)}</span>
        <span className="font-medium" style={{ color: accent }}>
          (+{deltaPct.toFixed(1)}%)
        </span>
      </div>
      <label
        className="ml-auto inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-medium"
        style={{
          color: accent,
          background: "transparent",
          border: "1px solid transparent",
        }}
      >
        <input
          type="checkbox"
          readOnly
          className="size-[13px] cursor-pointer"
          style={{ accentColor: accent }}
        />
        Acknowledge
      </label>
    </div>
  );
}
