"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowDown, Check, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  AGING_BEFORE,
  CUSTOMER,
  OPEN_INVOICES,
  PAYMENT_AMOUNT,
  allocatePayment,
} from "../_data/payment";
import { FakeAppShell } from "./fake-app-shell";

// Scene 3: post the allocation. Aging buckets shift down as money clears
// the oldest buckets first; success badge lands.

const ALLOCATIONS = allocatePayment(PAYMENT_AMOUNT, OPEN_INVOICES);

function bucketKey(ageDays: number): keyof typeof AGING_BEFORE {
  if (ageDays >= 60) return "d90";
  if (ageDays >= 30) return "d60";
  if (ageDays >= 1) return "d30";
  return "current";
}

const AGING_AFTER = (() => {
  const after = { ...AGING_BEFORE };
  for (const alloc of ALLOCATIONS) {
    const inv = OPEN_INVOICES.find((i) => i.number === alloc.invoiceNumber);
    if (!inv) continue;
    after[bucketKey(inv.ageDays)] -= alloc.applied;
  }
  return after;
})();

const BUCKETS: {
  key: keyof typeof AGING_BEFORE;
  label: string;
  tone: "good" | "neutral" | "warn" | "danger";
}[] = [
  { key: "current", label: "Current", tone: "good" },
  { key: "d30", label: "1–30 days", tone: "neutral" },
  { key: "d60", label: "31–60 days", tone: "warn" },
  { key: "d90", label: "61–90 days", tone: "danger" },
];

const TONE_BG: Record<string, string> = {
  good: "bg-success-bg/60",
  neutral: "bg-forest-tint/60",
  warn: "bg-warning-bg/70",
  danger: "bg-danger-bg/70",
};

const TONE_TEXT: Record<string, string> = {
  good: "text-success-fg",
  neutral: "text-forest-mid",
  warn: "text-warning-fg",
  danger: "text-danger-fg",
};

export function PostScene() {
  const [posted, setPosted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPosted(true), 700);
    return () => clearTimeout(t);
  }, []);

  const totalBefore = Object.values(AGING_BEFORE).reduce((s, v) => s + v, 0);
  const totalAfter = Object.values(AGING_AFTER).reduce((s, v) => s + v, 0);
  const max = Math.max(...Object.values(AGING_BEFORE));

  return (
    <motion.div
      key="post-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell crumbs={["Payments", "Posted"]}>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border-default px-6 py-5">
            <div>
              <h1 className="font-serif text-[24px] font-medium tracking-tight text-ink">
                {CUSTOMER.name}
              </h1>
              <p className="mt-0.5 text-[12px] text-subtle">
                Aging — before and after this payment.
              </p>
            </div>
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={
                posted ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }
              }
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="inline-flex items-center gap-2 rounded-full border border-success-border/70 bg-success-bg/70 px-3 py-1.5"
            >
              <Check
                className="size-3.5 text-success-fg"
                strokeWidth={2.4}
              />
              <span className="text-[12px] font-medium text-success-fg">
                Payment posted · ${PAYMENT_AMOUNT.toLocaleString()} applied
              </span>
            </motion.div>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-0">
            <BucketColumn
              title="Before"
              total={totalBefore}
              values={AGING_BEFORE}
              max={max}
              animate={false}
            />
            <div className="border-l border-border-default">
              <BucketColumn
                title="After"
                total={totalAfter}
                values={posted ? AGING_AFTER : AGING_BEFORE}
                max={max}
                animate={true}
              />
            </div>
          </div>
        </div>
      </FakeAppShell>
    </motion.div>
  );
}

function BucketColumn({
  title,
  total,
  values,
  max,
  animate,
}: {
  title: string;
  total: number;
  values: typeof AGING_BEFORE;
  max: number;
  animate: boolean;
}) {
  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
          {title}
        </span>
        <span className="font-serif text-[20px] font-medium text-ink tabular-nums">
          ${total.toLocaleString()}
        </span>
      </div>

      <div className="mt-4 flex-1 space-y-3">
        {BUCKETS.map((b) => {
          const before = AGING_BEFORE[b.key];
          const v = values[b.key];
          const fillPct = (v / max) * 100;
          const cleared = before > 0 && v === 0 && title === "After";
          const partial = before !== v && v > 0 && title === "After";
          return (
            <div key={b.key}>
              <div className="flex items-baseline justify-between text-[11.5px]">
                <span className="text-ink-warm">{b.label}</span>
                <div className="flex items-center gap-1.5">
                  {cleared ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-1.5 py-0.5 text-[10px] font-medium text-success-fg">
                      <Check className="size-2.5" strokeWidth={2.4} />
                      cleared
                    </span>
                  ) : partial ? (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-success-fg">
                      <ArrowDown className="size-2.5" strokeWidth={2.2} />
                      ${(before - v).toLocaleString()}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "font-mono text-[12px] tabular-nums",
                      cleared ? "text-success-fg line-through" : "text-ink",
                    )}
                  >
                    ${v.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="mt-1 h-3 overflow-hidden rounded-md bg-card-warm border border-border-default">
                <motion.div
                  className={cn("h-full", TONE_BG[b.tone])}
                  initial={false}
                  animate={
                    animate
                      ? { width: `${fillPct}%` }
                      : { width: `${(before / max) * 100}%` }
                  }
                  transition={{
                    duration: 0.85,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {title === "After" ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={animate ? { opacity: 1, y: 0 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className={cn(
            "mt-4 inline-flex items-center gap-2 rounded-md border border-success-border/60 bg-success-bg/40 px-3 py-2 text-[11.5px] font-medium",
            TONE_TEXT.good,
          )}
        >
          <Sparkles className="size-3.5" strokeWidth={2.2} />3 invoices
          cleared · 2 partially applied
        </motion.div>
      ) : null}
    </div>
  );
}
