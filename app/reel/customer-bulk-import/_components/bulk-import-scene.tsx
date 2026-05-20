"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  type Variants,
} from "motion/react";
import { Check, FileSpreadsheet, Sparkles, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { DEMO_CUSTOMERS, TOTAL_CUSTOMERS } from "../_data/customers";
import { FakeAppShell } from "./fake-app-shell";

// Scene 3: the bulk-import payoff. The file flies into a drop zone, the
// progress bar fills, the modal exits, and the customer table populates in
// rapid stagger. A "X imported in Y.Y seconds" stat lands at the end.

type Stage =
  | "list-empty"
  | "modal-open"
  | "file-dropping"
  | "importing"
  | "success"
  | "table-populated";

const STAGE_TIMINGS: Record<Stage, number> = {
  "list-empty": 700,
  "modal-open": 800,
  "file-dropping": 900,
  importing: 1700,
  success: 700,
  "table-populated": 2700,
};

const STAGE_ORDER: Stage[] = [
  "list-empty",
  "modal-open",
  "file-dropping",
  "importing",
  "success",
  "table-populated",
];

const rowEntry: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  },
};

const rowStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

export function BulkImportScene() {
  const [stage, setStage] = useState<Stage>("list-empty");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cumulative = 0;
    for (let i = 0; i < STAGE_ORDER.length - 1; i++) {
      cumulative += STAGE_TIMINGS[STAGE_ORDER[i]];
      const next = STAGE_ORDER[i + 1];
      timers.push(setTimeout(() => setStage(next), cumulative));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  // Animate the progress bar during the "importing" stage. Other stages
  // derive their displayed progress from `stage` directly (see
  // `displayProgress` below) so this effect only runs while there's animation
  // to drive.
  useEffect(() => {
    if (stage !== "importing") return;
    const start = performance.now();
    const duration = STAGE_TIMINGS.importing - 100;
    let raf = 0;
    const tick = (now: number) => {
      const pct = Math.min(100, ((now - start) / duration) * 100);
      setProgress(pct);
      if (pct < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  // Derived: what the UI should show as progress. Avoids a setState-in-effect
  // path that the React rules-of-hooks lint flags.
  const displayProgress =
    stage === "success" || stage === "table-populated" ? 100 : progress;

  // Once the table starts populating, render rows from the demo list. Limit
  // to a count that fits the visible row area — extras are fine but the
  // stagger feels best when ~12 rows land.
  const VISIBLE_ROWS = 14;
  const showRows = stage === "table-populated";
  const visibleCustomers = DEMO_CUSTOMERS.slice(0, VISIBLE_ROWS);

  return (
    <motion.div
      key="bulk-import"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell
        crumbs={["Customers"]}
        rightSlot={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline">
              <Upload className="size-3.5" />
              Import
            </Button>
            <Button size="sm">+ New customer</Button>
          </div>
        }
      >
        <div className="flex h-full flex-col">
          {/* Header strip with the count + stat */}
          <div className="flex items-center justify-between border-b border-border-default px-6 py-4">
            <div>
              <h1 className="font-serif text-[22px] font-medium tracking-tight text-ink">
                Customers
              </h1>
              <p className="mt-0.5 text-[12px] text-subtle">
                {showRows ? (
                  <>
                    <span className="font-medium text-ink-warm">
                      {TOTAL_CUSTOMERS}
                    </span>{" "}
                    customers · imported just now
                  </>
                ) : (
                  <span className="text-subtle">0 customers</span>
                )}
              </p>
            </div>
            <AnimatePresence>
              {showRows ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-2 rounded-full border border-success-border/80 bg-success-bg/70 px-3 py-1.5"
                >
                  <Sparkles
                    className="size-3.5 text-success-fg"
                    strokeWidth={2}
                  />
                  <span className="text-[12px] font-medium text-success-fg">
                    {TOTAL_CUSTOMERS} imported in 4.2 seconds
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-hidden p-6">
            <div className="overflow-hidden rounded-lg border border-border-default bg-card-warm">
              <table className="w-full text-[12px]">
                <thead className="bg-surface/60 text-[10px] uppercase tracking-[0.12em] text-subtle">
                  <tr>
                    <Th>Customer</Th>
                    <Th>Location</Th>
                    <Th>Abbreviation</Th>
                    <Th>Terms</Th>
                    <Th align="right">Added</Th>
                  </tr>
                </thead>
                <motion.tbody
                  variants={rowStagger}
                  initial="hidden"
                  animate={showRows ? "show" : "hidden"}
                >
                  {visibleCustomers.map((c) => (
                    <motion.tr
                      key={c.name}
                      variants={rowEntry}
                      className="border-t border-border-default"
                    >
                      <Td>
                        <div className="font-medium text-ink">{c.name}</div>
                        <div className="font-mono text-[10.5px] text-subtle">
                          {c.phone}
                        </div>
                      </Td>
                      <Td>
                        {c.city}, {c.state}
                      </Td>
                      <Td>
                        <span className="font-mono text-[11px] text-ink-warm">
                          {c.abbreviation}
                        </span>
                      </Td>
                      <Td>
                        <span className="font-mono text-[11px] text-ink-warm">
                          {c.terms}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-[10.5px] text-subtle">
                          just now
                        </span>
                      </Td>
                    </motion.tr>
                  ))}

                  {/* Empty placeholder when the table hasn't populated yet */}
                  {!showRows ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center">
                        <span className="text-[12px] text-subtle">
                          No customers yet.
                        </span>
                      </td>
                    </tr>
                  ) : null}
                </motion.tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Import modal */}
        <AnimatePresence>
          {(stage === "modal-open" ||
            stage === "file-dropping" ||
            stage === "importing" ||
            stage === "success") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-[2px]"
            >
              <motion.div
                initial={{ scale: 0.92, y: 16, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.96, y: 8, opacity: 0 }}
                transition={{
                  duration: 0.42,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="w-[460px] rounded-xl border border-border-default bg-card-warm p-6 shadow-2xl"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-[18px] font-medium text-ink">
                    Import customers
                  </h2>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                    .xlsx / .csv
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-subtle">
                  Drop the spreadsheet and we&apos;ll do the rest.
                </p>

                <DropZone stage={stage} progress={displayProgress} />

                <div className="mt-5 flex items-center justify-end gap-2">
                  <Button size="sm" variant="outline" disabled>
                    Cancel
                  </Button>
                  <Button size="sm" disabled>
                    {stage === "success" ? "Done" : "Importing…"}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </FakeAppShell>
    </motion.div>
  );
}

function DropZone({ stage, progress }: { stage: Stage; progress: number }) {
  const isHover = stage === "file-dropping";
  const isImporting = stage === "importing";
  const isDone = stage === "success";

  return (
    <div
      className={cn(
        "relative mt-5 overflow-hidden rounded-lg border-2 border-dashed bg-surface/60 transition-colors",
        isHover && "border-forest-mid bg-forest-tint/40",
        isImporting && "border-forest-mid bg-forest-tint/30",
        isDone && "border-success-border bg-success-bg/40",
        !isHover && !isImporting && !isDone && "border-border-default",
      )}
    >
      <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
        {/* The flying spreadsheet file */}
        <AnimatePresence mode="wait">
          {stage === "modal-open" ? (
            <motion.div
              key="prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2"
            >
              <Upload
                className="size-7 text-subtle"
                strokeWidth={1.6}
              />
              <span className="text-[12px] text-ink-warm">
                Drag &amp; drop or click to upload
              </span>
            </motion.div>
          ) : null}

          {stage === "file-dropping" ? (
            <motion.div
              key="dropping"
              initial={{ y: -90, x: -10, rotate: -10, opacity: 0 }}
              animate={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 16,
              }}
              className="flex items-center gap-2 rounded-md border border-border-default bg-card-warm px-3 py-2 shadow-md"
            >
              <FileSpreadsheet
                className="size-5 text-[#217346]"
                strokeWidth={1.8}
              />
              <div className="text-left">
                <div className="text-[12px] font-medium text-ink">
                  customer-book-2025.xlsx
                </div>
                <div className="font-mono text-[10px] text-subtle">
                  {TOTAL_CUSTOMERS} rows · 14 KB
                </div>
              </div>
            </motion.div>
          ) : null}

          {stage === "importing" ? (
            <motion.div
              key="importing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex w-full flex-col items-center gap-3"
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet
                  className="size-5 text-[#217346]"
                  strokeWidth={1.8}
                />
                <span className="text-[12px] font-medium text-ink">
                  customer-book-2025.xlsx
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                <motion.div
                  className="h-full bg-forest-mid"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.1, ease: "linear" }}
                />
              </div>
              <div className="font-mono text-[10px] text-subtle tabular-nums">
                Importing {Math.round((progress / 100) * TOTAL_CUSTOMERS)} of{" "}
                {TOTAL_CUSTOMERS}…
              </div>
            </motion.div>
          ) : null}

          {stage === "success" ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 320,
                damping: 18,
              }}
              className="flex flex-col items-center gap-2"
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-success-bg text-success-fg">
                <Check className="size-5" strokeWidth={2.4} />
              </div>
              <span className="text-[12.5px] font-medium text-success-fg">
                {TOTAL_CUSTOMERS} customers added
              </span>
              <span className="font-mono text-[10px] text-subtle">
                4.2 seconds
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Decorative animated shimmer during importing */}
      {isImporting ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(110deg, transparent 30%, color-mix(in oklch, var(--color-forest-tint) 60%, transparent) 50%, transparent 70%)",
          }}
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.4, ease: "linear", repeat: Infinity }}
        />
      ) : null}
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
        "px-4 py-2",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </td>
  );
}

