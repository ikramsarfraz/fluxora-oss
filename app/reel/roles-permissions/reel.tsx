"use client";

import { AnimatePresence } from "motion/react";

import { useAutopilot, type Phase } from "./_components/autopilot";
import {
  AuditScene,
  MatrixScene,
  PerspectiveScene,
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
      {phase === "matrix" ? <MatrixScene key={`matrix-${loopId}`} /> : null}
      {phase === "perspective-pill" ? (
        <ChapterPill
          key={`perspective-${loopId}`}
          index={2}
          title="Same workspace. Different eyes."
          subtitle="The crew sees lots. The CFO sees the P&amp;L."
        />
      ) : null}
      {phase === "perspective" ? (
        <PerspectiveScene key={`perspective-${loopId}`} />
      ) : null}
      {phase === "audit-pill" ? (
        <ChapterPill
          key={`audit-${loopId}`}
          index={3}
          title="Enforced, then logged."
          subtitle="Every action — allowed or denied — captured."
        />
      ) : null}
      {phase === "audit" ? <AuditScene key={`audit-${loopId}`} /> : null}
      {phase === "outro" ? <OutroSplash key={`outro-${loopId}`} /> : null}
    </AnimatePresence>
  );
}
