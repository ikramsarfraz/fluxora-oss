"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { FilterSegmented } from "./filter-segmented";
import { HeaderCard } from "./header-card";
import type { LineBbox } from "./line-bbox";
import { LineRow } from "./line-row";
import type {
  ProductLookup,
  SupplierLookup,
} from "./map-pipeline-to-review-data";
import { PdfHint, PdfPane } from "./pdf-pane";
import { PriceChangeBanner } from "./price-change-banner";
import { ReviewFooterStrip } from "./review-footer-strip";
import { ReviewHeaderStrip } from "./review-header-strip";
import {
  lineNeedsReview,
  type ProductCandidate,
  type ReviewCounts,
  type ReviewData,
  type ReviewFilter,
  type SupplierCandidate,
} from "./types";

export function ReviewScreen({
  data,
  pdfFile,
  lineBboxes,
  onSubmit,
  submitDisabled,
  onCancel,
  onReparse,
  onSelectLineCandidate,
  onSelectLineProduct,
  onSkipLine,
  onCreateLineProduct,
  onSelectSupplierCandidate,
  onCreateSupplier,
  onSelectSupplier,
  onSupplierTypedNameChange,
  suppliers = [],
  products = [],
  supplierSelectedId,
  lineMatchedProductIds,
  rememberAliases,
  onRememberAliasesChange,
  topSlot,
  headerSlot,
  pdfPaneAccessory,
  paneEnterDirection,
}: {
  data: ReviewData;
  /** Original PDF bytes — supplied by phase 5; omit for the demo placeholder. */
  pdfFile?: Blob | null;
  /** Per-line bounding boxes for the clickable overlay on the rasterized page. */
  lineBboxes?: LineBbox[];
  /** Primary CTA handler. Omit when the host wants the demo's no-op behavior. */
  onSubmit?: () => void;
  /** Force the primary CTA disabled (e.g. while a submit is in flight). */
  submitDisabled?: boolean;
  onCancel?: () => void;
  onReparse?: () => void;
  /** Called when the user clicks an AI candidate chip on a line. */
  onSelectLineCandidate?: (lineId: number, candidate: ProductCandidate) => void;
  /** Called when the user picks a product from the line's autocomplete. */
  onSelectLineProduct?: (lineId: number, product: ProductLookup) => void;
  /** Called when the user clicks "Skip this line". */
  onSkipLine?: (lineId: number) => void;
  /** Called when the user clicks "+ Create new" on a line. */
  onCreateLineProduct?: (lineId: number) => void;
  /** Called when the user clicks a supplier candidate chip. */
  onSelectSupplierCandidate?: (candidate: SupplierCandidate) => void;
  /** Called when the user clicks "+ Create supplier" on the header card. */
  onCreateSupplier?: () => void;
  /** Called when the user picks a supplier from the autocomplete. */
  onSelectSupplier?: (supplier: SupplierLookup | null) => void;
  /** Called as the user types into the supplier picker's search input. */
  onSupplierTypedNameChange?: (name: string) => void;
  suppliers?: SupplierLookup[];
  products?: ProductLookup[];
  supplierSelectedId?: string | null;
  /** Per-line matched product id, used to drive each row's picker selected state. */
  lineMatchedProductIds?: Record<number, string | null>;
  /** Controlled value for the footer's remember-aliases checkbox. */
  rememberAliases?: boolean;
  onRememberAliasesChange?: (value: boolean) => void;
  /** Optional chrome to render at the very top of <main> (above the header). */
  topSlot?: ReactNode;
  /**
   * Optional override for the default ReviewHeaderStrip. When supplied, the
   * host renders its own page header (e.g. the queue-aware one with
   * Skip / Complete & next buttons). When omitted, the legacy single-PDF
   * header strip renders.
   */
  headerSlot?: ReactNode;
  /**
   * Optional absolutely-positioned overlay rendered inside the same horizontal
   * flex as the PDF pane — used by the queue carousel to drop floating
   * prev/next arrows over the PDF.
   */
  pdfPaneAccessory?: ReactNode;
  /**
   * When set, the two content panes re-mount with a slide-in animation each
   * render (keyed on data.fileName change so React re-runs the keyframe).
   * Direction controls whether the slide comes from the right (`next`) or
   * the left (`prev`).
   */
  paneEnterDirection?: "next" | "prev";
}) {
  // Read sidebar state so the fixed bottom bar can re-anchor its left edge
  // when the sidebar collapses/expands. The default mode is "offcanvas", so
  // collapsed = sidebar fully off-screen and the bar should reach left:0.
  const { state: sidebarState } = useSidebar();
  const [zoom, setZoom] = useState(85);
  const [activeLineId, setActiveLineId] = useState<number | null>(
    data.lines[0]?.id ?? null,
  );
  const [supplier, setSupplier] = useState(data.parsed.supplier.value);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  // When `rememberAliases` is uncontrolled, fall back to local state so the
  // demo path keeps working without the host wiring anything.
  const [rememberAliasesLocal, setRememberAliasesLocal] = useState(true);
  const rememberAliasesValue = rememberAliases ?? rememberAliasesLocal;
  const setRememberAliases = onRememberAliasesChange ?? setRememberAliasesLocal;
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const counts: ReviewCounts = useMemo(() => {
    const matched = data.lines.filter(
      l => l.match.status === "matched" && !l.match.warning,
    ).length;
    const needsReview = data.lines.filter(l => lineNeedsReview(l.match)).length;
    const fees = data.lines.filter(l => l.match.status === "fee").length;
    return { matched, needsReview, fees, total: data.lines.length };
  }, [data.lines]);

  const filteredLines = useMemo(() => {
    if (filter === "all") return data.lines;
    if (filter === "matched")
      return data.lines.filter(
        l => l.match.status === "matched" && !l.match.warning,
      );
    if (filter === "fees")
      return data.lines.filter(l => l.match.status === "fee");
    return data.lines.filter(l => lineNeedsReview(l.match));
  }, [data.lines, filter]);

  useEffect(() => {
    if (activeLineId == null) return;
    // Respect the user's reduced-motion preference — scroll-with-behavior is
    // the most jarring animation on this screen for vestibular sensitivity.
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    lineRefs.current[activeLineId]?.scrollIntoView({
      block: "nearest",
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [activeLineId]);

  // Wrap setFilter so flipping the segmented control also retargets the active
  // line to the first still-visible row when the previous active row gets
  // filtered out. Doing this in the user-event handler (not an effect) keeps
  // the React Compiler happy and avoids the cascading-render warning.
  const handleFilterChange = (next: ReviewFilter) => {
    setFilter(next);
    if (activeLineId == null) return;
    const nextVisible =
      next === "all"
        ? data.lines
        : next === "matched"
          ? data.lines.filter(
              l => l.match.status === "matched" && !l.match.warning,
            )
          : next === "fees"
            ? data.lines.filter(l => l.match.status === "fee")
            : data.lines.filter(l => lineNeedsReview(l.match));
    if (!nextVisible.some(l => l.id === activeLineId)) {
      setActiveLineId(nextVisible[0]?.id ?? null);
    }
  };

  // Keyed pane-enter animation: when the parent provides a direction, we
  // attach the slide-in keyframe class to both panes. The animation reruns on
  // every render because `paneEnterDirection` flips back to undefined between
  // navigations in the queue shell — easier than reseeding a numeric key.
  const paneEnterClass = paneEnterDirection
    ? cn(
        "review-pane-enter",
        paneEnterDirection === "prev" && "review-pane-enter-from-prev",
      )
    : undefined;

  // Default header keeps the legacy single-PDF behavior intact. The queue
  // shell passes its own headerSlot to swap in the Skip / Complete & next
  // segmented control.
  const header = headerSlot ?? (
    <ReviewHeaderStrip
      fileName={data.fileName}
      counts={counts}
      onSubmit={onSubmit}
      submitDisabled={submitDisabled}
      onCancel={onCancel}
      onReparse={onReparse}
    />
  );

  return (
    // ReviewScreen is rendered inside ReviewQueueShell's <main>, which owns
    // the viewport-height + `-m-4` constraint. This root is a <div> (not a
    // nested <main>) that just fills whatever space the shell gives it via
    // `flex-1 min-h-0`. `overflow-hidden` keeps any in-pane overflow inside
    // the line-items scroll context.
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-stone-bg">
      {topSlot}
      {header}

      {/* grid-cols-2 gives both panes a deterministic 50/50 split regardless
          of intrinsic content widths, so the bottom-bar columns below line
          up exactly with the panes above. */}
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-2">
        <PdfPane
          fileName={data.fileName}
          page={data.page}
          pages={data.pages}
          zoom={zoom}
          onZoom={setZoom}
          lines={data.lines}
          activeLineId={activeLineId}
          onLineClick={setActiveLineId}
          pdfFile={pdfFile}
          lineBboxes={lineBboxes}
          paneEnterClass={paneEnterClass}
          // The queue carousel passes its floating prev/next here so the
          // arrows sit inside PdfPane (a positioned ancestor) — keeps them
          // from triggering horizontal page scroll on narrow viewports.
          accessory={pdfPaneAccessory}
        />

        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col bg-stone-bg",
            paneEnterClass,
          )}
        >
          <HeaderCard
            parsed={data.parsed}
            supplierValue={supplier}
            suppliers={suppliers}
            supplierSelectedId={supplierSelectedId ?? null}
            onSupplierSelect={s => {
              setSupplier(s?.name ?? "");
              onSelectSupplier?.(s);
            }}
            onSupplierTypedNameChange={name => {
              setSupplier(name);
              onSupplierTypedNameChange?.(name);
            }}
            onSupplierCandidate={onSelectSupplierCandidate}
            onCreateSupplier={onCreateSupplier}
          />

          {/* Price-change banner. Renders nothing when there are no
              deviations, so this is a zero-cost slot for clean invoices. */}
          <PriceChangeBanner deviations={data.priceDeviations} />

          {/* Line items section — header + scroll area only. The bill-total
              footer is no longer inside this section; it lives in the bottom
              bar of <main> alongside PdfHint so both halves are siblings of
              the two-pane row and the scroll area is free of overlay padding. */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-3.5 border-b border-stone-line bg-stone-surface px-[22px] py-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[15px] font-semibold text-stone-ink">
                  Line items
                </h2>
                {/* Show only the product-line count here. Fees are surfaced
                    separately via the Fees filter tab and the per-tab count
                    chip — counting them in the header would double-count. */}
                <span className="rounded bg-stone-line2 px-1.5 py-0.5 font-mono text-[11px] text-stone-muted">
                  {counts.total - counts.fees}
                </span>
              </div>
              <FilterSegmented
                filter={filter}
                counts={counts}
                onChange={handleFilterChange}
              />
            </div>

            {/* pb-20 clears the fixed bill-total bar (~67px) so the last
                line stays visible above it when scrolled to the bottom. */}
            <div className="h-0 min-h-0 flex-1 overflow-y-auto bg-stone-bg pb-20">
              {filteredLines.length === 0 ? (
                <div className="px-[22px] py-12 text-center text-[13px] text-stone-muted">
                  No lines match this filter.
                </div>
              ) : (
                filteredLines.map(line => (
                  <div
                    key={line.id}
                    ref={el => {
                      lineRefs.current[line.id] = el;
                    }}
                  >
                    <LineRow
                      line={line}
                      isActive={activeLineId === line.id}
                      onClick={() => setActiveLineId(line.id)}
                      products={products}
                      matchedProductId={
                        lineMatchedProductIds?.[line.id] ?? null
                      }
                      onSelectProduct={
                        onSelectLineProduct
                          ? p => onSelectLineProduct(line.id, p)
                          : undefined
                      }
                      onSelectCandidate={
                        onSelectLineCandidate
                          ? c => onSelectLineCandidate(line.id, c)
                          : undefined
                      }
                      onSkip={
                        onSkipLine ? () => onSkipLine(line.id) : undefined
                      }
                      onCreateNew={
                        onCreateLineProduct
                          ? () => onCreateLineProduct(line.id)
                          : undefined
                      }
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar — pinned to the viewport bottom via `position: fixed`,
          escaping any ancestor overflow/sizing so it's always visible. The
          left offset is driven by sidebar state (`var(--sidebar-width)` when
          expanded, `0` when collapsed/offcanvas) so the bar grows into the
          freed space on collapse. `transition-[left]` matches the sidebar's
          own width transition so they move together. `grid-cols-2` splits
          the remaining width 50/50, matching the panes above exactly. The
          scroll area above gets `pb-20` so the last line item isn't hidden
          behind this bar. */}
      <div
        className="fixed right-0 bottom-0 z-20 grid grid-cols-2 transition-[left] duration-200 ease-linear"
        style={{
          left: sidebarState === "collapsed" ? 0 : "var(--sidebar-width)",
        }}
      >
        <PdfHint />
        <ReviewFooterStrip
          rememberAliases={rememberAliasesValue}
          onRememberAliasesChange={setRememberAliases}
          billTotal={data.parsed.total.value}
        />
      </div>
    </div>
  );
}
