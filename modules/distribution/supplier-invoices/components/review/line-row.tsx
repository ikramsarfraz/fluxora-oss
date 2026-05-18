"use client";

import {
  AlertCircle,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Scale,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

import {
  LineCostDiffBanner,
  type LineCostAckKey,
} from "./line-cost-diff-banner";
import {
  LineLotExpiryEditor,
  type LineLotExpiryState,
} from "./line-lot-expiry-editor";
import {
  LineWeightEditor,
  type LineWeightState,
} from "./line-weight-editor";
import type { ProductLookup } from "./map-pipeline-to-review-data";
import { ProductPicker } from "./product-picker";
import { REVIEW_COLORS, toneColors } from "./tokens";
import { lineTone, type ParsedLine, type ProductCandidate } from "./types";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Render-side shape of one line's cost-diff banner data. Mirrors the
 *  fields LineCostDiffBanner needs plus the ack key the container uses
 *  to flip the ack state. */
export type LineCostDiffData = {
  variant: "changed" | "new";
  recordedCostPerLb: string | null;
  liveCostPerLb: string;
  productName: string;
  dependentCustomerCount: number;
  acknowledged: boolean;
  ackKey: LineCostAckKey;
};

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
  weightEditorState,
  isWeightEditorOpen,
  onToggleWeightEditor,
  onWeightEditorChange,
  lotExpiryState,
  isLotExpiryEditorOpen,
  onToggleLotExpiryEditor,
  onLotExpiryEditorChange,
  costDiff,
  onToggleCostAck,
  onDelete,
  onCasesChange,
  submitErrors,
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
  /**
   * Inline weight-editor state for this line (when the user has opened
   * the tray). Null when never opened. When non-null + isWeightEditorOpen
   * is true, the editor renders below the row.
   */
  weightEditorState?: LineWeightState | null;
  isWeightEditorOpen?: boolean;
  onToggleWeightEditor?: () => void;
  onWeightEditorChange?: (next: LineWeightState) => void;
  /**
   * Per-line lot/expiry override state + tray-open flag. Same pattern as
   * the weight editor — null = never opened; the toggle handler seeds it
   * on first open so closing without edits is a no-op.
   */
  lotExpiryState?: LineLotExpiryState | null;
  isLotExpiryEditorOpen?: boolean;
  onToggleLotExpiryEditor?: () => void;
  onLotExpiryEditorChange?: (next: LineLotExpiryState) => void;
  /**
   * Cost-diff banner data for this line (or null when there's no recorded
   * cost change vs the live cost-per-lb). When non-null, renders the
   * banner above the row's content.
   */
  costDiff?: LineCostDiffData | null;
  onToggleCostAck?: (key: LineCostAckKey) => void;
  /**
   * When supplied, renders a small × button on the right edge of the
   * line that removes the line from view AND from the submit payload.
   * Container tracks deleted lines in a Set so the user can restore
   * them via the footer notice.
   */
  onDelete?: () => void;
  /**
   * Edit the case-count for this line — replaces the read-only digit
   * in the NumericSnapshot with an inline +/- stepper. Used by the
   * reviewer to fix parser misreads (e.g. "1B" parsed as 18, merged
   * columns).
   */
  onCasesChange?: (cases: number) => void;
  /**
   * Per-line validation errors from the most recent rejected submit
   * (parsed out of the server action's Zod issues by the container).
   * Renders a red banner above the row when non-null/non-empty.
   */
  submitErrors?: string[] | null;
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
      aria-current={isActive ? "true" : undefined}
      aria-label={
        match.status === "matched"
          ? `Line ${line.id}: matched to ${match.product}`
          : match.status === "fee"
            ? `Line ${line.id}: non-inventory charge`
            : `Line ${line.id}: needs product match`
      }
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="flex cursor-pointer flex-col border-b border-stone-line transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--stone-ink)]"
      style={{
        background: palette.bg,
        borderLeft: `3px solid ${isActive ? palette.bar : "transparent"}`,
      }}
    >
      {submitErrors && submitErrors.length > 0 ? (
        <div
          role="alert"
          aria-live="polite"
          onClick={e => e.stopPropagation()}
          className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-[12px]"
          style={{
            background: "oklch(95% 0.05 25 / 0.55)",
            borderColor: "oklch(48% 0.18 25 / 0.3)",
            color: "oklch(48% 0.18 25)",
          }}
        >
          <AlertCircle
            className="size-[12px] shrink-0"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <span className="font-semibold">
            {submitErrors.length === 1
              ? "1 issue:"
              : `${submitErrors.length} issues:`}
          </span>
          <span>{submitErrors.join(" · ")}</span>
        </div>
      ) : null}
      {!isFee && costDiff && onToggleCostAck ? (
        <LineCostDiffBanner
          variant={costDiff.variant}
          recordedCostPerLb={costDiff.recordedCostPerLb}
          liveCostPerLb={costDiff.liveCostPerLb}
          productName={costDiff.productName}
          dependentCustomerCount={costDiff.dependentCustomerCount}
          acknowledged={costDiff.acknowledged}
          onToggleAck={() => onToggleCostAck(costDiff.ackKey)}
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3.5">
          <div className="min-w-0 flex-1">
            <RawText id={line.id} raw={line.raw} />
            {line.description ? <DescriptionText description={line.description} /> : null}
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
          <NumericSnapshot line={line} onCasesChange={onCasesChange} />
          {onDelete ? (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onDelete();
              }}
              title="Remove this line from the bill"
              className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-stone-muted transition-colors hover:bg-stone-line2 hover:text-stone-ink"
            >
              <X className="size-[14px]" strokeWidth={1.8} />
            </button>
          ) : null}
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
            {onToggleWeightEditor ? (
              <WeightChipButton
                isOpen={isWeightEditorOpen === true}
                hasOverride={weightEditorState != null}
                onClick={onToggleWeightEditor}
              />
            ) : null}
            {onToggleLotExpiryEditor ? (
              <LotExpiryChipButton
                isOpen={isLotExpiryEditorOpen === true}
                hasOverride={
                  lotExpiryState != null &&
                  (lotExpiryState.lotNumberOverride.trim().length > 0 ||
                    lotExpiryState.expirationDateOverride.trim().length > 0)
                }
                onClick={onToggleLotExpiryEditor}
              />
            ) : null}
            {!isMatched ? <SkipButton onClick={onSkip} /> : null}
          </div>
        ) : null}

        {!isFee &&
        isWeightEditorOpen === true &&
        weightEditorState != null &&
        onWeightEditorChange ? (
          <LineWeightEditor
            quantityCases={line.cases}
            state={weightEditorState}
            onChange={onWeightEditorChange}
            onClose={onToggleWeightEditor}
          />
        ) : null}

        {!isFee &&
        isLotExpiryEditorOpen === true &&
        lotExpiryState != null &&
        onLotExpiryEditorChange ? (
          <LineLotExpiryEditor
            state={lotExpiryState}
            onChange={onLotExpiryEditorChange}
            onClose={onToggleLotExpiryEditor}
          />
        ) : null}
      </div>
    </div>
  );
}

function LotExpiryChipButton({
  isOpen,
  hasOverride,
  onClick,
}: {
  isOpen: boolean;
  hasOverride: boolean;
  onClick: () => void;
}) {
  const baseLabel = hasOverride
    ? "Edit lot number and expiry (overridden)"
    : "Edit lot number and expiry";
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        onClick();
      }}
      title={baseLabel}
      aria-label={baseLabel}
      aria-expanded={isOpen}
      className={cn(
        "inline-flex items-center gap-1 rounded-[7px] border bg-stone-surface px-2.5 py-1 text-[12px] transition-colors",
        hasOverride
          ? "border-stone-ink text-stone-ink"
          : "border-stone-line text-stone-muted hover:text-stone-ink",
      )}
    >
      <Calendar className="size-[12px]" strokeWidth={1.8} aria-hidden="true" />
      {isOpen ? (
        <>
          Hide lot
          <ChevronUp className="size-[12px]" strokeWidth={1.8} aria-hidden="true" />
        </>
      ) : (
        <>
          {hasOverride ? "Lot set" : "Set lot / expiry"}
          <ChevronDown className="size-[12px]" strokeWidth={1.8} aria-hidden="true" />
        </>
      )}
    </button>
  );
}

function WeightChipButton({
  isOpen,
  hasOverride,
  onClick,
}: {
  isOpen: boolean;
  hasOverride: boolean;
  onClick: () => void;
}) {
  const baseLabel = hasOverride
    ? "Edit per-case weights (overridden)"
    : "Edit per-case weights";
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        onClick();
      }}
      title={baseLabel}
      aria-label={baseLabel}
      aria-expanded={isOpen}
      className={cn(
        "inline-flex items-center gap-1 rounded-[7px] border bg-stone-surface px-2.5 py-1 text-[12px] transition-colors",
        hasOverride
          ? "border-stone-ink text-stone-ink"
          : "border-stone-line text-stone-muted hover:text-stone-ink",
      )}
    >
      <Scale className="size-[12px]" strokeWidth={1.8} aria-hidden="true" />
      {isOpen ? (
        <>
          Hide weights
          <ChevronUp className="size-[12px]" strokeWidth={1.8} aria-hidden="true" />
        </>
      ) : (
        <>
          {hasOverride ? "Weights set" : "Set weights"}
          <ChevronDown className="size-[12px]" strokeWidth={1.8} aria-hidden="true" />
        </>
      )}
    </button>
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

function DescriptionText({ description }: { description: string }) {
  // Secondary description from the invoice's Description column — rendered as
  // smaller, muted, non-monospaced text just below the product name so the
  // user can read it for context without confusing it with the matchable
  // product name.
  return (
    <div className="mb-1 pl-[26px] text-[11.5px] italic leading-[1.4] text-stone-muted">
      {description}
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

// Human-readable labels for the parser's fee taxonomy. Kept inside the
// component file because the label set is purely presentational — the
// canonical category list lives in `ai-validation.ts`.
const FEE_CATEGORY_LABEL: Record<NonNullable<ParsedLine["feeCategory"]>, string> = {
  fuel: "Fuel surcharge",
  freight: "Freight / delivery",
  processing: "Processing fee",
  inspection: "Inspection fee",
  cod: "COD handling",
  refrigeration: "Refrigeration",
  other: "Other charge",
};

function FeeStatus({
  category,
}: {
  category: ParsedLine["feeCategory"] | null;
}) {
  const label = category ? FEE_CATEGORY_LABEL[category] : "Non-inventory charge";
  return (
    <div className="inline-flex items-center gap-1.5 text-[12px] font-medium text-stone-muted">
      <span>{label}</span>
      <span className="rounded bg-stone-line2 px-1.5 py-px text-[11px]">
        {category ? "Fee" : "Uncategorized"}
      </span>
    </div>
  );
}

function NumericSnapshot({
  line,
  onCasesChange,
}: {
  line: ParsedLine;
  onCasesChange?: (cases: number) => void;
}) {
  const isFee = line.match.status === "fee";
  // Fees don't have an editable case count (they're flat amounts) — only
  // matched / unmatched product lines do.
  const showStepper = !isFee && onCasesChange != null;
  return (
    <div className="flex shrink-0 flex-col items-end pl-3.5 text-right">
      <div className="font-mono text-[15px] font-semibold tabular-nums text-stone-ink">
        ${fmt(line.total)}
      </div>
      <div
        className="mt-0.5 flex items-center gap-1 font-mono text-[11px] tabular-nums"
        style={{ color: REVIEW_COLORS.mutedSoft }}
      >
        {showStepper ? (
          <CasesStepper
            value={line.cases}
            onChange={onCasesChange!}
          />
        ) : (
          <span>{line.cases}</span>
        )}
        <span>×</span>
        <span>
          {line.weight > 0
            ? `${line.weight.toFixed(2)}lb`
            : isFee
              ? "flat"
              : `${line.cases}cs`}
        </span>
        <span>@ ${line.unitPrice.toFixed(2)}</span>
        <span>{line.weight > 0 ? "/lb" : "/cs"}</span>
      </div>
    </div>
  );
}

/** Compact inline number editor with +/- buttons. Used for case-count
 *  edits in NumericSnapshot — typeable AND clickable so the user can
 *  bump by 1 or paste a corrected value. */
function CasesStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (cases: number) => void;
}) {
  return (
    <span
      onClick={e => e.stopPropagation()}
      className="inline-flex items-stretch overflow-hidden rounded-md border border-stone-line bg-stone-surface"
    >
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          onChange(Math.max(0, value - 1));
        }}
        title="Decrease cases"
        aria-label="Decrease cases"
        className="flex w-5 items-center justify-center text-stone-muted transition-colors hover:text-stone-ink"
      >
        −
      </button>
      <input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={e => {
          const next = Number.parseInt(e.target.value, 10);
          onChange(Number.isFinite(next) ? next : 0);
        }}
        onClick={e => e.stopPropagation()}
        aria-label="Case count"
        // Width fits up to ~3 digits; longer typing scrolls inside the
        // input rather than expanding the row.
        className="h-5 w-9 border-x border-stone-line bg-stone-surface text-center font-mono text-[11px] tabular-nums text-stone-ink outline-none focus:bg-stone-line2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          onChange(value + 1);
        }}
        title="Increase cases"
        aria-label="Increase cases"
        className="flex w-5 items-center justify-center text-stone-muted transition-colors hover:text-stone-ink"
      >
        +
      </button>
    </span>
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
