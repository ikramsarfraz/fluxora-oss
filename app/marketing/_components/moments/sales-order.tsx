"use client";

import { motion } from "motion/react";
import {
  ArrowRight,
  Boxes,
  Building2,
  ShoppingCart,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { MomentFrame, PulseDot } from "./moment-frame";

// Marketing moment: a single sales-order line being allocated FIFO. One
// focused card — customer + product + lot pull + margin. Larger type and
// generous whitespace so it's legible at marketing density.
export function SalesOrderMoment() {
  return (
    <MomentFrame label="Sales orders" tone="forest">
      <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-[1.1fr_1fr]">
        {/* Customer + product */}
        <div>
          <div className="flex items-center gap-2 rounded-lg border border-border-default bg-surface/40 px-3 py-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-forest-tint">
              <Building2
                className="size-4 text-forest-mid"
                strokeWidth={1.8}
              />
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-medium text-ink">
                Anchor Tavern
              </div>
              <div className="font-mono text-[10.5px] text-subtle">
                Tiburon · ANC
              </div>
            </div>
            <span className="rounded-full bg-forest-mid/10 px-2 py-0.5 font-mono text-[10px] font-medium text-forest-mid">
              Tier 2
            </span>
          </div>

          <div className="mt-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
            <ShoppingCart className="size-3" strokeWidth={2.2} />
            Line 1 · adding
          </div>
          <h3 className="mt-1 font-serif text-[22px] font-medium leading-tight tracking-tight text-ink">
            Atlantic salmon
            <br />
            <span className="text-ink-warm text-[16px]">— 4 lb fillets</span>
          </h3>
          <div className="mt-3 flex items-baseline gap-4 text-[13px]">
            <span className="font-mono text-ink-warm">
              <span className="text-subtle">Qty</span> 32 lb
            </span>
            <span className="font-mono text-ink-warm">
              <span className="text-subtle">@</span> $11.50 / lb
            </span>
            <span className="font-mono font-medium text-ink">
              = $368.00
            </span>
          </div>
        </div>

        {/* FIFO allocation */}
        <div className="rounded-xl border border-forest-tint-deep/40 bg-forest-tint/15 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
              <Sparkles className="size-3" strokeWidth={2.2} />
              FIFO · pulling oldest
            </div>
            <PulseDot />
          </div>

          <div className="mt-3 space-y-2">
            <LotPull
              lotNumber="L-1245"
              age="6 days old"
              pulled={18}
              total={18}
              cost={7.2}
              cleared
              delay={0.2}
            />
            <LotPull
              lotNumber="L-1259"
              age="3 days old"
              pulled={14}
              total={24}
              cost={7.4}
              delay={0.6}
            />
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-forest-tint-deep/40 pt-3 text-[12px]">
            <span className="flex items-center gap-1.5 text-success-fg">
              <TrendingUp className="size-3" strokeWidth={2.2} />
              <span className="font-mono">Margin</span>
            </span>
            <motion.span
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.1, duration: 0.5 }}
              className="font-serif text-[20px] font-medium leading-none text-success-fg"
            >
              43.4%
            </motion.span>
          </div>
        </div>
      </div>
    </MomentFrame>
  );
}

function LotPull({
  lotNumber,
  age,
  pulled,
  total,
  cost,
  cleared,
  delay,
}: {
  lotNumber: string;
  age: string;
  pulled: number;
  total: number;
  cost: number;
  cleared?: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "rounded-lg border bg-card-warm px-3 py-2.5",
        cleared
          ? "border-success-border/60 bg-success-bg/30"
          : "border-border-default",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[11px] font-medium text-ink">
          {lotNumber}
          <span className="text-subtle">·</span>
          <span className="text-subtle">{age}</span>
        </span>
        <span className="font-mono text-[10.5px] text-ink-warm">
          ${cost.toFixed(2)}/lb
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="min-w-[68px] font-mono text-[12px] font-medium text-ink">
          {pulled}
          <span className="text-subtle">/{total} lb</span>
        </span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(pulled / total) * 100}%` }}
            transition={{ duration: 0.7, delay: delay + 0.1 }}
            className={cn(
              "h-full",
              cleared ? "bg-success-fg" : "bg-forest-mid",
            )}
          />
        </div>
        <ArrowRight
          className={cn(
            "size-3",
            cleared ? "text-success-fg" : "text-forest-mid",
          )}
          strokeWidth={2.4}
        />
      </div>
    </motion.div>
  );
}

// Companion moment: just the FIFO lot stack, no order context. Used in the
// inventory section where order context isn't needed.
export function InventoryLotsMoment() {
  return (
    <MomentFrame label="Inventory · FIFO" tone="success">
      <div className="p-6">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
              ATL-SAL-04
            </p>
            <h3 className="mt-1 font-serif text-[22px] font-medium tracking-tight text-ink">
              Atlantic salmon — 4 lb fillets
            </h3>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
              On hand
            </p>
            <p className="font-serif text-[24px] font-medium leading-none text-ink">
              72 <span className="text-[12px] text-subtle">lb</span>
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
          <Boxes className="size-3" strokeWidth={2.2} />
          3 lots · oldest first
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <LotChip
            number="L-1245"
            qty={18}
            expiresIn={2}
            cost={7.2}
            warning
            fifoNext
            delay={0.2}
          />
          <LotChip
            number="L-1259"
            qty={24}
            expiresIn={5}
            cost={7.4}
            delay={0.35}
          />
          <LotChip
            number="L-1271"
            qty={30}
            expiresIn={7}
            cost={7.55}
            delay={0.5}
          />
        </div>
      </div>
    </MomentFrame>
  );
}

function LotChip({
  number,
  qty,
  expiresIn,
  cost,
  warning,
  fifoNext,
  delay,
}: {
  number: string;
  qty: number;
  expiresIn: number;
  cost: number;
  warning?: boolean;
  fifoNext?: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative rounded-lg border bg-card-warm p-3",
        warning
          ? "border-warning-border/70"
          : "border-border-default",
      )}
    >
      {fifoNext ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg"
          animate={{
            boxShadow: [
              "0 0 0 0 rgba(217, 184, 114, 0)",
              "0 0 0 6px rgba(217, 184, 114, 0.4)",
              "0 0 0 0 rgba(217, 184, 114, 0)",
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}

      {fifoNext ? (
        <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-forest-mid px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-card-warm">
          Next out
        </div>
      ) : (
        <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-subtle">
          In queue
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] font-medium text-ink">
          {number}
        </span>
        <span
          className={cn(
            "font-mono text-[10px]",
            warning ? "text-warning-fg font-medium" : "text-success-fg",
          )}
        >
          {expiresIn}d
        </span>
      </div>

      <div className="mt-1 font-serif text-[20px] font-medium leading-none text-ink">
        {qty} <span className="text-[11px] text-subtle">lb</span>
      </div>
      <div className="mt-1 font-mono text-[9.5px] text-subtle">
        ${cost.toFixed(2)}/lb
      </div>
    </motion.div>
  );
}
