"use client";

import { motion, type Variants } from "motion/react";
import { AlertTriangle, Building2 } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  AGING,
  AR_TOTAL,
  TOP_OWING_CUSTOMERS,
  type AgingBucket,
} from "../_data/dashboard";
import { formatMoney, useCountUp } from "./count-up";
import { FakeAppShell } from "./fake-app-shell";

// Scene 2: where the money is. AR total + aging buckets + top owing customers.

const TONE_COLOR: Record<AgingBucket["tone"], string> = {
  good: "var(--color-success-fg)",
  neutral: "var(--color-forest-mid)",
  warn: "var(--color-warning-fg)",
  danger: "var(--color-danger-fg)",
};

const TONE_BG: Record<AgingBucket["tone"], string> = {
  good: "bg-success-bg/60",
  neutral: "bg-forest-tint/60",
  warn: "bg-warning-bg/70",
  danger: "bg-danger-bg/70",
};

const TONE_TEXT: Record<AgingBucket["tone"], string> = {
  good: "text-success-fg",
  neutral: "text-forest-mid",
  warn: "text-warning-fg",
  danger: "text-danger-fg",
};

const rowStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.6 } },
};

const rowEntry: Variants = {
  hidden: { opacity: 0, x: 12 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
};

export function ReceivablesScene() {
  const arTotal = useCountUp(AR_TOTAL, 1400, 300);
  const maxBucket = Math.max(...AGING.map((b) => b.amount));
  const topMax = Math.max(...TOP_OWING_CUSTOMERS.map((c) => c.outstanding));

  return (
    <motion.div
      key="receivables-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell crumbs={["Dashboard", "Receivables"]}>
        <div className="grid h-full grid-cols-[1.1fr_1fr] gap-0">
          {/* Aging buckets */}
          <div className="overflow-y-auto p-6">
            <header className="flex items-baseline justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                  Accounts receivable
                </span>
                <h2 className="mt-1 font-serif text-[26px] font-medium leading-none text-ink tabular-nums">
                  {formatMoney(arTotal)}
                </h2>
                <p className="mt-1 text-[12px] text-subtle">
                  Across {AGING.reduce((s, b) => s + b.invoices, 0)} open
                  invoices
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-warning-border/70 bg-warning-bg/40 px-3 py-1.5">
                <AlertTriangle
                  className="size-3 text-warning-fg"
                  strokeWidth={2}
                />
                <span className="text-[11.5px] font-medium text-warning-fg">
                  $5,600 past 30 days
                </span>
              </div>
            </header>

            <div className="mt-6 space-y-3">
              {AGING.map((bucket, idx) => (
                <AgingBar
                  key={bucket.label}
                  bucket={bucket}
                  maxAmount={maxBucket}
                  delay={0.3 + idx * 0.08}
                />
              ))}
            </div>
          </div>

          {/* Top owing customers */}
          <aside className="flex flex-col overflow-hidden border-l border-border-default bg-card-warm/30">
            <div className="flex items-center gap-2 border-b border-border-default px-5 py-3">
              <Building2
                className="size-3.5 text-forest-mid"
                strokeWidth={2}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
                Who owes what
              </span>
            </div>

            <motion.ul
              variants={rowStagger}
              initial="hidden"
              animate="show"
              className="flex-1 overflow-y-auto"
            >
              {TOP_OWING_CUSTOMERS.map((c) => (
                <motion.li
                  key={c.name}
                  variants={rowEntry}
                  className="border-b border-border-default px-5 py-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <div className="font-medium text-ink text-[13px]">
                        {c.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-subtle">
                        <span>{c.city}</span>
                        <span>·</span>
                        <span
                          className={cn(
                            c.oldestInvoiceDays >= 60
                              ? "text-danger-fg"
                              : c.oldestInvoiceDays >= 30
                                ? "text-warning-fg"
                                : "text-subtle",
                          )}
                        >
                          oldest {c.oldestInvoiceDays}d
                        </span>
                      </div>
                    </div>
                    <span className="font-serif text-[16px] font-medium text-ink tabular-nums">
                      ${c.outstanding.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface">
                    <motion.div
                      className={cn(
                        "h-full",
                        c.oldestInvoiceDays >= 60
                          ? "bg-danger-fg"
                          : c.oldestInvoiceDays >= 30
                            ? "bg-warning-fg"
                            : "bg-forest-mid",
                      )}
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(c.outstanding / topMax) * 100}%`,
                      }}
                      transition={{
                        duration: 0.7,
                        delay: 0.8,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    />
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          </aside>
        </div>
      </FakeAppShell>
    </motion.div>
  );
}

function AgingBar({
  bucket,
  maxAmount,
  delay,
}: {
  bucket: AgingBucket;
  maxAmount: number;
  delay: number;
}) {
  const fillPct = (bucket.amount / maxAmount) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="font-mono uppercase tracking-[0.12em] text-subtle">
          {bucket.label} days
        </span>
        <span className="font-mono text-subtle">
          {bucket.invoices} invoice{bucket.invoices === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <div className="flex-1 overflow-hidden rounded-md bg-card-warm h-7 border border-border-default">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${fillPct}%` }}
            transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "h-full",
              TONE_BG[bucket.tone],
            )}
            style={{
              boxShadow: `inset 0 0 0 1px ${TONE_COLOR[bucket.tone]}30`,
            }}
          />
        </div>
        <span
          className={cn(
            "min-w-[100px] text-right font-serif text-[18px] font-medium tabular-nums",
            TONE_TEXT[bucket.tone],
          )}
        >
          ${bucket.amount.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
