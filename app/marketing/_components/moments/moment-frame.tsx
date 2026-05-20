"use client";

import { motion } from "motion/react";

import { cn } from "@/lib/utils";

// Frame wrapper for product moments. Subtle elevation, rounded corners,
// optional tab label at the top-left to set context without screaming.
export function MomentFrame({
  label,
  tone = "forest",
  children,
  className,
  contentClassName,
}: {
  label?: string;
  tone?: "forest" | "success" | "warning" | "info";
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const tabTone =
    tone === "success"
      ? "bg-success-bg text-success-fg border-success-border/60"
      : tone === "warning"
        ? "bg-warning-bg text-warning-fg border-warning-border/60"
        : tone === "info"
          ? "bg-info-bg text-info-fg border-info-border/60"
          : "bg-forest-tint text-forest-mid border-forest-tint-deep/60";

  return (
    <div className={cn("relative", className)}>
      {label ? (
        <div
          className={cn(
            "absolute left-5 -top-3 z-10 inline-flex items-center gap-1.5 rounded-full border bg-card-warm px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] shadow-sm",
            tabTone,
          )}
        >
          <span className="size-1 rounded-full bg-current" />
          {label}
        </div>
      ) : null}
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border-default bg-card-warm shadow-[0_22px_50px_-30px_rgba(31,58,46,0.35)]",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

// Tiny animated value tag — used for KPI deltas, time savings, etc.
export function PulseDot({ tone = "forest" }: { tone?: "forest" | "warning" | "success" }) {
  const dot =
    tone === "warning"
      ? "bg-warning-fg"
      : tone === "success"
        ? "bg-success-fg"
        : "bg-forest-mid";
  return (
    <span className="relative flex size-1.5">
      <motion.span
        className={cn("absolute inset-0 rounded-full", dot)}
        animate={{ opacity: [0.35, 0, 0.35], scale: [1, 2, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className={cn("relative size-1.5 rounded-full", dot)} />
    </span>
  );
}
