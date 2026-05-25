"use client";

import { cn } from "@/lib/utils";

export type StreamingLineItemState = "pending" | "parsing" | "parsed";

/**
 * One row in the streaming-preview line list. Mounts with a 350ms
 * `line-appear` entry animation; sibling staggering is the caller's job
 * via `delayIndex` (clamped at 5 × 30ms internally).
 */
export function StreamingLineItem({
  id,
  raw,
  total,
  state,
  delayIndex = 0,
}: {
  id: number;
  raw?: string;
  total?: string;
  state: StreamingLineItemState;
  delayIndex?: number;
}) {
  const pending = state === "pending";
  const parsing = state === "parsing";
  const parsed = state === "parsed";
  const stagger = Math.min(5, Math.max(0, delayIndex)) * 30;

  return (
    <div
      className="parse-line-appear flex items-center gap-2.5 rounded-[7px] px-3 py-2"
      style={{
        border: `0.5px solid ${
          parsing ? "var(--color-forest)" : "var(--color-border-default)"
        }`,
        background: pending ? "transparent" : "var(--color-card)",
        boxShadow: parsing ? "0 0 0 2px rgba(31, 58, 46, 0.08)" : undefined,
        animationDelay: `${stagger}ms`,
      }}
    >
      <span
        className="w-[22px] shrink-0 font-mono text-[10.5px] font-semibold tabular-nums text-muted"
        aria-hidden
      >
        L{id}
      </span>

      <div className="min-w-0 flex-1">
        {pending ? (
          <div className="parse-shimmer h-3 w-full rounded-[3px]" aria-hidden />
        ) : (
          <span
            className={cn(
              "block truncate font-mono text-[11.5px] tabular-nums",
              parsing ? "text-muted" : "text-ink",
            )}
          >
            {raw}
          </span>
        )}
      </div>

      {parsed && total ? (
        <span className="shrink-0 font-mono text-[12px] font-semibold tabular-nums text-ink">
          {total}
        </span>
      ) : null}

      {parsing ? (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium"
          style={{ color: "var(--color-forest)" }}
        >
          <span
            className="parse-live-dot size-1.5 rounded-full"
            style={{ background: "var(--color-forest)" }}
          />
          parsing
        </span>
      ) : null}

      {pending ? (
        <span className="shrink-0 font-mono text-[10.5px] text-muted">queued</span>
      ) : null}
    </div>
  );
}
