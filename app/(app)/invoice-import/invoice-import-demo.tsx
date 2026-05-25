"use client";

import { DemoController } from "./_demo/demo-controller";
import { DemoProvider, useDemo } from "./_demo/state";
import { InventoryStep } from "./_demo/steps/inventory-step";
import { QueueStep } from "./_demo/steps/queue-step";
import { ReviewStep } from "./_demo/steps/review-step";
import { SaveStep } from "./_demo/steps/save-step";
import { ScanningStep } from "./_demo/steps/scanning-step";
import { UploadStep } from "./_demo/steps/upload-step";

export function InvoiceImportDemo() {
  return (
    <DemoProvider>
      <DemoSurface />
      <DemoController />
    </DemoProvider>
  );
}

function DemoSurface() {
  const { state } = useDemo();
  switch (state.step) {
    case "inventory":
      return <InventoryStep />;
    case "upload":
      return <UploadStep />;
    case "scanning":
      return <ScanningStep />;
    case "queue":
      return <QueueStep />;
    case "review":
      return <ReviewStep />;
    case "saving":
      return <SaveStep />;
    case "saved":
      return <InventoryStep />;
  }
}
