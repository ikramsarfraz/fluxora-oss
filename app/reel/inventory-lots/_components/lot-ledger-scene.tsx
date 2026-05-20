"use client";

import { useEffect, useState } from "react";
import { motion, type Variants } from "motion/react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  History,
  Layers,
  Sparkles,
  TrendingUp,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";

import {
  INVENTORY,
  SALMON_LOTS,
  SALMON_MOVEMENTS,
  SALMON_ONHAND_TREND,
  type Lot,
  type Movement,
} from "../_data/inventory";
import { FakeAppShell } from "./fake-app-shell";

// Scene 2 (centerpiece): drill into Atlantic salmon. Lot timeline runs across
// the center with cards stacked oldest → newest. The expiring lot gets a
// pulsing amber ring; FIFO indicator points at it. Movement ledger on the
// right shows the receipt/ship history. Sparkline at the top traces 14 days
// of on-hand.

const SALMON = INVENTORY.find((i) => i.sku === "ATL-SAL-04")!;

const cardStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.35 } },
};

const cardEntry: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

const ledgerStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.6 } },
};

const ledgerEntry: Variants = {
  hidden: { opacity: 0, x: 12 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  },
};

export function LotLedgerScene() {
  // After cards land, trigger the pulsing amber ring on the expiring lot.
  const [pulseExpiring, setPulseExpiring] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPulseExpiring(true), 1400);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      key="lot-ledger-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell crumbs={["Inventory", SALMON.name]}>
        <div className="grid h-full grid-cols-[1.4fr_1fr] gap-0">
          {/* Left: product header + lot timeline */}
          <div className="overflow-y-auto p-6">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle">
                  {SALMON.sku}
                </p>
                <h1 className="mt-1 font-serif text-[24px] font-medium tracking-tight text-ink">
                  {SALMON.name}
                </h1>
              </div>
              <ProductStats />
            </div>

            {/* Sparkline */}
            <div className="mt-5 rounded-lg border border-border-default bg-card-warm p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                  On hand · last 14 days
                </span>
                <span className="font-mono text-[10px] text-subtle">
                  peak {Math.max(...SALMON_ONHAND_TREND)} lb · low{" "}
                  {Math.min(...SALMON_ONHAND_TREND)} lb
                </span>
              </div>
              <Sparkline values={SALMON_ONHAND_TREND} />
            </div>

            {/* Lot timeline header */}
            <div className="mt-6 flex items-center gap-2">
              <Layers
                className="size-3.5 text-forest-mid"
                strokeWidth={2}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
                Lot timeline · oldest first
              </span>
            </div>

            {/* Lot cards */}
            <motion.div
              variants={cardStagger}
              initial="hidden"
              animate="show"
              className="mt-3 grid grid-cols-3 gap-3"
            >
              {SALMON_LOTS.map((lot, idx) => (
                <motion.div key={lot.number} variants={cardEntry}>
                  <LotCard
                    lot={lot}
                    unit={SALMON.unit}
                    isFifoNext={idx === 0}
                    pulseExpiring={pulseExpiring && idx === 0}
                  />
                </motion.div>
              ))}
            </motion.div>

            {/* Expiry alert callout, lands after the cards */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 1.5 }}
              className="mt-4 flex items-start gap-3 rounded-lg border border-warning-border/70 bg-warning-bg/40 p-3"
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-warning-bg">
                <AlertTriangle
                  className="size-3.5 text-warning-fg"
                  strokeWidth={2}
                />
              </div>
              <div className="flex-1 text-[12px] leading-[1.5] text-warning-fg">
                <strong className="font-semibold">
                  L-1245 expires in 2 days.
                </strong>{" "}
                FIFO will pull this lot next — or you can mark it spoiled and
                move on.
              </div>
            </motion.div>
          </div>

          {/* Right: movement ledger */}
          <aside className="flex flex-col overflow-hidden border-l border-border-default bg-card-warm/30">
            <div className="flex items-center gap-2 border-b border-border-default px-5 py-3">
              <History
                className="size-3.5 text-forest-mid"
                strokeWidth={2}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
                Movement ledger
              </span>
              <span className="ml-auto rounded-full bg-surface px-2 py-0.5 font-mono text-[9.5px] text-ink-warm">
                last 7 days
              </span>
            </div>
            <motion.ul
              variants={ledgerStagger}
              initial="hidden"
              animate="show"
              className="flex-1 overflow-y-auto"
            >
              {SALMON_MOVEMENTS.map((m, idx) => (
                <motion.li
                  key={`${m.ref}-${m.lotNumber}-${idx}`}
                  variants={ledgerEntry}
                >
                  <MovementRow movement={m} unit={SALMON.unit} />
                </motion.li>
              ))}
            </motion.ul>
          </aside>
        </div>
      </FakeAppShell>
    </motion.div>
  );
}

function ProductStats() {
  return (
    <div className="flex items-center gap-3">
      <Pill
        icon={Sparkles}
        label="On hand"
        value={`${SALMON.onHand} ${SALMON.unit}`}
      />
      <Pill icon={Layers} label="Lots" value={SALMON.lotCount.toString()} />
      <Pill
        icon={TrendingUp}
        label="Avg cost"
        value={`$${SALMON.avgCost.toFixed(2)}`}
        tone="success"
      />
    </div>
  );
}

function Pill({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <div
      className={cn(
        "inline-flex flex-col items-end rounded-md border bg-card-warm px-3 py-1.5",
        tone === "success"
          ? "border-success-border/70"
          : "border-border-default",
      )}
    >
      <div className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-subtle">
        <Icon
          className={cn(
            "size-3",
            tone === "success" ? "text-success-fg" : "text-subtle",
          )}
          strokeWidth={2}
        />
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-serif text-[14px] font-medium leading-none",
          tone === "success" ? "text-success-fg" : "text-ink",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function LotCard({
  lot,
  unit,
  isFifoNext,
  pulseExpiring,
}: {
  lot: Lot;
  unit: string;
  isFifoNext: boolean;
  pulseExpiring: boolean;
}) {
  const expiring = lot.status === "expiring-soon";
  const fillPct = (lot.qtyRemaining / lot.qtyOriginal) * 100;

  return (
    <motion.div
      animate={
        pulseExpiring
          ? {
              boxShadow: [
                "0 0 0 0 rgba(217, 184, 114, 0)",
                "0 0 0 8px rgba(217, 184, 114, 0.35)",
                "0 0 0 0 rgba(217, 184, 114, 0)",
              ],
            }
          : undefined
      }
      transition={{
        duration: 2,
        ease: "easeInOut",
        repeat: pulseExpiring ? Infinity : 0,
      }}
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card-warm p-3.5",
        expiring
          ? "border-warning-border/80"
          : "border-border-default",
        isFifoNext && "ring-2 ring-forest-mid/30",
      )}
    >
      {/* FIFO indicator badge */}
      {isFifoNext ? (
        <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-forest-mid px-2 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.12em] text-card-warm">
          <ArrowUp className="size-2.5 rotate-90" strokeWidth={2.4} />
          Next out (FIFO)
        </div>
      ) : (
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
          In queue
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[12px] font-medium text-ink">
          {lot.number}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[9.5px]",
            expiring
              ? "bg-warning-bg text-warning-fg"
              : "bg-success-bg/60 text-success-fg",
          )}
        >
          <CalendarClock className="size-2.5" strokeWidth={2} />
          {lot.expiresInDays}d
        </span>
      </div>

      <div className="mt-2 font-serif text-[22px] font-medium leading-none text-ink">
        {lot.qtyRemaining}
        <span className="ml-1 font-sans text-[12px] font-normal text-subtle">
          {unit}
        </span>
      </div>
      <div className="mt-0.5 font-mono text-[10px] text-subtle">
        of {lot.qtyOriginal} {unit} · ${lot.cost.toFixed(2)}/{unit}
      </div>

      {/* Fill bar */}
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fillPct}%` }}
          transition={{
            duration: 0.8,
            delay: 0.2,
            ease: [0.22, 1, 0.36, 1],
          }}
          className={cn(
            "h-full",
            expiring ? "bg-warning-fg/80" : "bg-forest-mid",
          )}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-subtle">
        <span>Received {lot.receivedDaysAgo}d ago</span>
        {expiring ? (
          <span className="font-medium text-warning-fg">⚠ expiring soon</span>
        ) : (
          <span className="text-success-fg">fresh</span>
        )}
      </div>
    </motion.div>
  );
}

function MovementRow({
  movement,
  unit,
}: {
  movement: Movement;
  unit: string;
}) {
  const isReceived = movement.kind === "received";
  const isAdjustment = movement.kind === "adjustment";

  return (
    <div className="flex items-center gap-3 border-b border-border-default px-5 py-2.5 last:border-b-0">
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          isReceived
            ? "bg-success-bg text-success-fg"
            : isAdjustment
              ? "bg-warning-bg text-warning-fg"
              : "bg-info-bg text-info-fg",
        )}
      >
        {isReceived ? (
          <ArrowUp className="size-3.5" strokeWidth={2.2} />
        ) : isAdjustment ? (
          <Wrench className="size-3.5" strokeWidth={2.2} />
        ) : (
          <ArrowDown className="size-3.5" strokeWidth={2.2} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-[12px]">
          <span
            className={cn(
              "font-mono font-medium",
              isReceived
                ? "text-success-fg"
                : isAdjustment
                  ? "text-warning-fg"
                  : "text-ink",
            )}
          >
            {movement.qty > 0 ? "+" : ""}
            {movement.qty} {unit}
          </span>
          <span className="font-mono text-[10.5px] text-ink-warm">
            {movement.lotNumber}
          </span>
        </div>
        <div className="font-mono text-[10px] text-subtle">
          {movement.ref} · {movement.whenLabel}
        </div>
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 480;
  const h = 56;
  const pad = 4;
  const usableW = w - pad * 2;
  const usableH = h - pad * 2;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * usableW;
    const y = pad + (1 - (v - min) / range) * usableH;
    return { x, y };
  });

  const path = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");
  const areaPath = `${path} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor="var(--color-forest-mid)"
            stopOpacity="0.28"
          />
          <stop
            offset="100%"
            stopColor="var(--color-forest-mid)"
            stopOpacity="0"
          />
        </linearGradient>
      </defs>
      <motion.path
        d={areaPath}
        fill="url(#spark-fill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.35 }}
      />
      <motion.path
        d={path}
        fill="none"
        stroke="var(--color-forest-mid)"
        strokeWidth="1.6"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
      {/* End-point dot */}
      <motion.circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={3}
        fill="var(--color-forest-mid)"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 1.2 }}
      />
    </svg>
  );
}
