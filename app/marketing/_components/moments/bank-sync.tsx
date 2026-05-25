"use client";

import { motion } from "motion/react";
import {
  ArrowRight,
  FileText,
  HelpCircle,
  Landmark,
  Receipt,
  Sparkles,
  Wallet,
} from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { cn } from "@/lib/utils";

import { MarketingAppShell, PulseDot } from "./app-shell";

type Match = {
  desc: string;
  amount: number;
  matchKind: "invoice" | "bill" | "expense" | "unmatched";
  matchTarget: string;
  conf: number;
};

const MATCHES: Match[] = [
  {
    desc: "ACH · LIGHTHOUSE CAFE",
    amount: 4880,
    matchKind: "invoice",
    matchTarget: "INV-2701 + 2 more",
    conf: 0.97,
  },
  {
    desc: "WIRE · ANCHOR TAVERN",
    amount: 1840,
    matchKind: "invoice",
    matchTarget: "INV-2756",
    conf: 0.98,
  },
  {
    desc: "BAY AREA SEAFOOD · ACH",
    amount: -2240,
    matchKind: "bill",
    matchTarget: "BILL-1108",
    conf: 0.93,
  },
  {
    desc: "POS · COSTCO BUSINESS",
    amount: -184.32,
    matchKind: "expense",
    matchTarget: "Supplies",
    conf: 0.81,
  },
  {
    desc: "PG&E · AUTOPAY",
    amount: -612,
    matchKind: "expense",
    matchTarget: "Utilities",
    conf: 0.99,
  },
  {
    desc: "ACH · UNKNOWN MERCHANT",
    amount: -340,
    matchKind: "unmatched",
    matchTarget: "for review",
    conf: 0,
  },
];

const MATCH_TONE: Record<Match["matchKind"], { bg: string; text: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }> = {
  invoice: { bg: "bg-success-bg", text: "text-success-fg", Icon: FileText },
  bill: { bg: "bg-warning-bg", text: "text-warning-fg", Icon: Receipt },
  expense: { bg: "bg-info-bg", text: "text-info-fg", Icon: Wallet },
  unmatched: { bg: "bg-surface", text: "text-subtle", Icon: HelpCircle },
};

export function PlaidMoment() {
  return (
    <MarketingAppShell
      activeNav="banking"
      crumbs={["Banking", "Chase Business · •••• 4421"]}
      label="Plaid · bank sync"
      tone="info"
      rightSlot={
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-subtle">
          <PulseDot tone="warning" />
          Synced 3 min ago · 12 new
        </span>
      }
    >
      <div className="grid h-full grid-cols-[1fr_1.4fr] gap-0">
        {/* LEFT: bank connection */}
        <div className="flex flex-col items-center justify-center border-r border-border-default bg-card-warm/30 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            Linked via Plaid
          </div>
          <div className="mt-4 flex items-center gap-6">
            <BankNode color="#117ACA" letter="C" label="Chase" />
            <Pipe />
            <BankNode letter={<Logomark size={18} />} label="Fluxora" />
          </div>

          <div className="mt-6 w-full rounded-lg border border-border-default bg-card-warm p-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
              Account
            </div>
            <div className="mt-1 font-serif text-[16px] font-medium text-ink">
              Chase Business · Checking
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-subtle">
              •••• 4421 · daily sync
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-border-default pt-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                Balance
              </span>
              <span className="font-serif text-[18px] font-medium text-ink">
                $64,218.42
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT: transactions feed with match status */}
        <aside className="overflow-y-auto p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-info-fg" strokeWidth={2} />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-info-fg">
              Auto-matched · 5 of 6
            </span>
          </div>

          <ul className="mt-3 space-y-2">
            {MATCHES.map((m, idx) => (
              <TxnRow key={m.desc} match={m} delay={0.25 + idx * 0.12} />
            ))}
          </ul>
        </aside>
      </div>
    </MarketingAppShell>
  );
}

function TxnRow({ match, delay }: { match: Match; delay: number }) {
  const { bg, text, Icon } = MATCH_TONE[match.matchKind];
  const isUnmatched = match.matchKind === "unmatched";
  return (
    <motion.li
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-3 rounded-md border border-border-default bg-card-warm px-3 py-2.5"
    >
      <div className="flex-1 min-w-0">
        <div className="truncate text-[12.5px] font-medium text-ink">
          {match.desc}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[9.5px] font-medium",
              bg,
              text,
            )}
          >
            <Icon className="size-2.5" strokeWidth={2.2} />
            {match.matchTarget}
          </span>
          {!isUnmatched ? (
            <>
              <div className="h-1 w-[44px] overflow-hidden rounded-full bg-surface">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${match.conf * 100}%` }}
                  transition={{ duration: 0.5, delay: delay + 0.15 }}
                  className={cn(
                    "h-full",
                    match.conf >= 0.95 ? "bg-success-fg" : "bg-info-fg",
                  )}
                />
              </div>
              <span className="font-mono text-[9.5px] text-ink-warm">
                {Math.round(match.conf * 100)}%
              </span>
            </>
          ) : null}
        </div>
      </div>
      <span
        className={cn(
          "font-mono text-[12.5px] tabular-nums",
          match.amount >= 0 ? "text-success-fg" : "text-ink",
        )}
      >
        {match.amount >= 0 ? "+" : "−"}$
        {Math.abs(match.amount).toLocaleString(undefined, {
          minimumFractionDigits: match.amount % 1 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        })}
      </span>
    </motion.li>
  );
}

function BankNode({
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
        className="flex size-14 items-center justify-center rounded-2xl text-[24px] font-bold text-white shadow-sm"
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
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
        {label}
      </div>
    </div>
  );
}

function Pipe() {
  return (
    <div className="relative h-12 w-[120px]">
      <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-info-fg/30" />
      <motion.div
        className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-info-fg"
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
        className="absolute -bottom-2 right-1/2 size-3 -translate-y-1/2 text-subtle"
        strokeWidth={1.6}
      />
    </div>
  );
}
