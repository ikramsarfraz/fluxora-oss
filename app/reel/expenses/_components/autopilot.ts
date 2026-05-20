"use client";

import { useEffect, useState } from "react";

export type Phase =
  | "intro"
  | "drop"
  | "extract-pill"
  | "extract"
  | "post-pill"
  | "post"
  | "outro";

const PHASE_DURATION_MS: Record<Phase, number> = {
  intro: 3000,
  drop: 5500,
  "extract-pill": 1500,
  extract: 8500,
  "post-pill": 1500,
  post: 7500,
  outro: 4000,
};

const PHASE_ORDER: Phase[] = [
  "intro",
  "drop",
  "extract-pill",
  "extract",
  "post-pill",
  "post",
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
