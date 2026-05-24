"use client";

import { cn } from "@/lib/utils";

/**
 * Header field with skeleton fallback. Reveals via `line-appear` once `value`
 * arrives; until then renders a 14px shimmer bar so the field's footprint is
 * stable across the empty → populated transition.
 */
export function SkeletonField({
  label,
  value,
  mono = false,
  className,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-[7px] px-3 py-2.5", className)}
      style={{
        background: "var(--color-surface)",
        border: "0.5px solid var(--color-border-default)",
      }}
    >
      <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </div>
      {value ? (
        <div
          className={cn(
            "parse-line-appear truncate text-[13.5px] font-medium text-ink",
            mono && "font-mono tabular-nums",
          )}
        >
          {value}
        </div>
      ) : (
        <div className="parse-shimmer h-[14px] w-[70%] rounded-[3px]" aria-hidden />
      )}
    </div>
  );
}
