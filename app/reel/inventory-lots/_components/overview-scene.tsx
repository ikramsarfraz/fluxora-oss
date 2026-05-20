"use client";

import { useEffect, useState } from "react";
import { motion, type Variants } from "motion/react";
import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  Layers,
  Timer,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { INVENTORY, SUMMARY } from "../_data/inventory";
import { FakeAppShell } from "./fake-app-shell";

// Scene 1: inventory list with the "expiring soon" filter chip being clicked
// to focus the eye on the lots that need attention.

type Filter = "all" | "low" | "expiring";

const rowEntry: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  },
};

const rowStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.2 } },
};

export function OverviewScene() {
  const [filter, setFilter] = useState<Filter>("all");

  // After ~2.2s, click the "Expiring soon" filter — the eye lands on the
  // three rows that matter.
  useEffect(() => {
    const handle = setTimeout(() => setFilter("expiring"), 2400);
    return () => clearTimeout(handle);
  }, []);

  const filtered =
    filter === "expiring"
      ? INVENTORY.filter((item) => item.expiringSoonLots > 0)
      : filter === "low"
        ? INVENTORY.filter((item) => item.daysOfStock <= 5)
        : INVENTORY;

  return (
    <motion.div
      key="overview-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell crumbs={["Inventory"]}>
        <div className="flex h-full flex-col">
          <header className="flex items-end justify-between border-b border-border-default px-6 py-5">
            <div>
              <h1 className="font-serif text-[24px] font-medium tracking-tight text-ink">
                Inventory
              </h1>
              <p className="mt-0.5 text-[12px] text-subtle">
                Every SKU. Every lot. Every dollar of stock.
              </p>
            </div>
            <SummaryStrip />
          </header>

          {/* Filter chips */}
          <div className="flex items-center gap-2 border-b border-border-default px-6 py-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
              Filter
            </span>
            <Chip
              label="All"
              active={filter === "all"}
              count={INVENTORY.length}
            />
            <Chip
              label="Low stock"
              active={filter === "low"}
              count={INVENTORY.filter((i) => i.daysOfStock <= 5).length}
              icon={Timer}
            />
            <Chip
              label="Expiring soon"
              active={filter === "expiring"}
              count={INVENTORY.filter((i) => i.expiringSoonLots > 0).length}
              icon={AlertTriangle}
              tone="warning"
            />
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="overflow-hidden rounded-lg border border-border-default bg-card-warm">
              <table className="w-full text-[12px]">
                <thead className="bg-surface/60 text-[10px] uppercase tracking-[0.12em] text-subtle">
                  <tr>
                    <Th>SKU</Th>
                    <Th>Product</Th>
                    <Th align="right">On hand</Th>
                    <Th align="right">Lots</Th>
                    <Th align="right">Avg cost</Th>
                    <Th align="right">Days stock</Th>
                  </tr>
                </thead>
                <motion.tbody
                  variants={rowStagger}
                  initial="hidden"
                  animate="show"
                  key={filter}
                >
                  {filtered.map((item) => (
                    <motion.tr
                      key={item.sku}
                      variants={rowEntry}
                      className={cn(
                        "border-t border-border-default",
                        item.expiringSoonLots > 0 &&
                          filter === "expiring" &&
                          "bg-warning-bg/30",
                      )}
                    >
                      <Td>
                        <span className="font-mono text-[11px] text-ink-warm">
                          {item.sku}
                        </span>
                      </Td>
                      <Td>
                        <div className="font-medium text-ink">{item.name}</div>
                        {item.expiringSoonLots > 0 ? (
                          <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-warning-fg">
                            <AlertTriangle
                              className="size-3"
                              strokeWidth={2}
                            />
                            <span>
                              {item.expiringSoonLots} lot
                              {item.expiringSoonLots === 1 ? "" : "s"} expire
                              in &lt; 3 days
                            </span>
                          </div>
                        ) : null}
                      </Td>
                      <Td align="right">
                        <span className="font-mono">
                          {item.onHand} {item.unit}
                        </span>
                      </Td>
                      <Td align="right">
                        <div className="inline-flex items-center gap-1 font-mono text-[11px]">
                          <Layers
                            className="size-3 text-subtle"
                            strokeWidth={1.8}
                          />
                          {item.lotCount}
                        </div>
                      </Td>
                      <Td align="right">
                        <span className="font-mono">
                          ${item.avgCost.toFixed(2)}
                        </span>
                      </Td>
                      <Td align="right">
                        <span
                          className={cn(
                            "font-mono",
                            item.daysOfStock <= 3 && "text-warning-fg",
                          )}
                        >
                          {item.daysOfStock}d
                        </span>
                      </Td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </div>
          </div>
        </div>
      </FakeAppShell>
    </motion.div>
  );
}

function SummaryStrip() {
  return (
    <div className="flex items-center gap-5 text-right">
      <SummaryStat
        icon={Boxes}
        label="SKUs"
        value={SUMMARY.skuCount.toString()}
      />
      <span className="h-6 w-px bg-border-default" />
      <SummaryStat
        icon={CircleDollarSign}
        label="On hand"
        value={`$${SUMMARY.onHandValue.toLocaleString()}`}
      />
      <span className="h-6 w-px bg-border-default" />
      <SummaryStat
        icon={AlertTriangle}
        label="At risk"
        value={`${SUMMARY.expiringSoonLots} lots`}
        tone="warning"
      />
    </div>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
        <Icon
          className={cn(
            "size-3",
            tone === "warning" ? "text-warning-fg" : "text-subtle",
          )}
          strokeWidth={2}
        />
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-serif text-[15px] font-medium",
          tone === "warning" ? "text-warning-fg" : "text-ink",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  count,
  icon: Icon,
  tone,
}: {
  label: string;
  active: boolean;
  count: number;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone?: "warning";
}) {
  return (
    <motion.span
      animate={active ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
        active
          ? tone === "warning"
            ? "border-warning-border bg-warning-bg/60 text-warning-fg font-medium"
            : "border-forest-mid bg-forest-mid/10 text-forest-mid font-medium"
          : "border-border-default bg-card-warm text-ink-warm",
      )}
    >
      {Icon ? <Icon className="size-3" strokeWidth={2} /> : null}
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 font-mono text-[10px]",
          active ? "bg-card-warm/70" : "bg-surface",
        )}
      >
        {count}
      </span>
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
        "px-4 py-2 align-top",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </td>
  );
}
