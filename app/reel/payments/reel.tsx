"use client";

import { AnimatePresence } from "motion/react";

import { AllocateScene } from "./_components/allocate-scene";
import { useAutopilot, type Phase } from "./_components/autopilot";
import { IntakeScene } from "./_components/intake-scene";
import { PostScene } from "./_components/post-scene";
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
      {phase === "intake" ? <IntakeScene key={`intake-${loopId}`} /> : null}
      {phase === "allocate-pill" ? (
        <ChapterPill
          key={`allocate-${loopId}`}
          index={2}
          title="FIFO does the math."
          subtitle="Oldest invoice clears first. Partial applies just work."
        />
      ) : null}
      {phase === "allocate" ? (
        <AllocateScene key={`allocate-${loopId}`} />
      ) : null}
      {phase === "post-pill" ? (
        <ChapterPill
          key={`post-${loopId}`}
          index={3}
          title="Aging, before & after."
          subtitle="Buckets shift the moment the payment posts."
        />
      ) : null}
      {phase === "post" ? <PostScene key={`post-${loopId}`} /> : null}
      {phase === "outro" ? <OutroSplash key={`outro-${loopId}`} /> : null}
    </AnimatePresence>
  );
}
