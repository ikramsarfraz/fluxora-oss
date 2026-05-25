"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, FileText, Loader2, Sparkles } from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { cn } from "@/lib/utils";

import {
  CUSTOMER,
  INVOICE,
  LINES,
  SUBTOTAL,
  TAX,
  TENANT,
  TOTAL,
} from "../_data/invoice";
import { FakeAppShell } from "./fake-app-shell";

// Scene 2: PDF builds in real time. A progress stack on the left ticks
// through "header", "billing", "lines", "totals", "footer"; the PDF preview
// on the right fills in each section as the steps complete.

type BuildStep =
  | "header"
  | "billing"
  | "lines"
  | "totals"
  | "footer"
  | "done";

const STEP_ORDER: BuildStep[] = [
  "header",
  "billing",
  "lines",
  "totals",
  "footer",
  "done",
];

const STEP_LABEL: Record<BuildStep, string> = {
  header: "Composing letterhead",
  billing: "Filling in billing details",
  lines: "Rendering line items",
  totals: "Tallying totals",
  footer: "Stamping footer",
  done: "Finalized",
};

const STEP_MS = 1100;

export function BuildScene() {
  const [completed, setCompleted] = useState<number>(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= STEP_ORDER.length; i++) {
      timers.push(setTimeout(() => setCompleted(i), 600 + i * STEP_MS));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  const has = (step: BuildStep) => completed > STEP_ORDER.indexOf(step);

  return (
    <motion.div
      key="build-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell crumbs={["Invoices", INVOICE.number, "Generate PDF"]}>
        <div className="grid h-full grid-cols-[1fr_1.2fr] gap-0">
          {/* Steps panel */}
          <div className="flex flex-col p-6">
            <header>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                Generating PDF
              </span>
              <h2 className="mt-1 font-serif text-[20px] font-medium text-ink">
                {INVOICE.number} · {CUSTOMER.name}
              </h2>
            </header>

            <div className="mt-6 space-y-2.5">
              {STEP_ORDER.slice(0, -1).map((step, idx) => (
                <StepRow
                  key={step}
                  index={idx + 1}
                  label={STEP_LABEL[step]}
                  state={
                    has(step)
                      ? "done"
                      : completed === idx
                        ? "active"
                        : "pending"
                  }
                />
              ))}
            </div>

            {completed === STEP_ORDER.length ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 inline-flex items-center gap-2 rounded-md border border-success-border/70 bg-success-bg/40 px-3 py-2 text-[11.5px] font-medium text-success-fg"
              >
                <Sparkles className="size-3.5" strokeWidth={2.2} />
                PDF ready · 1 page · 84 KB · signed
              </motion.div>
            ) : null}
          </div>

          {/* PDF preview */}
          <aside className="flex items-start justify-center bg-card-warm/30 p-6">
            <div className="aspect-[0.78] w-full max-w-[440px] overflow-hidden rounded-md border border-border-default bg-white shadow-[0_22px_50px_-25px_rgba(31,58,46,0.45)]">
              <div className="flex h-full flex-col p-6 text-[10px] text-[#1A1A14]">
                {/* Letterhead */}
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={
                    has("header")
                      ? { opacity: 1, y: 0 }
                      : { opacity: 0.1, y: -8 }
                  }
                  transition={{ duration: 0.45 }}
                  className="flex items-start justify-between border-b pb-3"
                  style={{ borderColor: "#DDD3B8" }}
                >
                  <div className="flex items-center gap-2">
                    <Logomark size={28} />
                    <div>
                      <div
                        className="font-serif text-[14px] font-medium leading-none"
                        style={{ color: TENANT.primaryHex }}
                      >
                        {TENANT.name}
                      </div>
                      <div className="mt-1 font-mono text-[7.5px] uppercase tracking-[0.12em] text-[#6B6451]">
                        {TENANT.tagline}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#6B6451]">
                      Invoice
                    </div>
                    <div className="font-mono text-[12px] font-medium">
                      {INVOICE.number}
                    </div>
                    <div className="mt-0.5 font-mono text-[8px] text-[#6B6451]">
                      {INVOICE.issueDate}
                    </div>
                  </div>
                </motion.div>

                {/* Billing */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={
                    has("billing") ? { opacity: 1 } : { opacity: 0.1 }
                  }
                  transition={{ duration: 0.45 }}
                  className="mt-3 grid grid-cols-2 gap-3 text-[8.5px]"
                >
                  <div>
                    <div className="font-mono uppercase tracking-[0.12em] text-[#6B6451]">
                      Bill to
                    </div>
                    <div className="mt-1 font-medium">{CUSTOMER.name}</div>
                    <div>Attn: {CUSTOMER.attn}</div>
                    <div>
                      {CUSTOMER.city}, {CUSTOMER.state} {CUSTOMER.zip}
                    </div>
                    <div className="font-mono text-[7.5px] text-[#6B6451]">
                      Terms: {CUSTOMER.terms}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono uppercase tracking-[0.12em] text-[#6B6451]">
                      PO #
                    </div>
                    <div className="mt-1">{INVOICE.poNumber}</div>
                    <div className="mt-1.5 font-mono uppercase tracking-[0.12em] text-[#6B6451]">
                      Due
                    </div>
                    <div>{INVOICE.dueDate}</div>
                  </div>
                </motion.div>

                {/* Lines */}
                <div className="mt-3 border-t pt-2" style={{ borderColor: "#DDD3B8" }}>
                  <div className="flex justify-between font-mono text-[7px] uppercase tracking-[0.12em] text-[#6B6451]">
                    <span>Item</span>
                    <span className="flex gap-4">
                      <span>Qty</span>
                      <span>Price</span>
                      <span>Total</span>
                    </span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {LINES.map((line, idx) => (
                      <motion.div
                        key={line.description}
                        initial={{ opacity: 0, x: -8 }}
                        animate={
                          has("lines")
                            ? { opacity: 1, x: 0 }
                            : { opacity: 0.1, x: -8 }
                        }
                        transition={{ duration: 0.35, delay: idx * 0.12 }}
                        className="flex justify-between text-[8.5px]"
                      >
                        <span>{line.description}</span>
                        <span className="flex gap-4 font-mono">
                          <span>{line.qty}</span>
                          <span>${line.price.toFixed(2)}</span>
                          <span>${(line.qty * line.price).toFixed(2)}</span>
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={
                    has("totals") ? { opacity: 1 } : { opacity: 0.1 }
                  }
                  transition={{ duration: 0.45 }}
                  className="mt-3 ml-auto w-1/2 space-y-0.5 border-t pt-2 text-[8.5px]"
                  style={{ borderColor: "#DDD3B8" }}
                >
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono">
                      ${SUBTOTAL.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span className="font-mono">${TAX.toFixed(2)}</span>
                  </div>
                  <div
                    className="mt-1 flex justify-between border-t pt-1 font-medium"
                    style={{
                      borderColor: "#DDD3B8",
                      color: TENANT.primaryHex,
                    }}
                  >
                    <span>Total due</span>
                    <span className="font-mono">${TOTAL.toFixed(2)}</span>
                  </div>
                </motion.div>

                {/* Footer */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={
                    has("footer") ? { opacity: 1 } : { opacity: 0.1 }
                  }
                  className="mt-auto border-t pt-2 text-center font-mono text-[6.5px] text-[#6B6451]"
                  style={{ borderColor: "#DDD3B8" }}
                >
                  {TENANT.address1} · {TENANT.address2} · {TENANT.email} ·{" "}
                  {TENANT.phone}
                </motion.div>
              </div>
            </div>
          </aside>
        </div>
      </FakeAppShell>
    </motion.div>
  );
}

function StepRow({
  index,
  label,
  state,
}: {
  index: number;
  label: string;
  state: "pending" | "active" | "done";
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex size-7 items-center justify-center rounded-full",
          state === "done"
            ? "bg-success-bg text-success-fg"
            : state === "active"
              ? "bg-forest-tint text-forest-mid"
              : "bg-surface text-subtle",
        )}
      >
        {state === "done" ? (
          <Check className="size-3.5" strokeWidth={2.4} />
        ) : state === "active" ? (
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2.2} />
        ) : (
          <FileText className="size-3" strokeWidth={1.8} />
        )}
      </div>
      <div className="flex-1">
        <div
          className={cn(
            "text-[12.5px]",
            state === "done"
              ? "text-ink-warm"
              : state === "active"
                ? "font-medium text-ink"
                : "text-subtle",
          )}
        >
          {label}
        </div>
        <div className="font-mono text-[9.5px] text-subtle">
          step {index} of 5
        </div>
      </div>
      {state === "done" ? (
        <span className="font-mono text-[10px] text-success-fg">done</span>
      ) : state === "active" ? (
        <span className="font-mono text-[10px] text-forest-mid">running</span>
      ) : (
        <span className="font-mono text-[10px] text-subtle">queued</span>
      )}
    </div>
  );
}
