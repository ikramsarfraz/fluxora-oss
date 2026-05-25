"use client";

import { AnimatePresence } from "motion/react";

import { useAutopilot, type Phase } from "./_components/autopilot";
import {
  DropScene,
  ExtractScene,
  PostScene,
} from "./_components/scenes";
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
      {phase === "drop" ? <DropScene key={`drop-${loopId}`} /> : null}
      {phase === "extract-pill" ? (
        <ChapterPill
          key={`extract-${loopId}`}
          index={2}
          title="AI does the typing."
          subtitle="Vendor, total, category — pulled from the image."
        />
      ) : null}
      {phase === "extract" ? <ExtractScene key={`extract-${loopId}`} /> : null}
      {phase === "post-pill" ? (
        <ChapterPill
          key={`post-${loopId}`}
          index={3}
          title="Straight to the P&amp;L."
          subtitle="Booked, categorized, audit-trailed."
        />
      ) : null}
      {phase === "post" ? <PostScene key={`post-${loopId}`} /> : null}
      {phase === "outro" ? <OutroSplash key={`outro-${loopId}`} /> : null}
    </AnimatePresence>
  );
}
