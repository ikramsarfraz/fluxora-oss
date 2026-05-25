"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, FileText, Sparkles, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  CUSTOMER,
  OPEN_INVOICES,
  PAYMENT_AMOUNT,
  allocatePayment,
} from "../_data/payment";
import { FakeAppShell } from "./fake-app-shell";

// Scene 2: FIFO allocation. Payment ribbon at top, invoice list down the
// left. Each allocation lands in sequence — invoice gets a green "cleared"
// pill or a partial-applied marker.

const ALLOCATIONS = allocatePayment(PAYMENT_AMOUNT, OPEN_INVOICES);
const PER_STEP_MS = 1600;

export function AllocateScene() {
  // How many of the FIFO allocations have animated so far.
  const [appliedCount, setAppliedCount] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < ALLOCATIONS.length; i++) {
      timers.push(
        setTimeout(() => setAppliedCount(i + 1), 500 + i * PER_STEP_MS),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  const totalApplied = ALLOCATIONS.slice(0, appliedCount).reduce(
    (s, a) => s + a.applied,
    0,
  );
  const remaining = PAYMENT_AMOUNT - totalApplied;

  return (
    <motion.div
      key="allocate-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell crumbs={["Payments", "Apply", CUSTOMER.name]}>
        <div className="flex h-full flex-col">
          {/* Payment ribbon */}
          <div className="flex items-center justify-between border-b border-border-default bg-success-bg/30 px-6 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-full bg-success-fg text-card-warm">
                <Zap className="size-4" strokeWidth={2.2} />
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                  Payment in
                </div>
                <div className="font-serif text-[18px] font-medium text-ink tabular-nums">
                  ${PAYMENT_AMOUNT.toLocaleString()}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                  Applied so far
                </div>
                <motion.div
                  key={totalApplied}
                  initial={{ y: 4, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="font-serif text-[16px] font-medium text-success-fg tabular-nums"
                >
                  ${totalApplied.toLocaleString()}
                </motion.div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                  Remaining
                </div>
                <div className="font-serif text-[16px] font-medium text-ink-warm tabular-nums">
                  ${remaining.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Invoice list */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center gap-2">
              <Sparkles
                className="size-3.5 text-success-fg"
                strokeWidth={2}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-success-fg">
                FIFO · oldest invoice first
              </span>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-border-default bg-card-warm">
              <table className="w-full text-[12.5px]">
                <thead className="bg-surface/60 text-[10px] uppercase tracking-[0.12em] text-subtle">
                  <tr>
                    <Th>Invoice</Th>
                    <Th>Issued</Th>
                    <Th align="right">Age</Th>
                    <Th align="right">Amount</Th>
                    <Th align="right">Applied</Th>
                    <Th align="right">Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {OPEN_INVOICES.map((inv, idx) => {
                    const alloc =
                      idx < appliedCount ? ALLOCATIONS[idx] : null;
                    const isActive =
                      idx === appliedCount - 1 && alloc != null;
                    return (
                      <motion.tr
                        key={inv.number}
                        animate={
                          isActive
                            ? {
                                backgroundColor: [
                                  "rgba(184, 201, 158, 0.0)",
                                  "rgba(184, 201, 158, 0.45)",
                                  "rgba(184, 201, 158, 0.18)",
                                ],
                              }
                            : {}
                        }
                        transition={{ duration: 0.9 }}
                        className={cn(
                          "border-t border-border-default",
                          alloc?.cleared && "bg-success-bg/15",
                        )}
                      >
                        <Td>
                          <span className="flex items-center gap-2">
                            <FileText
                              className="size-3.5 text-subtle"
                              strokeWidth={1.8}
                            />
                            <span className="font-mono text-[11.5px] font-medium text-ink">
                              {inv.number}
                            </span>
                          </span>
                        </Td>
                        <Td>
                          <span className="font-mono text-[11px] text-subtle">
                            {inv.issueDate}
                          </span>
                        </Td>
                        <Td align="right">
                          <span
                            className={cn(
                              "font-mono text-[11px]",
                              inv.ageDays >= 60
                                ? "text-danger-fg"
                                : inv.ageDays >= 30
                                  ? "text-warning-fg"
                                  : "text-ink-warm",
                            )}
                          >
                            {inv.ageDays}d
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono tabular-nums">
                            ${inv.amount.toLocaleString()}
                          </span>
                        </Td>
                        <Td align="right">
                          <span
                            className={cn(
                              "font-mono tabular-nums font-medium",
                              alloc ? "text-success-fg" : "text-subtle",
                            )}
                          >
                            {alloc
                              ? `$${alloc.applied.toLocaleString()}`
                              : "—"}
                          </span>
                        </Td>
                        <Td align="right">
                          {alloc?.cleared ? (
                            <ClearedBadge />
                          ) : alloc ? (
                            <PartialBadge
                              applied={alloc.applied}
                              amount={inv.amount}
                            />
                          ) : (
                            <span className="font-mono text-[10px] text-subtle">
                              open
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

function ClearedBadge() {
  return (
    <motion.span
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 18 }}
      className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-medium text-success-fg"
    >
      <Check className="size-2.5" strokeWidth={2.4} />
      Cleared
    </motion.span>
  );
}

function PartialBadge({
  applied,
  amount,
}: {
  applied: number;
  amount: number;
}) {
  const pct = Math.round((applied / amount) * 100);
  return (
    <motion.span
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="inline-flex items-center gap-1 rounded-full bg-warning-bg/70 px-2 py-0.5 font-mono text-[10px] text-warning-fg"
    >
      partial · {pct}%
    </motion.span>
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
