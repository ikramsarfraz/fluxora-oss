"use client";

import { BillsShell } from "./_real/bills-shell";
import { ReelDialogs } from "./_real/dialogs";
import { ReviewScreen } from "./_real/review";
import { useReel } from "./_real/reel-state";
import { TransitionLayer } from "./_real/transitions";

import { FakeHeader, FakeSidebar } from "./fake-sidebar";
import { cn } from "@/lib/utils";

export function ReelSurface() {
  const { state } = useReel();
  const inReview = state.step === "review";
  const treatment = backingTreatmentFor(state.transition.kind);

  return (
    <div className="relative flex h-[820px] w-full overflow-hidden">
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
            {inReview ? <ReviewScreen /> : <BillsShell />}
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
      // Splash + outro fully take over the frame. Don't double-fade the
      // backing — let the transition's own bg-page do the cover.
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
