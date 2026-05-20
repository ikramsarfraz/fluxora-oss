"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  Boxes,
  FileText,
  Inbox,
  Landmark,
  Mail,
  Pause,
  Play,
  Receipt,
  ShoppingCart,
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
const BEFORE_MS = 4500;
const AFTER_MS = 4500;
const INTRO_MS = 3500;
const OUTRO_MS = 6000;

// Each compare step provides the data for the Before card and the After
// card. They render back-to-back in the SEQUENCE below.
const COMPARES: CompareStep[] = [
  {
    step: "Step 1 of 5",
    topic: "A supplier PDF lands in your inbox",
    before: {
      title: "Open the PDF. Retype every line.",
      detail:
        "Bay Area Seafood emailed an invoice at 8:42. Yesterday's stock is supposedly already on the shelf, and today's bills need to match.",
      tag: "Across 3 systems · 9 lines",
      events: [
        { at: "8:42", what: "Email lands. Open the PDF.", icon: Inbox },
        { at: "8:46", what: "Open AP system. Find Bay Area Seafood vendor." },
        {
          at: "8:51",
          what: "Retype 9 lines, one at a time. Aliases out of memory.",
        },
        {
          at: "9:02",
          what: "Manually receive each line into inventory. Forget two.",
        },
        { at: "9:07", what: "Post the bill. Realise lot dates are missing." },
      ],
      statLabel: "Manual time",
      statValue: "25 min",
    },
    after: {
      title: "Drop the PDF. Walk away.",
      detail:
        "Same email, dragged into Fluxora's import surface. AI reads every line, matches to the catalog, posts the bill, and receives the lots — all in one beat.",
      tag: "1 click · 94% match rate",
      events: [
        { at: "8:42:00", what: "PDF dropped onto the Bills inbox." },
        {
          at: "8:42:01",
          what: "AI extracts 9 lines · 3 lots auto-created.",
          icon: Sparkles,
        },
        { at: "8:42:03", what: "Aliases learned from prior receipts apply." },
        {
          at: "8:42:04",
          what: "Posted to AP + received into inventory.",
        },
      ],
      statLabel: "Fluxora time",
      statValue: "4 sec",
      callout: "9 lines posted. 3 lots received. Aliases persisted.",
    },
  },
  {
    step: "Step 2 of 5",
    topic: "Anchor Tavern phones in their order",
    before: {
      title: "Look up pricing. Pick lots by sticky note.",
      detail:
        "Mateo from Anchor wants the usual — salmon, wagyu, heirlooms. Their Tier 2 prices live in a separate spreadsheet, and the warehouse FIFO is a Post-it.",
      tag: "FIFO on a wall · margin unknown",
      events: [
        { at: "9:08", what: "Open the customer pricing spreadsheet." },
        { at: "9:10", what: "Find Anchor's Tier 2 line for each product." },
        {
          at: "9:14",
          what: "Walk to the warehouse to read the FIFO sticky.",
        },
        {
          at: "9:18",
          what: "Write the order out by hand on a paper pad.",
        },
        {
          at: "9:20",
          what: "Calculate margin in your head. Skip half of it.",
        },
      ],
      statLabel: "Manual time",
      statValue: "12 min",
    },
    after: {
      title: "Tier 2 pre-fills. FIFO pulls live.",
      detail:
        "Type three letters of Anchor's name. Tier 2 pricing snaps in. As you add each product, Fluxora pulls the oldest lots first and shows margin in real time.",
      tag: "Margin live · oldest-first allocation",
      events: [
        { at: "9:08:00", what: 'Type "Anch" — Anchor Tavern pre-fills.' },
        {
          at: "9:08:25",
          what: "Add 3 lines · FIFO allocates 6 lots automatically.",
          icon: ShoppingCart,
        },
        { at: "9:09:10", what: "Tier 2 prices apply per line." },
        { at: "9:09:30", what: "Margin chip lands at 42.7%." },
      ],
      statLabel: "Fluxora time",
      statValue: "90 sec",
      callout: "3 lines · 6 lots · 42.7% margin · all on one screen.",
    },
  },
  {
    step: "Step 3 of 5",
    topic: "Anchor wants the invoice for their books",
    before: {
      title: "Word template. Copy lines. Attach. Pray.",
      detail:
        "The accountant needs the invoice for AR matching. The Word letterhead is on the shared drive — someone keeps updating the wrong copy.",
      tag: "Word + email · no tracking",
      events: [
        { at: "9:20", what: 'Open invoice-template-FINAL-v3.docx.' },
        {
          at: "9:21",
          what: "Copy each order line into the table. Misalign two.",
        },
        { at: "9:24", what: "Update the totals manually. Tax was wrong." },
        { at: "9:25", what: "Export to PDF, attach to a Gmail draft.", icon: Mail },
        { at: "9:26", what: "Send. Hope the email address is current." },
      ],
      statLabel: "Manual time",
      statValue: "6 min",
    },
    after: {
      title: "One click. Branded. In the inbox.",
      detail:
        "Save the order in Fluxora — a branded PDF composes on the tenant letterhead and emails to the customer's saved billing address. Open + delivery tracked.",
      tag: "Branded · audit-ready · tracked",
      events: [
        { at: "9:09:31", what: "Click Save order on SO-2847." },
        {
          at: "9:09:32",
          what: "Branded PDF generated with letterhead.",
          icon: Receipt,
        },
        { at: "9:09:33", what: "Emailed to mateo@anchortavern.com." },
        { at: "9:10:18", what: "Anchor opens the invoice on his phone." },
      ],
      statLabel: "Fluxora time",
      statValue: "1 click",
      callout: "Sent in 2 sec. Opened in under a minute. Audit-ready.",
    },
  },
  {
    step: "Step 4 of 5",
    topic: "Lighthouse Cafe wires $4,880",
    before: {
      title: "Open five invoices. Edit each one.",
      detail:
        "An ACH lands and now five old invoices need to be reconciled. Aging gets exported again, the overpayment slips out of mind.",
      tag: "Per-invoice edits · stale aging",
      events: [
        { at: "9:30", what: "See the ACH on the bank feed. Hunt the customer." },
        { at: "9:33", what: "Open invoice #1. Apply the payment. Save." },
        {
          at: "9:36",
          what: "Open invoice #2. Apply. Save. Repeat 3 more times.",
        },
        { at: "9:39", what: "Re-export the aging report for the boss." },
        { at: "9:42", what: "Forget the overpayment exists. Discover it later." },
      ],
      statLabel: "Manual time",
      statValue: "12 min",
    },
    after: {
      title: "Match the payment. FIFO does the rest.",
      detail:
        "The ACH lines up to Lighthouse automatically. One click applies it to the oldest invoices first; aging buckets shift across the dashboard instantly.",
      tag: "FIFO across invoices · zero manual edits",
      events: [
        { at: "9:30:00", what: "ACH auto-matched to Lighthouse Cafe." },
        {
          at: "9:30:01",
          what: "FIFO applies $4,880 across 3 oldest invoices.",
          icon: Wallet,
        },
        { at: "9:30:02", what: "Aging buckets shift on the dashboard." },
        { at: "9:30:03", what: "$0 overpayment — clean apply." },
      ],
      statLabel: "Fluxora time",
      statValue: "auto",
      callout: "3 invoices cleared · aging current · zero manual edits.",
    },
  },
  {
    step: "Step 5 of 5",
    topic: "A lot is about to expire",
    before: {
      title: "Find out when the truck rolls back.",
      detail:
        "Nothing flags expiring stock. The driver returns with 18 lb of salmon that's now garbage, the GL takes the hit, and no audit trail catches it.",
      tag: "Discover late · no audit trail",
      events: [
        { at: "9:42", what: "Driver heads out. No expiry alert anywhere." },
        { at: "10:35", what: "Driver calls — the salmon smells off." },
        { at: "10:48", what: "Anchor refuses the order. Truck heads back." },
        { at: "11:20", what: "Write off 18 lb. Boss never sees the loss." },
        {
          at: "Tuesday next",
          what: "Same lot expires somewhere else. Repeat.",
        },
      ],
      statLabel: "Discovered",
      statValue: "Too late",
    },
    after: {
      title: "Two days ahead. Highlighted in amber.",
      detail:
        "Fluxora flagged L-1245 forty-eight hours before its expiry date. The next-out FIFO indicator surfaces it on every order screen.",
      tag: "Expiry-aware · audit-trailed",
      events: [
        {
          at: "Sunday",
          what: "L-1245 enters the 2-day expiry window.",
          icon: Boxes,
        },
        {
          at: "Sunday",
          what: 'Dashboard "stock at risk" lifts to 1 lot.',
        },
        {
          at: "Monday",
          what: "FIFO indicator surfaces L-1245 on every order screen.",
        },
        {
          at: "Tuesday",
          what: "Anchor's order naturally pulls it. Loss avoided.",
        },
      ],
      statLabel: "Caught",
      statValue: "2 days ahead",
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
  return <div className="absolute inset-0">{children}</div>;
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
