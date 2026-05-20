"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  Boxes,
  Building2,
  Calculator,
  ClipboardList,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Inbox,
  Landmark,
  Mail,
  Notebook,
  Pause,
  Play,
  Printer,
  Receipt,
  Send,
  ShoppingCart,
  Sparkles,
  StickyNote,
  Tag,
  Truck,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";

import {
  AiExtractMoment,
  BareShellProvider,
  InventoryLotsMoment,
  InvoicePdfMoment,
  PaymentsMoment,
  SalesOrderMoment,
} from "../../_components/moments";
import {
  AfterCard,
  BeforeCard,
  type CompareStep,
} from "./compare-card";
import { IntroCard, OutroCard } from "./intro-outro";

// One merged demo. Auto-sequences through five core workflows. Between each
// workflow, the visitor sees TWO stitched compare cards back-to-back:
// "the old way" (Before) → "the Fluxora way" (After). Each card has a
// vertical timeline with timestamped events — letting more info filter
// through than the previous single-divider design.

type SceneKey =
  | "ai-import"
  | "sales-order"
  | "invoice-pdf"
  | "payments"
  | "inventory";

type Phase =
  | { kind: "intro"; ms: number }
  | { kind: "scene"; scene: SceneKey; ms: number }
  | { kind: "before"; compare: CompareStep; ms: number }
  | { kind: "after"; compare: CompareStep; ms: number }
  | { kind: "outro"; ms: number };

const SCENE_MS = 11000;
// Compare cards run ~2.6s of entrance choreography (tool tiles / panel
// stagger, then voiceover, then big stat, then callout). Each card lingers
// for ~4-5s afterwards so visitors can read the voiceover and absorb the
// stat. 7500ms hits that beat without overstaying.
const BEFORE_MS = 7500;
const AFTER_MS = 7500;
const INTRO_MS = 3500;
const OUTRO_MS = 6000;

// Each compare beat now leads with VISUALS, not prose. The Before card
// shows a row of tool tiles (what's on the operator's desk right now);
// the After card shows ONE Fluxora panel with a checklist of actions. A
// huge time stat owns the right side of both. One short voiceover line
// carries the brand voice.
const COMPARES: CompareStep[] = [
  {
    step: "Step 1 of 5",
    topic: "A supplier PDF lands at 8:42",
    before: {
      tools: [
        { icon: Inbox, label: "Inbox", badge: "8:42" },
        { icon: FileText, label: "PDF reader", badge: "8:44" },
        { icon: FileSpreadsheet, label: "AP sheet", badge: "8:51" },
        { icon: Calculator, label: "Calculator", badge: "8:58" },
        { icon: ClipboardList, label: "Receiving log", badge: "9:02" },
      ],
      voiceover:
        "Five windows open. You're 9 lines into a 12-line invoice. The salmon SKU is named three different things across them.",
      stat: { value: "25 min", label: "Manual time" },
      statHint: "+ 14 alt-tabs",
    },
    after: {
      actions: [
        { icon: Sparkles, label: "AI extracts 9 lines", meta: "94% match" },
        { icon: Boxes, label: "3 lots auto-created" },
        { icon: Tag, label: "Aliases persisted forever" },
        { icon: FileCheck2, label: "Posted to AP + received" },
      ],
      voiceover:
        "Drop the PDF. Walk away. By the time the kettle boils, the bill is posted and the lots are on the shelf.",
      stat: { value: "4 sec", label: "Fluxora time" },
      statHint: "1 click",
      callout: "9 lines posted · 3 lots received · aliases persisted.",
    },
  },
  {
    step: "Step 2 of 5",
    topic: "Anchor Tavern phones in their order",
    before: {
      tools: [
        { icon: FileSpreadsheet, label: "Tier prices", badge: "9:08" },
        { icon: StickyNote, label: "FIFO Post-it", badge: "9:14" },
        { icon: Notebook, label: "Paper pad", badge: "9:18" },
        { icon: Calculator, label: "Margin math", badge: "9:20" },
      ],
      voiceover:
        "Tier prices on one sheet. Lots on the wall. Margin in your head. You'll find out next month if any of it was right.",
      stat: { value: "12 min", label: "Manual time" },
      statHint: "+ 1 walk to the warehouse",
    },
    after: {
      actions: [
        { icon: Building2, label: "Anchor pre-fills · Tier 2" },
        { icon: ShoppingCart, label: "FIFO allocates 6 lots" },
        { icon: Tag, label: "Tier price per line" },
        { icon: Sparkles, label: "Margin chip · 42.7%", meta: "live" },
      ],
      voiceover:
        "Type three letters. Add three lines. The margin tells you it was a good order before the truck loads.",
      stat: { value: "90 sec", label: "Fluxora time" },
      statHint: "margin live",
      callout: "3 lines · 6 lots · 42.7% margin · one screen.",
    },
  },
  {
    step: "Step 3 of 5",
    topic: "Anchor needs the invoice for their books",
    before: {
      tools: [
        { icon: FileText, label: "Word template", badge: "9:20" },
        { icon: Calculator, label: "Tax math", badge: "9:24" },
        { icon: Printer, label: "Export PDF", badge: "9:25" },
        { icon: Mail, label: "Gmail draft", badge: "9:26" },
      ],
      voiceover:
        "Hope you grabbed the right letterhead. Hope you got the tax math right. Hope the email address is current.",
      stat: { value: "6 min", label: "Manual time" },
      statHint: "3 hopes",
    },
    after: {
      actions: [
        { icon: Receipt, label: "Branded PDF · letterhead applied" },
        { icon: Send, label: "Emailed to billing contact" },
        { icon: FileCheck2, label: "Delivery + open tracked" },
        { icon: Sparkles, label: "Anchor opens it on his phone", meta: "47s" },
      ],
      voiceover:
        "Save the order. The PDF builds itself, the email goes out, the read receipt comes back before you finish your stretch.",
      stat: { value: "1 click", label: "Fluxora time" },
      statHint: "no template hunting",
      callout: "Sent in 2 sec. Opened in under a minute. Audit-ready.",
    },
  },
  {
    step: "Step 4 of 5",
    topic: "Lighthouse Cafe wires $4,880",
    before: {
      tools: [
        { icon: Landmark, label: "Bank feed", badge: "9:30" },
        { icon: Receipt, label: "Invoice #1", badge: "9:33" },
        { icon: Receipt, label: "Invoice #2", badge: "9:36" },
        { icon: Receipt, label: "+3 more", badge: "9:39" },
        { icon: FileSpreadsheet, label: "Aging report", badge: "9:41" },
      ],
      voiceover:
        "Five invoices, one ACH, no clear order. By the time you finish, the aging report you sent the boss is already wrong.",
      stat: { value: "12 min", label: "Manual time" },
      statHint: "0 auto-matches",
    },
    after: {
      actions: [
        { icon: Landmark, label: "ACH auto-matched · Lighthouse" },
        { icon: Wallet, label: "FIFO across 3 oldest invoices" },
        { icon: Sparkles, label: "Aging buckets shift live" },
        { icon: FileCheck2, label: "$0 overpayment · clean apply" },
      ],
      voiceover:
        "The bank feed hits, FIFO does the math, the aging report on the dashboard is correct before you set the coffee down.",
      stat: { value: "auto", label: "Fluxora time" },
      statHint: "0 manual edits",
      callout: "3 invoices cleared · aging current · zero manual edits.",
    },
  },
  {
    step: "Step 5 of 5",
    topic: "A lot is about to expire",
    before: {
      tools: [
        { icon: Truck, label: "Truck rolls out", badge: "9:42" },
        { icon: AlertTriangle, label: "Driver calls", badge: "10:35" },
        { icon: Inbox, label: "Customer refuses", badge: "10:48" },
        { icon: FileSpreadsheet, label: "Write-off ledger", badge: "11:20" },
      ],
      voiceover:
        "Nothing flagged the salmon. You find out from the driver. The 18 lb write-off goes in a spreadsheet no one reads.",
      stat: { value: "too late", label: "Discovered" },
      statHint: "18 lb gone",
    },
    after: {
      actions: [
        { icon: AlertTriangle, label: "L-1245 · 2 days to expiry" },
        { icon: Sparkles, label: 'Dashboard "stock at risk" lights up' },
        { icon: Boxes, label: "FIFO next-out on every order screen" },
        { icon: FileCheck2, label: "Anchor's order pulls it naturally" },
      ],
      voiceover:
        "The system tells you on Sunday. By Tuesday the lot is in a fridge in Tiburon — not in a write-off spreadsheet.",
      stat: { value: "48 hrs", label: "Caught ahead" },
      statHint: "0 write-offs",
      callout: "1 lot rescued · 18 lb saved · audit-trailed.",
    },
  },
];

const SEQUENCE: Phase[] = [
  { kind: "intro", ms: INTRO_MS },

  { kind: "scene", scene: "ai-import", ms: SCENE_MS },
  { kind: "before", compare: COMPARES[0], ms: BEFORE_MS },
  { kind: "after", compare: COMPARES[0], ms: AFTER_MS },

  { kind: "scene", scene: "sales-order", ms: SCENE_MS },
  { kind: "before", compare: COMPARES[1], ms: BEFORE_MS },
  { kind: "after", compare: COMPARES[1], ms: AFTER_MS },

  { kind: "scene", scene: "invoice-pdf", ms: SCENE_MS },
  { kind: "before", compare: COMPARES[2], ms: BEFORE_MS },
  { kind: "after", compare: COMPARES[2], ms: AFTER_MS },

  { kind: "scene", scene: "payments", ms: SCENE_MS },
  { kind: "before", compare: COMPARES[3], ms: BEFORE_MS },
  { kind: "after", compare: COMPARES[3], ms: AFTER_MS },

  { kind: "scene", scene: "inventory", ms: SCENE_MS },
  { kind: "before", compare: COMPARES[4], ms: BEFORE_MS },
  { kind: "after", compare: COMPARES[4], ms: AFTER_MS },

  { kind: "outro", ms: OUTRO_MS },
];

const TABS: {
  label: string;
  scene: SceneKey;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}[] = [
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

  const jumpTo = useCallback((target: number) => {
    setIdx(target);
  }, []);

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

  // Tab strip's active highlight follows the most recent scene phase, so
  // the strip never goes blank during the before/after pair that follows
  // each scene.
  const activeTabScene: SceneKey | null = (() => {
    if (phase.kind === "scene") return phase.scene;
    if (phase.kind === "intro" || phase.kind === "outro") return null;
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

            {phase.kind === "before" ? (
              <SceneFrame key={`before-${idx}`}>
                <BeforeCard compare={phase.compare} />
              </SceneFrame>
            ) : null}

            {phase.kind === "after" ? (
              <SceneFrame key={`after-${idx}`}>
                <AfterCard compare={phase.compare} />
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
                  <span
                    className={cn(
                      "font-mono text-[9.5px] uppercase tracking-[0.12em]",
                      active ? "text-card-warm/70" : "text-subtle",
                    )}
                  >
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
        ) : phase.kind === "before" ? (
          <span className="inline-flex items-center gap-1.5">
            <Landmark className="size-3" strokeWidth={2} />
            {phase.compare.step} · the old way
          </span>
        ) : phase.kind === "after" ? (
          <span className="inline-flex items-center gap-1.5 text-success-fg">
            <Sparkles className="size-3" strokeWidth={2} />
            {phase.compare.step} · the Fluxora way
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

function SceneFrame({ children }: { children: React.ReactNode }) {
  // Wrap every scene in BareShellProvider so any moment using
  // MarketingAppShell drops its own card chrome and stretches to fill the
  // 640px parent. Cards that don't use the shell (Intro, Outro, Before,
  // After) ignore the context — no-op for them.
  return (
    <div className="absolute inset-0">
      <BareShellProvider>{children}</BareShellProvider>
    </div>
  );
}

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
