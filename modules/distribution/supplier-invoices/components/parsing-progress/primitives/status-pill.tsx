"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type StatusPillVariant = "live" | "done";

/**
 * Right-corner pill for streaming surfaces. Live renders a pulsing forest dot
 * on the card surface; Done swaps to the success-tinted background with a
 * check glyph.
 */
export function StatusPill({
  variant,
  label,
  className,
}: {
  variant: StatusPillVariant;
  label?: string;
  className?: string;
}) {
  const isDone = variant === "done";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-2.5 text-[11px] font-semibold",
        className,
      )}
      style={{
        background: isDone ? "var(--color-success-bg)" : "var(--color-card)",
        color: isDone ? "var(--color-success-fg)" : "var(--color-forest)",
        border: `0.5px solid ${
          isDone ? "var(--color-success-border)" : "var(--color-border-default)"
        }`,
      }}
    >
      {isDone ? (
        <Check className="size-3" strokeWidth={2} aria-hidden />
      ) : (
        <span
          className="parse-live-dot size-1.5 rounded-full"
          style={{ background: "var(--color-forest)" }}
        />
      )}
      {label ?? (isDone ? "Done" : "Live")}
    </span>
  );
}
