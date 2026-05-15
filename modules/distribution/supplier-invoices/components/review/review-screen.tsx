"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { FilterSegmented } from "./filter-segmented";
import { HeaderCard } from "./header-card";
import type { LineBbox } from "./line-bbox";
import { LineRow } from "./line-row";
import type {
  ProductLookup,
  SupplierLookup,
} from "./map-pipeline-to-review-data";
import { PdfPane } from "./pdf-pane";
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
}) {
  const [zoom, setZoom] = useState(85);
  const [activeLineId, setActiveLineId] = useState<number | null>(data.lines[0]?.id ?? null);
  const [supplier, setSupplier] = useState(data.parsed.supplier.value);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  // When `rememberAliases` is uncontrolled, fall back to local state so the
  // demo path keeps working without the host wiring anything.
  const [rememberAliasesLocal, setRememberAliasesLocal] = useState(true);
  const rememberAliasesValue = rememberAliases ?? rememberAliasesLocal;
  const setRememberAliases = onRememberAliasesChange ?? setRememberAliasesLocal;
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const counts: ReviewCounts = useMemo(() => {
    const matched = data.lines.filter(l => l.match.status === "matched" && !l.match.warning).length;
    const needsReview = data.lines.filter(l => lineNeedsReview(l.match)).length;
    const fees = data.lines.filter(l => l.match.status === "fee").length;
    return { matched, needsReview, fees, total: data.lines.length };
  }, [data.lines]);

  const filteredLines = useMemo(() => {
    if (filter === "all") return data.lines;
    if (filter === "matched")
      return data.lines.filter(l => l.match.status === "matched" && !l.match.warning);
    if (filter === "fees") return data.lines.filter(l => l.match.status === "fee");
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
          ? data.lines.filter(l => l.match.status === "matched" && !l.match.warning)
          : next === "fees"
            ? data.lines.filter(l => l.match.status === "fee")
            : data.lines.filter(l => lineNeedsReview(l.match));
    if (!nextVisible.some(l => l.id === activeLineId)) {
      setActiveLineId(nextVisible[0]?.id ?? null);
    }
  };

  return (
    <main className="-m-4 flex h-[calc(100dvh-4rem)] min-w-0 flex-1 flex-col bg-stone-bg">
      <ReviewHeaderStrip
        fileName={data.fileName}
        counts={counts}
        onSubmit={onSubmit}
        submitDisabled={submitDisabled}
        onCancel={onCancel}
        onReparse={onReparse}
      />

      <div className="flex min-h-0 flex-1">
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
        />

        <div
          className="flex min-h-0 flex-col bg-stone-bg"
          style={{ width: "52%", minWidth: 600 }}
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

          {/* Line items section — header + scroll area only. The footer is
              promoted to a direct child of the right pane below so it stays
              pinned at the bottom regardless of how much the line list
              scrolls or how short the pane gets. */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-3.5 border-b border-stone-line bg-stone-surface px-[22px] py-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[15px] font-semibold text-stone-ink">Line items</h2>
                {/* Show only the product-line count here. Fees are surfaced
                    separately via the Fees filter tab and the per-tab count
                    chip — counting them in the header would double-count. */}
                <span className="rounded bg-stone-line2 px-1.5 py-0.5 font-mono text-[11px] text-stone-muted">
                  {counts.total - counts.fees}
                </span>
              </div>
              <FilterSegmented filter={filter} counts={counts} onChange={handleFilterChange} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-stone-bg">
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
                      matchedProductId={lineMatchedProductIds?.[line.id] ?? null}
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
                      onSkip={onSkipLine ? () => onSkipLine(line.id) : undefined}
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

          {/* Bill-total footer — direct child of the right pane with shrink-0
              so the bill total stays visible even if the inner line-items
              section collapses or scrolls. */}
          <div className="shrink-0">
            <ReviewFooterStrip
              rememberAliases={rememberAliasesValue}
              onRememberAliasesChange={setRememberAliases}
              billTotal={data.parsed.total.value}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
