"use client";

import { useEffect, useState } from "react";

export type Phase =
  | "intro"
  | "plans"
  | "checkout-pill"
  | "checkout"
  | "active-pill"
  | "active"
  | "outro";

const PHASE_DURATION_MS: Record<Phase, number> = {
  intro: 3000,
  plans: 7500,
  "checkout-pill": 1500,
  checkout: 8500,
  "active-pill": 1500,
  active: 6500,
  outro: 4000,
};

const PHASE_ORDER: Phase[] = [
  "intro",
  "plans",
  "checkout-pill",
  "checkout",
  "active-pill",
  "active",
  "outro",
];

export function useAutopilot(): { phase: Phase; loopId: number } {
  const [phase, setPhase] = useState<Phase>("intro");
  const [loopId, setLoopId] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      const next = (PHASE_ORDER.indexOf(phase) + 1) % PHASE_ORDER.length;
      if (next === 0) setLoopId((id) => id + 1);
      setPhase(PHASE_ORDER[next]);
    }, PHASE_DURATION_MS[phase]);
    return () => clearTimeout(t);
  }, [phase]);
  return { phase, loopId };
}
