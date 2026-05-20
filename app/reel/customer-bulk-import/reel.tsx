"use client";

import { AnimatePresence } from "motion/react";

import { useAutopilot, type Phase } from "./_components/autopilot";
import { BulkImportScene } from "./_components/bulk-import-scene";
import { ManualEntryScene } from "./_components/manual-entry-scene";
import { SpreadsheetScene } from "./_components/spreadsheet-scene";
import { ChapterPill, IntroSplash, OutroSplash } from "./_components/splash";

// Top-level reel: a single full-screen frame that swaps scenes on a timer.
// Three acts (spreadsheet → manual → bulk) bracketed by intro / outro splash
// and connective chapter-pill overlays. Loops forever; the loopId from
// useAutopilot remounts the inner tree on each cycle so timers reset cleanly.

export function Reel() {
  const { phase, loopId } = useAutopilot();

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-page">
      <SceneStack phase={phase} loopId={loopId} />
    </main>
  );
}

function SceneStack({ phase, loopId }: { phase: Phase; loopId: number }) {
  return (
    <AnimatePresence mode="wait">
      {phase === "intro" ? <IntroSplash key={`intro-${loopId}`} /> : null}

      {phase === "spreadsheet" ? (
        <SpreadsheetScene key={`spreadsheet-${loopId}`} />
      ) : null}

      {phase === "old-way-pill" ? (
        <ChapterPill
          key={`old-${loopId}`}
          index={2}
          title="The old way"
          subtitle="One customer at a time."
          tone="amber"
        />
      ) : null}

      {phase === "manual" ? (
        <ManualEntryScene key={`manual-${loopId}`} />
      ) : null}

      {phase === "better-way-pill" ? (
        <ChapterPill
          key={`better-${loopId}`}
          index={3}
          title="There's a better way"
          subtitle="Drop the file. Walk away."
          tone="forest"
        />
      ) : null}

      {phase === "bulk" ? (
        <BulkImportScene key={`bulk-${loopId}`} />
      ) : null}

      {phase === "outro" ? <OutroSplash key={`outro-${loopId}`} /> : null}
    </AnimatePresence>
  );
}
