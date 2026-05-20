"use client";

import { motion } from "motion/react";
import {
  Building2,
  Check,
  FileText,
  Sparkles,
  Tag,
  UploadCloud,
  Wrench,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { MarketingAppShell } from "./app-shell";

// =========================================================================
// AiExtractMoment — full Bills page with PDF drop + extracted fields
// =========================================================================
export function AiExtractMoment() {
  return (
    <MarketingAppShell
      activeNav="bills"
      crumbs={["Bills", "Import supplier invoice"]}
      label="AI invoice import"
      tone="info"
      rightSlot={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-info-bg/60 px-2.5 py-1 font-mono text-[11px] text-info-fg">
          <Sparkles className="size-3" strokeWidth={2} />
          2.4 sec · 94%
        </span>
      }
    >
      <div className="grid h-full grid-cols-[0.95fr_1.1fr] gap-0">
        {/* LEFT: receipt thumbnail */}
        <div className="flex flex-col items-center justify-center border-r border-border-default bg-card-warm/30 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            Just dropped
          </div>
          <motion.div
            initial={{ y: -50, rotate: -10, opacity: 0 }}
            animate={{ y: 0, rotate: 0, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 18,
            }}
            className="mt-3 flex w-full max-w-[220px] flex-col gap-1.5 rounded-md border-2 border-border-default bg-card-warm p-3.5 shadow-md"
          >
            <div className="flex items-center gap-1.5 border-b border-border-default pb-1.5">
              <FileText className="size-3.5 text-[#217346]" strokeWidth={2.2} />
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
          </motion.div>
          <div className="mt-3 flex items-center gap-1.5 font-mono text-[10px] text-subtle">
            <UploadCloud className="size-3" strokeWidth={2} />
            bay-area-seafood-4421.pdf · 84 KB
          </div>
        </div>

        {/* RIGHT: extracted fields */}
        <div className="p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-info-fg" strokeWidth={2} />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-info-fg">
              AI extracted · ready to post
            </span>
          </div>

          <div className="mt-3 space-y-2">
            <Field
              icon={Building2}
              label="Vendor"
              value="Bay Area Seafood"
              conf={0.97}
              delay={0.3}
            />
            <Field
              icon={Zap}
              label="Total"
              value="$714.00"
              conf={0.99}
              delay={0.5}
            />
            <Field
              icon={Tag}
              label="Lines matched"
              value="3 of 3 · 0 aliases needed"
              conf={0.94}
              delay={0.7}
            />
            <Field
              icon={Wrench}
              label="Receive into"
              value="Inventory · 3 lots auto-created"
              conf={0.92}
              delay={0.9}
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="mt-4 flex items-center gap-2 rounded-md bg-success-fg px-3 py-2 text-[12px] font-medium text-card-warm"
          >
            <Check className="size-3.5" strokeWidth={2.6} />
            Posted to AP + received into inventory
          </motion.div>

          <p className="mt-3 font-mono text-[10px] text-subtle">
            Aliases learned will persist for the next Bay Area Seafood invoice.
          </p>
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
