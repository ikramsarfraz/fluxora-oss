"use client";

import { useEffect, useState } from "react";

export type Phase =
  | "intro"
  | "subdomain"
  | "invite-pill"
  | "invite"
  | "checklist-pill"
  | "checklist"
  | "outro";

const PHASE_DURATION_MS: Record<Phase, number> = {
  intro: 3000,
  subdomain: 7500,
  "invite-pill": 1500,
  invite: 8500,
  "checklist-pill": 1500,
  checklist: 7500,
  outro: 4000,
};

const PHASE_ORDER: Phase[] = [
  "intro",
  "subdomain",
  "invite-pill",
  "invite",
  "checklist-pill",
  "checklist",
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
