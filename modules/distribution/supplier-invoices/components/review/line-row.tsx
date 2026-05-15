"use client";

import { AlertCircle, Check, Plus, Sparkles, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ProductLookup } from "./map-pipeline-to-review-data";
import { ProductPicker } from "./product-picker";
import { REVIEW_COLORS, toneColors } from "./tokens";
import { lineTone, type ParsedLine, type ProductCandidate } from "./types";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function LineRow({
  line,
  isActive,
  onClick,
  onSelectCandidate,
  onSelectProduct,
  onSkip,
  onCreateNew,
  products,
  matchedProductId,
}: {
  line: ParsedLine;
  isActive: boolean;
  onClick: () => void;
  onSelectCandidate?: (candidate: ProductCandidate) => void;
  /** Called when the user picks from the autocomplete dropdown. */
  onSelectProduct?: (product: ProductLookup) => void;
  onSkip?: () => void;
  onCreateNew?: () => void;
  /** Catalog products for the autocomplete dropdown. */
  products?: ProductLookup[];
  /** Currently matched product id (used to drive the picker's selected state). */
  matchedProductId?: string | null;
}) {
  const match = line.match;
  const isFee = match.status === "fee";
  const isMatched = match.status === "matched";
  const isWarn = isMatched && !!match.warning;
  const tone = lineTone(match);
  const palette = toneColors(tone, isActive);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="flex cursor-pointer border-b border-stone-line transition-colors"
      style={{
        background: palette.bg,
        borderLeft: `3px solid ${isActive ? palette.bar : "transparent"}`,
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3.5">
          <div className="min-w-0 flex-1">
            <RawText id={line.id} raw={line.raw} />
            {!isFee ? (
              isMatched ? (
                <MatchedStatus match={match} warn={isWarn} />
              ) : (
                <UnmatchedStatus />
              )
            ) : (
              <FeeStatus />
            )}
          </div>
          <NumericSnapshot line={line} />
        </div>

        {!isFee ? (
          <div className="flex flex-wrap items-stretch gap-2">
            <ProductPicker
              products={products ?? []}
              selectedId={matchedProductId ?? null}
              placeholder={
                isMatched && match.status === "matched"
                  ? `Confirmed: ${match.product}`
                  : "Search product or paste SKU…"
              }
              onValueChange={p => {
                if (p) onSelectProduct?.(p);
              }}
            />
            {!isMatched && match.candidates.length > 0
              ? match.candidates.map((candidate, i) => (
                  <CandidateButton
                    key={i}
                    candidate={candidate}
                    onClick={() => onSelectCandidate?.(candidate)}
                  />
                ))
              : null}
            <CreateNewButton onClick={onCreateNew} />
            {!isMatched ? <SkipButton onClick={onSkip} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RawText({ id, raw }: { id: number; raw: string }) {
  return (
    <div className="mb-1 font-mono text-[11.5px] leading-[1.4] text-stone-muted">
      <span className="mr-1.5 rounded bg-stone-line2 px-1.5 py-px text-[10.5px] font-semibold">
        L{id}
      </span>
      {raw}
    </div>
  );
}

function MatchedStatus({
  match,
  warn,
}: {
  match: Extract<ParsedLine["match"], { status: "matched" }>;
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
      <span className="text-[13px] font-semibold text-stone-ink">{match.product}</span>
      <span className="font-mono text-[11px]" style={{ color: REVIEW_COLORS.mutedSoft }}>
        {match.sku}
      </span>
      <span
        className="rounded px-1.5 py-px font-mono text-[11px] font-semibold tabular-nums"
        style={{ background: bg, color }}
      >
        {match.score}% match
      </span>
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
      <span className="text-[12px] text-stone-muted">· Pick a product or create new</span>
    </div>
  );
}

function FeeStatus() {
  return (
    <div className="inline-flex items-center gap-1.5 text-[12px] font-medium text-stone-muted">
      <span>Non-inventory charge</span>
      <span className="rounded bg-stone-line2 px-1.5 py-px text-[11px]">Fee</span>
    </div>
  );
}

function NumericSnapshot({ line }: { line: ParsedLine }) {
  const isFee = line.match.status === "fee";
  return (
    <div className="shrink-0 pl-3.5 text-right">
      <div className="font-mono text-[15px] font-semibold tabular-nums text-stone-ink">
        ${fmt(line.total)}
      </div>
      <div
        className="mt-0.5 font-mono text-[11px] tabular-nums"
        style={{ color: REVIEW_COLORS.mutedSoft }}
      >
        {line.cases}×{" "}
        {line.weight > 0
          ? `${line.weight.toFixed(2)}lb`
          : isFee
            ? "flat"
            : `${line.cases}cs`}{" "}
        @ ${line.unitPrice.toFixed(2)}
        {line.weight > 0 ? "/lb" : "/cs"}
      </div>
    </div>
  );
}

function CandidateButton({
  candidate,
  onClick,
}: {
  candidate: ProductCandidate;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        onClick?.();
      }}
      className="inline-flex items-center gap-2 rounded-[7px] border border-stone-line bg-stone-surface py-1 pl-2.5 pr-1 text-[12px] text-stone-ink transition-colors hover:bg-stone-line2"
    >
      <Sparkles
        className="size-[12px]"
        strokeWidth={1.6}
        style={{ color: REVIEW_COLORS.accent }}
      />
      <span className="font-medium">{candidate.name}</span>
      <span className="rounded bg-stone-line2 px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums text-stone-muted">
        {candidate.score}%
      </span>
    </button>
  );
}

function CreateNewButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-[7px] bg-stone-surface px-2.5 py-1 text-[12px] text-stone-muted transition-colors hover:text-stone-ink",
      )}
      style={{ border: `1px dashed ${REVIEW_COLORS.borderStrong}` }}
    >
      <Plus className="size-[12px]" strokeWidth={1.8} />
      Create new
    </button>
  );
}

function SkipButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        onClick?.();
      }}
      className="bg-transparent px-2.5 py-1 text-[12px] transition-colors hover:text-stone-ink"
      style={{ color: REVIEW_COLORS.mutedSoft }}
    >
      Skip this line
    </button>
  );
}
