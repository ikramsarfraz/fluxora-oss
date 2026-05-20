"use client";

import { AnimatePresence, motion } from "motion/react";

import { BillsShell } from "./_real/bills-shell";
import { ReelDialogs } from "./_real/dialogs";
import { ReviewScreen } from "./_real/review";
import { useReel } from "./_real/reel-state";
import { TransitionLayer } from "./_real/transitions";

import { FakeHeader, FakeSidebar } from "./fake-sidebar";
import { cn } from "@/lib/utils";

const easeOut = [0.16, 1, 0.3, 1] as const;

export function ReelSurface() {
  const { state } = useReel();
  const inReview = state.step === "review";
  const treatment = backingTreatmentFor(state.transition.kind);

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      {/* Surface content — fades/blurs underneath active transitions. */}
      <div
        className={cn(
          "flex h-full w-full transition-[opacity,filter,transform] duration-500 ease-out",
          treatment.transitioning && "scale-[0.99]",
        )}
        style={{
          opacity: 1 - treatment.dim,
          filter: treatment.blur > 0 ? `blur(${treatment.blur}px)` : undefined,
        }}
      >
        <FakeSidebar activeUrl="/supplier-invoices" collapsed={inReview} />
        <div className="flex min-w-0 flex-1 flex-col">
          <FakeHeader crumbs={crumbsForStep(state.step)} />
          <main
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-y-auto bg-page",
              inReview ? "p-0" : "gap-4 p-4",
            )}
          >
            {/* Cross-fade the inner screen whenever the demo step changes.
                mode="popLayout" gives the exiting screen position:absolute
                so the new screen renders into the same space — both stack
                during the cross-fade instead of fighting for layout.
                mode="wait" caused a dead frame between exit-complete and
                enter-start where the surface was visibly empty. */}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={`${state.step}-${state.activeTab}`}
                initial={{ opacity: 0, scale: 0.992 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.996 }}
                transition={{
                  opacity: { duration: 0.4, ease: easeOut },
                  scale: { duration: 0.5, ease: easeOut },
                }}
                className="flex min-h-0 flex-1 flex-col"
              >
                {inReview ? <ReviewScreen /> : <BillsShell />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      <ReelDialogs />
      <TransitionLayer />
    </div>
  );
}

function backingTreatmentFor(kind: string) {
  switch (kind) {
    case "splash":
    case "outro":
    case "explainer":
      // Splash + outro + explainer fully take over the frame. Don't double-
      // fade the backing — let the transition's own bg-page do the cover.
      return { dim: 0, blur: 0, transitioning: false } as const;
    case "chapter":
      return { dim: 0.45, blur: 4, transitioning: true } as const;
    case "interstitial":
      return { dim: 0.55, blur: 5, transitioning: true } as const;
    default:
      return { dim: 0, blur: 0, transitioning: false } as const;
  }
}

function crumbsForStep(step: string): string[] {
  switch (step) {
    case "review":
      return ["Purchasing", "Bills", "INV-2847"];
    default:
      return ["Purchasing", "Bills"];
  }
}
