"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Floating circular prev/next buttons overlaid on the PDF pane while review
 * is open. Hidden when the corresponding direction is not available so users
 * don't get a "click does nothing" button at the start or end of the queue.
 */
export function FloatingNav({
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  return (
    <>
      {hasPrev ? (
        <FloatingArrow
          direction="prev"
          onClick={onPrev}
          title="Previous PDF (←)"
        />
      ) : null}
      {hasNext ? (
        <FloatingArrow
          direction="next"
          onClick={onNext}
          title="Next PDF (→)"
        />
      ) : null}
    </>
  );
}

function FloatingArrow({
  direction,
  onClick,
  title,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  title: string;
}) {
  const isPrev = direction === "prev";
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "absolute top-1/2 z-10 inline-flex items-center justify-center rounded-full text-stone-ink transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--stone-ink)]",
        "enabled:hover:bg-white",
      )}
      style={{
        width: 40,
        height: 40,
        // Left arrow sits 14px from the PDF pane's left edge; right arrow sits
        // just inside the inner divider between PDF and form panes (which is
        // at left:48% — 22px ≈ button half-width).
        left: isPrev ? 14 : "calc(48% - 22px)",
        transform: "translateY(-50%)",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
        border: "none",
      }}
    >
      {isPrev ? (
        <ChevronLeft className="size-[18px]" strokeWidth={1.8} />
      ) : (
        <ChevronRight className="size-[18px]" strokeWidth={1.8} />
      )}
    </button>
  );
}
