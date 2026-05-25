"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  CalendarClock,
  Layers,
  Plus,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";

import {
  CUSTOMER,
  PRODUCTS,
  type Product,
  allocateFifo,
  avgCost,
} from "../_data/order";
import { FakeAppShell } from "./fake-app-shell";

// Scene 2: the FIFO centerpiece. Three products are added in sequence and
// the right-hand visualizer shows the lot stack getting drained oldest-first.
//
// Internal state machine, one tick per phase:
//   for each product i in 0..2:
//     enterProduct → showLots → pullLot(0) → pullLot(1) → [pullLot(2)] → settle
// All phases live in one numbered cursor; effect schedules timers from there.

type LineItem = {
  product: Product;
  allocation: { lotNumber: string; pulled: number; cost: number }[];
  lineTotal: number;
  margin: number;
};

const PER_PRODUCT_MS = 4500;
const PHASE_BREAKDOWN = {
  introduce: 300,
  showLots: 600,
  pullFirstLot: 1000,
  pullSecondLot: 1100,
  settle: 1500,
} as const;

function computeLineItem(product: Product): LineItem {
  const allocation = allocateFifo(product.lots, product.orderQty);
  const totalCost = allocation.reduce((s, a) => s + a.pulled * a.cost, 0);
  const lineTotal = product.orderQty * product.tierPrice;
  const margin = lineTotal === 0 ? 0 : (lineTotal - totalCost) / lineTotal;
  return { product, allocation, lineTotal, margin };
}

export function FifoScene() {
  // The current product being "added". -1 = nothing yet.
  const [currentIdx, setCurrentIdx] = useState(-1);
  // Within the current product: how many of its allocations have visibly
  // "pulled" so far.
  const [pulledCount, setPulledCount] = useState(0);
  // Lines that have already landed in the order table.
  const [committed, setCommitted] = useState<LineItem[]>([]);

  const committedTotals = useMemo(() => {
    const subtotal = committed.reduce((s, l) => s + l.lineTotal, 0);
    const cost = committed.reduce(
      (s, l) =>
        s + l.allocation.reduce((c, a) => c + a.pulled * a.cost, 0),
      0,
    );
    const margin = subtotal === 0 ? 0 : (subtotal - cost) / subtotal;
    return { subtotal, margin };
  }, [committed]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cumulative = 200;

    for (let i = 0; i < PRODUCTS.length; i++) {
      const line = computeLineItem(PRODUCTS[i]);
      const allocCount = line.allocation.length;

      // Enter this product
      timers.push(
        setTimeout(() => {
          setCurrentIdx(i);
          setPulledCount(0);
        }, cumulative + PHASE_BREAKDOWN.introduce),
      );

      // Show lots (no-op visual delay)
      const showLotsAt =
        cumulative + PHASE_BREAKDOWN.introduce + PHASE_BREAKDOWN.showLots;

      // Pull each allocation one at a time
      for (let p = 0; p < allocCount; p++) {
        const at =
          showLotsAt +
          (p === 0
            ? PHASE_BREAKDOWN.pullFirstLot
            : PHASE_BREAKDOWN.pullFirstLot +
              p * PHASE_BREAKDOWN.pullSecondLot);
        timers.push(
          setTimeout(() => {
            setPulledCount(p + 1);
          }, at),
        );
      }

      // Commit the line to the table
      const commitAt = cumulative + PER_PRODUCT_MS - 300;
      timers.push(
        setTimeout(() => {
          setCommitted((prev) => [...prev, line]);
        }, commitAt),
      );

      cumulative += PER_PRODUCT_MS;
    }

    return () => timers.forEach(clearTimeout);
  }, []);

  const currentProduct =
    currentIdx >= 0 ? PRODUCTS[currentIdx] : null;
  const currentLine = currentProduct
    ? computeLineItem(currentProduct)
    : null;

  return (
    <motion.div
      key="fifo-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell
        crumbs={["Orders", "New order", "SO-2847"]}
        rightSlot={
          <RunningTotals
            subtotal={committedTotals.subtotal}
            margin={committedTotals.margin}
            lineCount={committed.length}
          />
        }
      >
        <div className="grid h-full grid-cols-[1.4fr_1fr] gap-0">
          {/* Line items column */}
          <div className="overflow-hidden border-r border-border-default p-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-forest-tint px-2 py-0.5 font-mono text-[10px] text-forest-mid">
                {CUSTOMER.abbreviation}
              </span>
              <h2 className="font-serif text-[18px] font-medium text-ink">
                {CUSTOMER.name}
              </h2>
              <span className="text-subtle">·</span>
              <span className="text-[11.5px] text-subtle">
                {CUSTOMER.tier} · {CUSTOMER.terms}
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border border-border-default bg-card-warm">
              <table className="w-full text-[12px]">
                <thead className="bg-surface/60 text-[10px] uppercase tracking-[0.12em] text-subtle">
                  <tr>
                    <Th>Product</Th>
                    <Th align="right">Qty</Th>
                    <Th align="right">Price</Th>
                    <Th align="right">Line</Th>
                    <Th align="right">Margin</Th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {committed.map((line) => (
                      <motion.tr
                        key={line.product.sku}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.35,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="border-t border-border-default"
                      >
                        <Td>
                          <div className="font-medium text-ink">
                            {line.product.name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10.5px] text-subtle">
                            <Layers className="size-3" strokeWidth={1.6} />
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
                        <Td align="right">
                          <span
                            className={cn(
                              "font-mono text-[11px]",
                              line.margin >= 0.4
                                ? "text-success-fg"
                                : "text-ink-warm",
                            )}
                          >
                            {(line.margin * 100).toFixed(1)}%
                          </span>
                        </Td>
                      </motion.tr>
                    ))}

                    {/* In-progress row for the currently-pulling product */}
                    {currentProduct &&
                    !committed.some(
                      (l) => l.product.sku === currentProduct.sku,
                    ) ? (
                      <motion.tr
                        key={`pending-${currentProduct.sku}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-t border-border-default bg-forest-tint/20"
                      >
                        <Td>
                          <div className="font-medium text-ink">
                            {currentProduct.name}
                          </div>
                          <div className="mt-0.5 font-mono text-[10.5px] text-forest-mid">
                            allocating…
                          </div>
                        </Td>
                        <Td align="right">
                          <span className="font-mono">
                            {currentProduct.orderQty} {currentProduct.unit}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono">
                            ${currentProduct.tierPrice.toFixed(2)}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-subtle">—</span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-subtle">—</span>
                        </Td>
                      </motion.tr>
                    ) : null}

                    {/* Placeholder when nothing has been added yet */}
                    {committed.length === 0 && !currentProduct ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-8 text-center text-[12px] text-subtle"
                        >
                          Add the first line to get started.
                        </td>
                      </tr>
                    ) : null}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Add-line affordance */}
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-border-default px-2.5 py-1.5 text-[11.5px] text-subtle">
              <Plus className="size-3" strokeWidth={2} />
              Add line
            </div>
          </div>

          {/* FIFO visualizer column */}
          <aside className="overflow-y-auto bg-card-warm/30 p-6">
            <div className="flex items-center gap-2">
              <Sparkles
                className="size-3.5 text-forest-mid"
                strokeWidth={2}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
                FIFO allocation
              </span>
            </div>

            <AnimatePresence mode="wait">
              {currentLine && currentProduct ? (
                <motion.div
                  key={currentProduct.sku}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{
                    duration: 0.4,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="mt-3"
                >
                  <h3 className="font-serif text-[15px] font-medium leading-tight text-ink">
                    {currentProduct.name}
                  </h3>
                  <p className="mt-0.5 font-mono text-[11px] text-subtle">
                    Need: {currentProduct.orderQty} {currentProduct.unit}
                  </p>

                  <div className="mt-4 flex flex-col gap-2">
                    {currentProduct.lots.map((lot, lotIdx) => {
                      const alloc = currentLine.allocation.find(
                        (a) => a.lotNumber === lot.number,
                      );
                      const isPulled =
                        alloc !== undefined &&
                        lotIdx <
                          currentLine.allocation.findIndex(
                            (a) =>
                              a.lotNumber ===
                              currentLine.allocation[pulledCount - 1]
                                ?.lotNumber,
                          ) +
                            1 &&
                        pulledCount > 0;
                      const isActive =
                        alloc !== undefined &&
                        pulledCount > 0 &&
                        currentLine.allocation[pulledCount - 1]
                          ?.lotNumber === lot.number;
                      const drained =
                        isPulled &&
                        alloc !== undefined &&
                        alloc.pulled === lot.qtyRemaining;
                      const remainingAfter = isPulled
                        ? lot.qtyRemaining - (alloc?.pulled ?? 0)
                        : lot.qtyRemaining;
                      const remainingPct =
                        lot.qtyRemaining === 0
                          ? 0
                          : (remainingAfter / lot.qtyRemaining) * 100;

                      return (
                        <LotCard
                          key={lot.number}
                          lotNumber={lot.number}
                          receivedDaysAgo={lot.receivedDaysAgo}
                          qtyRemaining={lot.qtyRemaining}
                          qtyAfter={remainingAfter}
                          remainingPct={remainingPct}
                          cost={lot.cost}
                          unit={currentProduct.unit}
                          pulled={alloc?.pulled}
                          drained={drained}
                          active={isActive}
                          touched={isPulled}
                        />
                      );
                    })}
                  </div>

                  {/* Allocation summary, appears once everything's pulled */}
                  {pulledCount >= currentLine.allocation.length ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 rounded-lg border border-success-border/70 bg-success-bg/40 p-3 text-[11.5px]"
                    >
                      <div className="flex items-center justify-between text-success-fg">
                        <span className="font-medium">Allocated</span>
                        <span className="font-mono">
                          {currentProduct.orderQty} {currentProduct.unit}{" "}
                          from {currentLine.allocation.length} lot
                          {currentLine.allocation.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-ink-warm">
                        <span>Avg cost</span>
                        <span className="font-mono">
                          ${avgCost(currentLine.allocation).toFixed(2)} /{" "}
                          {currentProduct.unit}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-ink-warm">
                        <span>Tier price</span>
                        <span className="font-mono">
                          ${currentProduct.tierPrice.toFixed(2)} /{" "}
                          {currentProduct.unit}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between border-t border-success-border/40 pt-1.5 font-medium text-success-fg">
                        <span>Margin</span>
                        <span className="font-mono">
                          {(currentLine.margin * 100).toFixed(1)}%
                        </span>
                      </div>
                    </motion.div>
                  ) : null}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-6 rounded-lg border border-dashed border-border-default p-6 text-center"
                >
                  <Layers
                    className="mx-auto size-7 text-subtle"
                    strokeWidth={1.4}
                  />
                  <p className="mt-2 text-[12px] text-subtle">
                    Add a line to see lot allocation.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </aside>
        </div>
      </FakeAppShell>
    </motion.div>
  );
}

function LotCard({
  lotNumber,
  receivedDaysAgo,
  qtyRemaining,
  qtyAfter,
  remainingPct,
  cost,
  unit,
  pulled,
  drained,
  active,
  touched,
}: {
  lotNumber: string;
  receivedDaysAgo: number;
  qtyRemaining: number;
  qtyAfter: number;
  remainingPct: number;
  cost: number;
  unit: string;
  pulled?: number;
  drained?: boolean;
  active?: boolean;
  touched?: boolean;
}) {
  return (
    <motion.div
      layout
      animate={drained ? { opacity: 0.55, scale: 0.985 } : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden rounded-md border bg-card-warm px-3 py-2.5",
        active
          ? "border-forest-mid ring-2 ring-forest-mid/30"
          : touched
            ? "border-success-border/80 bg-success-bg/30"
            : "border-border-default",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-medium text-ink">
            {lotNumber}
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px] text-subtle">
            <CalendarClock className="size-3" strokeWidth={1.8} />
            {receivedDaysAgo}d ago
          </span>
        </div>
        <span className="font-mono text-[10.5px] text-ink-warm">
          ${cost.toFixed(2)}/{unit}
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <span className="min-w-[64px] font-mono text-[11px] text-ink">
          {qtyAfter} / {qtyRemaining} {unit}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
          <motion.div
            className={cn(
              "h-full",
              touched ? "bg-success-fg/70" : "bg-forest-mid",
            )}
            initial={false}
            animate={{ width: `${remainingPct}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      {/* Pulled callout */}
      <AnimatePresence>
        {active && pulled !== undefined ? (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="mt-1.5 flex items-center gap-1.5 text-[10.5px] font-medium text-forest-mid"
          >
            <ArrowRight className="size-3" strokeWidth={2.2} />
            Pulling {pulled} {unit}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* "Drained" tag */}
      {drained ? (
        <span className="absolute top-2 right-2 rounded-full bg-success-bg px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-success-fg">
          Drained
        </span>
      ) : null}
    </motion.div>
  );
}

function RunningTotals({
  subtotal,
  margin,
  lineCount,
}: {
  subtotal: number;
  margin: number;
  lineCount: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <Chip
        label={`${lineCount} line${lineCount === 1 ? "" : "s"}`}
        value={`$${subtotal.toFixed(2)}`}
      />
      <Chip
        label="margin"
        value={`${(margin * 100).toFixed(1)}%`}
        tone="success"
        icon={TrendingUp}
      />
    </div>
  );
}

function Chip({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "success";
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1",
        tone === "success"
          ? "border-success-border/70 bg-success-bg/50"
          : "border-border-default bg-card-warm",
      )}
    >
      {Icon ? (
        <Icon
          className={cn(
            "size-3",
            tone === "success" ? "text-success-fg" : "text-subtle",
          )}
          strokeWidth={2}
        />
      ) : null}
      <span
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.14em]",
          tone === "success" ? "text-success-fg" : "text-subtle",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-[11.5px] font-medium",
          tone === "success" ? "text-success-fg" : "text-ink",
        )}
      >
        {value}
      </span>
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
