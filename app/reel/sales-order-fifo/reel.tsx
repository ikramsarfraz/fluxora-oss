"use client";

import { AnimatePresence } from "motion/react";

import { useAutopilot, type Phase } from "./_components/autopilot";
import { CustomerScene } from "./_components/customer-scene";
import { FifoScene } from "./_components/fifo-scene";
import { InvoiceScene } from "./_components/invoice-scene";
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

      {phase === "customer" ? (
        <CustomerScene key={`customer-${loopId}`} />
      ) : null}

      {phase === "fifo-pill" ? (
        <ChapterPill
          key={`fifo-pill-${loopId}`}
          index={2}
          title="Add lines. FIFO does the rest."
          subtitle="Oldest lots out first. Margin updates live."
        />
      ) : null}

      {phase === "fifo" ? <FifoScene key={`fifo-${loopId}`} /> : null}

      {phase === "save-pill" ? (
        <ChapterPill
          key={`save-pill-${loopId}`}
          index={3}
          title="Save. Pick. Invoice."
          subtitle="One click — pick list and invoice are ready."
        />
      ) : null}

      {phase === "invoice" ? (
        <InvoiceScene key={`invoice-${loopId}`} />
      ) : null}

      {phase === "outro" ? <OutroSplash key={`outro-${loopId}`} /> : null}
    </AnimatePresence>
  );
}
