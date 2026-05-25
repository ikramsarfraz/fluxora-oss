"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowDown,
  FileText,
  HelpCircle,
  Receipt,
  Sparkles,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { TRANSACTIONS, type BankTxn } from "../_data/transactions";
import { FakeAppShell } from "./fake-app-shell";

// Scene 3: each transaction gets auto-matched. Status pills land one by one.

const PER_MATCH_MS = 500;

const MATCH_ICON: Record<BankTxn["match"]["kind"], React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  invoice: FileText,
  bill: Receipt,
  expense: Wallet,
  unmatched: HelpCircle,
};

const MATCH_TONE: Record<BankTxn["match"]["kind"], string> = {
  invoice: "text-success-fg bg-success-bg",
  bill: "text-warning-fg bg-warning-bg",
  expense: "text-info-fg bg-info-bg",
  unmatched: "text-subtle bg-surface",
};

export function MatchScene() {
  const [matched, setMatched] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < TRANSACTIONS.length; i++) {
      timers.push(setTimeout(() => setMatched(i + 1), 500 + i * PER_MATCH_MS));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  const matchedCount = TRANSACTIONS.slice(0, matched).filter(
    (t) => t.match.kind !== "unmatched",
  ).length;

  return (
    <motion.div
      key="match-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell crumbs={["Banking", "Auto-match"]}>
        <div className="flex h-full flex-col">
          {/* Top stat strip */}
          <div className="flex items-center justify-between border-b border-border-default bg-card-warm/60 px-6 py-4">
            <div>
              <h1 className="font-serif text-[20px] font-medium tracking-tight text-ink">
                Match transactions
              </h1>
              <p className="mt-0.5 text-[12px] text-subtle">
                Fluxora pairs each transaction with the invoice, bill, or
                expense it belongs to.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <SumStat
                label="Matched"
                value={matchedCount}
                total={TRANSACTIONS.length}
                highlight
              />
              <SumStat
                label="For review"
                value={TRANSACTIONS.slice(0, matched).filter(
                  (t) => t.match.kind === "unmatched",
                ).length}
                total={TRANSACTIONS.length}
              />
            </div>
          </div>

          {/* Transaction table with match pills */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="overflow-hidden rounded-lg border border-border-default bg-card-warm">
              <table className="w-full text-[12.5px]">
                <thead className="bg-surface/60 text-[10px] uppercase tracking-[0.12em] text-subtle">
                  <tr>
                    <Th>Date</Th>
                    <Th>Description</Th>
                    <Th align="right">Amount</Th>
                    <Th align="right">Matched to</Th>
                    <Th align="right">Confidence</Th>
                  </tr>
                </thead>
                <tbody>
                  {TRANSACTIONS.map((tx, idx) => {
                    const isMatched = idx < matched;
                    const justLanded = idx === matched - 1;
                    return (
                      <motion.tr
                        key={tx.id}
                        animate={
                          justLanded
                            ? {
                                backgroundColor: [
                                  "rgba(184, 201, 158, 0)",
                                  "rgba(184, 201, 158, 0.4)",
                                  "rgba(184, 201, 158, 0.1)",
                                ],
                              }
                            : {}
                        }
                        transition={{ duration: 0.7 }}
                        className="border-t border-border-default"
                      >
                        <Td>
                          <span className="font-mono text-[11px] text-subtle">
                            {tx.date}
                          </span>
                        </Td>
                        <Td>
                          <span className="text-ink">{tx.description}</span>
                        </Td>
                        <Td align="right">
                          <span
                            className={cn(
                              "font-mono tabular-nums",
                              tx.amount >= 0
                                ? "text-success-fg"
                                : "text-ink",
                            )}
                          >
                            {tx.amount >= 0 ? "+" : "−"}$
                            {Math.abs(tx.amount).toLocaleString(undefined, {
                              minimumFractionDigits:
                                tx.amount % 1 === 0 ? 0 : 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </Td>
                        <Td align="right">
                          {isMatched ? (
                            <MatchPill match={tx.match} />
                          ) : (
                            <span className="font-mono text-[10px] text-subtle">
                              pending…
                            </span>
                          )}
                        </Td>
                        <Td align="right">
                          {isMatched ? (
                            <ConfidenceBar
                              confidence={tx.match.confidence ?? 0}
                              unmatched={tx.match.kind === "unmatched"}
                            />
                          ) : (
                            <span className="font-mono text-[10px] text-subtle">
                              —
                            </span>
                          )}
                        </Td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </FakeAppShell>
    </motion.div>
  );
}

function MatchPill({ match }: { match: BankTxn["match"] }) {
  const Icon = MATCH_ICON[match.kind];
  const tone = MATCH_TONE[match.kind];

  if (match.kind === "unmatched") {
    return (
      <motion.span
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
        className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] text-subtle"
      >
        <Icon className="size-2.5" strokeWidth={2.2} />
        For review
      </motion.span>
    );
  }

  return (
    <motion.span
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 18 }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
        tone,
      )}
    >
      <Icon className="size-2.5" strokeWidth={2.2} />
      <span>{match.target}</span>
    </motion.span>
  );
}

function ConfidenceBar({
  confidence,
  unmatched,
}: {
  confidence: number;
  unmatched: boolean;
}) {
  if (unmatched) {
    return (
      <span className="font-mono text-[10px] text-subtle">—</span>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="h-1 w-[60px] overflow-hidden rounded-full bg-surface">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${confidence * 100}%` }}
          transition={{ duration: 0.4 }}
          className={cn(
            "h-full",
            confidence >= 0.9
              ? "bg-success-fg"
              : confidence >= 0.75
                ? "bg-info-fg"
                : "bg-warning-fg",
          )}
        />
      </div>
      <span className="font-mono text-[10px] text-ink-warm">
        {Math.round(confidence * 100)}%
      </span>
    </div>
  );
}

function SumStat({
  label,
  value,
  total,
  highlight,
}: {
  label: string;
  value: number;
  total: number;
  highlight?: boolean;
}) {
  return (
    <div className="text-right">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline justify-end gap-1.5">
        <motion.span
          key={value}
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={cn(
            "font-serif text-[20px] font-medium leading-none",
            highlight ? "text-success-fg" : "text-ink",
          )}
        >
          {value}
        </motion.span>
        <span className="font-mono text-[12px] text-subtle">/ {total}</span>
      </div>
      {highlight ? (
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-success-fg">
          <Sparkles className="size-2.5" strokeWidth={2.4} />
          <ArrowDown className="size-2.5 rotate-180" strokeWidth={2.4} />
          auto-applied
        </div>
      ) : null}
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "px-4 py-2 font-medium",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      className={cn(
        "px-4 py-2",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </td>
  );
}
