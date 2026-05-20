"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Save, Timer, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { DEMO_CUSTOMERS, TOTAL_CUSTOMERS } from "../_data/customers";
import { FakeAppShell } from "./fake-app-shell";

// Scene 2: someone fills out the customer add form by hand. We type the first
// customer's fields character by character with a virtual cursor, save, then
// quickly montage the next three. A counter ticks "X / 18 · MM:SS" on the
// right so the audience feels the math: at ~2 min per customer, the whole
// book takes the rest of the afternoon.

const MANUAL_FIELDS = [
  { label: "Name", key: "name" as const },
  { label: "Phone", key: "phone" as const },
  { label: "Email", key: "email" as const },
  { label: "Abbreviation", key: "abbreviation" as const },
  { label: "City", key: "city" as const },
  { label: "State", key: "state" as const },
  { label: "Terms", key: "terms" as const },
];

// Each typed field reveals over `BASE_CHAR_MS * length` ms. We add small
// pauses between fields. Total budget ≈ 6.5s for the first customer, then
// blink/save, then the montage runs at a sped-up rate.
const BASE_CHAR_MS = 28;
const FIELD_PAUSE_MS = 220;

type TypedFields = Partial<Record<(typeof MANUAL_FIELDS)[number]["key"], string>>;

export function ManualEntryScene() {
  const customer = DEMO_CUSTOMERS[0];

  const [typed, setTyped] = useState<TypedFields>({});
  const [activeField, setActiveField] = useState<string | null>(
    MANUAL_FIELDS[0].key,
  );
  const [saved, setSaved] = useState(false);
  const [counter, setCounter] = useState(1);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Schedule the type-out: walk each field, reveal one character every
  // BASE_CHAR_MS ms, pause briefly, move to the next.
  useEffect(() => {
    let cancelled = false;
    let cursorMs = 0;

    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const field of MANUAL_FIELDS) {
      const value = customer[field.key];
      // Move focus to this field
      timers.push(
        setTimeout(() => {
          if (!cancelled) setActiveField(field.key);
        }, cursorMs),
      );
      // Reveal characters one at a time
      for (let i = 1; i <= value.length; i++) {
        const at = cursorMs + i * BASE_CHAR_MS;
        timers.push(
          setTimeout(() => {
            if (!cancelled)
              setTyped((t) => ({ ...t, [field.key]: value.slice(0, i) }));
          }, at),
        );
      }
      cursorMs += value.length * BASE_CHAR_MS + FIELD_PAUSE_MS;
    }

    // Save click after all fields typed
    timers.push(
      setTimeout(() => {
        if (!cancelled) {
          setActiveField(null);
          setSaved(true);
        }
      }, cursorMs + 200),
    );

    // After save, montage the next three at accelerated pace
    timers.push(
      setTimeout(() => {
        if (!cancelled) {
          // Reset form, increment counter to suggest more customers entered
          setTyped({});
          setSaved(false);
          setCounter(2);
        }
      }, cursorMs + 1100),
    );
    timers.push(
      setTimeout(() => {
        if (!cancelled) setCounter(3);
      }, cursorMs + 1900),
    );
    timers.push(
      setTimeout(() => {
        if (!cancelled) setCounter(4);
      }, cursorMs + 2700),
    );
    timers.push(
      setTimeout(() => {
        if (!cancelled) setCounter(5);
      }, cursorMs + 3500),
    );

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [customer]);

  // Elapsed time clock — simulated, accelerated. Every real second corresponds
  // to ~24 fake seconds so a few minutes of "manual work" plays out in the
  // scene's run time. Resets when scene mounts.
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSec((s) => s + 24);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(elapsedSec / 60);
  const seconds = elapsedSec % 60;

  return (
    <motion.div
      key="manual-entry"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell
        crumbs={["Customers", "New customer"]}
        rightSlot={
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            ctrl-S to save
          </span>
        }
      >
        <div className="grid h-full grid-cols-[1fr_300px] gap-0">
          {/* Form column */}
          <div className="overflow-y-auto p-8">
            <h1 className="font-serif text-[24px] font-medium tracking-tight text-ink">
              Add a customer
            </h1>
            <p className="mt-1 text-[12.5px] text-subtle">
              Enter the customer&apos;s contact and billing details.
            </p>

            <div className="mt-6 max-w-[520px] rounded-lg border border-border-default bg-card-warm p-6 shadow-sm">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                {MANUAL_FIELDS.map((field) => (
                  <FormField
                    key={field.key}
                    label={field.label}
                    value={typed[field.key] ?? ""}
                    active={activeField === field.key}
                    span={field.key === "name" || field.key === "email"}
                  />
                ))}
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 border-t border-border-default pt-4">
                <Button size="sm" variant="outline">
                  Cancel
                </Button>
                <motion.div
                  animate={
                    saved
                      ? { scale: [1, 0.92, 1] }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.35 }}
                >
                  <Button size="sm">
                    <Save className="size-3.5" />
                    Save customer
                  </Button>
                </motion.div>
              </div>

              <AnimatePresence>
                {saved ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 flex items-center gap-2 rounded-md bg-success-bg/60 px-3 py-2 text-[11.5px] text-success-fg"
                  >
                    <Plus className="size-3.5" strokeWidth={2} />
                    <span>Customer saved. 1 of {TOTAL_CUSTOMERS} entered.</span>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          {/* Counter rail */}
          <aside className="flex flex-col gap-4 border-l border-border-default bg-card-warm/40 p-6">
            <div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-subtle font-mono">
                <Users className="size-3" strokeWidth={2} />
                <span>Progress</span>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <motion.span
                  key={counter}
                  initial={{ y: 6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="font-serif text-[48px] font-medium leading-none text-ink"
                >
                  {counter}
                </motion.span>
                <span className="text-[14px] text-subtle">
                  / {TOTAL_CUSTOMERS}
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface">
                <motion.div
                  className="h-full bg-forest-mid"
                  initial={false}
                  animate={{ width: `${(counter / TOTAL_CUSTOMERS) * 100}%` }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-subtle font-mono">
                <Timer className="size-3" strokeWidth={2} />
                <span>Elapsed</span>
              </div>
              <div className="mt-2 font-mono text-[28px] font-medium tabular-nums text-ink">
                {minutes.toString().padStart(2, "0")}:
                {seconds.toString().padStart(2, "0")}
              </div>
              <p className="mt-2 text-[11px] leading-[1.55] text-subtle">
                At ~2 min per customer, the rest of the book is the rest of
                your afternoon.
              </p>
            </div>

            <div className="mt-auto rounded-lg border border-warning-border/70 bg-warning-bg/40 p-3 text-[11px] leading-[1.5] text-warning-fg">
              <strong className="font-semibold">Heads up.</strong> 13 customers
              still in the spreadsheet.
            </div>
          </aside>
        </div>
      </FakeAppShell>
    </motion.div>
  );
}

function FormField({
  label,
  value,
  active,
  span,
}: {
  label: string;
  value: string;
  active: boolean;
  span?: boolean;
}) {
  return (
    <label className={cn("block", span && "col-span-2")}>
      <span className="block text-[11px] font-medium text-ink-warm">
        {label}
      </span>
      <div
        className={cn(
          "mt-1 flex h-8 items-center rounded-md border bg-card-warm px-2.5 text-[12.5px] text-ink",
          active
            ? "border-forest-mid ring-2 ring-forest-mid/20"
            : "border-border-default",
        )}
      >
        <span className="truncate">{value}</span>
        {active ? <BlinkingCaret /> : null}
      </div>
    </label>
  );
}

function BlinkingCaret() {
  return (
    <motion.span
      aria-hidden
      className="ml-px inline-block h-[14px] w-[1.5px] bg-ink"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
    />
  );
}
