"use client";

import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";

import { REVIEW_COLORS } from "./tokens";

/**
 * "All caught up" state — rendered when the review queue has been cleared.
 * Has a one-shot 800ms burst entrance via the `review-done-burst` keyframe
 * in globals.css. CTA navigates back to the bulk-import landing.
 */
export function QueueDone({ onBackToBulk }: { onBackToBulk: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <div
        className="review-done-burst rounded-2xl border border-stone-line bg-stone-surface text-center"
        style={{
          maxWidth: 520,
          padding: "48px 40px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.05)",
        }}
      >
        <div
          className="mx-auto mb-5 flex items-center justify-center rounded-full"
          style={{
            width: 64,
            height: 64,
            background: REVIEW_COLORS.goodSoft,
            color: REVIEW_COLORS.good,
            border: `1.5px solid color-mix(in oklch, ${REVIEW_COLORS.good} 40%, transparent)`,
          }}
        >
          <Check className="size-[30px]" strokeWidth={2.4} />
        </div>
        <h1
          className="mb-2 font-semibold text-stone-ink"
          style={{ fontSize: 24, letterSpacing: "-0.015em" }}
        >
          All caught up
        </h1>
        <p
          className="mb-6 text-stone-muted"
          style={{ fontSize: 14 }}
        >
          Every invoice in this batch has been reviewed and posted. Inventory
          has been updated.
        </p>
        <Button
          type="button"
          onClick={onBackToBulk}
          className="h-9 gap-1.5 border-stone-ink bg-stone-ink text-[13px] text-stone-surface hover:bg-stone-ink/90"
        >
          Back to bulk import
          <ArrowRight className="size-[14px]" strokeWidth={1.8} />
        </Button>
      </div>
    </div>
  );
}
