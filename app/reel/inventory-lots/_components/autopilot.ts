"use client";

import { useEffect, useState } from "react";

export type Phase =
  | "intro"
  | "overview"
  | "drill-pill"
  | "ledger"
  | "adjust-pill"
  | "adjustment"
  | "outro";

const PHASE_DURATION_MS: Record<Phase, number> = {
  intro: 3000,
  overview: 6500,
  "drill-pill": 1500,
  ledger: 11000,
  "adjust-pill": 1500,
  adjustment: 6500,
  outro: 4000,
};

const PHASE_ORDER: Phase[] = [
  "intro",
  "overview",
  "drill-pill",
  "ledger",
  "adjust-pill",
  "adjustment",
  "outro",
];

export function useAutopilot(): { phase: Phase; loopId: number } {
  const [phase, setPhase] = useState<Phase>("intro");
  const [loopId, setLoopId] = useState(0);

  useEffect(() => {
    const handle = setTimeout(() => {
      const nextIdx = (PHASE_ORDER.indexOf(phase) + 1) % PHASE_ORDER.length;
      if (nextIdx === 0) setLoopId((id) => id + 1);
      setPhase(PHASE_ORDER[nextIdx]);
    }, PHASE_DURATION_MS[phase]);
    return () => clearTimeout(handle);
  }, [phase]);

  return { phase, loopId };
}
