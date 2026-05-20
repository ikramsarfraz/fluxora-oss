"use client";

import { AnimatePresence } from "motion/react";

import { AdjustmentScene } from "./_components/adjustment-scene";
import { useAutopilot, type Phase } from "./_components/autopilot";
import { LotLedgerScene } from "./_components/lot-ledger-scene";
import { OverviewScene } from "./_components/overview-scene";
import { ChapterPill, IntroSplash, OutroSplash } from "./_components/splash";

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

      {phase === "overview" ? (
        <OverviewScene key={`overview-${loopId}`} />
      ) : null}

      {phase === "drill-pill" ? (
        <ChapterPill
          key={`drill-${loopId}`}
          index={2}
          title="Drill into a lot."
          subtitle="See every receipt, every ship, every dollar."
        />
      ) : null}

      {phase === "ledger" ? (
        <LotLedgerScene key={`ledger-${loopId}`} />
      ) : null}

      {phase === "adjust-pill" ? (
        <ChapterPill
          key={`adjust-${loopId}`}
          index={3}
          title="Spoilage, audited."
          subtitle="Adjust a lot — the ledger never forgets."
        />
      ) : null}

      {phase === "adjustment" ? (
        <AdjustmentScene key={`adjustment-${loopId}`} />
      ) : null}

      {phase === "outro" ? <OutroSplash key={`outro-${loopId}`} /> : null}
    </AnimatePresence>
  );
}
