"use client";

import { AnimatePresence } from "motion/react";

import { useAutopilot, type Phase } from "./_components/autopilot";
import { LinkScene } from "./_components/link-scene";
import { MatchScene } from "./_components/match-scene";
import { ChapterPill, IntroSplash, OutroSplash } from "./_components/splash";
import { SyncScene } from "./_components/sync-scene";

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
      {phase === "link" ? <LinkScene key={`link-${loopId}`} /> : null}
      {phase === "sync-pill" ? (
        <ChapterPill
          key={`sync-${loopId}`}
          index={2}
          title="Transactions roll in."
          subtitle="Bank → Fluxora, on a schedule, forever."
        />
      ) : null}
      {phase === "sync" ? <SyncScene key={`sync-${loopId}`} /> : null}
      {phase === "match-pill" ? (
        <ChapterPill
          key={`match-${loopId}`}
          index={3}
          title="Auto-matched."
          subtitle="Each line gets an invoice, bill, or expense."
        />
      ) : null}
      {phase === "match" ? <MatchScene key={`match-${loopId}`} /> : null}
      {phase === "outro" ? <OutroSplash key={`outro-${loopId}`} /> : null}
    </AnimatePresence>
  );
}
