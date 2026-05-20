"use client";

import { motion } from "motion/react";
import { ArrowRight, Landmark } from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { cn } from "@/lib/utils";

import { MomentFrame, PulseDot } from "./moment-frame";

// Plaid moment: bank → fluxora pipe + a tiny match feed underneath.
type Match = {
  desc: string;
  amount: number;
  match: string;
  tone: "success" | "warning" | "info";
};

const MATCHES: Match[] = [
  { desc: "ACH · LIGHTHOUSE CAFE", amount: 4880, match: "Invoice payment · INV-2701 +2", tone: "success" },
  { desc: "BAY AREA SEAFOOD · ACH", amount: -2240, match: "Supplier bill · BILL-1108", tone: "warning" },
  { desc: "POS · COSTCO BUSINESS", amount: -184.32, match: "Expense · Supplies", tone: "info" },
];

const TONE_BG: Record<Match["tone"], string> = {
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  info: "bg-info-bg text-info-fg",
};

export function PlaidMoment() {
  return (
    <MomentFrame label="Plaid · bank sync" tone="info">
      <div className="p-6">
        {/* Connection pipe */}
        <div className="flex items-center justify-between gap-4">
          <Node color="#117ACA" letter="C" label="Chase Business" />
          <Pipe />
          <Node letter={<Logomark size={20} />} label="Fluxora" />
        </div>

        <div className="mt-5 flex items-center justify-between border-y border-border-default py-3">
          <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-info-fg">
            <PulseDot tone="warning" />
            Syncing daily
          </div>
          <span className="font-mono text-[11px] text-subtle">
            Last sync · 3 minutes ago · 12 transactions
          </span>
        </div>

        {/* Match feed */}
        <ul className="mt-3 space-y-2">
          {MATCHES.map((m, idx) => (
            <motion.li
              key={m.desc}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.35 + idx * 0.18,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex items-center gap-3 rounded-md border border-border-default bg-card-warm px-3 py-2"
            >
              <div className="flex-1">
                <div className="text-[12.5px] font-medium text-ink">{m.desc}</div>
                <div className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] text-subtle">
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5",
                      TONE_BG[m.tone],
                    )}
                  >
                    {m.match}
                  </span>
                </div>
              </div>
              <span
                className={cn(
                  "font-mono text-[12.5px] tabular-nums",
                  m.amount >= 0 ? "text-success-fg" : "text-ink",
                )}
              >
                {m.amount >= 0 ? "+" : "−"}$
                {Math.abs(m.amount).toLocaleString(undefined, {
                  minimumFractionDigits: m.amount % 1 === 0 ? 0 : 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </MomentFrame>
  );
}

function Node({
  color,
  letter,
  label,
}: {
  color?: string;
  letter: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="flex size-12 items-center justify-center rounded-xl text-[22px] font-bold text-white shadow-sm"
        style={
          color
            ? { backgroundColor: color }
            : {
                backgroundColor: "var(--color-card-warm)",
                border: "1px solid var(--color-border-default)",
              }
        }
      >
        {letter}
      </div>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-subtle">
        {label}
      </div>
    </div>
  );
}

function Pipe() {
  return (
    <div className="relative h-12 flex-1">
      <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-info-fg/30" />
      <motion.div
        className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-info-fg shadow-[0_0_10px_rgba(31,58,46,0.4)]"
        animate={{ left: ["0%", "100%"] }}
        transition={{ duration: 1.8, ease: "linear", repeat: Infinity }}
      />
      <motion.div
        className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-info-fg/60"
        animate={{ left: ["0%", "100%"] }}
        transition={{ duration: 1.8, delay: 0.6, ease: "linear", repeat: Infinity }}
      />
      <ArrowRight
        className="absolute right-[-12px] top-1/2 size-3.5 -translate-y-1/2 text-info-fg"
        strokeWidth={2.4}
      />
      <Landmark
        className="absolute -bottom-1 right-1/2 size-3 -translate-y-1/2 text-subtle"
        strokeWidth={1.6}
      />
    </div>
  );
}
