"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Building2, Calendar, CreditCard, DollarSign } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  CUSTOMER,
  PAYMENT_AMOUNT,
  PAYMENT_DATE,
  PAYMENT_METHOD,
} from "../_data/payment";
import { FakeAppShell } from "./fake-app-shell";

// Scene 1: someone records a payment. Customer chip, amount typed in, payment
// method picker, save click.

export function IntakeScene() {
  const [typedAmount, setTypedAmount] = useState("");
  useEffect(() => {
    const target = PAYMENT_AMOUNT.toString();
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= target.length; i++) {
      timers.push(
        setTimeout(() => setTypedAmount(target.slice(0, i)), 500 + i * 90),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      key="intake-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell crumbs={["Payments", "Record payment"]}>
        <div className="flex h-full items-start justify-center p-8">
          <div className="w-full max-w-[560px]">
            <header>
              <h1 className="font-serif text-[24px] font-medium tracking-tight text-ink">
                Record a payment
              </h1>
              <p className="mt-1 text-[12.5px] text-subtle">
                We&apos;ll apply it to the customer&apos;s oldest open invoices.
              </p>
            </header>

            <div className="mt-6 rounded-xl border border-border-default bg-card-warm p-6 shadow-sm">
              {/* Customer chip */}
              <div className="flex items-center gap-3 rounded-md border border-border-default bg-surface/40 px-3 py-2.5">
                <Building2 className="size-4 text-subtle" strokeWidth={1.8} />
                <div className="flex-1">
                  <div className="text-[12.5px] font-medium text-ink">
                    {CUSTOMER.name}
                  </div>
                  <div className="font-mono text-[10.5px] text-subtle">
                    {CUSTOMER.abbreviation} · {CUSTOMER.city}, {CUSTOMER.state}
                  </div>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-warning-fg">
                  $4,880 open
                </span>
              </div>

              {/* Amount + date row */}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <FormField label="Amount">
                  <div className="flex items-center gap-1.5 font-serif text-[28px] font-medium text-ink tabular-nums">
                    <DollarSign
                      className="size-5 text-subtle"
                      strokeWidth={1.8}
                    />
                    <span>{typedAmount}</span>
                    <BlinkingCaret />
                  </div>
                </FormField>
                <FormField label="Date">
                  <div className="flex items-center gap-1.5 text-[14px] text-ink">
                    <Calendar
                      className="size-3.5 text-subtle"
                      strokeWidth={1.8}
                    />
                    {PAYMENT_DATE}
                  </div>
                </FormField>
              </div>

              {/* Method */}
              <div className="mt-4">
                <FormField label="Method">
                  <div className="flex items-center gap-1.5 text-[12.5px] text-ink">
                    <CreditCard
                      className="size-3.5 text-subtle"
                      strokeWidth={1.8}
                    />
                    {PAYMENT_METHOD}
                  </div>
                </FormField>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-border-default pt-4">
                <button
                  className="rounded-md border border-border-default bg-card-warm px-3 py-1.5 text-[12px] text-ink-warm"
                  disabled
                >
                  Cancel
                </button>
                <motion.button
                  className="rounded-md bg-success-fg px-3 py-1.5 text-[12px] font-medium text-card-warm"
                  disabled
                  whileHover={{ scale: 1.02 }}
                >
                  Apply to invoices
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </FakeAppShell>
    </motion.div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 rounded-md border border-border-default bg-card-warm px-3 py-2",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function BlinkingCaret() {
  return (
    <motion.span
      aria-hidden
      className="inline-block h-[20px] w-[2px] bg-ink"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
    />
  );
}
