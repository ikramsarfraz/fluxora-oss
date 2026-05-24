"use client";

import { cn } from "@/lib/utils";

/**
 * Track + fill bar shared by the single-PDF, bulk, and re-scan loaders.
 * Fill swaps to success-fg when `isDone`; while running, a subtle bar-glide
 * highlight slides left→right for forward-motion polish.
 */
export function ProgressBar({
  value,
  isDone = false,
  height = 8,
  className,
}: {
  value: number;
  isDone?: boolean;
  /** Track height; 8 for the main loaders, 6 per-row, 4 in the rescan banner. */
  height?: 8 | 6 | 4;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const running = !isDone && clamped > 0 && clamped < 100;
  const radius = height / 2;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative w-full overflow-hidden", className)}
      style={{
        height,
        background: "var(--color-surface)",
        borderRadius: radius,
      }}
    >
      <div
        className={cn(
          "h-full transition-[width] duration-200 ease-linear",
          running && "parse-bar-glide",
        )}
        style={{
          width: `${clamped}%`,
          background: isDone ? "var(--color-success-fg)" : "var(--color-forest)",
          borderRadius: radius,
        }}
      />
    </div>
  );
}
