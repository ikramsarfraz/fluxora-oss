"use client";

import { motion } from "motion/react";
import {
  Check,
  FileText,
  Sparkles,
  UploadCloud,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { MomentFrame } from "./moment-frame";

// AI invoice import — receipt thumbnail + 4 extracted fields with
// confidence bars. Used as a static fallback when not iframe-embedding the
// full reel.
export function AiExtractMoment() {
  return (
    <MomentFrame label="AI invoice import" tone="info">
      <div className="grid grid-cols-1 gap-0 md:grid-cols-[0.9fr_1fr]">
        {/* PDF thumb */}
        <div className="flex flex-col items-center justify-center bg-card-warm/40 p-6">
          <motion.div
            initial={{ y: -40, rotate: -10, opacity: 0 }}
            animate={{ y: 0, rotate: 0, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 220,
              damping: 18,
            }}
            className="flex w-full max-w-[200px] flex-col gap-1.5 rounded-md border-2 border-border-default bg-card-warm p-3 shadow-md"
          >
            <div className="flex items-center gap-1.5">
              <FileText
                className="size-3.5 text-[#217346]"
                strokeWidth={2.2}
              />
              <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-subtle">
                Bay Area Seafood
              </span>
            </div>
            <div className="font-serif text-[11.5px] font-medium text-ink">
              Invoice 4421
            </div>
            <ul className="mt-1 space-y-0.5 text-[9.5px] text-ink-warm font-mono">
              <li>Atlantic salmon · 30 lb · $216.00</li>
              <li>Heirloom tomatoes · 8 cs · $176.00</li>
              <li>Wagyu ribeye · 14 ea · $322.00</li>
            </ul>
            <div className="mt-1 border-t border-border-default pt-1 text-right font-mono text-[10px] font-medium text-ink">
              Total · $714.00
            </div>
          </motion.div>

          <div className="mt-4 flex items-center gap-1.5 font-mono text-[10px] text-subtle">
            <UploadCloud className="size-3" strokeWidth={2} />
            Dropped · 84 KB
          </div>
        </div>

        {/* Extracted fields */}
        <div className="border-t border-border-default p-6 md:border-l md:border-t-0">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-info-fg">
            <Sparkles className="size-3" strokeWidth={2.2} />
            Extracted in 2.4 seconds
          </div>

          <div className="mt-3 space-y-2">
            <Field label="Vendor" value="Bay Area Seafood" conf={0.97} delay={0.3} />
            <Field label="Total" value="$714.00" conf={0.99} delay={0.5} />
            <Field label="Lines" value="3 matched · 0 new" conf={0.94} delay={0.7} />
            <Field label="Receive to" value="Inventory · 3 lots" conf={0.92} delay={0.9} />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-success-fg px-3 py-1.5 text-[11.5px] font-medium text-card-warm"
          >
            <Check className="size-3" strokeWidth={2.6} />
            Posted to AP + received
          </motion.div>
        </div>
      </div>
    </MomentFrame>
  );
}

function Field({
  label,
  value,
  conf,
  delay,
}: {
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
      className="flex items-center gap-3 rounded-md border border-success-border/40 bg-card-warm px-3 py-2"
    >
      <div className="flex-1">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-subtle">
          {label}
        </div>
        <div className="text-[13px] font-medium text-ink">{value}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-1 w-[44px] overflow-hidden rounded-full bg-surface">
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
        <span className="font-mono text-[9.5px] text-ink-warm">
          {Math.round(conf * 100)}%
        </span>
      </div>
    </motion.div>
  );
}

// Customer bulk import: file drops + counter ticks. Compact.
export function BulkImportMoment() {
  return (
    <MomentFrame label="Customer bulk import" tone="forest">
      <div className="p-6">
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="font-serif text-[20px] font-medium tracking-tight text-ink">
              customer-book.xlsx
            </h3>
            <div className="mt-0.5 font-mono text-[10.5px] text-subtle">
              18 rows · 14 KB
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 18,
              delay: 0.6,
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-success-bg/70 px-3 py-1 text-[11px] font-medium text-success-fg"
          >
            <Sparkles className="size-3" strokeWidth={2.2} />
            18 imported · 4.2 sec
          </motion.div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-surface">
          <motion.div
            className="h-full bg-forest-mid"
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.6, delay: 0.2 }}
          />
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-border-default">
          <Row name="Anchor Tavern" city="Tiburon" tier="Tier 2" delay={0.4} />
          <Row name="Lighthouse Cafe" city="San Francisco" tier="Tier 1" delay={0.5} />
          <Row name="Ferry Plaza Cafe" city="San Francisco" tier="Tier 2" delay={0.6} />
          <Row name="Magnolia Diner" city="Berkeley" tier="Tier 3" delay={0.7} />
          <Row
            name="+ 14 more"
            city=""
            tier=""
            muted
            delay={0.85}
          />
        </div>
      </div>
    </MomentFrame>
  );
}

function Row({
  name,
  city,
  tier,
  muted,
  delay,
}: {
  name: string;
  city: string;
  tier: string;
  muted?: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay }}
      className={cn(
        "flex items-center justify-between border-t border-border-default px-3 py-2 first:border-t-0",
        muted ? "bg-surface/40" : "bg-card-warm",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "text-[12.5px]",
            muted ? "font-mono text-subtle" : "font-medium text-ink",
          )}
        >
          {name}
        </span>
        {city ? (
          <span className="font-mono text-[10px] text-subtle">{city}</span>
        ) : null}
      </div>
      {tier ? (
        <span className="rounded-full bg-forest-tint/40 px-1.5 py-0.5 font-mono text-[9.5px] text-forest-mid">
          {tier}
        </span>
      ) : null}
    </motion.div>
  );
}
