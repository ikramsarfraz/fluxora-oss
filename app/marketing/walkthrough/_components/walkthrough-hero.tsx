"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  Boxes,
  FileText,
  Landmark,
  Pause,
  Play,
  Receipt,
  Sparkles,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";

import {
  AiExtractMoment,
  InventoryLotsMoment,
  InvoicePdfMoment,
  PaymentsMoment,
  SalesOrderMoment,
} from "../../_components/moments";
import { CompareCard, type ComparePayload } from "./compare-card";
import { IntroCard, OutroCard } from "./intro-outro";

// One merged demo. Auto-sequences through the five core workflows with a
// compare card between each ("manual time vs Fluxora time").
//
// The hero is a fixed-size frame so the scene swap is a clean A→B with no
// page jump. Tab strip at the bottom shows progress + lets visitors jump
// to any chapter. Pause toggle lets them stop the auto-advance entirely.

type SceneKey =
  | "ai-import"
  | "sales-order"
  | "invoice-pdf"
  | "payments"
  | "inventory";

type Phase =
  | { kind: "intro"; ms: number }
  | { kind: "scene"; scene: SceneKey; ms: number }
  | { kind: "compare"; compare: ComparePayload; ms: number }
  | { kind: "outro"; ms: number };

const SCENE_MS = 11000;
const COMPARE_MS = 3500;
const INTRO_MS = 3500;
const OUTRO_MS = 6000;

const SEQUENCE: Phase[] = [
  { kind: "intro", ms: INTRO_MS },

  { kind: "scene", scene: "ai-import", ms: SCENE_MS },
  {
    kind: "compare",
    ms: COMPARE_MS,
    compare: {
      step: "Step 1 · A supplier PDF lands in your inbox",
      manual: {
        time: "25 min",
        bullets: [
          "Open PDF, retype 9 lines into your AP system",
          "Re-resolve every supplier alias from scratch",
          "Forget to receive the lots — find out next Tuesday",
        ],
      },
      fluxora: {
        time: "4 sec",
        bullets: [
          "Drop the PDF, AI extracts every line at 94% accuracy",
          "Aliases learn once, persist forever",
          "Posts to AP + receives lots into inventory in one click",
        ],
      },
    },
  },

  { kind: "scene", scene: "sales-order", ms: SCENE_MS },
  {
    kind: "compare",
    ms: COMPARE_MS,
    compare: {
      step: "Step 2 · Anchor Tavern calls in their weekly order",
      manual: {
        time: "12 min",
        bullets: [
          "Look up Anchor's tier prices in a separate sheet",
          "Pick which lots to ship (FIFO is a sticky note)",
          "Calculate margin in your head later — if at all",
        ],
      },
      fluxora: {
        time: "90 sec",
        bullets: [
          "Type \"Anch\" — Anchor Tavern pre-fills with Tier 2 pricing",
          "FIFO pulls oldest lots line-by-line, visually",
          "Live margin chip updates as you build the order",
        ],
      },
    },
  },

  { kind: "scene", scene: "invoice-pdf", ms: SCENE_MS },
  {
    kind: "compare",
    ms: COMPARE_MS,
    compare: {
      step: "Step 3 · Anchor needs an invoice for their books",
      manual: {
        time: "6 min",
        bullets: [
          "Open a Word template, copy the order line-by-line",
          "Attach to email manually, hope the addresses are current",
          "No idea if they opened it or not",
        ],
      },
      fluxora: {
        time: "1 click",
        bullets: [
          "Branded PDF composes with your letterhead automatically",
          "Sends to the customer's saved billing email",
          "Delivery + open tracking right on the order",
        ],
      },
    },
  },

  { kind: "scene", scene: "payments", ms: SCENE_MS },
  {
    kind: "compare",
    ms: COMPARE_MS,
    compare: {
      step: "Step 4 · Lighthouse Cafe wires $4,880",
      manual: {
        time: "12 min",
        bullets: [
          "Open 5 outstanding invoices, edit each manually",
          "Re-export the aging report so the boss has fresh numbers",
          "Forget the overpayment exists",
        ],
      },
      fluxora: {
        time: "auto",
        bullets: [
          "FIFO applies the payment to the oldest 3 invoices",
          "Aging buckets shift live across the dashboard",
          "Overpayment lands on customer credit, ready for next order",
        ],
      },
    },
  },

  { kind: "scene", scene: "inventory", ms: SCENE_MS },
  {
    kind: "compare",
    ms: COMPARE_MS,
    compare: {
      step: "Step 5 · One lot is about to expire",
      manual: {
        time: "discover it on the truck",
        bullets: [
          "Find out when the warehouse calls saying \"it's bad\"",
          "Write off the loss with no audit trail",
          "Repeat next month",
        ],
      },
      fluxora: {
        time: "2 days ahead",
        bullets: [
          "Expiry-aware filter flags L-1245 before it bites",
          "FIFO next-out indicator surfaces it on every order screen",
          "Spoilage adjustments stay audit-trailed on the lot",
        ],
      },
    },
  },

  { kind: "outro", ms: OUTRO_MS },
];

// Tabs displayed at the bottom. Each one targets a specific scene index.
const TABS: { label: string; scene: SceneKey; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; }[] = [
  { label: "AI invoice import", scene: "ai-import", icon: Sparkles },
  { label: "Sales order", scene: "sales-order", icon: FileText },
  { label: "Branded invoice", scene: "invoice-pdf", icon: Receipt },
  { label: "Payments", scene: "payments", icon: Wallet },
  { label: "Inventory", scene: "inventory", icon: Boxes },
];

function sceneIndexFor(scene: SceneKey): number {
  return SEQUENCE.findIndex((p) => p.kind === "scene" && p.scene === scene);
}

export function WalkthroughHero() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  // Setting idx triggers the autoadvance effect to restart with fresh
  // timing (the effect depends on idx). Wrapped in useCallback for the
  // tab buttons' onClick handlers.
  const jumpTo = useCallback((target: number) => {
    setIdx(target);
  }, []);

  // Auto-advance through the sequence on a timer tied to each phase's ms.
  // Loops back to 0 when finished. Pauses entirely if the visitor clicks
  // the pause toggle.
  useEffect(() => {
    if (paused) return;
    const phase = SEQUENCE[idx];
    const handle = setTimeout(() => {
      setIdx((prev) => (prev + 1) % SEQUENCE.length);
    }, phase.ms);
    return () => clearTimeout(handle);
  }, [idx, paused]);

  const phase = SEQUENCE[idx];
  const currentSceneKey: SceneKey | null =
    phase.kind === "scene" ? phase.scene : null;

  // Map idx → which tab is "active." Compare cards adopt the previous
  // scene's tab so the tab strip never goes blank during transitions.
  const activeTabScene: SceneKey | null = (() => {
    if (phase.kind === "scene") return phase.scene;
    if (phase.kind === "intro" || phase.kind === "outro") return null;
    // It's a compare — look back to find the last scene phase
    for (let i = idx - 1; i >= 0; i--) {
      const p = SEQUENCE[i];
      if (p.kind === "scene") return p.scene;
    }
    return null;
  })();

  return (
    <div className="flex flex-col gap-4">
      {/* The frame */}
      <div className="relative overflow-hidden rounded-2xl border border-border-default bg-card-warm shadow-[0_30px_80px_-30px_rgba(31,58,46,0.45)]">
        <div className="relative h-[640px] w-full">
          <AnimatePresence mode="wait">
            {phase.kind === "intro" ? (
              <SceneFrame key="intro">
                <IntroCard />
              </SceneFrame>
            ) : null}

            {phase.kind === "compare" ? (
              <SceneFrame key={`compare-${idx}`}>
                <CompareCard compare={phase.compare} />
              </SceneFrame>
            ) : null}

            {phase.kind === "outro" ? (
              <SceneFrame key="outro">
                <OutroCard />
              </SceneFrame>
            ) : null}

            {currentSceneKey === "ai-import" ? (
              <SceneFrame key="ai-import">
                <AiExtractMoment />
              </SceneFrame>
            ) : null}
            {currentSceneKey === "sales-order" ? (
              <SceneFrame key="sales-order">
                <SalesOrderMoment />
              </SceneFrame>
            ) : null}
            {currentSceneKey === "invoice-pdf" ? (
              <SceneFrame key="invoice-pdf">
                <InvoicePdfMoment />
              </SceneFrame>
            ) : null}
            {currentSceneKey === "payments" ? (
              <SceneFrame key="payments">
                <PaymentsMoment />
              </SceneFrame>
            ) : null}
            {currentSceneKey === "inventory" ? (
              <SceneFrame key="inventory">
                <InventoryLotsMoment />
              </SceneFrame>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* Tab strip + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-default bg-card-warm/60 px-3 py-2.5 backdrop-blur">
        <ol className="flex flex-wrap items-center gap-1.5">
          {TABS.map((tab, i) => {
            const active = activeTabScene === tab.scene;
            const Icon = tab.icon;
            return (
              <li key={tab.scene}>
                <button
                  type="button"
                  onClick={() => jumpTo(sceneIndexFor(tab.scene))}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition",
                    active
                      ? "border-forest-mid bg-forest-mid text-card-warm shadow-sm"
                      : "border-border-default bg-card-warm text-ink-warm hover:border-ink-warm/40 hover:text-ink",
                  )}
                >
                  <span className={cn(
                    "font-mono text-[9.5px] uppercase tracking-[0.12em]",
                    active ? "text-card-warm/70" : "text-subtle",
                  )}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Icon className="size-3" strokeWidth={2} />
                  <span className="font-medium">{tab.label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="flex items-center gap-3">
          {/* Keyed on idx so the bar remounts fresh on each phase change —
              avoids a setState-in-effect reset that the React rules-of-hooks
              lint dislikes. */}
          <ProgressBar key={idx} phase={phase} paused={paused} />
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-card-warm px-2.5 py-1 text-[11px] text-ink-warm hover:text-ink"
          >
            {paused ? (
              <>
                <Play className="size-3" strokeWidth={2} />
                Play
              </>
            ) : (
              <>
                <Pause className="size-3" strokeWidth={2} />
                Pause
              </>
            )}
          </button>
        </div>
      </div>

      {/* Caption */}
      <div className="text-center font-mono text-[10.5px] uppercase tracking-[0.16em] text-subtle">
        {phase.kind === "intro" ? (
          <span>Intro · 7 a.m. at Pacific Wharf</span>
        ) : phase.kind === "outro" ? (
          <span>Done · 9:43 a.m.</span>
        ) : phase.kind === "compare" ? (
          <span className="inline-flex items-center gap-1.5">
            <Landmark className="size-3" strokeWidth={2} />
            Spreadsheet vs Fluxora · compare
          </span>
        ) : (
          <span>
            Now showing ·{" "}
            <span className="text-forest-mid">
              {TABS.find((t) => t.scene === currentSceneKey)?.label}
            </span>{" "}
            in the app
          </span>
        )}
      </div>
    </div>
  );
}

// Small wrapper around each scene so AnimatePresence has a stable child
// shape (absolute-fill div). Keeps the heights aligned during swaps.
function SceneFrame({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0">{children}</div>;
}

// Slim progress bar that fills across the current phase's duration. Pauses
// when the visitor pauses. Caller remounts via `key={idx}` so each phase
// starts the bar from 0 without a setState-in-effect reset.
function ProgressBar({ phase, paused }: { phase: Phase; paused: boolean }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (paused) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const pct = Math.min(100, (elapsed / phase.ms) * 100);
      setProgress(pct);
      if (pct < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, phase.ms]);

  return (
    <div className="hidden h-1 w-[140px] overflow-hidden rounded-full bg-surface md:block">
      <div
        className="h-full bg-forest-mid transition-[width] duration-100"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
