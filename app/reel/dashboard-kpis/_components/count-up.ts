"use client";

import { useEffect, useState } from "react";
import { animate, useMotionValue, useMotionValueEvent } from "motion/react";

// Animated number that eases up to its target. Used by every KPI card on the
// dashboard reel. Returns the current interpolated value so callers can
// format it however they want (money, percent, plain count).
export function useCountUp(
  target: number,
  durationMs = 1400,
  delayMs = 0,
): number {
  const mv = useMotionValue(0);
  const [snapshot, setSnapshot] = useState(0);

  useMotionValueEvent(mv, "change", setSnapshot);

  useEffect(() => {
    mv.set(0);
    const controls = animate(mv, target, {
      duration: durationMs / 1000,
      delay: delayMs / 1000,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [target, durationMs, delayMs, mv]);

  return snapshot;
}

export function formatMoney(v: number): string {
  return `$${Math.round(v).toLocaleString()}`;
}

export function formatPercent(v: number): string {
  return `${v.toFixed(1)}%`;
}

export function formatCount(v: number): string {
  return Math.round(v).toLocaleString();
}
