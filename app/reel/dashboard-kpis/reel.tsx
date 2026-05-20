"use client";

import { AnimatePresence } from "motion/react";

import { useAutopilot, type Phase } from "./_components/autopilot";
import { ReceivablesScene } from "./_components/receivables-scene";
import { SnapshotScene } from "./_components/snapshot-scene";
import { ChapterPill, IntroSplash, OutroSplash } from "./_components/splash";
import { WinsScene } from "./_components/wins-scene";

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
      {phase === "snapshot" ? (
        <SnapshotScene key={`snapshot-${loopId}`} />
      ) : null}
      {phase === "drill-pill" ? (
        <ChapterPill
          key={`drill-${loopId}`}
          index={2}
          title="Where the money is."
          subtitle="AR aging, top owing, who to nudge."
        />
      ) : null}
      {phase === "receivables" ? (
        <ReceivablesScene key={`receivables-${loopId}`} />
      ) : null}
      {phase === "wins-pill" ? (
        <ChapterPill
          key={`wins-${loopId}`}
          index={3}
          title="Today's wins."
          subtitle="What's running hot. What's worth a nudge."
        />
      ) : null}
      {phase === "wins" ? <WinsScene key={`wins-${loopId}`} /> : null}
      {phase === "outro" ? <OutroSplash key={`outro-${loopId}`} /> : null}
    </AnimatePresence>
  );
}
