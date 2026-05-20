"use client";

import { motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// How often (ms) a moment replays its entrance animation while it remains
// in view. Tuned to be longer than the longest moment's full animation so
// nothing gets cut off — but short enough that visitors who pause on a
// section see the moment loop a couple of times.
const DEFAULT_LOOP_MS = 6500;

// Frame wrapper for product moments. Subtle elevation, rounded corners,
// optional tab label at the top-left to set context without screaming.
//
// Behaviour: while the frame is in view, the inner content remounts every
// `loopMs` so the entrance animation re-plays. When the frame scrolls out
// of view, the interval is paused — visitors don't pay for animations they
// can't see, and offscreen moments don't pull the eye when the user is
// reading something else. On re-entry, the moment replays immediately so
// people who scroll back see motion straight away.
export function MomentFrame({
  label,
  tone = "forest",
  loopMs = DEFAULT_LOOP_MS,
  children,
  className,
  contentClassName,
}: {
  label?: string;
  tone?: "forest" | "success" | "warning" | "info";
  loopMs?: number;
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

  const ref = useRef<HTMLDivElement>(null);
  // `amount: 0.25` — a quarter of the moment must be on-screen before we
  // consider it visible. Prevents the loop from kicking on slivers as
  // someone scrolls past quickly.
  const inView = useInView(ref, { amount: 0.25 });
  const [loopKey, setLoopKey] = useState(0);
  const hasBeenSeen = useRef(false);

  useEffect(() => {
    if (!inView) return;
    // Replay immediately on re-entry, but not on the very first mount —
    // motion's `initial → animate` already plays the entrance once.
    if (hasBeenSeen.current) {
      setLoopKey((k) => k + 1);
    }
    hasBeenSeen.current = true;
    const id = setInterval(() => setLoopKey((k) => k + 1), loopMs);
    return () => clearInterval(id);
  }, [inView, loopMs]);

  return (
    <div
      ref={ref}
      className={cn("relative", className)}
      // Disable browser scroll-anchoring. When the inner key bumps every
      // loopMs the subtree remounts; without this, the browser may try to
      // "anchor" scroll position to the changing element and yank the page.
      style={{ overflowAnchor: "none" }}
    >
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
        {/* The `loopKey` remounts the entire inner tree on each cycle so
            each moment's motion variants fire their entrance animation
            again. Keep callers free of any per-moment loop wiring. */}
        <div key={loopKey}>{children}</div>
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
