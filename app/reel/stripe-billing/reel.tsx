"use client";

import { AnimatePresence } from "motion/react";

import { useAutopilot, type Phase } from "./_components/autopilot";
import {
  ActiveScene,
  CheckoutScene,
  PlansScene,
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
      {phase === "plans" ? <PlansScene key={`plans-${loopId}`} /> : null}
      {phase === "checkout-pill" ? (
        <ChapterPill
          key={`checkout-${loopId}`}
          index={2}
          title="Stripe handles it."
          subtitle="PCI scope is theirs. You see &lsquo;succeeded.&rsquo;"
        />
      ) : null}
      {phase === "checkout" ? (
        <CheckoutScene key={`checkout-${loopId}`} />
      ) : null}
      {phase === "active-pill" ? (
        <ChapterPill
          key={`active-${loopId}`}
          index={3}
          title="Features unlock on the spot."
          subtitle="Webhook lands. Plan gates flip. Your team's in."
        />
      ) : null}
      {phase === "active" ? <ActiveScene key={`active-${loopId}`} /> : null}
      {phase === "outro" ? <OutroSplash key={`outro-${loopId}`} /> : null}
    </AnimatePresence>
  );
}
