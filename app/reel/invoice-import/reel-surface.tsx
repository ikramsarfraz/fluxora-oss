"use client";

import { useDemo } from "@/app/(app)/invoice-import/_demo/state";
import { InventoryStep } from "@/app/(app)/invoice-import/_demo/steps/inventory-step";
import { QueueStep } from "@/app/(app)/invoice-import/_demo/steps/queue-step";
import { ReviewStep } from "@/app/(app)/invoice-import/_demo/steps/review-step";
import { SaveStep } from "@/app/(app)/invoice-import/_demo/steps/save-step";
import { ScanningStep } from "@/app/(app)/invoice-import/_demo/steps/scanning-step";
import { UploadStep } from "@/app/(app)/invoice-import/_demo/steps/upload-step";

import { useReelDirector } from "./autopilot";

const URL_BY_STEP: Record<string, string> = {
  inventory: "fluxora.app/inventory",
  upload: "fluxora.app/invoice-import",
  scanning: "fluxora.app/invoice-import",
  queue: "fluxora.app/invoice-import",
  review: "fluxora.app/invoice-import/inv-2847",
  saving: "fluxora.app/invoice-import/inv-2847",
  saved: "fluxora.app/inventory",
};

export function ReelSurface() {
  const { state } = useDemo();
  let inner: React.ReactNode;
  switch (state.step) {
    case "inventory":
      inner = <InventoryStep />;
      break;
    case "upload":
      inner = <UploadStep />;
      break;
    case "scanning":
      inner = <ScanningStep />;
      break;
    case "queue":
      inner = <QueueStep />;
      break;
    case "review":
      inner = <ReviewStep />;
      break;
    case "saving":
      inner = <SaveStep />;
      break;
    case "saved":
      inner = <InventoryStep />;
      break;
  }
  return <div className="flex h-[680px] flex-col overflow-hidden p-6">{inner}</div>;
}

export function useReelUrl(): string {
  const { state } = useDemo();
  return URL_BY_STEP[state.step] ?? "fluxora.app";
}

// Keep useReelDirector reachable through this barrel so the reel root has one
// import. Avoids an unused-import warning if reel.tsx changes later.
export { useReelDirector };
