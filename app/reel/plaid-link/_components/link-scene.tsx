"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Landmark, Lock, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

import { BANK } from "../_data/transactions";
import { FakeAppShell } from "./fake-app-shell";

// Scene 1: Plaid Link modal. Picks an institution, simulates auth, selects
// an account, lands on success.

type Step = "pick" | "auth" | "accounts" | "success";

const STEP_ORDER: Step[] = ["pick", "auth", "accounts", "success"];
const STEP_MS: Record<Step, number> = {
  pick: 1500,
  auth: 1900,
  accounts: 1700,
  success: 1400,
};

const INSTITUTIONS = [
  { name: "Chase Business", color: "#117ACA", popular: true },
  { name: "Bank of America", color: "#E31837" },
  { name: "Wells Fargo", color: "#D71E28" },
  { name: "Capital One", color: "#004977" },
  { name: "PNC", color: "#F58025" },
  { name: "US Bank", color: "#0F4D92" },
];

export function LinkScene() {
  const [step, setStep] = useState<Step>("pick");
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let acc = 0;
    for (let i = 0; i < STEP_ORDER.length - 1; i++) {
      acc += STEP_MS[STEP_ORDER[i]];
      const next = STEP_ORDER[i + 1];
      timers.push(setTimeout(() => setStep(next), acc));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      key="link-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell crumbs={["Banking", "Connect a bank"]}>
        <div className="flex h-full items-center justify-center bg-ink/15 p-6">
          {/* Plaid Link modal */}
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-[440px] overflow-hidden rounded-2xl border border-border-default bg-card-warm shadow-2xl"
          >
            <div className="flex items-center gap-2.5 border-b border-border-default px-5 py-3.5">
              <div className="flex size-7 items-center justify-center rounded-md bg-info-fg text-card-warm">
                <Landmark className="size-3.5" strokeWidth={2.2} />
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-medium text-ink">Plaid</div>
                <div className="font-mono text-[9.5px] text-subtle">
                  Connecting Fluxora · Pacific Wharf
                </div>
              </div>
              <div className="flex items-center gap-1 font-mono text-[9.5px] text-subtle">
                <Lock className="size-2.5" strokeWidth={2.4} />
                <span>256-bit</span>
              </div>
            </div>

            <div className="p-5">
              <AnimatePresence mode="wait">
                {step === "pick" ? <PickStep key="pick" /> : null}
                {step === "auth" ? <AuthStep key="auth" /> : null}
                {step === "accounts" ? <AccountStep key="accts" /> : null}
                {step === "success" ? <SuccessStep key="success" /> : null}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </FakeAppShell>
    </motion.div>
  );
}

function PickStep() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <h2 className="font-serif text-[16px] font-medium text-ink">
        Choose your bank
      </h2>
      <p className="mt-1 text-[11.5px] text-subtle">
        Search 12,000 institutions
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-md border border-info-fg/40 bg-card-warm px-3 py-2 ring-2 ring-info-fg/15">
        <span className="font-mono text-[12px] text-ink">Chase Business</span>
        <BlinkingCaret />
      </div>
      <div className="mt-3 space-y-1">
        {INSTITUTIONS.map((inst, idx) => (
          <motion.div
            key={inst.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + idx * 0.04 }}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-[12.5px]",
              idx === 0
                ? "bg-info-bg/40 ring-1 ring-info-fg/30"
                : "hover:bg-surface/40",
            )}
          >
            <span
              className="flex size-6 items-center justify-center rounded text-[10px] font-bold text-card-warm"
              style={{ backgroundColor: inst.color }}
            >
              {inst.name[0]}
            </span>
            <span className="text-ink">{inst.name}</span>
            {inst.popular ? (
              <span className="ml-auto rounded-full bg-surface px-1.5 py-0.5 font-mono text-[9px] text-subtle">
                popular
              </span>
            ) : null}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function AuthStep() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-md bg-[#117ACA] text-[14px] font-bold text-white">
          C
        </span>
        <h2 className="font-serif text-[16px] font-medium text-ink">
          Chase Business
        </h2>
      </div>
      <p className="mt-1 text-[11.5px] text-subtle">
        Sign in to continue. Plaid never stores your password.
      </p>
      <div className="mt-4 space-y-3">
        <Input label="Username" value="sarah.chen@pacificwharf" />
        <Input label="Password" value="••••••••••••" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-info-fg px-3 py-2.5 text-[12.5px] font-medium text-card-warm"
      >
        Continue
        <motion.span
          className="size-2.5 rounded-full bg-card-warm"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      </motion.div>
    </motion.div>
  );
}

function AccountStep() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <h2 className="font-serif text-[16px] font-medium text-ink">
        Choose accounts to connect
      </h2>
      <p className="mt-1 text-[11.5px] text-subtle">
        Fluxora only sees the accounts you check.
      </p>
      <div className="mt-3 space-y-2">
        <AccountRow
          name="Business Checking"
          mask="•••• 4421"
          balance={64218.42}
          checked={true}
        />
        <AccountRow
          name="Business Savings"
          mask="•••• 8842"
          balance={120640.0}
          checked={false}
        />
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-info-fg px-3 py-2.5 text-[12.5px] font-medium text-card-warm"
      >
        Continue · 1 account
      </motion.div>
    </motion.div>
  );
}

function SuccessStep() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-4 py-4 text-center"
    >
      <motion.div
        initial={{ scale: 0.4 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
        className="flex size-14 items-center justify-center rounded-full bg-success-bg text-success-fg"
      >
        <Check className="size-7" strokeWidth={2.4} />
      </motion.div>
      <div>
        <h2 className="font-serif text-[18px] font-medium text-ink">
          You&apos;re connected.
        </h2>
        <p className="mt-1 text-[12px] text-subtle">
          {BANK.name} · {BANK.accountType} {BANK.accountMask}
        </p>
      </div>
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-subtle">
        <ShieldCheck className="size-3 text-success-fg" strokeWidth={2.2} />
        Fluxora can read transactions. Plaid handles the rest.
      </div>
    </motion.div>
  );
}

function Input({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-subtle">
        {label}
      </div>
      <div className="mt-1 rounded-md border border-border-default bg-surface/40 px-3 py-2 text-[12.5px] text-ink">
        {value}
      </div>
    </div>
  );
}

function AccountRow({
  name,
  mask,
  balance,
  checked,
}: {
  name: string;
  mask: string;
  balance: number;
  checked: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md border bg-card-warm px-3 py-2.5",
        checked
          ? "border-info-fg/50 ring-1 ring-info-fg/20"
          : "border-border-default",
      )}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "flex size-5 items-center justify-center rounded border",
            checked
              ? "border-info-fg bg-info-fg text-card-warm"
              : "border-border-default bg-card-warm",
          )}
        >
          {checked ? <Check className="size-3" strokeWidth={2.6} /> : null}
        </div>
        <div>
          <div className="text-[12.5px] font-medium text-ink">{name}</div>
          <div className="font-mono text-[10px] text-subtle">{mask}</div>
        </div>
      </div>
      <span className="font-mono text-[12px] text-ink tabular-nums">
        ${balance.toLocaleString()}
      </span>
    </div>
  );
}

function BlinkingCaret() {
  return (
    <motion.span
      aria-hidden
      className="inline-block h-[14px] w-[1.5px] bg-ink"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
    />
  );
}
