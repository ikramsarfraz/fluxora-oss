"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  Plus,
  Receipt,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { DuplicateInvoiceBanner, PdfHint, PriceChangeBanner } from "./banners";
import { LineRow } from "./line-row";
import { FilterSegmented, ReviewFooterStrip } from "./footer";
import { fmtAmount, fmtDate } from "./mock-data";
import { QueueStrip, ReviewQueueHeader } from "./queue";
import { useReel } from "./reel-state";
import type { ReviewCounts, ReviewFilter, ReviewLine } from "./types";

// Visual replica of
// modules/distribution/supplier-invoices/components/review/review-screen.tsx
// Same chrome, same banners, same LineRow shape. Virtualizer + lot-expiry /
// weight editor trays + charges panel are stubbed (chip buttons only) — the
// autopilot never opens them.

function lineNeedsReview(line: ReviewLine): boolean {
  const kind = line.match.kind;
  if (kind === "fee") return false;
  if (kind === "matched" && !line.match.warning && line.unitCost != null)
    return false;
  return true;
}

function computeCounts(lines: ReviewLine[]): ReviewCounts {
  let matched = 0;
  let needsReview = 0;
  let fees = 0;
  for (const l of lines) {
    if (l.match.kind === "fee") fees++;
    else if (lineNeedsReview(l)) needsReview++;
    else matched++;
  }
  return { matched, needsReview, fees, total: lines.length };
}

export function ReviewScreen() {
  const { state } = useReel();
  const review = state.review;
  const [filter, setFilter] = useState<ReviewFilter>("all");

  const counts = useMemo<ReviewCounts>(
    () => (review ? computeCounts(review.lines) : { total: 0, matched: 0, needsReview: 0, fees: 0 }),
    [review],
  );

  const filteredLines = useMemo<ReviewLine[]>(() => {
    if (!review) return [];
    if (filter === "all") return review.lines;
    if (filter === "matched")
      return review.lines.filter(
        (l) => l.match.kind === "matched" && !l.match.warning && l.unitCost != null,
      );
    if (filter === "fees")
      return review.lines.filter((l) => l.match.kind === "fee");
    return review.lines.filter(lineNeedsReview);
  }, [review, filter]);

  const footerTotals = useMemo(() => {
    if (!review)
      return {
        totalLineCount: 0,
        totalCases: 0,
        totalWeightLbs: 0,
        chargesTotal: 0,
        linesTotal: 0,
      };
    const productLines = review.lines.filter((l) => l.match.kind !== "fee");
    return {
      totalLineCount: productLines.length,
      totalCases: productLines.reduce((s, l) => s + (l.cases || 0), 0),
      totalWeightLbs: productLines.reduce((s, l) => s + (l.weight || 0), 0),
      chargesTotal: review.lines
        .filter((l) => l.match.kind === "fee")
        .reduce((s, l) => s + l.total, 0),
      linesTotal: productLines.reduce((s, l) => s + l.total, 0),
    };
  }, [review]);

  if (!review) return null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-page">
      <QueueStrip />
      <ReviewQueueHeader />

      {/* Two-pane row — fills the space between the queue header and the
          bottom bar. */}
      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden border-r border-border-default bg-surface/30">
          <PdfPane />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-page">
          <HeaderCard />

          <DuplicateInvoiceBanner matches={review.duplicateMatches} />
          <PriceChangeBanner deviations={review.priceDeviations} />

          {/* Line items section */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-3.5 border-b border-border-default bg-card px-[22px] py-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[15px] font-medium text-ink">Line items</h2>
                <span className="rounded bg-divider px-1.5 py-0.5 font-mono text-[11px] text-subtle">
                  {counts.total - counts.fees}
                </span>
              </div>
              <FilterSegmented filter={filter} counts={counts} onChange={setFilter} />
            </div>

            <div className="h-0 min-h-0 flex-1 overflow-y-auto bg-page pb-2">
              {filteredLines.length === 0 ? (
                <div className="px-[22px] py-12 text-center text-[13px] text-subtle">
                  No lines match this filter.
                </div>
              ) : (
                renderLinesWithSection(filteredLines, filter)
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom totals bar — production pins this fixed at the viewport
          bottom and splits the panes 50/50 (PdfHint under the PDF, totals
          under the form). We mirror the 50/50 grid as a sibling of the
          two-pane row so it spans the full review width edge-to-edge,
          matching the production look without the fixed-positioning
          complexity (the reel surface is already a bounded container). */}
      <div className="grid shrink-0 grid-cols-2 border-t border-border-default bg-card">
        <div className="border-r border-border-default">
          <PdfHint />
        </div>
        <ReviewFooterStrip
          totalLineCount={footerTotals.totalLineCount}
          totalCases={footerTotals.totalCases}
          totalWeightLbs={footerTotals.totalWeightLbs}
          chargesTotal={footerTotals.chargesTotal}
          billTotal={review.declaredTotal}
        />
      </div>
    </div>
  );
}

function renderLinesWithSection(lines: ReviewLine[], filter: ReviewFilter) {
  // When the filter is "all" we keep the "Non-inventory charges" section
  // header above the fee lines so they're visually separated. Any other
  // filter renders the list flat.
  if (filter !== "all") {
    return (
      <>
        {lines.map((l) => (
          <LineRow key={l.id} line={l} />
        ))}
      </>
    );
  }
  const productLines = lines.filter((l) => l.match.kind !== "fee");
  const feeLines = lines.filter((l) => l.match.kind === "fee");
  return (
    <>
      {productLines.map((l) => (
        <LineRow key={l.id} line={l} />
      ))}
      {feeLines.length > 0 ? (
        <>
          <NonInventoryDivider count={feeLines.length} />
          {feeLines.map((l) => (
            <LineRow key={l.id} line={l} />
          ))}
        </>
      ) : null}
    </>
  );
}

// ---------- PDF pane ----------
function PdfPane() {
  const { state } = useReel();
  const review = state.review;
  if (!review) return null;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border-default bg-surface/60 px-3 py-2">
        <span className="font-mono text-[11px] text-subtle">{review.fileName}</span>
        <span className="text-subtle">·</span>
        <span className="text-[11px] text-subtle">Page 1 of {review.pages}</span>
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
                      {l.unitCost == null ? "—" : `$${fmtAmount(l.unitCost)}`}
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
                    (s, l) => s + (l.unitCost == null ? 0 : l.qty * l.unitCost),
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
                {review.supplierTypedName} — <span className="font-medium">not in catalog</span>
              </span>
            )}
          </div>
        </ParsedField>

        <ParsedField label="Invoice number" chip={<FieldChip confidence={91} />}>
          <input
            value={review.parsedInvoiceNumber}
            readOnly
            className="block h-[34px] w-full rounded-lg border border-border-default bg-card px-3 font-mono text-[13px] tabular-nums outline-none"
          />
        </ParsedField>

        <ParsedField label="Invoice date" chip={<FieldChip confidence={96} />}>
          <input
            type="date"
            value={review.parsedInvoiceDate}
            readOnly
            className="block h-[34px] w-full rounded-lg border border-border-default bg-card px-3 text-[13px] outline-none"
          />
        </ParsedField>

        <ParsedField label="Receive date" chip={<FieldChip confidence={88} hint="same as invoice" />}>
          <input
            type="date"
            value={review.parsedReceiveDate}
            readOnly
            className="block h-[34px] w-full rounded-lg border border-border-default bg-card px-3 text-[13px] outline-none"
          />
        </ParsedField>

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
