"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowUp, Check, History, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  INVENTORY,
  SALMON_LOTS,
  SALMON_MOVEMENTS,
  type Lot,
} from "../_data/inventory";
import { FakeAppShell } from "./fake-app-shell";

// Scene 3: a spoilage adjustment runs against L-1245. Modal opens, reason
// pre-fills, confirm clicks. The expiring lot's qty bar shrinks, a new
// adjustment row lands at the top of the movement log, on-hand drops 72 → 68.

const SALMON = INVENTORY.find((i) => i.sku === "ATL-SAL-04")!;
const SPOIL_QTY = 4;
const SPOIL_LOT = SALMON_LOTS[0];

type Stage = "modal-open" | "submitting" | "applied" | "settled";

const STAGE_ORDER: Stage[] = [
  "modal-open",
  "submitting",
  "applied",
  "settled",
];
const STAGE_DURATION_MS: Record<Stage, number> = {
  "modal-open": 1600,
  submitting: 900,
  applied: 1200,
  settled: 2200,
};

export function AdjustmentScene() {
  const [stage, setStage] = useState<Stage>("modal-open");

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

  const adjustmentApplied =
    stage === "applied" || stage === "settled";
  const remainingAfter = adjustmentApplied
    ? SPOIL_LOT.qtyRemaining - SPOIL_QTY
    : SPOIL_LOT.qtyRemaining;
  const fillPctAfter =
    (remainingAfter / SPOIL_LOT.qtyOriginal) * 100;
  const onHandAfter = adjustmentApplied ? SALMON.onHand - SPOIL_QTY : SALMON.onHand;

  return (
    <motion.div
      key="adjustment-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell crumbs={["Inventory", SALMON.name, "Adjustment"]}>
        <div className="grid h-full grid-cols-[1.4fr_1fr] gap-0">
          {/* Left: lot card showing the change */}
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
              <OnHandStat
                onHand={onHandAfter}
                changed={adjustmentApplied}
                delta={-SPOIL_QTY}
                unit={SALMON.unit}
              />
            </div>

            <div className="mt-6 flex items-center gap-2">
              <Wrench
                className="size-3.5 text-warning-fg"
                strokeWidth={2}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-warning-fg">
                Adjusting · {SPOIL_LOT.number}
              </span>
            </div>

            <div
              className={cn(
                "mt-3 max-w-[420px] overflow-hidden rounded-lg border bg-card-warm p-4",
                "border-warning-border/80",
              )}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[12px] font-medium text-ink">
                  {SPOIL_LOT.number}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-1.5 py-0.5 font-mono text-[9.5px] text-warning-fg">
                  ⚠ expires in {SPOIL_LOT.expiresInDays}d
                </span>
              </div>

              <div className="mt-2 flex items-baseline gap-2 font-serif text-[26px] font-medium leading-none text-ink">
                {remainingAfter}
                <span className="font-sans text-[12px] font-normal text-subtle">
                  {SALMON.unit}
                </span>
                <AnimatePresence>
                  {adjustmentApplied ? (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="font-mono text-[12px] font-medium text-warning-fg"
                    >
                      −{SPOIL_QTY} {SALMON.unit}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface">
                <motion.div
                  className="h-full bg-warning-fg/80"
                  initial={false}
                  animate={{ width: `${fillPctAfter}%` }}
                  transition={{
                    duration: 0.6,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between font-mono text-[10.5px] text-subtle">
                <span>
                  Received {SPOIL_LOT.receivedDaysAgo}d ago · $
                  {SPOIL_LOT.cost.toFixed(2)}/{SALMON.unit}
                </span>
                {adjustmentApplied ? (
                  <span className="font-medium text-warning-fg">
                    {SPOIL_QTY} {SALMON.unit} written off
                  </span>
                ) : null}
              </div>
            </div>

            {/* Settled toast */}
            <AnimatePresence>
              {stage === "settled" ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 inline-flex items-center gap-2 rounded-md border border-success-border/60 bg-success-bg/40 px-3 py-2 text-[11.5px] text-success-fg"
                >
                  <Check className="size-3.5" strokeWidth={2.4} />
                  <span className="font-medium">
                    Adjustment saved · written to ledger
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* The other lots, dimmed since they aren't being adjusted */}
            <div className="mt-6 grid grid-cols-2 gap-3 opacity-50">
              {SALMON_LOTS.slice(1).map((lot) => (
                <DimmedLotCard
                  key={lot.number}
                  lot={lot}
                  unit={SALMON.unit}
                />
              ))}
            </div>
          </div>

          {/* Right: movement ledger with the new adjustment row */}
          <aside className="flex flex-col overflow-hidden border-l border-border-default bg-card-warm/30">
            <div className="flex items-center gap-2 border-b border-border-default px-5 py-3">
              <History
                className="size-3.5 text-forest-mid"
                strokeWidth={2}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
                Movement ledger
              </span>
            </div>
            <ul className="flex-1 overflow-y-auto">
              <AnimatePresence>
                {adjustmentApplied ? (
                  <motion.li
                    key="adjustment-row"
                    initial={{ opacity: 0, y: -12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      duration: 0.45,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <MovementRow
                      kind="adjustment"
                      qty={-SPOIL_QTY}
                      lotNumber={SPOIL_LOT.number}
                      reference="ADJ-spoilage"
                      whenLabel="just now"
                      highlight
                      unit={SALMON.unit}
                    />
                  </motion.li>
                ) : null}
              </AnimatePresence>
              {SALMON_MOVEMENTS.map((m, idx) => (
                <li key={`${m.ref}-${m.lotNumber}-${idx}`}>
                  <MovementRow
                    kind={m.kind}
                    qty={m.qty}
                    lotNumber={m.lotNumber}
                    reference={m.ref}
                    whenLabel={m.whenLabel}
                    unit={SALMON.unit}
                  />
                </li>
              ))}
            </ul>
          </aside>
        </div>

        {/* Modal */}
        <AnimatePresence>
          {stage === "modal-open" || stage === "submitting" ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-40 flex items-center justify-center bg-ink/30 backdrop-blur-[2px]"
            >
              <motion.div
                initial={{ scale: 0.92, y: 16, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.96, y: 8, opacity: 0 }}
                transition={{
                  duration: 0.42,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="w-[420px] rounded-xl border border-border-default bg-card-warm p-6 shadow-2xl"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-full bg-warning-bg">
                    <AlertTriangle
                      className="size-4 text-warning-fg"
                      strokeWidth={2}
                    />
                  </div>
                  <h2 className="font-serif text-[18px] font-medium text-ink">
                    Record adjustment
                  </h2>
                </div>

                <p className="mt-3 text-[12.5px] text-subtle">
                  {SPOIL_LOT.number} · {SALMON.name}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <FormField label="Quantity" value={`-${SPOIL_QTY} ${SALMON.unit}`} />
                  <FormField label="Reason" value="Expired (auto)" />
                </div>

                <FormField
                  label="Note"
                  value="Two pieces unsellable. Logged at 2:14 PM."
                  span
                />

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    className="rounded-md border border-border-default bg-card-warm px-3 py-1.5 text-[12px] text-ink-warm"
                    disabled
                  >
                    Cancel
                  </button>
                  <motion.button
                    animate={
                      stage === "submitting"
                        ? { scale: [1, 0.94, 1] }
                        : {}
                    }
                    transition={{ duration: 0.35 }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-[12px] font-medium",
                      "bg-warning-fg text-card-warm",
                    )}
                    disabled
                  >
                    {stage === "submitting" ? "Saving…" : "Save adjustment"}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </FakeAppShell>
    </motion.div>
  );
}

function OnHandStat({
  onHand,
  delta,
  unit,
  changed,
}: {
  onHand: number;
  delta: number;
  unit: string;
  changed: boolean;
}) {
  return (
    <div className="text-right">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
        On hand
      </div>
      <div className="mt-0.5 flex items-baseline justify-end gap-2 font-serif text-[24px] font-medium leading-none">
        <motion.span
          key={onHand}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={cn(changed ? "text-warning-fg" : "text-ink")}
        >
          {onHand}
        </motion.span>
        <span className="font-sans text-[12px] font-normal text-subtle">
          {unit}
        </span>
      </div>
      <AnimatePresence>
        {changed ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 inline-flex items-center gap-1 rounded-full bg-warning-bg/80 px-2 py-0.5 font-mono text-[10px] text-warning-fg"
          >
            <ArrowUp className="size-2.5 rotate-180" strokeWidth={2.4} />
            {delta} {unit}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function FormField({
  label,
  value,
  span,
}: {
  label: string;
  value: string;
  span?: boolean;
}) {
  return (
    <div className={cn("mt-3", span && "col-span-2")}>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
        {label}
      </div>
      <div className="mt-1 rounded-md border border-border-default bg-surface/40 px-3 py-1.5 text-[12.5px] text-ink">
        {value}
      </div>
    </div>
  );
}

function DimmedLotCard({ lot, unit }: { lot: Lot; unit: string }) {
  return (
    <div className="rounded-md border border-border-default bg-card-warm/60 p-2.5">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] text-ink-warm">{lot.number}</span>
        <span className="font-mono text-[10px] text-subtle">
          {lot.expiresInDays}d
        </span>
      </div>
      <div className="mt-1 font-serif text-[16px] font-medium leading-none text-ink">
        {lot.qtyRemaining}
        <span className="ml-1 text-[11px] font-normal text-subtle">{unit}</span>
      </div>
    </div>
  );
}

function MovementRow({
  kind,
  qty,
  lotNumber,
  reference,
  whenLabel,
  unit,
  highlight,
}: {
  kind: "received" | "shipped" | "adjustment";
  qty: number;
  lotNumber: string;
  reference: string;
  whenLabel: string;
  unit: string;
  highlight?: boolean;
}) {
  const isReceived = kind === "received";
  const isAdjustment = kind === "adjustment";

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-border-default px-5 py-2.5 last:border-b-0",
        highlight && "bg-warning-bg/30",
      )}
    >
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
          <ArrowUp className="size-3.5 rotate-180" strokeWidth={2.2} />
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
            {qty > 0 ? "+" : ""}
            {qty} {unit}
          </span>
          <span className="font-mono text-[10.5px] text-ink-warm">
            {lotNumber}
          </span>
        </div>
        <div className="font-mono text-[10px] text-subtle">
          {reference} · {whenLabel}
        </div>
      </div>
    </div>
  );
}
