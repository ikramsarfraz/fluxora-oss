"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowDown, ArrowRight } from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { cn } from "@/lib/utils";

import { BANK, TRANSACTIONS } from "../_data/transactions";
import { FakeAppShell } from "./fake-app-shell";

// Scene 2: transactions stream from the bank into Fluxora. Center-stage
// connection animation, then transactions slide in from the right.

export function SyncScene() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < TRANSACTIONS.length; i++) {
      timers.push(
        setTimeout(() => setVisible((v) => v + 1), 1100 + i * 380),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  const list = TRANSACTIONS.slice(0, visible);

  return (
    <motion.div
      key="sync-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell crumbs={["Banking", BANK.name, "Sync"]}>
        <div className="grid h-full grid-cols-[1.1fr_1.4fr] gap-0">
          {/* Connection visual */}
          <div className="flex flex-col items-center justify-center border-r border-border-default bg-card-warm/30 p-8">
            <div className="flex items-center gap-8">
              <NodeCard color="#117ACA" letter="C" label={BANK.name} />
              <Pipe />
              <NodeCard letter={<Logomark size={20} />} label="Fluxora" />
            </div>

            <div className="mt-8 text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                Syncing
              </div>
              <div className="mt-1 font-serif text-[22px] font-medium text-ink tabular-nums">
                {visible} / {TRANSACTIONS.length}
              </div>
              <div className="mt-3 h-1 w-[200px] overflow-hidden rounded-full bg-surface">
                <motion.div
                  className="h-full bg-info-fg"
                  initial={false}
                  animate={{
                    width: `${(visible / TRANSACTIONS.length) * 100}%`,
                  }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>
              <div className="mt-3 text-[11px] text-subtle">
                Last sync · {visible >= TRANSACTIONS.length ? "just now" : "in progress"}
              </div>
            </div>
          </div>

          {/* Transactions feed */}
          <aside className="flex flex-col overflow-hidden p-6">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                New transactions
              </span>
              <span className="font-mono text-[10px] text-subtle">
                last 3 days
              </span>
            </div>
            <ul className="mt-3 flex-1 space-y-2 overflow-y-auto">
              {list.map((tx) => (
                <motion.li
                  key={tx.id}
                  initial={{ opacity: 0, x: 24, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-md border border-border-default bg-card-warm px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full",
                          tx.amount >= 0
                            ? "bg-success-bg text-success-fg"
                            : "bg-warning-bg/60 text-warning-fg",
                        )}
                      >
                        {tx.amount >= 0 ? (
                          <ArrowDown
                            className="size-3.5 rotate-180"
                            strokeWidth={2.2}
                          />
                        ) : (
                          <ArrowDown className="size-3.5" strokeWidth={2.2} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] font-medium text-ink">
                          {tx.description}
                        </div>
                        <div className="font-mono text-[10px] text-subtle">
                          {tx.date}
                        </div>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "font-mono text-[13px] tabular-nums",
                        tx.amount >= 0
                          ? "text-success-fg"
                          : "text-ink",
                      )}
                    >
                      {tx.amount >= 0 ? "+" : "−"}$
                      {Math.abs(tx.amount).toLocaleString(undefined, {
                        minimumFractionDigits: tx.amount % 1 === 0 ? 0 : 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </motion.li>
              ))}
            </ul>
          </aside>
        </div>
      </FakeAppShell>
    </motion.div>
  );
}

function NodeCard({
  color,
  letter,
  label,
}: {
  color?: string;
  letter: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex size-16 items-center justify-center rounded-2xl text-[28px] font-bold text-white shadow-md"
        style={color ? { backgroundColor: color } : { backgroundColor: "var(--color-card-warm)", border: "1px solid var(--color-border-default)" }}
      >
        {letter}
      </div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle">
        {label}
      </div>
    </div>
  );
}

function Pipe() {
  return (
    <div className="relative h-10 w-[200px]">
      <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-info-fg/30" />
      <motion.div
        className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-info-fg shadow-[0_0_12px_rgba(31,58,46,0.4)]"
        animate={{ left: ["0%", "100%"] }}
        transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
      />
      <motion.div
        className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-info-fg/60"
        animate={{ left: ["0%", "100%"] }}
        transition={{ duration: 1.6, delay: 0.5, ease: "linear", repeat: Infinity }}
      />
      <motion.div
        className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-info-fg/40"
        animate={{ left: ["0%", "100%"] }}
        transition={{ duration: 1.6, delay: 1, ease: "linear", repeat: Infinity }}
      />
      <ArrowRight
        className="absolute right-[-12px] top-1/2 size-4 -translate-y-1/2 text-info-fg"
        strokeWidth={2.4}
      />
    </div>
  );
}
