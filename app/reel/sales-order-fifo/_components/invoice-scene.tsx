"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  FileText,
  Mail,
  PackageCheck,
  Printer,
  Save,
} from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  CUSTOMER,
  ORDER_DATE,
  ORDER_NUMBER,
  PRODUCTS,
  allocateFifo,
} from "../_data/order";
import { FakeAppShell } from "./fake-app-shell";

// Scene 3: payoff. Save button presses, the order locks, and a printable
// invoice PDF slides up on the right with the tenant's letterhead. Pick
// list lands as a smaller chip below — same data, different doc.

type Stage =
  | "review" // order is built, save button waiting
  | "saving" // save button pressed, animating
  | "generated" // invoice + pick list visible
  | "settled"; // small "ready to ship" caption appears

const STAGE_ORDER: Stage[] = ["review", "saving", "generated", "settled"];
const STAGE_DURATION_MS: Record<Stage, number> = {
  review: 1000,
  saving: 1200,
  generated: 2700,
  settled: 1600,
};

const LINES = PRODUCTS.map((product) => {
  const allocation = allocateFifo(product.lots, product.orderQty);
  return {
    product,
    allocation,
    lineTotal: product.orderQty * product.tierPrice,
  };
});

const SUBTOTAL = LINES.reduce((s, l) => s + l.lineTotal, 0);
const TAX = SUBTOTAL * 0.0875;
const TOTAL = SUBTOTAL + TAX;

export function InvoiceScene() {
  const [stage, setStage] = useState<Stage>("review");

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cumulative = 0;
    for (let i = 0; i < STAGE_ORDER.length - 1; i++) {
      cumulative += STAGE_DURATION_MS[STAGE_ORDER[i]];
      const next = STAGE_ORDER[i + 1];
      timers.push(setTimeout(() => setStage(next), cumulative));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  const showInvoice =
    stage === "generated" || stage === "settled";

  return (
    <motion.div
      key="invoice-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell
        crumbs={["Orders", ORDER_NUMBER]}
        rightSlot={
          <div className="flex items-center gap-2">
            <motion.div
              animate={stage === "saving" ? { scale: [1, 0.94, 1] } : {}}
              transition={{ duration: 0.35 }}
            >
              <Button size="sm" disabled={stage !== "review"}>
                <Save className="size-3.5" />
                {stage === "review" ? "Save order" : "Saved"}
              </Button>
            </motion.div>
            {showInvoice ? (
              <>
                <Button size="sm" variant="outline">
                  <Printer className="size-3.5" />
                  Pick list
                </Button>
                <Button size="sm" variant="outline">
                  <Mail className="size-3.5" />
                  Send invoice
                </Button>
              </>
            ) : null}
          </div>
        }
      >
        <div className="grid h-full grid-cols-[1.05fr_1fr] gap-0">
          {/* Left: order summary */}
          <div className="overflow-y-auto p-6">
            <div className="flex items-baseline justify-between">
              <div>
                <h1 className="font-serif text-[24px] font-medium tracking-tight text-ink">
                  Order {ORDER_NUMBER}
                </h1>
                <p className="mt-0.5 text-[12px] text-subtle">
                  {ORDER_DATE} · {CUSTOMER.name} · {CUSTOMER.tier}
                </p>
              </div>
              <AnimatePresence>
                {stage !== "review" ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 320,
                      damping: 18,
                    }}
                    className="flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1 text-[11px] font-medium text-success-fg"
                  >
                    <Check className="size-3" strokeWidth={2.4} />
                    Posted
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-border-default bg-card-warm">
              <table className="w-full text-[12px]">
                <thead className="bg-surface/60 text-[10px] uppercase tracking-[0.12em] text-subtle">
                  <tr>
                    <Th>Line</Th>
                    <Th align="right">Qty</Th>
                    <Th align="right">Price</Th>
                    <Th align="right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {LINES.map((line) => (
                    <tr
                      key={line.product.sku}
                      className="border-t border-border-default"
                    >
                      <Td>
                        <div className="font-medium text-ink">
                          {line.product.name}
                        </div>
                        <div className="mt-0.5 font-mono text-[10.5px] text-subtle">
                          {line.allocation
                            .map((a) => `${a.lotNumber}·${a.pulled}`)
                            .join(" + ")}
                        </div>
                      </Td>
                      <Td align="right">
                        <span className="font-mono">
                          {line.product.orderQty} {line.product.unit}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="font-mono">
                          ${line.product.tierPrice.toFixed(2)}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="font-mono font-medium text-ink">
                          ${line.lineTotal.toFixed(2)}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border-default bg-surface/40 text-[11.5px]">
                  <TotalRow label="Subtotal" value={SUBTOTAL} />
                  <TotalRow label="Tax (8.75%)" value={TAX} />
                  <TotalRow label="Total" value={TOTAL} bold />
                </tfoot>
              </table>
            </div>

            {/* Pick list chip */}
            <AnimatePresence>
              {showInvoice ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.2 }}
                  className="mt-4 inline-flex items-center gap-2 rounded-md border border-success-border/60 bg-success-bg/30 px-3 py-2 text-[11.5px] text-success-fg"
                >
                  <PackageCheck className="size-3.5" strokeWidth={2} />
                  <span className="font-medium">
                    Pick list generated · 6 lots · 3 SKUs
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Right: invoice PDF preview */}
          <aside className="flex flex-col bg-card-warm/30 p-6">
            <div className="flex items-center gap-2">
              <FileText
                className="size-3.5 text-forest-mid"
                strokeWidth={2}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
                Invoice preview
              </span>
              <span className="ml-auto rounded-full bg-surface px-2 py-0.5 font-mono text-[9.5px] text-ink-warm">
                {ORDER_NUMBER.replace("SO", "INV")}
              </span>
            </div>

            <AnimatePresence>
              {showInvoice ? (
                <motion.div
                  initial={{ opacity: 0, y: 60, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 0.65,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="mt-3 origin-bottom overflow-hidden rounded-md border border-border-default bg-white shadow-[0_22px_50px_-25px_rgba(31,58,46,0.45)]"
                  style={{ aspectRatio: "0.78" }}
                >
                  <InvoicePdfPreview />
                </motion.div>
              ) : (
                <motion.div
                  initial={false}
                  animate={{ opacity: 1 }}
                  className="mt-3 flex flex-1 items-center justify-center rounded-md border border-dashed border-border-default text-[12px] text-subtle"
                >
                  Will appear once the order is saved.
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {stage === "settled" ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 flex items-center justify-center gap-2 text-[11.5px] font-medium text-success-fg"
                >
                  <Check className="size-3.5" strokeWidth={2.4} />
                  Ready to send to {CUSTOMER.name}.
                </motion.div>
              ) : null}
            </AnimatePresence>
          </aside>
        </div>

        {/* Brief saving overlay */}
        <AnimatePresence>
          {stage === "saving" ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-page/40 backdrop-blur-[1px]"
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-full border border-forest-tint-deep/60 bg-card-warm/95 px-4 py-2 shadow-lg"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
                  Saving order…
                </span>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </FakeAppShell>
    </motion.div>
  );
}

function InvoicePdfPreview() {
  return (
    <div className="flex h-full flex-col px-6 py-5 text-[10px] text-[#1A1A14]">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Logomark size={28} />
          <div>
            <div className="font-serif text-[16px] font-medium leading-none text-[#1F3A2E]">
              Pacific Wharf Provisions
            </div>
            <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[#6B6451]">
              312 Tiburon Blvd · Tiburon, CA 94920
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#6B6451]">
            Invoice
          </div>
          <div className="font-mono text-[11px] font-medium text-[#1A1A14]">
            {ORDER_NUMBER.replace("SO", "INV")}
          </div>
          <div className="mt-0.5 font-mono text-[8px] text-[#6B6451]">
            {ORDER_DATE}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[#DDD3B8] pt-3 text-[9px]">
        <div>
          <div className="font-mono uppercase tracking-[0.12em] text-[#6B6451]">
            Bill to
          </div>
          <div className="mt-1 font-medium text-[#1A1A14]">
            {CUSTOMER.name}
          </div>
          <div className="text-[#3A3528]">
            {CUSTOMER.city}, {CUSTOMER.state}
          </div>
          <div className="font-mono text-[8px] text-[#6B6451]">
            Terms: {CUSTOMER.terms}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono uppercase tracking-[0.12em] text-[#6B6451]">
            Order date
          </div>
          <div className="mt-1 text-[#3A3528]">{ORDER_DATE}</div>
          <div className="font-mono uppercase tracking-[0.12em] mt-1.5 text-[#6B6451]">
            Due
          </div>
          <div className="text-[#3A3528]">May 26, 2026</div>
        </div>
      </div>

      <table className="mt-3 w-full border-t border-[#DDD3B8] text-[8.5px]">
        <thead>
          <tr className="text-[#6B6451]">
            <th className="py-1 text-left font-mono uppercase tracking-[0.12em]">
              Item
            </th>
            <th className="py-1 text-right font-mono uppercase tracking-[0.12em]">
              Qty
            </th>
            <th className="py-1 text-right font-mono uppercase tracking-[0.12em]">
              Price
            </th>
            <th className="py-1 text-right font-mono uppercase tracking-[0.12em]">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {LINES.map((line) => (
            <tr key={line.product.sku} className="border-t border-[#EFECD9]">
              <td className="py-1 pr-2">{line.product.name}</td>
              <td className="py-1 text-right font-mono">
                {line.product.orderQty}
              </td>
              <td className="py-1 text-right font-mono">
                ${line.product.tierPrice.toFixed(2)}
              </td>
              <td className="py-1 text-right font-mono">
                ${line.lineTotal.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-auto border-t border-[#DDD3B8] pt-2">
        <div className="flex justify-between text-[#3A3528]">
          <span>Subtotal</span>
          <span className="font-mono">${SUBTOTAL.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[#3A3528]">
          <span>Tax</span>
          <span className="font-mono">${TAX.toFixed(2)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-[#DDD3B8] pt-1 font-medium text-[#1F3A2E]">
          <span>Total due</span>
          <span className="font-mono">${TOTAL.toFixed(2)}</span>
        </div>
      </div>
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
        "px-4 py-3 align-top",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </td>
  );
}

function TotalRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <tr className={cn(bold && "border-t border-border-default")}>
      <td colSpan={3} className="px-4 py-1.5 text-right text-subtle">
        {label}
      </td>
      <td className="px-4 py-1.5 text-right">
        <span
          className={cn(
            "font-mono",
            bold ? "text-[13px] font-medium text-ink" : "",
          )}
        >
          ${value.toFixed(2)}
        </span>
      </td>
    </tr>
  );
}
