"use client";

import { AnimatePresence } from "motion/react";

import { useAutopilot, type Phase } from "./_components/autopilot";
import { ChecklistScene } from "./_components/checklist-scene";
import { InviteScene } from "./_components/invite-scene";
import { ChapterPill, IntroSplash, OutroSplash } from "./_components/splash";
import { SubdomainScene } from "./_components/subdomain-scene";

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
      {phase === "subdomain" ? (
        <SubdomainScene key={`subdomain-${loopId}`} />
      ) : null}
      {phase === "invite-pill" ? (
        <ChapterPill
          key={`invite-${loopId}`}
          index={2}
          title="Bring your team."
          subtitle="Roles pre-assigned. Tokens single-use."
        />
      ) : null}
      {phase === "invite" ? (
        <InviteScene key={`invite-${loopId}`} />
      ) : null}
      {phase === "checklist-pill" ? (
        <ChapterPill
          key={`checklist-${loopId}`}
          index={3}
          title="First steps."
          subtitle="Five quick things and you're operating."
        />
      ) : null}
      {phase === "checklist" ? (
        <ChecklistScene key={`checklist-${loopId}`} />
      ) : null}
      {phase === "outro" ? <OutroSplash key={`outro-${loopId}`} /> : null}
    </AnimatePresence>
  );
}
