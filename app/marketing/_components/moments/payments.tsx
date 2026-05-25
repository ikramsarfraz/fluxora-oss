"use client";

import { motion } from "motion/react";
import {
  ArrowDown,
  Building2,
  Check,
  CreditCard,
  Sparkles,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { MarketingAppShell } from "./app-shell";

type Bucket = {
  label: string;
  before: number;
  after: number;
  tone: "good" | "neutral" | "warn" | "danger";
};

const BUCKETS: Bucket[] = [
  { label: "Current", before: 9400, after: 9400, tone: "good" },
  { label: "1–30 days", before: 7800, after: 5160, tone: "neutral" },
  { label: "31–60 days", before: 2840, after: 0, tone: "warn" },
  { label: "61–90 days", before: 1840, after: 0, tone: "danger" },
];

const TONE_BG: Record<Bucket["tone"], string> = {
  good: "bg-success-bg/60",
  neutral: "bg-forest-tint/60",
  warn: "bg-warning-bg/70",
  danger: "bg-danger-bg/70",
};

export function PaymentsMoment() {
  const totalBefore = BUCKETS.reduce((s, b) => s + b.before, 0);
  const totalAfter = BUCKETS.reduce((s, b) => s + b.after, 0);
  const max = Math.max(...BUCKETS.map((b) => b.before));

  return (
    <MarketingAppShell
      activeNav="payments"
      crumbs={["Payments", "Apply payment", "Lighthouse Cafe"]}
      label="Payments · FIFO match"
      tone="success"
      rightSlot={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success-border/60 bg-success-bg/40 px-2.5 py-1 text-[11.5px] font-medium text-success-fg">
          <Sparkles className="size-3" strokeWidth={2} />3 invoices cleared
        </span>
      }
    >
      <div className="flex h-full flex-col p-5">
        {/* Payment ribbon */}
        <div className="flex items-center gap-3 rounded-lg border border-success-border/60 bg-success-bg/40 px-4 py-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-success-fg text-card-warm">
            <Zap className="size-4" strokeWidth={2.2} />
          </div>
          <div className="flex-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-success-fg">
              Payment received
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-[20px] font-medium text-ink">
                $4,880.00
              </span>
              <span className="font-mono text-[11px] text-subtle">
                from Lighthouse Cafe
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
              Method
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[12px] text-ink">
              <CreditCard className="size-3" strokeWidth={2} />
              ACH · •••• 0142
            </div>
          </div>
        </div>

        {/* Customer chip */}
        <div className="mt-4 flex items-center gap-2.5 rounded-md border border-border-default bg-card-warm px-3 py-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-forest-tint">
            <Building2 className="size-3.5 text-forest-mid" strokeWidth={1.8} />
          </div>
          <span className="text-[12.5px] font-medium text-ink">
            Lighthouse Cafe
          </span>
          <span className="font-mono text-[10px] text-subtle">
            San Francisco · LCH
          </span>
          <span className="ml-auto font-mono text-[10.5px] text-ink-warm">
            $4,880 open balance
          </span>
        </div>

        {/* Before/after aging buckets */}
        <div className="mt-5 grid flex-1 grid-cols-2 gap-5">
          <Column
            title="Before"
            total={totalBefore}
            buckets={BUCKETS}
            phase="before"
            max={max}
          />
          <Column
            title="After FIFO apply"
            total={totalAfter}
            buckets={BUCKETS}
            phase="after"
            max={max}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
          className="mt-4 flex items-center gap-2 rounded-lg border border-success-border/60 bg-success-bg/30 px-3 py-2 text-[11.5px] font-medium text-success-fg"
        >
          <Sparkles className="size-3.5" strokeWidth={2} />
          61–90 cleared · 31–60 cleared · 1–30 reduced · 0 manual matches
          required
        </motion.div>
      </div>
    </MarketingAppShell>
  );
}

function Column({
  title,
  total,
  buckets,
  phase,
  max,
}: {
  title: string;
  total: number;
  buckets: Bucket[];
  phase: "before" | "after";
  max: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
          {title}
        </span>
        <span className="font-serif text-[18px] font-medium text-ink tabular-nums">
          ${total.toLocaleString()}
        </span>
      </div>
      <div className="mt-3 space-y-2.5">
        {buckets.map((b, idx) => {
          const value = phase === "after" ? b.after : b.before;
          const cleared = phase === "after" && b.before > 0 && b.after === 0;
          const partial = phase === "after" && b.after > 0 && b.after !== b.before;
          const fillPct = (value / max) * 100;
          return (
            <div key={b.label}>
              <div className="flex items-baseline justify-between text-[11.5px]">
                <span className="text-ink-warm">{b.label}</span>
                <div className="flex items-center gap-1.5">
                  {cleared ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-success-bg px-1.5 py-0.5 text-[9.5px] font-medium text-success-fg">
                      <Check className="size-2" strokeWidth={2.6} />
                      cleared
                    </span>
                  ) : partial ? (
                    <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-success-fg">
                      <ArrowDown className="size-2.5" strokeWidth={2.4} />
                      ${(b.before - b.after).toLocaleString()}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "font-mono text-[12px] tabular-nums",
                      cleared ? "text-success-fg line-through" : "text-ink",
                    )}
                  >
                    ${value.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-md border border-border-default bg-card-warm">
                <motion.div
                  className={cn("h-full", TONE_BG[b.tone])}
                  initial={false}
                  animate={{ width: `${fillPct}%` }}
                  transition={{
                    duration: 0.85,
                    delay: phase === "after" ? 0.6 + idx * 0.08 : 0.15 + idx * 0.06,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
