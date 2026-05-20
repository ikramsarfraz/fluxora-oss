"use client";

import { useEffect, useState } from "react";

export type Phase =
  | "intro"
  | "link"
  | "sync-pill"
  | "sync"
  | "match-pill"
  | "match"
  | "outro";

const PHASE_DURATION_MS: Record<Phase, number> = {
  intro: 3000,
  link: 7500,
  "sync-pill": 1400,
  sync: 7500,
  "match-pill": 1400,
  match: 9500,
  outro: 4000,
};

const PHASE_ORDER: Phase[] = [
  "intro",
  "link",
  "sync-pill",
  "sync",
  "match-pill",
  "match",
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
