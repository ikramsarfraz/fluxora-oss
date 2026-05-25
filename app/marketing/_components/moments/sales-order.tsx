"use client";

import { motion } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  Boxes,
  Building2,
  CalendarClock,
  Layers,
  Plus,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { MarketingAppShell, PulseDot } from "./app-shell";

// =========================================================================
// SalesOrderMoment — full Orders page with FIFO panel
// =========================================================================
export function SalesOrderMoment() {
  return (
    <MarketingAppShell
      activeNav="orders"
      crumbs={["Orders", "New order", "SO-2847"]}
      label="Sales orders · FIFO"
      tone="forest"
      rightSlot={
        <>
          <Chip>
            <Layers className="size-3" strokeWidth={2} />
            3 lines · $2,288.00
          </Chip>
          <Chip tone="success">
            <TrendingUp className="size-3" strokeWidth={2} />
            42.7% margin
          </Chip>
        </>
      }
    >
      <div className="grid h-full grid-cols-[1.5fr_1fr] gap-0">
        {/* LEFT: order body */}
        <div className="border-r border-border-default p-5">
          {/* Customer chip row */}
          <div className="flex items-center gap-3 rounded-lg border border-border-default bg-card-warm px-3 py-2.5">
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
                ANC · Tiburon, CA
              </div>
            </div>
            <span className="rounded-full bg-forest-tint/60 px-2 py-0.5 font-mono text-[10px] font-medium text-forest-mid">
              Tier 2
            </span>
            <span className="rounded-full bg-info-bg/60 px-2 py-0.5 font-mono text-[10px] font-medium text-info-fg">
              Net 7
            </span>
          </div>

          {/* Line items table */}
          <div className="mt-4 overflow-hidden rounded-lg border border-border-default bg-card-warm">
            <table className="w-full text-[12.5px]">
              <thead className="bg-surface/60 text-[10px] uppercase tracking-[0.12em] text-subtle">
                <tr>
                  <Th>Product</Th>
                  <Th align="right">Qty</Th>
                  <Th align="right">Price</Th>
                  <Th align="right">Line</Th>
                </tr>
              </thead>
              <tbody>
                <LineRow
                  product="Wagyu ribeye · 8 oz"
                  lots="L-1198·6 + L-1233·8"
                  qty="14 ea"
                  price="$32.00"
                  total="$448.00"
                  delay={0.05}
                />
                <LineRow
                  product="Heirloom tomatoes · case"
                  lots="L-1252·5 + L-1266·3"
                  qty="8 case"
                  price="$38.00"
                  total="$304.00"
                  delay={0.18}
                />
                {/* Active row — the one being added (focal animation) */}
                <LineRow
                  product="Atlantic salmon · 4 lb fillets"
                  lots="allocating…"
                  qty="32 lb"
                  price="$11.50"
                  total="$368.00"
                  active
                  delay={0.32}
                />
              </tbody>
            </table>
          </div>

          {/* Add-line affordance */}
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-border-default px-2.5 py-1.5 text-[11.5px] text-subtle">
            <Plus className="size-3" strokeWidth={2} />
            Add line
          </div>
        </div>

        {/* RIGHT: FIFO panel — the focal animation */}
        <aside className="overflow-y-auto bg-card-warm/30 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-forest-mid" strokeWidth={2} />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
              FIFO · oldest first
            </span>
            <span className="ml-auto"><PulseDot /></span>
          </div>

          <h3 className="mt-3 font-serif text-[15px] font-medium leading-tight text-ink">
            Atlantic salmon — 4 lb fillets
          </h3>
          <p className="mt-0.5 font-mono text-[11px] text-subtle">
            Need: 32 lb · pulling from 2 lots
          </p>

          <div className="mt-4 space-y-2">
            <LotCard
              number="L-1245"
              age="6 days old"
              cost={7.2}
              pulled={18}
              total={18}
              cleared
              delay={0.4}
            />
            <LotCard
              number="L-1259"
              age="3 days old"
              cost={7.4}
              pulled={14}
              total={24}
              delay={0.9}
            />
          </div>

          {/* Allocation summary */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.5 }}
            className="mt-4 rounded-lg border border-success-border/60 bg-success-bg/40 p-3 text-[11.5px]"
          >
            <div className="flex items-center justify-between text-success-fg">
              <span className="font-medium">Allocated</span>
              <span className="font-mono">32 lb · 2 lots</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-ink-warm">
              <span>Avg cost</span>
              <span className="font-mono">$7.29 / lb</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between text-ink-warm">
              <span>Tier price</span>
              <span className="font-mono">$11.50 / lb</span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-success-border/40 pt-1.5 font-medium text-success-fg">
              <span>Margin</span>
              <span className="font-mono">43.4%</span>
            </div>
          </motion.div>
        </aside>
      </div>
    </MarketingAppShell>
  );
}

function LineRow({
  product,
  lots,
  qty,
  price,
  total,
  active,
  delay,
}: {
  product: string;
  lots: string;
  qty: string;
  price: string;
  total: string;
  active?: boolean;
  delay: number;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "border-t border-border-default",
        active && "bg-forest-tint/20",
      )}
    >
      <Td>
        <div className="font-medium text-ink">{product}</div>
        <div
          className={cn(
            "mt-0.5 flex items-center gap-1.5 font-mono text-[10.5px]",
            active ? "text-forest-mid" : "text-subtle",
          )}
        >
          <Layers className="size-3" strokeWidth={1.6} />
          {lots}
        </div>
      </Td>
      <Td align="right">
        <span className="font-mono">{qty}</span>
      </Td>
      <Td align="right">
        <span className="font-mono">{price}</span>
      </Td>
      <Td align="right">
        <span className={cn("font-mono font-medium", active ? "text-forest-mid" : "text-ink")}>
          {total}
        </span>
      </Td>
    </motion.tr>
  );
}

function LotCard({
  number,
  age,
  cost,
  pulled,
  total,
  cleared,
  delay,
}: {
  number: string;
  age: string;
  cost: number;
  pulled: number;
  total: number;
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
          : "border-forest-mid/40 ring-2 ring-forest-mid/15",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[11px] font-medium text-ink">
          {number}
          <span className="text-subtle">·</span>
          <span className="text-subtle">{age}</span>
        </span>
        <span className="font-mono text-[10.5px] text-ink-warm">
          ${cost.toFixed(2)}/lb
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="min-w-[64px] font-mono text-[12px] font-medium text-ink">
          {pulled}
          <span className="text-subtle">/{total} lb</span>
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(pulled / total) * 100}%` }}
            transition={{ duration: 0.7, delay: delay + 0.1 }}
            className={cn("h-full", cleared ? "bg-success-fg" : "bg-forest-mid")}
          />
        </div>
      </div>
      {cleared ? (
        <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-success-fg">
          <span className="font-mono">Fully pulled</span>
          <span className="font-mono">$129.60 cost</span>
        </div>
      ) : (
        <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-forest-mid">
          <span className="font-mono">Pulling 14 of 24</span>
          <span className="font-mono">$103.60 cost</span>
        </div>
      )}
    </motion.div>
  );
}

// =========================================================================
// InventoryLotsMoment — full Inventory page with lot timeline + ledger
// =========================================================================
export function InventoryLotsMoment() {
  return (
    <MarketingAppShell
      activeNav="inventory"
      crumbs={["Inventory", "Atlantic salmon — 4 lb fillets"]}
      label="Inventory · lots"
      tone="success"
      rightSlot={
        <>
          <Chip>
            <Boxes className="size-3" strokeWidth={2} />
            72 lb · 3 lots
          </Chip>
          <Chip tone="warning">
            <CalendarClock className="size-3" strokeWidth={2} />
            1 lot expiring
          </Chip>
        </>
      }
    >
      <div className="grid h-full grid-cols-[1.5fr_1fr] gap-0">
        {/* LEFT: product header + sparkline + lot timeline */}
        <div className="border-r border-border-default p-5">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                ATL-SAL-04
              </p>
              <h2 className="mt-1 font-serif text-[20px] font-medium tracking-tight text-ink">
                Atlantic salmon — 4 lb fillets
              </h2>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                Avg cost
              </div>
              <div className="font-serif text-[18px] font-medium leading-none text-success-fg">
                $7.38/lb
              </div>
            </div>
          </div>

          {/* Sparkline */}
          <div className="mt-4 rounded-lg border border-border-default bg-card-warm p-3">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                On hand · 14 days
              </span>
              <span className="font-mono text-[10px] text-subtle">
                peak 80 · low 28 lb
              </span>
            </div>
            <SparkLine />
          </div>

          {/* Lot timeline */}
          <div className="mt-4 flex items-center gap-2">
            <Layers className="size-3.5 text-forest-mid" strokeWidth={2} />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
              Lot timeline · oldest first
            </span>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2.5">
            <InventoryLot
              num="L-1245"
              qty={18}
              expires={2}
              cost={7.2}
              warning
              fifoNext
              delay={0.2}
            />
            <InventoryLot
              num="L-1259"
              qty={24}
              expires={5}
              cost={7.4}
              delay={0.35}
            />
            <InventoryLot
              num="L-1271"
              qty={30}
              expires={7}
              cost={7.55}
              delay={0.5}
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="mt-3 flex items-start gap-2.5 rounded-lg border border-warning-border/60 bg-warning-bg/40 px-3 py-2"
          >
            <CalendarClock
              className="mt-0.5 size-3.5 shrink-0 text-warning-fg"
              strokeWidth={2}
            />
            <p className="text-[12px] leading-[1.5] text-warning-fg">
              <strong className="font-semibold">L-1245 expires in 2 days.</strong>{" "}
              FIFO will pull next. Pre-offer to Anchor Tavern at tier price?
            </p>
          </motion.div>
        </div>

        {/* RIGHT: movement ledger */}
        <aside className="overflow-y-auto bg-card-warm/30 p-5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
              Movement ledger
            </span>
            <span className="ml-auto rounded-full bg-surface px-2 py-0.5 font-mono text-[9.5px] text-subtle">
              7d
            </span>
          </div>

          <ul className="mt-3 space-y-2">
            <Move kind="in" qty={30} reference="PO-4421" lot="L-1271" when="1d ago" delay={0.25} />
            <Move kind="out" qty={-8} reference="SO-2845" lot="L-1245" when="1d ago" delay={0.35} />
            <Move kind="in" qty={30} reference="PO-4408" lot="L-1259" when="3d ago" delay={0.45} />
            <Move kind="out" qty={-6} reference="SO-2841" lot="L-1259" when="3d ago" delay={0.55} />
            <Move kind="out" qty={-14} reference="SO-2839" lot="L-1245" when="4d ago" delay={0.65} />
            <Move kind="in" qty={30} reference="PO-4392" lot="L-1245" when="6d ago" delay={0.75} />
          </ul>
        </aside>
      </div>
    </MarketingAppShell>
  );
}

function InventoryLot({
  num,
  qty,
  expires,
  cost,
  warning,
  fifoNext,
  delay,
}: {
  num: string;
  qty: number;
  expires: number;
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
        "relative rounded-lg border bg-card-warm p-2.5",
        warning ? "border-warning-border/70" : "border-border-default",
      )}
    >
      {fifoNext ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg"
          animate={{
            boxShadow: [
              "0 0 0 0 rgba(217, 184, 114, 0)",
              "0 0 0 5px rgba(217, 184, 114, 0.4)",
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
        <span className="font-mono text-[10.5px] font-medium text-ink">
          {num}
        </span>
        <span
          className={cn(
            "font-mono text-[10px]",
            warning ? "font-medium text-warning-fg" : "text-success-fg",
          )}
        >
          {expires}d
        </span>
      </div>
      <div className="mt-1 font-serif text-[18px] font-medium leading-none text-ink">
        {qty} <span className="text-[10.5px] text-subtle">lb</span>
      </div>
      <div className="mt-0.5 font-mono text-[9.5px] text-subtle">
        ${cost.toFixed(2)}/lb
      </div>
    </motion.div>
  );
}

function Move({
  kind,
  qty,
  reference,
  lot,
  when,
  delay,
}: {
  kind: "in" | "out";
  qty: number;
  reference: string;
  lot: string;
  when: string;
  delay: number;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay }}
      className="flex items-center gap-2.5 border-b border-border-default pb-2 last:border-b-0 last:pb-0"
    >
      <div
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          kind === "in"
            ? "bg-success-bg text-success-fg"
            : "bg-info-bg text-info-fg",
        )}
      >
        {kind === "in" ? (
          <ArrowUp className="size-3" strokeWidth={2.4} />
        ) : (
          <ArrowDown className="size-3" strokeWidth={2.4} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 text-[12px]">
          <span
            className={cn(
              "font-mono font-medium",
              kind === "in" ? "text-success-fg" : "text-ink",
            )}
          >
            {qty > 0 ? "+" : ""}
            {qty} lb
          </span>
          <span className="font-mono text-[10.5px] text-ink-warm">{lot}</span>
        </div>
        <div className="font-mono text-[9.5px] text-subtle">
          {reference} · {when}
        </div>
      </div>
    </motion.li>
  );
}

function SparkLine() {
  const values = [44, 46, 38, 32, 30, 28, 58, 50, 44, 38, 64, 80, 74, 72];
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 480;
  const h = 60;
  const padX = 4;
  const padY = 6;
  const points = values.map((v, i) => ({
    x: padX + (i / (values.length - 1)) * (w - padX * 2),
    y: padY + (1 - (v - min) / range) * (h - padY * 2),
  }));
  const path = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");
  const area = `${path} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-12 w-full">
      <defs>
        <linearGradient id="inv-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-forest-mid)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--color-forest-mid)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill="url(#inv-spark-fill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      />
      <motion.path
        d={path}
        fill="none"
        stroke="var(--color-forest-mid)"
        strokeWidth="1.8"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={3}
        fill="var(--color-forest-mid)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay: 1.2 }}
      />
    </svg>
  );
}

// ---------- shared atoms ----------

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "success" | "warning";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium",
        tone === "success"
          ? "border-success-border/60 bg-success-bg/50 text-success-fg"
          : tone === "warning"
            ? "border-warning-border/60 bg-warning-bg/50 text-warning-fg"
            : "border-border-default bg-card-warm text-ink-warm",
      )}
    >
      {children}
    </span>
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
        "px-3 py-2 font-medium",
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
        "px-3 py-2.5",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </td>
  );
}
