"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ReelStateProvider } from "./_real/reel-state";
import { ReelDirectorProvider } from "./autopilot";
import { Caption } from "./caption";
import { ReelControls } from "./reel-controls";
import { ReelShell } from "./reel-shell";
import { ReelSurface, useReelUrl } from "./reel-surface";
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
  const url = useReelUrl();

  return (
    <main className="min-h-screen bg-page py-10">
      <div className="mx-auto max-w-7xl px-4">
        <header className="mb-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            Invoice import
          </p>
          <h1 className="mt-3 font-serif text-[40px] font-medium leading-[1.1] tracking-tight text-ink md:text-[52px]">
            Receive a PDF.
            <br />
            Post a bill.
            <br />
            <span className="text-forest-mid">Stock is current.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-subtle">
            Watch Fluxora extract, match, and post a supplier invoice end-to-end —
            no manual data entry, no copy-paste.
          </p>
        </header>

        <ReelShell url={url} frameRef={frameRef}>
          <ReelSurface />
          <VirtualCursor frameRef={frameRef} />
        </ReelShell>

        <Caption />
        <ReelControls />

        <div className="mt-12 flex flex-col items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/signup">
              Try Fluxora free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Link
            href="/features"
            className="text-xs text-subtle underline-offset-4 hover:text-ink-warm hover:underline"
          >
            See the rest of the product →
          </Link>
        </div>
      </div>
    </main>
  );
}
