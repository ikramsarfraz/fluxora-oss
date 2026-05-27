"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { ChargesPanel, type ChargeDraft } from "./charges-panel";
import { FilterSegmented } from "./filter-segmented";
import { HeaderCard } from "./header-card";
import type { LineBbox } from "./line-bbox";
import type { LineCostAckKey } from "./line-cost-diff-banner";
import type { LineLotExpiryState } from "./line-lot-expiry-editor";
import { LineRow, type LineCostDiffData } from "./line-row";
import type { LineWeightState } from "./line-weight-editor";
import type {
  ProductLookup,
  SupplierLookup,
} from "./map-pipeline-to-review-data";
import {
  DuplicateInvoiceBanner,
  type DuplicateMatch,
} from "./duplicate-invoice-banner";
import { PdfHint, PdfPane } from "./pdf-pane";
import { PriceChangeBanner } from "./price-change-banner";
import { ReviewFooterStrip } from "./review-footer-strip";
import { ReviewHeaderStrip } from "./review-header-strip";
import {
  lineNeedsReview,
  type PaymentMethod,
  type ProductCandidate,
  type ReviewCounts,
  type ReviewData,
  type ReviewFilter,
  type SupplierCandidate,
} from "./types";

export function ReviewScreen({
  data,
  pdfFile,
  pdfLoadError,
  lineBboxes,
  onSubmit,
  submitDisabled,
  onCancel,
  onReparse,
  onSelectLineCandidate,
  onSelectLineProduct,
  onSkipLine,
  onCreateLineProduct,
  lineWeightStates,
  openWeightEditorLines,
  onToggleLineWeightEditor,
  onLineWeightChange,
  lineLotExpiryStates,
  openLotExpiryEditorLines,
  onToggleLineLotExpiryEditor,
  onLineLotExpiryChange,
  lineCostDiffs,
  onToggleCostAck,
  charges,
  onChargesChange,
  deletedLineIds,
  onDeleteLine,
  onRestoreAllLines,
  onLineCasesChange,
  lineSubmitErrors,
  onSelectSupplierCandidate,
  onCreateSupplier,
  onSelectSupplier,
  onSupplierTypedNameChange,
  paymentMethod,
  onPaymentMethodChange,
  notes,
  onNotesChange,
  invoiceNumber,
  onInvoiceNumberChange,
  invoiceDate,
  onInvoiceDateChange,
  receiveDate,
  onReceiveDateChange,
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
  duplicateMatches,
  duplicateAcknowledged,
  onDuplicateAcknowledgedChange,
  onAddLine,
  userAddedLineIds,
  userAddedLinePrices,
  onUserAddedLineUnitPriceChange,
}: {
  data: ReviewData;
  /** Original PDF bytes. Null while the host is still fetching them. */
  pdfFile?: Blob | null;
  /**
   * True when the host gave up fetching the PDF — surfaces an explicit
   * error card in PdfPane instead of an indefinite loading skeleton.
   */
  pdfLoadError?: boolean;
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
  /**
   * Per-line weight-editor state (only populated for lines the user has
   * opened the tray for). Keyed by `line.id`. Missing key = no override.
   */
  lineWeightStates?: Record<number, LineWeightState | undefined>;
  /**
   * Set of line ids whose weight tray is currently expanded. Distinct
   * from `lineWeightStates` so a line can have an override applied while
   * the tray is collapsed.
   */
  openWeightEditorLines?: ReadonlySet<number>;
  onToggleLineWeightEditor?: (lineId: number) => void;
  onLineWeightChange?: (lineId: number, next: LineWeightState) => void;
  /**
   * Per-line lot/expiry override state. Same shape as the weight editor:
   * presence/missing keys + the open-set are tracked separately so
   * toggling the tray doesn't mark a line as overridden.
   */
  lineLotExpiryStates?: Record<number, LineLotExpiryState | undefined>;
  openLotExpiryEditorLines?: ReadonlySet<number>;
  onToggleLineLotExpiryEditor?: (lineId: number) => void;
  onLineLotExpiryChange?: (lineId: number, next: LineLotExpiryState) => void;
  /**
   * Per-line cost-diff banner data — provided by the container after
   * cross-referencing the live cost-per-lb (from current line state)
   * against `getSupplierInvoiceCostDiffContext()`. Null/missing key =
   * no banner for that line.
   */
  lineCostDiffs?: Record<number, LineCostDiffData | null>;
  onToggleCostAck?: (key: LineCostAckKey) => void;
  /**
   * Editable list of non-inventory charges (freight, fuel, tax, etc.) —
   * seeded from the parser's `detectedFees`. When supplied alongside
   * `onChargesChange`, the `ChargesPanel` renders below the line items.
   */
  charges?: ChargeDraft[];
  onChargesChange?: (next: ChargeDraft[]) => void;
  /**
   * Line ids the user has explicitly removed from the bill. Filtered out
   * of both the rendered list and the submit payload. Container exposes
   * `onRestoreAllLines` so the footer can offer an undo.
   */
  deletedLineIds?: ReadonlySet<number>;
  onDeleteLine?: (lineId: number) => void;
  onRestoreAllLines?: () => void;
  /**
   * Edit the case-count for a line. Stored as an override in the
   * container so the parser's value can be restored by clearing the
   * override (not exposed in v1 — user can just type the original back).
   */
  onLineCasesChange?: (lineId: number, cases: number) => void;
  /**
   * Per-line validation errors surfaced from the server's most recent
   * rejected submit. Keyed on `line.id`. Renders an inline red banner
   * above the offending row(s); cleared when the user retries submit.
   */
  lineSubmitErrors?: Record<number, string[]>;
  /** Called when the user clicks a supplier candidate chip. */
  onSelectSupplierCandidate?: (candidate: SupplierCandidate) => void;
  /** Called when the user clicks "+ Create supplier" on the header card. */
  onCreateSupplier?: () => void;
  /** Called when the user picks a supplier from the autocomplete. */
  onSelectSupplier?: (supplier: SupplierLookup | null) => void;
  /** Called as the user types into the supplier picker's search input. */
  onSupplierTypedNameChange?: (name: string) => void;
  /**
   * Payment-method override controlled by the parent (initialized from the
   * parser's prefill). Null when the user picks "Not specified".
   */
  paymentMethod: PaymentMethod | null;
  onPaymentMethodChange: (value: PaymentMethod | null) => void;
  /**
   * Bill-level notes — controlled by the parent, seeded from the parser's
   * prefill. Empty string = no notes (sent to server as null on submit).
   */
  notes: string;
  onNotesChange: (value: string) => void;
  /**
   * Controlled invoice header text fields. Previously these were
   * `defaultValue` inputs inside HeaderCard whose edits never made it
   * to the submit payload — moving them to controlled state at the
   * container fixes the silent-drop bug.
   */
  invoiceNumber: string;
  onInvoiceNumberChange: (value: string) => void;
  invoiceDate: string;
  onInvoiceDateChange: (value: string) => void;
  receiveDate: string;
  onReceiveDateChange: (value: string) => void;
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
   *
   * Pass a function to receive the screen's live, form-state-aware `counts`
   * plus the host-supplied `submitDisabled` flag — needed by the queue
   * header so its Complete button reflects both line resolution state and
   * outer guards like the duplicate-bill ack checkbox. Pass a node directly
   * when neither piece of state is needed.
   */
  headerSlot?:
    | ReactNode
    | ((args: { counts: ReviewCounts; submitDisabled: boolean }) => ReactNode);
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
  /**
   * Posted supplier invoices that share the same (supplier, supplier-printed
   * invoice number) — OR same (supplier, invoice date, total) as a softer
   * signal — as the one currently being reviewed. When non-empty, a banner
   * shows above the line items section so the user can compare and confirm
   * before re-posting a duplicate. Empty / undefined hides the banner
   * entirely.
   */
  duplicateMatches?: DuplicateMatch[];
  /**
   * Whether the user has acknowledged the duplicate banner's "I want to post
   * this anyway" checkbox. When `duplicateMatches` contains a finalized
   * (non-draft) row, the host treats this flag as a submit precondition.
   */
  duplicateAcknowledged?: boolean;
  onDuplicateAcknowledgedChange?: (value: boolean) => void;
  /**
   * Append a blank line to the review state. Surfaces a "+ Add line"
   * button below the line list so the user can recover when the AI
   * parser missed a row entirely (most common on hand-written / heavily
   * abbreviated bills). Container manages the new line's id + state.
   */
  onAddLine?: () => void;
  /**
   * Line ids that were inserted manually (vs. parsed from the bill).
   * Drives the inline unit-price input on user-added rows — parser-
   * emitted lines keep the display-only price since the parser already
   * filled it.
   */
  userAddedLineIds?: ReadonlySet<number>;
  /** Per-user-added-line price input string keyed by line id. */
  userAddedLinePrices?: Record<number, string>;
  onUserAddedLineUnitPriceChange?: (lineId: number, value: string) => void;
}) {
  // Read sidebar state so the fixed bottom bar can re-anchor its left edge
  // when the sidebar collapses/expands. The default mode is "offcanvas", so
  // collapsed = sidebar fully off-screen and the bar should reach left:0.
  const { state: sidebarState } = useSidebar();
  const [zoom, setZoom] = useState(85);
  // Local page state seeded from data.page. Multi-page invoices use the
  // PdfToolbar's prev/next buttons via `onPageChange`. When the user
  // navigates to a different invoice in the queue carousel, the parent
  // remounts ReviewContainer (key={currentKey}), which remounts this
  // component, which reseeds the state — so page resets to 1 on switch.
  const [page, setPage] = useState(data.page);
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

  // Header card auto-collapses to a thin summary strip the moment the
  // reviewer first interacts with a line — claws back ~150-200px of
  // line items real estate without preventing the user from re-
  // expanding. We track "has already auto-collapsed once this session"
  // via a ref so a manual re-expand doesn't get clobbered the next
  // time the user clicks a line.
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const hasAutoCollapsedHeaderRef = useRef(false);
  const handleLineClickForCollapse = (lineId: number) => {
    setActiveLineId(lineId);
    if (!hasAutoCollapsedHeaderRef.current) {
      hasAutoCollapsedHeaderRef.current = true;
      setHeaderCollapsed(true);
    }
  };

  // Apply line deletions BEFORE any other derived calculation so counts,
  // filtered list, totals, and footer numbers all reflect the same
  // "lines the user wants on this bill" universe.
  const visibleLines = useMemo(() => {
    if (!deletedLineIds || deletedLineIds.size === 0) return data.lines;
    return data.lines.filter(l => !deletedLineIds.has(l.id));
  }, [data.lines, deletedLineIds]);

  const counts: ReviewCounts = useMemo(() => {
    const matched = visibleLines.filter(
      l => l.match.status === "matched" && !l.match.warning,
    ).length;
    const needsReview = visibleLines.filter(l => lineNeedsReview(l.match)).length;
    const fees = visibleLines.filter(l => l.match.status === "fee").length;
    return { matched, needsReview, fees, total: visibleLines.length };
  }, [visibleLines]);

  // Bill-level totals shown in the footer strip. Product lines only —
  // fees flow into `chargesTotal` separately so the user can verify
  // "lines + charges = bill total" at a glance.
  const footerTotals = useMemo(() => {
    const productLines = visibleLines.filter(l => l.match.status !== "fee");
    const totalLineCount = productLines.length;
    let totalCases = 0;
    let totalWeightLbs = 0;
    let linesTotal = 0;
    for (const line of productLines) {
      totalCases += Number(line.cases) || 0;
      totalWeightLbs += Number(line.weight) || 0;
      linesTotal += Number(line.total) || 0;
    }
    const chargesTotal = (charges ?? []).reduce(
      (sum, c) => sum + (Number(c.amount) || 0),
      0,
    );
    return {
      totalLineCount,
      totalCases,
      totalWeightLbs,
      chargesTotal,
      linesTotal,
    };
  }, [visibleLines, charges]);

  const filteredLines = useMemo(() => {
    if (filter === "all") return visibleLines;
    if (filter === "matched")
      return visibleLines.filter(
        l => l.match.status === "matched" && !l.match.warning,
      );
    if (filter === "fees")
      return visibleLines.filter(l => l.match.status === "fee");
    return visibleLines.filter(l => lineNeedsReview(l.match));
  }, [visibleLines, filter]);

  // Virtualize the line-items list — big bills can run 100+ lines and
  // each LineRow brings its own product picker, conditional banners,
  // and expandable trays. Rendering them all eats noticeable frame
  // budget on the initial mount + every state change. `react-virtual`
  // only mounts rows in (or near) the viewport; off-screen rows are
  // skipped entirely. Variable heights from the trays/banners are
  // handled via `measureElement`. The active-line scroll behavior
  // routes through `scrollToIndex` instead of the old `scrollIntoView`
  // ref so it works even when the target row hasn't been rendered yet.
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredLines.length,
    getScrollElement: () => scrollContainerRef.current,
    // Estimate of a base LineRow's height (no trays / banners open).
    // Mis-estimating just changes the initial scroll-jump precision;
    // `measureElement` corrects it the moment each row mounts.
    estimateSize: () => 96,
    overscan: 6,
    getItemKey: index => filteredLines[index]?.id ?? index,
  });

  useEffect(() => {
    if (activeLineId == null) return;
    const idx = filteredLines.findIndex(l => l.id === activeLineId);
    if (idx < 0) return;
    // `align: "auto"` only scrolls when the target is out of view —
    // matches the previous `block: "nearest"` semantics. Reduced
    // motion is honored by react-virtual via the CSS scroll-behavior
    // on the parent so we don't need to thread it manually.
    rowVirtualizer.scrollToIndex(idx, { align: "auto" });
  }, [activeLineId, filteredLines, rowVirtualizer]);

  // Wrap setFilter so flipping the segmented control also retargets the active
  // line to the first still-visible row when the previous active row gets
  // filtered out. Doing this in the user-event handler (not an effect) keeps
  // the React Compiler happy and avoids the cascading-render warning.
  const handleFilterChange = (next: ReviewFilter) => {
    setFilter(next);
    if (activeLineId == null) return;
    const nextVisible =
      next === "all"
        ? visibleLines
        : next === "matched"
          ? visibleLines.filter(
              l => l.match.status === "matched" && !l.match.warning,
            )
          : next === "fees"
            ? visibleLines.filter(l => l.match.status === "fee")
            : visibleLines.filter(l => lineNeedsReview(l.match));
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
  // segmented control — as a function so it can read the live `counts` and
  // the outer `submitDisabled` flag (duplicate-bill ack, in-flight submit).
  const resolvedHeaderSlot =
    typeof headerSlot === "function"
      ? headerSlot({ counts, submitDisabled: submitDisabled === true })
      : headerSlot;
  const header = resolvedHeaderSlot ?? (
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-page">
      {topSlot}
      {header}

      {/* Two-pane row implemented as a flex row (not grid). Flex gives us
          predictable height-constraint propagation: with `flex-1 min-h-0`
          on the row AND each pane, children's max-height collapses to the
          available space rather than expanding the row to fit content.
          The previous grid implementation needed an explicit
          `grid-template-rows: 1fr` and even then the implicit
          `grid-auto-rows: auto` minimum sometimes let a tall right pane
          (100 line items) push past the row's allotment, breaking the
          inner overflow-y-auto chain. Inline `overflow-hidden` on each
          pane is a final belt — guarantees any residual overflow is
          clipped at the pane boundary so the inner scroll engages. */}
      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <PdfPane
            fileName={data.fileName}
            page={page}
            pages={data.pages}
            onPageChange={setPage}
            zoom={zoom}
            onZoom={setZoom}
            lines={data.lines}
            activeLineId={activeLineId}
            onLineClick={handleLineClickForCollapse}
            pdfFile={pdfFile}
            pdfLoadError={pdfLoadError}
            lineBboxes={lineBboxes}
            paneEnterClass={paneEnterClass}
            // The queue carousel passes its floating prev/next here so the
            // arrows sit inside PdfPane (a positioned ancestor) — keeps them
            // from triggering horizontal page scroll on narrow viewports.
            accessory={pdfPaneAccessory}
          />
        </div>

        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-page",
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
            paymentMethod={paymentMethod}
            onPaymentMethodChange={onPaymentMethodChange}
            notes={notes}
            onNotesChange={onNotesChange}
            invoiceNumber={invoiceNumber}
            onInvoiceNumberChange={onInvoiceNumberChange}
            invoiceDate={invoiceDate}
            onInvoiceDateChange={onInvoiceDateChange}
            receiveDate={receiveDate}
            onReceiveDateChange={onReceiveDateChange}
            collapsed={headerCollapsed}
            onToggleCollapse={() => setHeaderCollapsed(v => !v)}
          />

          {/* Duplicate-invoice warning. Hidden when the parsed (supplier,
              supplier-printed invoice number) doesn't match any posted
              bill — non-blocking when it does, just a banner with links to
              the existing bills so the user can compare. */}
          <DuplicateInvoiceBanner
            matches={duplicateMatches ?? []}
            acknowledged={duplicateAcknowledged}
            onAcknowledgedChange={onDuplicateAcknowledgedChange}
          />

          {/* Price-change banner. Renders nothing when there are no
              deviations, so this is a zero-cost slot for clean invoices. */}
          <PriceChangeBanner deviations={data.priceDeviations} />

          {/* Line items section — header + scroll area only. The bill-total
              footer is no longer inside this section; it lives in the bottom
              bar of <main> alongside PdfHint so both halves are siblings of
              the two-pane row and the scroll area is free of overlay padding.
              `overflow-hidden` here keeps the wrapper from being inflated by
              its scroll-list child — without it, a child with `flex-1` whose
              content far exceeds available space can still push the wrapper
              past the parent's allotment in some flexbox edge cases. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-3.5 border-b border-border-default bg-card px-[22px] py-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[15px] font-medium text-ink">
                  Line items
                </h2>
                {/* Show only the product-line count here. Fees are surfaced
                    separately via the Fees filter tab and the per-tab count
                    chip — counting them in the header would double-count. */}
                <span className="rounded bg-divider px-1.5 py-0.5 font-mono text-[11px] text-subtle">
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
                line stays visible above it when scrolled to the bottom.
                The virtualizer below positions rows absolutely inside a
                tall inner spacer; this outer div is the scroll port. */}
            <div
              ref={scrollContainerRef}
              className="h-0 min-h-0 flex-1 overflow-y-auto bg-page pb-20"
            >
              {filteredLines.length === 0 ? (
                <div className="px-[22px] py-12 text-center text-[13px] text-subtle">
                  No lines match this filter.
                </div>
              ) : (
                <div
                  style={{
                    height: rowVirtualizer.getTotalSize(),
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map(virtualRow => {
                    const line = filteredLines[virtualRow.index];
                    if (!line) return null;
                    return (
                      <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={el => {
                          // Track each row's actual rendered height so the
                          // virtualizer's total-size + offsets stay accurate
                          // when trays / banners expand or collapse.
                          rowVirtualizer.measureElement(el);
                          lineRefs.current[line.id] = el;
                        }}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <LineRow
                          line={line}
                          isActive={activeLineId === line.id}
                          onClick={() => handleLineClickForCollapse(line.id)}
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
                          weightEditorState={
                            lineWeightStates?.[line.id] ?? null
                          }
                          isWeightEditorOpen={
                            openWeightEditorLines?.has(line.id) ?? false
                          }
                          onToggleWeightEditor={
                            onToggleLineWeightEditor
                              ? () => onToggleLineWeightEditor(line.id)
                              : undefined
                          }
                          onWeightEditorChange={
                            onLineWeightChange
                              ? next => onLineWeightChange(line.id, next)
                              : undefined
                          }
                          lotExpiryState={
                            lineLotExpiryStates?.[line.id] ?? null
                          }
                          isLotExpiryEditorOpen={
                            openLotExpiryEditorLines?.has(line.id) ?? false
                          }
                          onToggleLotExpiryEditor={
                            onToggleLineLotExpiryEditor
                              ? () => onToggleLineLotExpiryEditor(line.id)
                              : undefined
                          }
                          onLotExpiryEditorChange={
                            onLineLotExpiryChange
                              ? next => onLineLotExpiryChange(line.id, next)
                              : undefined
                          }
                          costDiff={lineCostDiffs?.[line.id] ?? null}
                          onToggleCostAck={onToggleCostAck}
                          onDelete={
                            onDeleteLine
                              ? () => onDeleteLine(line.id)
                              : undefined
                          }
                          onCasesChange={
                            onLineCasesChange
                              ? cases => onLineCasesChange(line.id, cases)
                              : undefined
                          }
                          submitErrors={lineSubmitErrors?.[line.id] ?? null}
                          isUserAdded={
                            userAddedLineIds?.has(line.id) ?? false
                          }
                          userAddedUnitPrice={
                            userAddedLinePrices?.[line.id] ?? ""
                          }
                          onUserAddedUnitPriceChange={
                            onUserAddedLineUnitPriceChange
                              ? value =>
                                  onUserAddedLineUnitPriceChange(line.id, value)
                              : undefined
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Deleted-lines notice. The user can wipe lines they don't
                  want on this bill; we keep them out of the rendered list
                  + the submit payload, but leave a small footer so an
                  accidental click is one-step recoverable. */}
              {deletedLineIds && deletedLineIds.size > 0 && onRestoreAllLines ? (
                <div className="flex items-center justify-between gap-3 border-t border-border-default bg-page px-[22px] py-2 text-[12px] text-subtle">
                  <span>
                    {deletedLineIds.size} line
                    {deletedLineIds.size === 1 ? "" : "s"} removed from this bill
                  </span>
                  <button
                    type="button"
                    onClick={onRestoreAllLines}
                    className="font-medium text-ink underline-offset-2 hover:underline"
                  >
                    Restore all
                  </button>
                </div>
              ) : null}

              {/* "+ Add line" — surfaces when the parser missed a row
                  entirely (most common on hand-written / heavily abbreviated
                  bills). The new line lands at the bottom of the list with
                  an unmatched product so the user picks a catalog product,
                  sets qty + weight, and types in a unit price. */}
              {onAddLine ? (
                <div className="flex justify-start border-t border-border-default bg-page px-[22px] py-2">
                  <button
                    type="button"
                    onClick={onAddLine}
                    className="text-[12px] font-medium text-ink underline-offset-2 hover:underline"
                  >
                    + Add line
                  </button>
                </div>
              ) : null}

              {/* Non-inventory charges panel — rendered inside the same
                  scroll container as the line items so it scrolls with
                  them. Submit's `charges` payload comes from this state. */}
              {charges && onChargesChange ? (
                <ChargesPanel
                  charges={charges}
                  onChange={onChargesChange}
                />
              ) : null}
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
        className="fixed right-0 bottom-0 z-20 grid grid-cols-2 overflow-hidden transition-[left] duration-200 ease-linear"
        style={{
          left: sidebarState === "collapsed" ? 0 : "var(--sidebar-width)",
        }}
      >
        <PdfHint />
        <ReviewFooterStrip
          rememberAliases={rememberAliasesValue}
          onRememberAliasesChange={setRememberAliases}
          totalLineCount={footerTotals.totalLineCount}
          totalCases={footerTotals.totalCases}
          totalWeightLbs={footerTotals.totalWeightLbs}
          chargesTotal={footerTotals.chargesTotal}
          billTotal={data.parsed.total.value}
        />
      </div>
    </div>
  );
}
