"use client";

import { useEffect, useMemo, useRef } from "react";
import { Check, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

import { cn } from "@/lib/utils";

import { getSupplierPerformanceStatsAction } from "../../actions";
import type { SupplierPerformanceBucket } from "../../services/bulk-import-history";

import type { QueueEntry } from "./queue-types";
import { REVIEW_COLORS } from "./tokens";

const fmt = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function QueueStrip({
  queue,
  currentKey,
  completingKey,
  onPick,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  queue: QueueEntry[];
  currentKey: string | null;
  completingKey: string | null;
  onPick: (key: string) => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  // Fetch vendor-performance buckets for every distinct supplier in the
  // queue, in a single round-trip. Stale-time is generous — the buckets only
  // change when posted bills accrue, which the user is doing right now via
  // the carousel; we invalidate on completion (see ReviewContainer).
  const supplierIds = useMemo(
    () =>
      Array.from(
        new Set(
          queue
            .map(q => q.supplierId)
            .filter((id): id is string => Boolean(id)),
        ),
      ),
    [queue],
  );
  const statsQuery = useQuery({
    queryKey: ["supplier-performance", supplierIds] as const,
    queryFn: () => getSupplierPerformanceStatsAction(supplierIds),
    enabled: supplierIds.length > 0,
    staleTime: 60_000,
  });
  const bucketBySupplierId = useMemo(() => {
    const map = new Map<string, SupplierPerformanceBucket>();
    for (const s of statsQuery.data ?? []) map.set(s.supplierId, s.bucket);
    return map;
  }, [statsQuery.data]);

  // Virtualize the horizontal card carousel. For typical queues (5-50
  // entries) this is overkill, but a single tenant uploading 200+ PDFs
  // in one batch would otherwise pay the cost of mounting every card
  // (each with its own QueueCard render + scrollIntoView ref + the
  // supplier-performance bucket lookup) on every prev/next nav. With
  // virtualization, the active card and its neighbors are always
  // rendered, and the rest are skipped.
  //
  // The active-card scroll behavior switches from per-card refs +
  // scrollIntoView to scrollToIndex — works correctly even when the
  // target card isn't rendered yet.
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const cardVirtualizer = useVirtualizer({
    count: queue.length,
    getScrollElement: () => scrollContainerRef.current,
    // Card minWidth is 230 + 8px flex gap = 238. Estimating slightly
    // higher keeps the overscan generous; measureElement corrects the
    // virtualizer once cards mount.
    estimateSize: () => 245,
    horizontal: true,
    overscan: 4,
    getItemKey: i => queue[i]?.key ?? i,
  });

  useEffect(() => {
    if (!currentKey) return;
    const idx = queue.findIndex(q => q.key === currentKey);
    if (idx < 0) return;
    cardVirtualizer.scrollToIndex(idx, { align: "auto", behavior: "smooth" });
  }, [currentKey, queue, cardVirtualizer]);

  return (
    <div
      className="flex shrink-0 items-stretch border-b border-stone-line"
      // The strip uses a warmer neutral than the page bg to anchor itself as
      // an inset chrome bar. Matches the design system's "sidebar" tone.
      style={{ padding: "10px 14px", background: "#f3f1ea" }}
    >
      {/* Caption block — label + counter, divided from the cards on its right. */}
      <div
        className="flex flex-col justify-center border-r border-stone-line"
        style={{ paddingRight: 14, marginRight: 14, minWidth: 140 }}
      >
        <div
          className="font-semibold uppercase"
          style={{
            fontSize: 10,
            color: REVIEW_COLORS.mutedSoft,
            letterSpacing: "0.08em",
          }}
        >
          Review queue
        </div>
        <div className="mt-[3px] flex items-baseline gap-[6px]">
          <span className="font-mono text-[18px] font-bold tabular-nums text-stone-ink">
            {queue.length}
          </span>
          <span className="text-[12px] text-stone-muted">
            {queue.length === 1 ? "invoice left" : "invoices left"}
          </span>
        </div>
      </div>

      {/* Prev arrow — advances selection one invoice back. The
          currentKey-change effect above auto-scrolls the new card into view. */}
      <ArrowButton
        disabled={!hasPrev}
        onClick={onPrev}
        title="Previous (←)"
        className="mr-[6px]"
      >
        <ChevronLeft className="size-[14px]" strokeWidth={1.6} />
      </ArrowButton>

      {/* Carousel — real scroll container (`overflow-x-auto`) so
          `scrollIntoView` works reliably in every browser, with the visible
          scrollbar hidden via `no-scrollbar` so the user navigates via the
          prev/next arrows (which advance `currentKey`; the effect above
          auto-scrolls the matching card into view). `min-w-0` lets this
          flex item shrink — flex items have an implicit `min-width: auto`
          (= intrinsic content size) that would otherwise let the cards
          push the strip wider than the viewport and spill horizontal
          scroll onto <main>.
          Symmetric padding on all four axes leaves room inside the clip
          for the active card's 2px lift plus the 2px Tailwind ring (and
          the same ring on focus-visible) so the first/last card's ring
          doesn't get sheared off at the strip edges. */}
      <div
        ref={scrollContainerRef}
        className="no-scrollbar flex min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden scroll-smooth"
        style={{ padding: 5 }}
      >
        {/* Inner spacer holds the virtualizer's reported total width so
            the scrollbar geometry matches the full queue length. Cards
            are absolutely positioned inside it at their virtual offset.
            8px gap from the original flex layout is folded into each
            card's translateX so the spacing carries through. */}
        <div
          style={{
            width: cardVirtualizer.getTotalSize(),
            height: "100%",
            position: "relative",
            flexShrink: 0,
          }}
        >
          {cardVirtualizer.getVirtualItems().map(virtualCard => {
            const entry = queue[virtualCard.index];
            if (!entry) return null;
            return (
              <div
                key={virtualCard.key}
                data-index={virtualCard.index}
                ref={el => cardVirtualizer.measureElement(el)}
                className="flex items-stretch"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "100%",
                  transform: `translateX(${virtualCard.start}px)`,
                  paddingRight: 8,
                }}
              >
                <QueueCard
                  entry={entry}
                  position={virtualCard.index + 1}
                  isCurrent={entry.key === currentKey}
                  isCompleting={entry.key === completingKey}
                  performanceBucket={
                    entry.supplierId
                      ? bucketBySupplierId.get(entry.supplierId) ?? null
                      : null
                  }
                  onClick={() => {
                    if (entry.key !== completingKey) onPick(entry.key);
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Next arrow — advances selection one invoice forward. The
          currentKey-change effect above auto-scrolls the new card into view. */}
      <ArrowButton
        disabled={!hasNext}
        onClick={onNext}
        title="Next (→)"
        className="ml-[6px]"
      >
        <ChevronRight className="size-[14px]" strokeWidth={1.6} />
      </ArrowButton>
    </div>
  );
}

function QueueCard({
  entry,
  position,
  isCurrent,
  isCompleting,
  performanceBucket,
  onClick,
}: {
  entry: QueueEntry;
  position: number;
  isCurrent: boolean;
  isCompleting: boolean;
  performanceBucket: SupplierPerformanceBucket | null;
  onClick: () => void;
}) {
  const supplierWarn = !entry.supplierMatched;
  const needsReview = entry.needsReviewCount;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isCompleting}
      // Visual tokens come from the same Card primitive used elsewhere in
      // the app (--card, --foreground) so the strip stays consistent with
      // bills/invoices listing cards. Active state is a heavier ring +
      // shadow, not a color swap — keeps both states on the same surface
      // so density and contrast stay even across the carousel.
      className={cn(
        "review-queue-card relative flex shrink-0 flex-col gap-[5px] rounded-xl bg-card text-card-foreground text-left transition-[transform,box-shadow,opacity] duration-150 ease-[cubic-bezier(.2,.7,.2,1)]",
        "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none",
        isCurrent
          ? "translate-y-[-2px] shadow-sm ring-2 ring-foreground/60"
          : "shadow-xs ring-1 ring-foreground/10 hover:translate-y-[-1px] hover:ring-foreground/30",
        isCompleting && "review-queue-card-completing",
      )}
      style={{
        minWidth: 230,
        maxWidth: 280,
        padding: "8px 10px",
        cursor: isCompleting ? "default" : "pointer",
      }}
    >
      {/* Row 1: position chip + PDF icon + supplier short name */}
      <div className="flex items-center gap-[7px]">
        <span
          className="flex shrink-0 items-center justify-center rounded-[5px] font-mono text-[10px] font-bold tabular-nums"
          style={{
            width: 18,
            height: 18,
            background: isCurrent ? "var(--stone-ink)" : "var(--stone-line2)",
            color: isCurrent ? "var(--stone-surface)" : "var(--stone-muted)",
          }}
        >
          {position}
        </span>
        <FileText
          className="size-[14px] shrink-0"
          strokeWidth={1.6}
          style={{
            color: isCurrent ? "var(--stone-ink)" : "var(--stone-muted)",
          }}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[12px]",
            isCurrent
              ? "font-semibold text-stone-ink"
              : "font-medium text-stone-muted",
          )}
        >
          {entry.supplierShort}
        </span>
        {/* Vendor-performance badge — green/yellow/red dot hinting at how
            many past bills we've posted from this supplier. Lets the user
            sequence work (knock out green first, save red for last).
            Hidden when there's no matched supplier or no data yet. */}
        {performanceBucket ? (
          <VendorPerformanceDot bucket={performanceBucket} />
        ) : null}
      </div>

      {/* Row 2: invoice ref · total */}
      <div
        className="flex items-center gap-[7px] text-[11px]"
        style={{ paddingLeft: 25 }}
      >
        <span className="font-mono" style={{ color: REVIEW_COLORS.mutedSoft }}>
          {entry.invoiceShort}
        </span>
        <span style={{ color: REVIEW_COLORS.mutedSoft }}>·</span>
        <span className="font-mono tabular-nums text-stone-muted">
          ${fmt(entry.total)}
        </span>
      </div>

      {/* Row 3: tiny status pills */}
      <div
        className="mt-px flex items-center gap-[6px]"
        style={{ paddingLeft: 25 }}
      >
        {supplierWarn ? (
          <span
            title="Supplier needs attention"
            className="block size-[6px] rounded-full"
            style={{ background: REVIEW_COLORS.warn }}
          />
        ) : null}
        {needsReview > 0 ? (
          <span
            className="inline-flex items-center gap-[4px] text-[10.5px] font-semibold"
            style={{ color: REVIEW_COLORS.danger }}
          >
            <span
              className="block size-[5px] rounded-full"
              style={{ background: REVIEW_COLORS.danger }}
            />
            {needsReview} to fix
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-[4px] text-[10.5px] font-semibold"
            style={{ color: REVIEW_COLORS.good }}
          >
            <Check className="size-[10px]" strokeWidth={2.4} />
            Ready
          </span>
        )}
        <span
          className="ml-auto font-mono text-[10px]"
          style={{ color: REVIEW_COLORS.mutedSoft }}
        >
          L{entry.lineCount}
        </span>
      </div>

    </button>
  );
}

function ArrowButton({
  disabled,
  onClick,
  title,
  className,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center justify-center self-center rounded-[8px] border border-stone-line bg-stone-surface text-stone-ink transition-colors",
        "enabled:hover:bg-[color:var(--stone-line2)]",
        "disabled:cursor-not-allowed disabled:opacity-35",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--stone-ink)]",
        className,
      )}
      style={{ width: 34, height: 34 }}
    >
      {children}
    </button>
  );
}

function VendorPerformanceDot({
  bucket,
}: {
  bucket: SupplierPerformanceBucket;
}) {
  const fill =
    bucket === "green"
      ? REVIEW_COLORS.good
      : bucket === "yellow"
        ? REVIEW_COLORS.warn
        : REVIEW_COLORS.danger;
  const tooltip =
    bucket === "green"
      ? "Trusted vendor — many past bills; alias map mature."
      : bucket === "yellow"
        ? "Some past history with this vendor."
        : "New vendor — expect to map products manually.";
  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      className="block size-[7px] shrink-0 rounded-full"
      style={{ background: fill }}
    />
  );
}
