"use client";

import { AnimatePresence } from "motion/react";

import { useAutopilot, type Phase } from "./_components/autopilot";
import { BrandingScene } from "./_components/branding-scene";
import { BuildScene } from "./_components/build-scene";
import { SendScene } from "./_components/send-scene";
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
      {phase === "branding" ? (
        <BrandingScene key={`branding-${loopId}`} />
      ) : null}
      {phase === "build-pill" ? (
        <ChapterPill
          key={`build-${loopId}`}
          index={2}
          title="The PDF builds itself."
          subtitle="Letterhead, lines, totals — your brand applied."
        />
      ) : null}
      {phase === "build" ? <BuildScene key={`build-${loopId}`} /> : null}
      {phase === "send-pill" ? (
        <ChapterPill
          key={`send-${loopId}`}
          index={3}
          title="Send. Track. Done."
          subtitle="From draft to inbox without leaving the app."
        />
      ) : null}
      {phase === "send" ? <SendScene key={`send-${loopId}`} /> : null}
      {phase === "outro" ? <OutroSplash key={`outro-${loopId}`} /> : null}
    </AnimatePresence>
  );
}
