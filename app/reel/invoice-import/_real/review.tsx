"use client";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Plus,
  Receipt,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { MOCK_PRODUCTS, fmtAmount, fmtDate } from "./mock-data";
import { useReel } from "./reel-state";
import type { ReviewLine } from "./types";

// Visual replica of
// modules/distribution/supplier-invoices/components/review/review-screen.tsx
// (745 LoC of production). Keeps the same JSX shell, header card, line-row
// shape, and bill-total bar so the reel reads as the real product. Skips
// the virtualizer, weight tray, lot/expiry editor, and charges panel — none
// fire in the autopilot script.

export function ReviewScreen() {
  const { state, dispatch } = useReel();
  const review = state.review;
  if (!review) return null;

  const productLines = review.lines.filter((l) => l.match.kind !== "fee");
  const feeLines = review.lines.filter((l) => l.match.kind === "fee");

  const computedTotal = review.lines.reduce(
    (s, l) => s + (l.unitCost == null ? 0 : l.qty * l.unitCost),
    0,
  );

  const hasUnmatched = review.lines.some((l) => l.match.kind === "unmatched");
  const hasMissingCost = review.lines.some((l) => l.unitCost == null);
  const submitDisabled = !review.supplierId || hasMissingCost || hasUnmatched;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-page">
      <ReviewTopBar submitDisabled={submitDisabled} />

      {/* Two-pane row */}
      <div className="flex min-h-0 min-w-0 flex-1">
        {/* PDF pane */}
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden border-r border-border-default bg-surface/30">
          <PdfPane />
        </div>

        {/* Form pane */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-page">
          <HeaderCard />

          {/* Price-change banner (V-belt has 25% cost spike) */}
          {review.lines.some((l) => (l.costDeltaPct ?? 0) >= 18) ? (
            <div
              className="flex items-center gap-2 border-b border-border-default px-4 py-2 text-[12px]"
              style={{
                background: "oklch(96% 0.04 80)",
                color: "oklch(50% 0.14 70)",
              }}
            >
              <AlertTriangle className="size-3.5 shrink-0" strokeWidth={1.8} />
              <span>
                <span className="font-semibold">1 cost change</span> — V-belt A52
                up <span className="font-mono tabular-nums">25%</span> vs last bill
              </span>
              <button
                type="button"
                className="ml-auto text-[11.5px] font-medium hover:underline"
              >
                Review
              </button>
            </div>
          ) : null}

          {/* Line items section */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-3.5 border-b border-border-default bg-card px-[22px] py-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[15px] font-medium text-ink">Line items</h2>
                <span className="rounded bg-divider px-1.5 py-0.5 font-mono text-[11px] text-subtle">
                  {productLines.length}
                </span>
              </div>
              <FilterSegmented productCount={productLines.length} feeCount={feeLines.length} />
            </div>

            <div className="h-0 min-h-0 flex-1 overflow-y-auto bg-page pb-16">
              {productLines.map((line) => (
                <LineRow key={line.id} line={line} />
              ))}
              {feeLines.length > 0 ? (
                <>
                  <NonInventoryDivider count={feeLines.length} />
                  {feeLines.map((line) => (
                    <LineRow key={line.id} line={line} />
                  ))}
                </>
              ) : null}
            </div>
          </div>

          {/* Bill total bar */}
          <BillTotalBar
            computedTotal={computedTotal}
            declaredTotal={review.declaredTotal}
            lineCount={productLines.length}
          />
        </div>
      </div>
    </div>
  );
}

// ---------- PDF pane (styled mock — no real pdfjs) ----------
function PdfPane() {
  const { state } = useReel();
  const review = state.review;
  if (!review) return null;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border-default bg-surface/60 px-3 py-2">
        <span className="font-mono text-[11px] text-subtle">
          {review.fileName}
        </span>
        <span className="text-subtle">·</span>
        <span className="text-[11px] text-subtle">
          Page 1 of {review.pages}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <Button variant="ghost" size="icon-xs" aria-label="Zoom out" disabled>
            <ZoomOut />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="Zoom in" disabled>
            <ZoomIn />
          </Button>
          <span className="mx-1 h-3 w-px bg-border-soft" />
          <Button variant="ghost" size="icon-xs" aria-label="Download" disabled>
            <Download />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-[560px] rounded-sm border border-border-soft bg-white p-7 shadow-sm font-mono text-[10px] leading-relaxed text-zinc-800">
          <header className="flex items-start justify-between gap-6">
            <div>
              <div className="font-serif text-[17px] font-medium tracking-tight text-zinc-900">
                Northwind Trading Co.
              </div>
              <div className="mt-1 text-[9.5px] text-zinc-500">
                184 Harborview Rd
                <br />
                Portland, OR 97211
                <br />
                ar@northwind-trading.example
              </div>
            </div>
            <div className="text-right">
              <div className="font-serif text-[13px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                Invoice
              </div>
              <div className="mt-1 text-[9.5px] text-zinc-900">
                # <span className="font-medium">{review.parsedInvoiceNumber}</span>
              </div>
              <div className="text-[9.5px] text-zinc-500">
                Issued {fmtDate(review.parsedInvoiceDate)}
              </div>
            </div>
          </header>

          <div className="mt-5">
            <div
              className="grid gap-2 border-b border-zinc-200 pb-1.5 text-[8.5px] uppercase tracking-[0.08em] text-zinc-400"
              style={{ gridTemplateColumns: "26px 1fr 50px 60px 64px" }}
            >
              <div>Line</div>
              <div>Description</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Unit</div>
              <div className="text-right">Amount</div>
            </div>
            <div className="divide-y divide-zinc-100">
              {review.lines.map((l, i) => {
                const lineTotal = l.unitCost == null ? 0 : l.qty * l.unitCost;
                return (
                  <div
                    key={l.id}
                    className="grid gap-2 px-1 py-1.5"
                    style={{ gridTemplateColumns: "26px 1fr 50px 60px 64px" }}
                  >
                    <div className="text-zinc-400 tabular-nums">{i + 1}</div>
                    <div className="text-zinc-900">{l.description}</div>
                    <div className="text-right text-zinc-700 tabular-nums">
                      {l.qty}
                    </div>
                    <div className="text-right text-zinc-700 tabular-nums">
                      {l.unitCost == null
                        ? "—"
                        : `$${fmtAmount(l.unitCost)}`}
                    </div>
                    <div className="text-right text-zinc-900 tabular-nums">
                      ${fmtAmount(lineTotal)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ml-auto mt-4 w-1/2 space-y-1 border-t border-zinc-200 pt-2 text-[9.5px]">
            <div className="flex justify-between text-zinc-500">
              <span>Subtotal</span>
              <span className="tabular-nums">
                $
                {fmtAmount(
                  review.lines.reduce(
                    (s, l) =>
                      s + (l.unitCost == null ? 0 : l.qty * l.unitCost),
                    0,
                  ),
                )}
              </span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>Tax</span>
              <span className="tabular-nums">$0.00</span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-1.5 font-medium text-zinc-900">
              <span>Total due</span>
              <span className="tabular-nums">
                ${fmtAmount(review.declaredTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Header card ----------
function HeaderCard() {
  const { state, dispatch } = useReel();
  const review = state.review;
  if (!review) return null;
  const hasSupplier = review.supplierId != null;

  if (state.headerCollapsed) {
    return <CollapsedHeaderStrip />;
  }

  return (
    <div data-reel="header-card" className="border-b border-border-default bg-card px-4 py-3">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[14px] font-medium text-ink">Invoice header</h2>
        <div className="flex items-center gap-2">
          <FieldChip confidence={94} hint="extracted by AI" />
          <button
            type="button"
            data-reel="collapse-header"
            title="Collapse header to a summary strip"
            onClick={() =>
              dispatch({ type: "SET_HEADER_COLLAPSED", collapsed: true })
            }
            className="flex size-7 items-center justify-center rounded-md text-subtle transition-colors hover:bg-divider hover:text-ink"
          >
            <ChevronUp className="size-[14px]" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {/* Supplier */}
        <ParsedField
          label="Supplier"
          required
          chip={
            <FieldChip
              confidence={62}
              status={hasSupplier ? "good" : "warn"}
              hint={hasSupplier ? "matched" : "no exact match"}
            />
          }
          action={
            <button
              type="button"
              data-reel="create-supplier"
              onClick={() =>
                dispatch({
                  type: "OPEN_DIALOG",
                  dialog: {
                    kind: "create-supplier",
                    prefillName: review.supplierTypedName,
                  },
                })
              }
              className="inline-flex items-center gap-1 text-[11px] font-medium text-forest-mid disabled:opacity-50"
            >
              <Plus className="size-[12px]" strokeWidth={1.8} />
              Create supplier
            </button>
          }
        >
          <div
            className={cn(
              "flex h-[34px] w-full items-center rounded-lg border bg-card px-3 text-[13px]",
              hasSupplier
                ? "border-border-default text-ink"
                : "border-warning-border bg-warning-bg/30 text-warning-fg",
            )}
          >
            {hasSupplier ? (
              review.supplierTypedName
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-warning-fg" />
                {review.supplierTypedName} —{" "}
                <span className="font-medium">not in catalog</span>
              </span>
            )}
          </div>
        </ParsedField>

        {/* Invoice number */}
        <ParsedField label="Invoice number" chip={<FieldChip confidence={91} />}>
          <input
            value={review.parsedInvoiceNumber}
            readOnly
            className="block h-[34px] w-full rounded-lg border border-border-default bg-card px-3 font-mono text-[13px] tabular-nums outline-none"
          />
        </ParsedField>

        {/* Invoice date */}
        <ParsedField label="Invoice date" chip={<FieldChip confidence={96} />}>
          <input
            type="date"
            value={review.parsedInvoiceDate}
            readOnly
            className="block h-[34px] w-full rounded-lg border border-border-default bg-card px-3 text-[13px] outline-none"
          />
        </ParsedField>

        {/* Receive date */}
        <ParsedField label="Receive date" chip={<FieldChip confidence={88} hint="same as invoice" />}>
          <input
            type="date"
            value={review.parsedReceiveDate}
            readOnly
            className="block h-[34px] w-full rounded-lg border border-border-default bg-card px-3 text-[13px] outline-none"
          />
        </ParsedField>

        {/* Payment method */}
        <ParsedField label="Payment method">
          <div className="flex h-[34px] w-full items-center rounded-lg border border-border-default bg-card px-3 text-[13px] text-ink">
            {review.paymentMethod}
          </div>
        </ParsedField>
      </div>
    </div>
  );
}

function ParsedField({
  label,
  required,
  chip,
  action,
  children,
}: {
  label: string;
  required?: boolean;
  chip?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">
            {label}
          </span>
          {required ? (
            <span className="text-[11px] font-semibold text-danger-fg">*</span>
          ) : null}
          {chip}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function FieldChip({
  confidence,
  status = "good",
  hint,
}: {
  confidence: number;
  status?: "good" | "warn";
  hint?: string;
}) {
  const color =
    status === "warn"
      ? "oklch(70% 0.16 70)"
      : confidence >= 70
        ? "var(--color-success-fg)"
        : "oklch(70% 0.16 70)";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-medium"
      style={{
        background: "color-mix(in oklch, currentColor 8%, transparent)",
        color,
      }}
    >
      <Sparkles className="size-2.5" strokeWidth={2} />
      <span className="font-mono tabular-nums">{confidence}%</span>
      {hint ? <span className="font-normal opacity-70">· {hint}</span> : null}
    </span>
  );
}

// ---------- Line row ----------
function LineRow({ line }: { line: ReviewLine }) {
  const { state, dispatch } = useReel();
  const isActive = state.activeLineId === line.id;
  const isFee = line.match.kind === "fee";
  const isMatched = line.match.kind === "matched";
  const isUnmatched = line.match.kind === "unmatched";
  const isCandidates = line.match.kind === "candidates";
  const missingCost = line.unitCost == null;

  const matchedProductId =
    line.match.kind === "matched" ? line.match.productId : null;
  const product = matchedProductId
    ? MOCK_PRODUCTS.find((p) => p.id === matchedProductId)
    : null;

  // Background tints — match production palette: warn (yellow) for issues,
  // soft sage for matched, neutral for fees.
  const tint =
    missingCost || isUnmatched
      ? "oklch(98% 0.025 25)"
      : isCandidates
        ? "oklch(98% 0.025 80)"
        : "transparent";

  return (
    <div
      role="button"
      tabIndex={0}
      data-reel={`review-line-${line.id}`}
      aria-current={isActive ? "true" : undefined}
      onMouseEnter={() => dispatch({ type: "SET_ACTIVE_LINE", lineId: line.id })}
      onMouseLeave={() => dispatch({ type: "SET_ACTIVE_LINE", lineId: null })}
      className="flex cursor-pointer flex-col border-b border-border-default transition-colors"
      style={{
        background: tint,
        borderLeft: `3px solid ${isActive ? "var(--color-forest-mid)" : "transparent"}`,
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[10.5px] text-subtle">
              <span className="font-mono">L{line.pdfRowIndex + 1}</span>
              <span>·</span>
              <ConfidencePill value={line.confidence} />
              {line.flags?.includes("partial-scan") ? (
                <>
                  <span>·</span>
                  <span className="font-medium text-danger-fg">
                    Partial scan
                  </span>
                </>
              ) : null}
            </div>
            <div className="mt-0.5 text-[13px] font-medium text-ink">
              {line.description}
            </div>

            {/* Match status row */}
            <div className="mt-1.5 text-[11.5px]">
              {isMatched && product ? (
                <span className="inline-flex items-center gap-1.5 text-success-fg">
                  <Check className="size-3" strokeWidth={2.4} />
                  <span className="font-medium text-ink">{product.name}</span>
                  <span className="font-mono text-subtle">· {product.sku}</span>
                  {line.match.kind === "matched" && line.match.viaAlias ? (
                    <span className="text-subtle">· matched via alias</span>
                  ) : null}
                  {line.match.kind === "matched" && line.match.aliasAdded ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-forest-tint px-1.5 py-0.5 text-[10px] font-medium text-forest"
                    >
                      <Sparkles className="size-2.5" />
                      alias added
                    </span>
                  ) : null}
                </span>
              ) : isFee && line.match.kind === "fee" ? (
                <span className="inline-flex items-center gap-1.5 text-subtle">
                  <span className="rounded bg-divider px-1.5 py-0.5 text-[10px] font-medium text-ink-warm">
                    Fee
                  </span>
                  <span className="font-mono text-[11px]">
                    {line.match.account}
                  </span>
                </span>
              ) : isUnmatched ? (
                <span className="inline-flex items-center gap-1.5 text-danger-fg">
                  <span className="size-1.5 rounded-full bg-danger-fg" />
                  <span className="font-medium">No product match</span>
                </span>
              ) : null}
            </div>
          </div>

          {/* Numeric snapshot */}
          <div className="flex flex-col items-end gap-0.5 text-right tabular-nums">
            <div className="text-[10.5px] uppercase tracking-[0.06em] text-subtle">
              Qty × Unit
            </div>
            <div className="text-[12px] text-ink-warm">
              {line.qty} × {missingCost ? "—" : `$${fmtAmount(line.unitCost!)}`}
            </div>
            <div
              className={cn(
                "font-mono text-[14px] font-semibold",
                missingCost ? "text-danger-fg" : "text-ink",
              )}
              data-financial
            >
              {missingCost ? "—" : `$${fmtAmount(line.qty * line.unitCost!)}`}
            </div>
          </div>
        </div>

        {/* Action chips for candidates / unmatched */}
        {(isCandidates || isUnmatched) && (
          <div className="flex flex-wrap items-stretch gap-2">
            <div
              data-reel={`line-${line.id}-picker`}
              className="flex h-[34px] flex-1 min-w-[200px] items-center rounded-lg border border-border-default bg-card px-3 text-[12.5px] text-subtle"
            >
              Search product or paste SKU…
            </div>
            {isCandidates &&
              line.match.kind === "candidates" &&
              line.match.suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  data-reel={`line-${line.id}-candidate-${i}`}
                  onClick={() =>
                    dispatch({
                      type: "CONFIRM_SUGGESTION",
                      lineId: line.id,
                      productId: s.productId,
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-card py-1 pl-2.5 pr-1.5 text-[12px] text-ink transition-colors hover:bg-divider"
                >
                  <Sparkles
                    className="size-[12px] text-forest-mid"
                    strokeWidth={1.6}
                  />
                  <span className="font-medium">
                    {productName(s.productId)}
                  </span>
                  <span className="rounded bg-divider px-1.5 py-px font-mono text-[10.5px] tabular-nums text-subtle">
                    {s.score}%
                  </span>
                </button>
              ))}
            <button
              type="button"
              data-reel={`line-${line.id}-create`}
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-forest-mid bg-forest-tint/40 px-2.5 py-1 text-[12px] font-medium text-forest hover:bg-forest-tint/70"
            >
              <Plus className="size-[12px]" strokeWidth={1.8} />
              Create new
            </button>
          </div>
        )}

        {/* Missing-cost inline editor */}
        {missingCost && !isFee && (
          <div className="flex items-center gap-2 rounded-md border border-danger-border/70 bg-danger-bg/30 px-3 py-2 text-[12px] text-danger-fg">
            <AlertTriangle className="size-3.5" strokeWidth={1.8} />
            <span className="font-medium">Cost missing</span>
            <span>— fill in to compute totals.</span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[10.5px] uppercase tracking-[0.06em] text-subtle">
                Unit cost
              </span>
              <button
                type="button"
                data-reel={`line-${line.id}-fill-cost`}
                onClick={() =>
                  dispatch({
                    type: "FILL_LINE_COST",
                    lineId: line.id,
                    unitCost: 6.15,
                  })
                }
                className="flex h-7 w-20 items-center justify-end rounded-md border border-border-default bg-card pr-2 font-mono text-[12px] tabular-nums text-subtle"
              >
                $—
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfidencePill({ value }: { value: number }) {
  const color =
    value >= 85
      ? "var(--color-success-fg)"
      : value >= 65
        ? "oklch(70% 0.16 70)"
        : "var(--color-danger-fg)";
  return (
    <span className="inline-flex items-center gap-1 tabular-nums" style={{ color }}>
      <span className="size-1 rounded-full" style={{ background: color, opacity: 0.7 }} />
      {value}% confidence
    </span>
  );
}

function productName(productId: string): string {
  return MOCK_PRODUCTS.find((p) => p.id === productId)?.name ?? productId;
}

// ---------- Filter segmented ----------
function FilterSegmented({
  productCount,
  feeCount,
}: {
  productCount: number;
  feeCount: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <Filter className="size-3.5 text-subtle" strokeWidth={1.6} />
      <div className="flex gap-1 rounded-[7px] border border-border-default bg-card p-[3px]">
        {[
          { label: "All", count: productCount + feeCount },
          { label: "Needs attention", count: 3 },
          { label: "Fees", count: feeCount },
        ].map((t, i) => (
          <button
            key={t.label}
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-[11.5px] font-medium transition-colors",
              i === 0
                ? "bg-forest-mid text-card-warm"
                : "text-subtle hover:text-ink",
            )}
          >
            {t.label}
            <span
              className={cn(
                "rounded px-1 py-px font-mono text-[10px] tabular-nums",
                i === 0
                  ? "bg-card-warm/20 text-card-warm"
                  : "bg-divider text-subtle",
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Bill total bar ----------
function BillTotalBar({
  computedTotal,
  declaredTotal,
  lineCount,
}: {
  computedTotal: number;
  declaredTotal: number;
  lineCount: number;
}) {
  const delta = Number((declaredTotal - computedTotal).toFixed(2));
  const matches = Math.abs(delta) <= 0.05;

  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border-default bg-card px-[22px] py-2.5 text-[12px]">
      <div className="flex items-center gap-4 text-subtle">
        <span>
          <span className="text-ink-warm">{lineCount}</span> line items
        </span>
        <span className="text-border-default">|</span>
        <span className="inline-flex items-center gap-1.5">
          <span>Bill total</span>
          <span className="font-mono text-[13px] font-semibold tabular-nums text-ink">
            ${fmtAmount(declaredTotal)}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-3 text-[11.5px]">
        <span className="text-subtle">Lines sum to</span>
        <span
          className={cn(
            "font-mono text-[12.5px] font-semibold tabular-nums",
            matches ? "text-ink" : "text-danger-fg",
          )}
        >
          ${fmtAmount(computedTotal)}
        </span>
        {matches ? (
          <span className="inline-flex items-center gap-1 text-success-fg">
            <Check className="size-3" strokeWidth={2.4} />
            matches
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-danger-fg">
            <X className="size-3" strokeWidth={2.4} />
            off by ${fmtAmount(Math.abs(delta))}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- Collapsed header strip ----------
function CollapsedHeaderStrip() {
  const { state, dispatch } = useReel();
  const review = state.review;
  if (!review) return null;
  const hasSupplier = review.supplierId != null;
  const fmtMoney = (n: number) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const fmtShortDate = (iso: string) => {
    if (!iso) return "—";
    const [, m, d] = iso.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIdx = Number(m) - 1;
    if (!Number.isInteger(monthIdx) || !months[monthIdx]) return iso;
    return `${months[monthIdx]} ${Number(d)}`;
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-default bg-card px-4 py-2 text-[12px]">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className={
            hasSupplier
              ? "min-w-0 max-w-[280px] truncate text-[13px] font-semibold text-ink"
              : "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-semibold"
          }
          style={
            hasSupplier
              ? undefined
              : { background: "oklch(95% 0.05 60 / 0.6)", color: "oklch(60% 0.16 35)" }
          }
        >
          {hasSupplier ? review.supplierTypedName : "Supplier missing"}
        </span>
        <span className="text-subtle">·</span>
        <span className="font-mono text-subtle">#{review.parsedInvoiceNumber}</span>
        <span className="text-subtle">·</span>
        <span className="font-mono text-subtle">{fmtShortDate(review.parsedInvoiceDate)}</span>
        <span className="text-subtle">·</span>
        <span className="font-mono font-semibold tabular-nums text-ink">
          ${fmtMoney(review.declaredTotal)}
        </span>
        {review.paymentMethod ? (
          <>
            <span className="text-subtle">·</span>
            <span className="text-subtle">{review.paymentMethod}</span>
          </>
        ) : null}
      </div>
      <button
        type="button"
        data-reel="expand-header"
        onClick={() => dispatch({ type: "SET_HEADER_COLLAPSED", collapsed: false })}
        title="Expand header to edit"
        className="inline-flex items-center gap-1 rounded-md border border-border-default bg-card px-2 py-0.5 text-[11px] font-medium text-subtle hover:text-ink"
      >
        Edit
        <ChevronDown className="size-[12px]" strokeWidth={1.8} />
      </button>
    </div>
  );
}

// ---------- Non-inventory section divider ----------
function NonInventoryDivider({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-3 border-y border-border-default bg-surface/50 px-[22px] py-2.5">
      <Receipt className="size-3.5 text-subtle" strokeWidth={1.8} />
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-subtle">
        Non-inventory charges
      </span>
      <span className="rounded bg-divider px-1.5 py-0.5 font-mono text-[10.5px] text-subtle">
        {count}
      </span>
      <span className="ml-auto text-[11px] text-subtle">
        Posted to expense — no stock movement.
      </span>
    </div>
  );
}

// ---------- Review top bar (back + filename + actions) ----------
function ReviewTopBar({ submitDisabled }: { submitDisabled: boolean }) {
  const { state, dispatch } = useReel();
  const review = state.review;
  if (!review) return null;

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-default bg-card px-4 py-2.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-reel="review-back"
          className="text-[12.5px] font-medium text-subtle hover:text-ink"
        >
          ← Imports
        </button>
        <span className="text-subtle">/</span>
        <span className="font-mono text-[12.5px] tabular-nums text-ink">
          {review.fileName}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 text-[12px]">
          Re-scan
        </Button>
        <Button
          type="button"
          size="sm"
          data-reel="submit-review"
          disabled={submitDisabled}
          onClick={() => dispatch({ type: "SUBMIT_REVIEW" })}
          className="h-8 gap-1.5 border-forest-mid bg-forest-mid text-[12px] text-card-warm hover:bg-forest"
        >
          {submitDisabled ? "Resolve to submit" : "Submit & post"}
        </Button>
      </div>
    </div>
  );
}
