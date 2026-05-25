"use client";

import { ArrowLeft, ArrowRight, FileText, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ProgressIndicator } from "./progress-indicator";
import { REVIEW_COLORS } from "./tokens";
import type { ReviewCounts } from "./types";

/**
 * Queue-aware page header — used in place of the legacy `ReviewHeaderStrip`
 * when the user is reviewing a bulk-import queue. Adds a queue position
 * counter ("3 of 5") and a segmented Skip / Complete & next CTA whose label
 * adapts to the queue state.
 */
export function ReviewQueueHeader({
  fileName,
  counts,
  position,
  total,
  hasNext,
  isLastRemaining,
  onBackToBulk,
  onReparse,
  reparsePending = false,
  onSkip,
  onComplete,
  submitting,
  submitDisabled,
}: {
  fileName: string;
  counts: ReviewCounts;
  /** 1-indexed position of the current invoice in the queue. */
  position: number;
  /** Number of remaining invoices in the queue. */
  total: number;
  /** True when there's another invoice after the current one. */
  hasNext: boolean;
  /** True when this is the only invoice still in the queue. */
  isLastRemaining: boolean;
  onBackToBulk?: () => void;
  onReparse?: () => void;
  /**
   * True while a rescan mutation is in flight. Drives the spinner +
   * "Re-scanning…" label on the Re-scan button so the user has visible
   * feedback during the (multi-second) AI round-trip.
   */
  reparsePending?: boolean;
  onSkip?: () => void;
  onComplete?: () => void;
  submitting?: boolean;
  /**
   * Outer host gate — true when the form has its own reason to block submit
   * (currently: unacknowledged posted-duplicate banner). Distinct from
   * `submitting` so the label can stay meaningful while a submit is queued
   * but pre-conditions aren't satisfied yet.
   */
  submitDisabled?: boolean;
}) {
  const needsReviewBlock = counts.needsReview > 0;
  const blocked =
    needsReviewBlock || submitting === true || submitDisabled === true;
  const completeLabel = (() => {
    if (needsReviewBlock) return `Resolve ${counts.needsReview} to continue`;
    if (submitDisabled === true) return "Confirm duplicate to continue";
    if (hasNext) return "Complete & next";
    if (isLastRemaining) return "Complete";
    return "Complete & finish";
  })();
  const showCompleteArrow = !blocked && hasNext;

  return (
    <div className="flex items-center justify-between gap-[18px] border-b border-border-default bg-page px-6 py-3">
      <div className="flex min-w-0 items-center gap-3.5">
        {/* File chip with red PDF icon. */}
        <div className="flex items-center gap-2.5 rounded-lg border border-border-default bg-card py-[5px] pl-2 pr-2.5">
          <FileText
            className="size-4 shrink-0"
            strokeWidth={1.6}
            style={{ color: REVIEW_COLORS.danger }}
          />
          <span className="max-w-[300px] truncate font-mono text-[12px] font-medium text-ink">
            {fileName}
          </span>
        </div>

        {/* Position counter chip. */}
        <span
          className="rounded font-mono text-[11px]"
          style={{
            color: REVIEW_COLORS.mutedSoft,
            background: "var(--color-divider)",
            padding: "4px 8px",
          }}
        >
          {position} of {total}
        </span>

        <ProgressIndicator counts={counts} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBackToBulk}
          className="h-8 gap-1.5 text-[12px]"
        >
          <ArrowLeft className="size-[12px]" strokeWidth={1.8} />
          Bulk list
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReparse}
          disabled={reparsePending || !onReparse}
          className="h-8 gap-1.5 text-[12px]"
        >
          {reparsePending ? (
            <Loader2 className="size-[12px] animate-spin" strokeWidth={1.8} />
          ) : (
            <RefreshCw className="size-[12px]" strokeWidth={1.6} />
          )}
          {reparsePending ? "Re-scanning…" : "Re-scan"}
        </Button>

        {/* Segmented Skip / Complete & next group. */}
        <div className="flex">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSkip}
            disabled={!hasNext}
            title="Skip without completing (→)"
            className="h-8 rounded-r-none border-r-0 text-[12px] disabled:opacity-50"
          >
            Skip for now
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onComplete}
            disabled={blocked}
            // aria-live keeps the label announceable when it flips
            // between "Resolve N to continue" / "Confirm duplicate" /
            // "Complete & next" so screen-reader users hear why the
            // button is gated without having to re-navigate to it.
            aria-live="polite"
            aria-disabled={blocked}
            className={cn(
              "h-8 gap-1.5 rounded-l-none border-forest-mid bg-forest-mid text-[12px] text-card-warm hover:bg-forest",
              blocked && "cursor-not-allowed opacity-50",
            )}
          >
            {completeLabel}
            {showCompleteArrow ? (
              <ArrowRight
                className="size-[12px]"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            ) : null}
          </Button>
        </div>
      </div>
    </div>
  );
}
