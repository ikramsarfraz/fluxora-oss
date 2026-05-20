"use client";

import { useEffect, useState } from "react";

export type Phase =
  | "intro"
  | "snapshot"
  | "drill-pill"
  | "receivables"
  | "wins-pill"
  | "wins"
  | "outro";

const PHASE_DURATION_MS: Record<Phase, number> = {
  intro: 3000,
  snapshot: 8500,
  "drill-pill": 1500,
  receivables: 8500,
  "wins-pill": 1500,
  wins: 8500,
  outro: 4000,
};

const PHASE_ORDER: Phase[] = [
  "intro",
  "snapshot",
  "drill-pill",
  "receivables",
  "wins-pill",
  "wins",
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
