"use client";

import { BillsShell } from "./_real/bills-shell";
import { ReviewScreen } from "./_real/review";
import { useReel } from "./_real/reel-state";

import { FakeHeader, FakeSidebar } from "./fake-sidebar";

const URL_BY_STEP: Record<string, string> = {
  bills: "fluxora.app/supplier-invoices",
  "imports-empty": "fluxora.app/supplier-invoices?tab=inbox",
  "imports-scanning": "fluxora.app/supplier-invoices?tab=inbox",
  "imports-populated": "fluxora.app/supplier-invoices?tab=inbox",
  review: "fluxora.app/supplier-invoices/inv-2847/review",
  "imports-reviewed": "fluxora.app/supplier-invoices?tab=inbox",
};

export function ReelSurface() {
  const { state } = useReel();
  const inReview = state.step === "review";

  return (
    <div className="flex h-[820px] w-full">
      <FakeSidebar activeUrl="/supplier-invoices" />
      <div className="flex min-w-0 flex-1 flex-col">
        <FakeHeader crumbs={crumbsForStep(state.step)} />
        <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-page p-4">
          {inReview ? <ReviewScreen /> : <BillsShell />}
        </main>
      </div>
    </div>
  );
}

export function useReelUrl(): string {
  const { state } = useReel();
  return URL_BY_STEP[state.step] ?? "fluxora.app";
}

function crumbsForStep(step: string): string[] {
  switch (step) {
    case "review":
      return ["Purchasing", "Bills", "INV-2847"];
    default:
      return ["Purchasing", "Bills"];
  }
}
