"use client";

import { BillsShell } from "./_real/bills-shell";
import { ReviewScreen } from "./_real/review";
import { useReel } from "./_real/reel-state";

import { FakeHeader, FakeSidebar } from "./fake-sidebar";
import { cn } from "@/lib/utils";

export function ReelSurface() {
  const { state } = useReel();
  const inReview = state.step === "review";

  return (
    <div className="flex h-[820px] w-full">
      <FakeSidebar activeUrl="/supplier-invoices" collapsed={inReview} />
      <div className="flex min-w-0 flex-1 flex-col">
        <FakeHeader crumbs={crumbsForStep(state.step)} />
        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto bg-page",
            // Review screen runs edge-to-edge, flush against the sidebar +
            // header — gives the two-pane layout its full real estate. All
            // other steps use the normal page padding.
            inReview ? "p-0" : "gap-4 p-4",
          )}
        >
          {inReview ? <ReviewScreen /> : <BillsShell />}
        </main>
      </div>
    </div>
  );
}

function crumbsForStep(step: string): string[] {
  switch (step) {
    case "review":
      return ["Purchasing", "Bills", "INV-2847"];
    default:
      return ["Purchasing", "Bills"];
  }
}
