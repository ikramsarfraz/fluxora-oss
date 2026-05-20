"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowDown,
  Check,
  FileText,
  Receipt,
  Sparkles,
  Tag,
  UploadCloud,
  Wrench,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { FakeAppShell } from "./fake-app-shell";

// All three Expense scenes in one file to keep file count tight. Each is a
// self-contained client component with its own internal timing.

// =========================================================================
// Scene 1 — Drop the receipt
// =========================================================================
type DropStage = "idle" | "dropping" | "landed";

export function DropScene() {
  const [stage, setStage] = useState<DropStage>("idle");
  useEffect(() => {
    const t1 = setTimeout(() => setStage("dropping"), 800);
    const t2 = setTimeout(() => setStage("landed"), 1800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <motion.div
      key="drop-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell crumbs={["Expenses", "New expense"]}>
        <div className="flex h-full items-center justify-center p-8">
          <div className="w-full max-w-[520px]">
            <h1 className="font-serif text-[22px] font-medium tracking-tight text-ink">
              Drop a receipt
            </h1>
            <p className="mt-1 text-[12.5px] text-subtle">
              We&apos;ll pull vendor, total, and category from the image.
            </p>

            <div
              className={cn(
                "relative mt-5 flex h-[260px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-card-warm",
                stage === "dropping"
                  ? "border-warning-fg bg-warning-bg/30"
                  : stage === "landed"
                    ? "border-success-fg bg-success-bg/30"
                    : "border-border-default",
              )}
            >
              {stage === "idle" ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <UploadCloud
                    className="size-8 text-subtle"
                    strokeWidth={1.6}
                  />
                  <span className="text-[13px] text-ink-warm">
                    Drag &amp; drop or click to upload
                  </span>
                  <span className="font-mono text-[10px] text-subtle">
                    .jpg / .png / .pdf · up to 8 MB
                  </span>
                </div>
              ) : (
                <ReceiptCard stage={stage} />
              )}
            </div>
          </div>
        </div>
      </FakeAppShell>
    </motion.div>
  );
}

function ReceiptCard({ stage }: { stage: DropStage }) {
  const initial =
    stage === "dropping" ? { y: -110, x: -8, rotate: -8, opacity: 0 } : false;
  return (
    <motion.div
      initial={initial}
      animate={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 16 }}
      className="flex w-[180px] flex-col gap-1.5 rounded-md border border-border-default bg-card-warm p-3 shadow-md"
    >
      <div className="flex items-center justify-between border-b border-border-default pb-1.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-subtle">
          Costco Wholesale
        </span>
        <Receipt
          className="size-3 text-warning-fg"
          strokeWidth={2}
        />
      </div>
      <div className="space-y-0.5">
        <ReceiptLine label="Pallet wrap" qty={4} total={48.0} />
        <ReceiptLine label="Insulated bags" qty={2} total={36.4} />
        <ReceiptLine label="Pen pack 12ct" qty={1} total={14.9} />
      </div>
      <div className="mt-1 border-t border-border-default pt-1 text-right font-mono text-[10px] font-medium text-ink">
        Total $184.32
      </div>
      {stage === "landed" ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
          className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-success-fg text-card-warm shadow-md"
        >
          <Check className="size-4" strokeWidth={2.6} />
        </motion.div>
      ) : null}
    </motion.div>
  );
}

function ReceiptLine({
  label,
  qty,
  total,
}: {
  label: string;
  qty: number;
  total: number;
}) {
  return (
    <div className="flex items-center justify-between font-mono text-[9px] text-ink-warm">
      <span>
        {label} × {qty}
      </span>
      <span>${total.toFixed(2)}</span>
    </div>
  );
}

// =========================================================================
// Scene 2 — AI extracts
// =========================================================================
type Field = {
  key: string;
  label: string;
  value: string;
  confidence: number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

const FIELDS: Field[] = [
  { key: "vendor", label: "Vendor", value: "Costco Wholesale", confidence: 0.97, icon: Receipt },
  { key: "amount", label: "Total", value: "$184.32", confidence: 0.99, icon: Zap },
  { key: "category", label: "Category", value: "Supplies", confidence: 0.88, icon: Tag },
  { key: "account", label: "GL account", value: "6420 · Office & ops", confidence: 0.92, icon: Wrench },
  { key: "date", label: "Date", value: "May 18, 2026", confidence: 0.98, icon: FileText },
];

const FIELD_MS = 900;

export function ExtractScene() {
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= FIELDS.length; i++) {
      timers.push(setTimeout(() => setFilled(i), 700 + i * FIELD_MS));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      key="extract-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell crumbs={["Expenses", "New expense", "Review"]}>
        <div className="grid h-full grid-cols-[1.1fr_1.2fr] gap-0">
          {/* Receipt preview */}
          <div className="flex items-center justify-center border-r border-border-default bg-card-warm/30 p-6">
            <ReceiptCard stage="landed" />
          </div>

          {/* Extracted fields */}
          <div className="overflow-y-auto p-6">
            <div className="flex items-center gap-2">
              <Sparkles
                className="size-3.5 text-warning-fg"
                strokeWidth={2}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-warning-fg">
                AI extraction · {Math.min(100, Math.round((filled / FIELDS.length) * 100))}%
              </span>
            </div>
            <h2 className="mt-2 font-serif text-[18px] font-medium text-ink">
              Confirm and post
            </h2>

            <ul className="mt-4 space-y-2">
              {FIELDS.map((field, idx) => {
                const isFilled = idx < filled;
                return (
                  <motion.li
                    key={field.key}
                    animate={
                      isFilled
                        ? { opacity: 1 }
                        : { opacity: 0.3 }
                    }
                    className={cn(
                      "flex items-center gap-3 rounded-md border bg-card-warm px-3 py-2.5",
                      isFilled
                        ? "border-success-border/60"
                        : "border-border-default",
                    )}
                  >
                    <field.icon
                      className="size-3.5 text-subtle"
                      strokeWidth={2}
                    />
                    <div className="flex-1">
                      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-subtle">
                        {field.label}
                      </div>
                      <motion.div
                        initial={false}
                        animate={
                          isFilled
                            ? { opacity: 1, y: 0 }
                            : { opacity: 0, y: 4 }
                        }
                        transition={{ duration: 0.3 }}
                        className="text-[13px] font-medium text-ink"
                      >
                        {field.value}
                      </motion.div>
                    </div>
                    {isFilled ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-1 w-[44px] overflow-hidden rounded-full bg-surface">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${field.confidence * 100}%` }}
                            transition={{ duration: 0.5 }}
                            className={cn(
                              "h-full",
                              field.confidence >= 0.95
                                ? "bg-success-fg"
                                : field.confidence >= 0.85
                                  ? "bg-warning-fg"
                                  : "bg-danger-fg",
                            )}
                          />
                        </div>
                        <span className="font-mono text-[9.5px] text-ink-warm">
                          {Math.round(field.confidence * 100)}%
                        </span>
                      </div>
                    ) : (
                      <span className="font-mono text-[9.5px] text-subtle">
                        reading…
                      </span>
                    )}
                  </motion.li>
                );
              })}
            </ul>

            {filled >= FIELDS.length ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-success-fg px-3 py-2 text-[12px] font-medium text-card-warm"
              >
                <Check className="size-3.5" strokeWidth={2.6} />
                Post to P&amp;L
              </motion.div>
            ) : null}
          </div>
        </div>
      </FakeAppShell>
    </motion.div>
  );
}

// =========================================================================
// Scene 3 — P&L impact
// =========================================================================
type PLCategory = {
  label: string;
  amount: number;
  pct: number;
  highlight?: boolean;
};

const PL_BEFORE: PLCategory[] = [
  { label: "Cost of goods", amount: 52400, pct: 62 },
  { label: "Payroll", amount: 14200, pct: 17 },
  { label: "Rent & utilities", amount: 4800, pct: 6 },
  { label: "Supplies", amount: 1640, pct: 2 },
  { label: "Other", amount: 11000, pct: 13 },
];

const PL_AFTER: PLCategory[] = PL_BEFORE.map((c) =>
  c.label === "Supplies"
    ? { ...c, amount: c.amount + 184.32, pct: c.pct, highlight: true }
    : c,
);

export function PostScene() {
  const [posted, setPosted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPosted(true), 700);
    return () => clearTimeout(t);
  }, []);

  const data = posted ? PL_AFTER : PL_BEFORE;
  const total = data.reduce((s, c) => s + c.amount, 0);

  return (
    <motion.div
      key="post-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell crumbs={["Expenses", "Posted"]}>
        <div className="flex h-full flex-col p-6">
          <header className="flex items-baseline justify-between">
            <div>
              <h1 className="font-serif text-[22px] font-medium tracking-tight text-ink">
                P&amp;L · this month
              </h1>
              <p className="mt-0.5 text-[12px] text-subtle">
                Where the spend lands when this expense hits.
              </p>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={posted ? { opacity: 1, scale: 1 } : { opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="inline-flex items-center gap-2 rounded-full bg-success-bg/60 px-3 py-1.5 text-[11.5px] font-medium text-success-fg"
            >
              <ArrowDown className="size-3 rotate-180" strokeWidth={2.4} />
              +$184.32 · Supplies
            </motion.div>
          </header>

          <div className="mt-6 overflow-hidden rounded-lg border border-border-default bg-card-warm">
            <table className="w-full text-[12.5px]">
              <thead className="bg-surface/60 text-[10px] uppercase tracking-[0.12em] text-subtle">
                <tr>
                  <Th>Category</Th>
                  <Th align="right">Amount</Th>
                  <Th>Share</Th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr
                    key={c.label}
                    className={cn(
                      "border-t border-border-default",
                      c.highlight && "bg-success-bg/30",
                    )}
                  >
                    <Td>
                      <span className="font-medium text-ink">{c.label}</span>
                    </Td>
                    <Td align="right">
                      <motion.span
                        key={c.amount}
                        initial={
                          c.highlight ? { y: 6, opacity: 0 } : false
                        }
                        animate={{ y: 0, opacity: 1 }}
                        className={cn(
                          "font-mono tabular-nums",
                          c.highlight
                            ? "text-success-fg font-medium"
                            : "text-ink",
                        )}
                      >
                        ${c.amount.toLocaleString(undefined, {
                          minimumFractionDigits: c.amount % 1 === 0 ? 0 : 2,
                          maximumFractionDigits: 2,
                        })}
                      </motion.span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-[140px] overflow-hidden rounded-full bg-surface">
                          <div
                            className={cn(
                              "h-full",
                              c.highlight
                                ? "bg-success-fg"
                                : "bg-forest-mid/50",
                            )}
                            style={{ width: `${c.pct}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10.5px] text-subtle">
                          {c.pct}%
                        </span>
                      </div>
                    </Td>
                  </tr>
                ))}
                <tr className="border-t border-border-default bg-surface/40">
                  <Td>
                    <span className="font-medium text-ink">Total</span>
                  </Td>
                  <Td align="right">
                    <span className="font-serif text-[15px] font-medium text-ink tabular-nums">
                      $
                      {total.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </Td>
                  <Td />
                </tr>
              </tbody>
            </table>
          </div>

          {posted ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.4 }}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-success-border/60 bg-success-bg/40 px-3 py-2 text-[11.5px] font-medium text-success-fg"
            >
              <Sparkles className="size-3.5" strokeWidth={2.2} />
              Booked to GL 6420 · audit-trailed · attached PDF
            </motion.div>
          ) : null}
        </div>
      </FakeAppShell>
    </motion.div>
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
  children?: React.ReactNode;
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
