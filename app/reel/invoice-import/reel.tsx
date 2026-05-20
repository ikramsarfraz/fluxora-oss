"use client";

import { useRef } from "react";

import { ReelStateProvider } from "./_real/reel-state";
import { ReelDirectorProvider } from "./autopilot";
import { ReelControls } from "./reel-controls";
import { ReelShell } from "./reel-shell";
import { ReelSurface } from "./reel-surface";
import { VirtualCursor } from "./virtual-cursor";

export function Reel() {
  return (
    <ReelStateProvider>
      <ReelDirectorProvider>
        <ReelLayout />
      </ReelDirectorProvider>
    </ReelStateProvider>
  );
}

function ReelLayout() {
  const frameRef = useRef<HTMLDivElement>(null);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-page">
      <ReelShell frameRef={frameRef}>
        <ReelSurface />
        <VirtualCursor frameRef={frameRef} />
      </ReelShell>
      {/* Floating controls pinned bottom-right. Stay unobtrusive over the
          reel; brighten on hover. */}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] opacity-50 transition-opacity hover:opacity-100 [&_*]:pointer-events-auto">
        <ReelControls />
      </div>
    </main>
  );
}
