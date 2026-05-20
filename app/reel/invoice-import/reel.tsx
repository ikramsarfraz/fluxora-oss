"use client";

import { useRef } from "react";

import { ReelStateProvider } from "./_real/reel-state";
import { ReelDirectorProvider } from "./autopilot";
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

  // Floating restart/pause controls used to live here — removed so the reel
  // plays uninterrupted whether it's viewed full-screen at /reel/invoice-
  // import or embedded as an iframe on a marketing page. Visitors should
  // roam the surrounding content freely without the reel asking for
  // attention.
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-page">
      <ReelShell frameRef={frameRef}>
        <ReelSurface />
        <VirtualCursor frameRef={frameRef} />
      </ReelShell>
    </main>
  );
}
