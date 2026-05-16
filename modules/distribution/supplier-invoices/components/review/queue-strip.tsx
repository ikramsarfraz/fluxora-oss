"use client";

import { Check, ChevronLeft, ChevronRight, FileText } from "lucide-react";

import { cn } from "@/lib/utils";

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

      {/* Prev arrow */}
      <ArrowButton
        disabled={!hasPrev}
        onClick={onPrev}
        title="Previous (←)"
        className="mr-[6px]"
      >
        <ChevronLeft className="size-[14px]" strokeWidth={1.6} />
      </ArrowButton>

      {/* Carousel — horizontal scroll with thin scrollbar. `min-w-0` is
          required so this flex item can actually shrink: flex items have an
          implicit `min-width: auto` (= intrinsic content size) that would
          otherwise let the cards push the strip wider than the viewport and
          spill horizontal scroll onto <main>. */}
      <div
        className="flex flex-1 items-stretch gap-2 overflow-x-auto overflow-y-hidden"
        style={{ paddingBottom: 2 }}
      >
        {queue.map((entry, idx) => (
          <QueueCard
            key={entry.key}
            entry={entry}
            position={idx + 1}
            isCurrent={entry.key === currentKey}
            isCompleting={entry.key === completingKey}
            onClick={() => {
              if (entry.key !== completingKey) onPick(entry.key);
            }}
          />
        ))}
      </div>

      {/* Next arrow */}
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
  onClick,
}: {
  entry: QueueEntry;
  position: number;
  isCurrent: boolean;
  isCompleting: boolean;
  onClick: () => void;
}) {
  const supplierWarn = !entry.supplierMatched;
  const needsReview = entry.needsReviewCount;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isCompleting}
      // Hover + active styles are below in inline style for the lift effect;
      // the className handles base focus ring + transition timing.
      className={cn(
        "review-queue-card relative flex shrink-0 flex-col gap-[5px] rounded-[9px] text-left transition-[transform,background,border-color,opacity] duration-150 ease-[cubic-bezier(.2,.7,.2,1)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--stone-ink)]",
        isCurrent ? "translate-y-[-2px]" : "hover:translate-y-[-1px]",
        isCompleting && "review-queue-card-completing",
      )}
      style={{
        minWidth: 230,
        maxWidth: 280,
        padding: "8px 10px",
        background: isCurrent
          ? "var(--stone-surface)"
          : "rgba(255,255,255,0.55)",
        border: `1px solid ${isCurrent ? "var(--stone-ink)" : "var(--stone-line)"}`,
        outline: isCurrent
          ? `2px solid color-mix(in oklch, var(--stone-ink) 15%, transparent)`
          : "none",
        outlineOffset: -1,
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

      {/* 2px ink underline pinned to the bottom edge of the current card. */}
      {isCurrent ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0"
          style={{
            bottom: -1,
            height: 2,
            background: "var(--stone-ink)",
            borderRadius: 1,
          }}
        />
      ) : null}
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
