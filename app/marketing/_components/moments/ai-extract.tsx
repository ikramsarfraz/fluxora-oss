"use client";

import { motion } from "motion/react";
import {
  Building2,
  Check,
  FileText,
  Layers,
  Sparkles,
  Tag,
  UploadCloud,
  Wrench,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { MarketingAppShell } from "./app-shell";

// =========================================================================
// AiExtractMoment — bulk invoice drop with progressive AI extraction reveal
// =========================================================================
//
// The narrative reads in three beats:
//
//   1. DROP   — one invoice falls into the drop zone. Nothing else happens
//               yet. The visitor's eye is locked on the file landing.
//   2. BULK   — four more invoices fan in behind it; a "5 queued · bulk
//               processing" badge punches in. This is the moment that says
//               "this works for a folder, not just one PDF."
//   3. EXTRACT — only now does the right panel wake up. Status flips from
//               "Waiting" → "AI reading" → "AI extracted"; a scanning sweep
//               passes over the front invoice; then the extracted fields
//               cascade in one at a time, ~0.8s apart, so each confidence
//               bar has time to read before the next field lands.
//
// Timeline (within the 11s scene window):
//
//   0.0 → 0.3   drop zone visible; right panel says "Waiting"
//   0.3 → 1.5   first invoice spring-drops in from above
//   1.5 → 1.9   filename appears
//   1.9 → 3.0   4 more invoices fan in behind, queue badge punches in
//   3.0 → 3.7   right panel transitions: "AI reading invoice…"
//   3.7 → 4.4   scanning sweep across the front invoice
//   4.4 → 5.2   Vendor field
//   5.2 → 6.0   Total field
//   6.0 → 6.8   Lines matched field
//   6.8 → 7.6   Receive into field
//   7.6 → 8.2   green Posted callout
//   8.2 → 8.8   "+ 4 more processing" queue hint
//
// loopMs is bumped to 11500ms so the loop never restarts mid-walkthrough
// (the walkthrough's SCENE_MS = 11000ms). On the editorial / compare /
// tour pages this gives the moment a slightly longer breathing pause
// between loops — which the new pacing wants anyway.

const QUEUED_INVOICES = [
  { vendor: "North Coast Cheese", id: "20133", total: "$298.50" },
  { vendor: "Pacific Greens", id: "8842", total: "$412.20" },
  { vendor: "Sonoma Wines", id: "1190", total: "$1,224.00" },
  { vendor: "Bay Coffee Co.", id: "5571", total: "$186.40" },
];

export function AiExtractMoment() {
  return (
    <MarketingAppShell
      activeNav="bills"
      crumbs={["Bills", "Import supplier invoices"]}
      label="AI invoice import · bulk"
      tone="info"
      loopMs={11500}
      rightSlot={
        <motion.span
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: 7.6,
            type: "spring",
            stiffness: 320,
            damping: 18,
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-info-bg/60 px-2.5 py-1 font-mono text-[11px] text-info-fg"
        >
          <Sparkles className="size-3" strokeWidth={2} />
          2.4 sec · 94%
        </motion.span>
      }
    >
      <div className="grid h-full grid-cols-[0.95fr_1.1fr] gap-0">
        {/* LEFT: drop zone with stack of invoices */}
        <div className="relative flex flex-col items-center justify-center overflow-hidden border-r border-border-default bg-card-warm/30 px-5 py-8">
          {/* Drop-zone label — visible while the page is "empty," fades as
              the first invoice settles. */}
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 1, 0] }}
            transition={{ duration: 1.8, times: [0, 0.2, 1] }}
            className="absolute top-5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle"
          >
            <UploadCloud className="size-3" strokeWidth={2} />
            Drop invoices here
          </motion.div>

          {/* Stack container — front invoice with queued invoices fanned
              behind. Min height reserves room for the fan offsets. */}
          <div className="relative mt-4 min-h-[210px] w-full max-w-[220px]">
            {/* Queued invoices — fan in behind the front one. Reversed so
                the "closest" queued card lands first (smallest offset) and
                cards further back appear later, like the stack growing. */}
            {QUEUED_INVOICES.map((inv, idx) => {
              const depth = idx + 1;
              return (
                <motion.div
                  key={inv.id}
                  initial={{
                    opacity: 0,
                    x: 0,
                    y: -40,
                    rotate: -16,
                    scale: 0.86,
                  }}
                  animate={{
                    opacity: 1 - depth * 0.16,
                    x: -depth * 8,
                    y: -depth * 5,
                    rotate: -depth * 2.5,
                    scale: 1 - depth * 0.03,
                  }}
                  transition={{
                    delay: 1.9 + idx * 0.22,
                    type: "spring",
                    stiffness: 200,
                    damping: 22,
                  }}
                  style={{ zIndex: 5 - depth }}
                  className="absolute inset-0 flex flex-col gap-1 rounded-md border-2 border-border-default bg-card-warm p-3 shadow-md"
                >
                  <div className="flex items-center gap-1.5 border-b border-border-default pb-1">
                    <FileText
                      className="size-3 text-info-fg"
                      strokeWidth={2.2}
                    />
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-subtle">
                      {inv.vendor}
                    </span>
                  </div>
                  <div className="font-serif text-[11px] font-medium text-ink">
                    Invoice {inv.id}
                  </div>
                </motion.div>
              );
            })}

            {/* Front invoice — drops in 0.3 → 1.5s with a satisfying spring */}
            <motion.div
              initial={{ y: -120, rotate: -10, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, rotate: 0, opacity: 1, scale: 1 }}
              transition={{
                delay: 0.3,
                type: "spring",
                stiffness: 180,
                damping: 16,
                mass: 1.1,
              }}
              style={{ zIndex: 10 }}
              className="relative flex w-full flex-col gap-1.5 rounded-md border-2 border-border-default bg-card-warm p-3.5 shadow-lg"
            >
              <div className="flex items-center gap-1.5 border-b border-border-default pb-1.5">
                <FileText
                  className="size-3.5 text-[#217346]"
                  strokeWidth={2.2}
                />
                <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-subtle">
                  Bay Area Seafood
                </span>
              </div>
              <div className="font-serif text-[12px] font-medium text-ink">
                Invoice 4421
              </div>
              <ul className="space-y-0.5 font-mono text-[9.5px] text-ink-warm">
                <li className="flex justify-between">
                  <span>Atlantic salmon · 30 lb</span>
                  <span>$216.00</span>
                </li>
                <li className="flex justify-between">
                  <span>Heirloom tomatoes · 8 cs</span>
                  <span>$176.00</span>
                </li>
                <li className="flex justify-between">
                  <span>Wagyu ribeye · 14 ea</span>
                  <span>$322.00</span>
                </li>
              </ul>
              <div className="mt-1 border-t border-border-default pt-1 text-right font-mono text-[10.5px] font-medium text-ink">
                Total · $714.00
              </div>

              {/* Scanning sweep — 3.7 → 4.4s, runs top to bottom across the
                  front invoice as the AI reads it. */}
              <motion.div
                aria-hidden
                initial={{ y: -4, opacity: 0 }}
                animate={{ y: 180, opacity: [0, 1, 1, 0] }}
                transition={{
                  delay: 3.7,
                  duration: 0.7,
                  times: [0, 0.1, 0.85, 1],
                  ease: "linear",
                }}
                className="pointer-events-none absolute inset-x-2 top-0 h-[2px] rounded-full bg-info-fg shadow-[0_0_14px_var(--color-info-fg)]"
              />
            </motion.div>
          </div>

          {/* Filename — appears just after the front invoice settles */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.5 }}
            className="mt-5 flex items-center gap-1.5 font-mono text-[10px] text-subtle"
          >
            <UploadCloud className="size-3" strokeWidth={2} />
            bay-area-seafood-4421.pdf · 84 KB
          </motion.div>

          {/* Bulk queue badge — punches in once the fan completes */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: 3.0,
              type: "spring",
              stiffness: 280,
              damping: 22,
            }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-info-border/60 bg-info-bg/60 px-2.5 py-1 font-mono text-[10px] text-info-fg"
          >
            <Layers className="size-3" strokeWidth={2} />
            5 invoices queued · bulk processing
          </motion.div>
        </div>

        {/* RIGHT: status panel — empty until the AI starts reading */}
        <div className="p-5">
          {/* Three-state status label. Each state owns the same row; they
              cross-fade as the moment progresses. */}
          <div className="relative h-5">
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: [1, 1, 0] }}
              transition={{ duration: 3.0, times: [0, 0.85, 1] }}
              className="absolute inset-0 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle"
            >
              <UploadCloud className="size-3.5" strokeWidth={2} />
              Waiting for invoices…
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{
                delay: 3.0,
                duration: 1.4,
                times: [0, 0.15, 0.85, 1],
              }}
              className="absolute inset-0 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-info-fg"
            >
              <Sparkles className="size-3.5" strokeWidth={2} />
              AI reading invoice…
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 4.4, duration: 0.5 }}
              className="absolute inset-0 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-info-fg"
            >
              <Sparkles className="size-3.5" strokeWidth={2} />
              AI extracted · ready to post
            </motion.div>
          </div>

          {/* Extracted fields — cascade in 0.8s apart so each confidence
              bar reads before the next row lands. */}
          <div className="mt-3 space-y-2">
            <Field
              icon={Building2}
              label="Vendor"
              value="Bay Area Seafood"
              conf={0.97}
              delay={4.4}
            />
            <Field
              icon={Zap}
              label="Total"
              value="$714.00"
              conf={0.99}
              delay={5.2}
            />
            <Field
              icon={Tag}
              label="Lines matched"
              value="3 of 3 · 0 aliases needed"
              conf={0.94}
              delay={6.0}
            />
            <Field
              icon={Wrench}
              label="Receive into"
              value="Inventory · 3 lots auto-created"
              conf={0.92}
              delay={6.8}
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 7.6, duration: 0.5 }}
            className="mt-4 flex items-center gap-2 rounded-md bg-success-fg px-3 py-2 text-[12px] font-medium text-card-warm"
          >
            <Check className="size-3.5" strokeWidth={2.6} />
            Posted to AP + received into inventory
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 8.2, duration: 0.6 }}
            className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] text-subtle"
          >
            <Layers className="size-3" strokeWidth={2} />
            + 4 more processing · aliases learned will persist
          </motion.p>
        </div>
      </div>
    </MarketingAppShell>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  conf,
  delay,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  conf: number;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-3 rounded-md border border-success-border/40 bg-card-warm px-3 py-2.5"
    >
      <Icon className="size-4 text-subtle" strokeWidth={1.8} />
      <div className="flex-1">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-subtle">
          {label}
        </div>
        <div className="text-[13px] font-medium text-ink">{value}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-1 w-[50px] overflow-hidden rounded-full bg-surface">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${conf * 100}%` }}
            transition={{ duration: 0.5, delay: delay + 0.1 }}
            className={cn(
              "h-full",
              conf >= 0.95 ? "bg-success-fg" : "bg-info-fg",
            )}
          />
        </div>
        <span className="font-mono text-[10px] text-ink-warm">
          {Math.round(conf * 100)}%
        </span>
      </div>
    </motion.div>
  );
}

// =========================================================================
// BulkImportMoment — full Customers page with import in progress
// =========================================================================
const CUSTOMERS_PREVIEW = [
  { name: "Anchor Tavern", city: "Tiburon, CA", tier: "Tier 2", balance: "$0.00" },
  { name: "Lighthouse Cafe", city: "San Francisco, CA", tier: "Tier 1", balance: "$0.00" },
  { name: "Ferry Plaza Cafe", city: "San Francisco, CA", tier: "Tier 2", balance: "$0.00" },
  { name: "Magnolia Diner", city: "Berkeley, CA", tier: "Tier 3", balance: "$0.00" },
  { name: "Vine Street Trattoria", city: "San Francisco, CA", tier: "Tier 2", balance: "$0.00" },
];

export function BulkImportMoment() {
  return (
    <MarketingAppShell
      activeNav="customers"
      crumbs={["Customers"]}
      label="Customers · bulk import"
      tone="forest"
      rightSlot={
        <motion.span
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.8, type: "spring", stiffness: 320, damping: 18 }}
          className="inline-flex items-center gap-1.5 rounded-full bg-success-bg/60 px-2.5 py-1 text-[11.5px] font-medium text-success-fg"
        >
          <Sparkles className="size-3" strokeWidth={2} />
          18 imported in 4.2s
        </motion.span>
      }
    >
      <div className="flex h-full flex-col p-5">
        {/* Header */}
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="font-serif text-[20px] font-medium tracking-tight text-ink">
              Customers
            </h2>
            <p className="mt-0.5 text-[12.5px] text-subtle">
              <span className="font-medium text-ink-warm">18 customers</span> ·
              imported just now from customer-book.xlsx
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-card-warm px-2.5 py-1 font-mono text-[11px] text-subtle">
              <UploadCloud className="size-3" strokeWidth={2} />
              customer-book.xlsx · 14 KB
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface">
          <motion.div
            className="h-full bg-forest-mid"
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        {/* Customers table */}
        <div className="mt-5 flex-1 overflow-hidden rounded-lg border border-border-default bg-card-warm">
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface/60 text-[10px] uppercase tracking-[0.12em] text-subtle">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Customer</th>
                <th className="px-3 py-2 text-left font-medium">Location</th>
                <th className="px-3 py-2 text-left font-medium">Tier</th>
                <th className="px-3 py-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {CUSTOMERS_PREVIEW.map((c, idx) => (
                <motion.tr
                  key={c.name}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: 0.3 + idx * 0.07,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="border-t border-border-default"
                >
                  <td className="px-3 py-2.5 font-medium text-ink">{c.name}</td>
                  <td className="px-3 py-2.5 text-ink-warm">{c.city}</td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-full bg-forest-tint/40 px-1.5 py-0.5 font-mono text-[10px] text-forest-mid">
                      {c.tier}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-subtle">
                    {c.balance}
                  </td>
                </motion.tr>
              ))}
              <motion.tr
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
                className="border-t border-border-default bg-surface/40"
              >
                <td colSpan={4} className="px-3 py-2.5 text-center">
                  <span className="font-mono text-[11px] text-subtle">
                    + 13 more
                  </span>
                </td>
              </motion.tr>
            </tbody>
          </table>
        </div>
      </div>
    </MarketingAppShell>
  );
}
