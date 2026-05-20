"use client";

import { useEffect, useState } from "react";

// Phases of the customer bulk-import reel. The autopilot walks through them
// in order, looping forever. Each phase owns its own internal animation
// timing — autopilot just decides when one ends and the next begins.

export type Phase =
  | "intro" // opening splash
  | "spreadsheet" // scene 1: the Excel sheet
  | "old-way-pill" // chapter overlay: "The old way"
  | "manual" // scene 2: filling the form by hand
  | "better-way-pill" // chapter overlay: "There's a better way"
  | "bulk" // scene 3: drop file → progress → table populates
  | "outro"; // closing splash with stats

/** How long each phase stays on screen, in milliseconds. */
const PHASE_DURATION_MS: Record<Phase, number> = {
  intro: 3200,
  spreadsheet: 6500,
  "old-way-pill": 1600,
  manual: 10500,
  "better-way-pill": 1600,
  bulk: 7500,
  outro: 4200,
};

const PHASE_ORDER: Phase[] = [
  "intro",
  "spreadsheet",
  "old-way-pill",
  "manual",
  "better-way-pill",
  "bulk",
  "outro",
];

export function useAutopilot(): { phase: Phase; loopId: number } {
  const [phase, setPhase] = useState<Phase>("intro");
  // loopId bumps each time the reel restarts — children remount via key={loopId}
  // so internal animations reset cleanly when the cycle starts over.
  const [loopId, setLoopId] = useState(0);

  useEffect(() => {
    const duration = PHASE_DURATION_MS[phase];
    const handle = setTimeout(() => {
      const nextIdx = (PHASE_ORDER.indexOf(phase) + 1) % PHASE_ORDER.length;
      if (nextIdx === 0) setLoopId((id) => id + 1);
      setPhase(PHASE_ORDER[nextIdx]);
    }, duration);
    return () => clearTimeout(handle);
  }, [phase]);

  return { phase, loopId };
}
