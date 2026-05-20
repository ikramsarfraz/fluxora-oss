"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Check,
  CreditCard,
  Lock,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { cn } from "@/lib/utils";

// =========================================================================
// Scene 1 — Plan picker
// =========================================================================
type Plan = {
  key: string;
  name: string;
  price: string;
  per: string;
  features: string[];
  recommended?: boolean;
};

const PLANS: Plan[] = [
  {
    key: "starter",
    name: "Starter",
    price: "$29",
    per: "/mo",
    features: [
      "1 workspace",
      "Up to 100 SKUs",
      "Up to 2 users",
      "Email support",
    ],
  },
  {
    key: "growth",
    name: "Growth",
    price: "$99",
    per: "/mo",
    features: [
      "Up to 5,000 SKUs",
      "Up to 10 users",
      "FIFO inventory + lots",
      "Plaid bank linking",
      "Priority support",
    ],
    recommended: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "Custom",
    per: "",
    features: [
      "Unlimited SKUs + users",
      "AI invoice import",
      "Custom roles & SSO",
      "Audit log retention",
      "Named CSM",
    ],
  },
];

export function PlansScene() {
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSelected("growth"), 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      key="plans-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 flex flex-col bg-page"
    >
      <header className="border-b border-border-default bg-card-warm/60 px-6 py-4">
        <div className="flex items-center gap-2 text-[12.5px]">
          <Logomark size={20} />
          <span className="font-serif font-medium text-ink">Fluxora</span>
          <span className="text-subtle">/</span>
          <span className="text-ink-warm">Account</span>
          <span className="text-subtle">/</span>
          <span className="font-medium text-ink">Billing</span>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center p-8">
        <div className="text-center">
          <h1 className="font-serif text-[28px] font-medium tracking-tight text-ink">
            Choose your plan
          </h1>
          <p className="mt-1 text-[12.5px] text-subtle">
            Billed monthly · cancel anytime · upgrade or downgrade in a click
          </p>
        </div>

        <div className="mt-8 grid w-full max-w-[920px] grid-cols-3 gap-4">
          {PLANS.map((plan, idx) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              selected={selected === plan.key}
              delay={0.3 + idx * 0.1}
            />
          ))}
        </div>
      </main>
    </motion.div>
  );
}

function PlanCard({
  plan,
  selected,
  delay,
}: {
  plan: Plan;
  selected: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <motion.div
        animate={
          selected
            ? {
                scale: 1.04,
                boxShadow: "0 20px 50px -20px rgba(31, 58, 46, 0.45)",
              }
            : { scale: 1, boxShadow: "0 4px 14px -8px rgba(0,0,0,0.15)" }
        }
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        className={cn(
          "flex h-full flex-col rounded-2xl border-2 bg-card-warm p-5",
          selected
            ? "border-warning-fg"
            : plan.recommended
              ? "border-forest-tint-deep/60"
              : "border-border-default",
        )}
      >
        {plan.recommended ? (
          <div className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-forest-mid px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-card-warm">
            <Sparkles className="size-2.5" strokeWidth={2.4} />
            Most popular
          </div>
        ) : null}
        <h3 className="font-serif text-[20px] font-medium text-ink">
          {plan.name}
        </h3>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="font-serif text-[32px] font-medium leading-none text-ink">
            {plan.price}
          </span>
          <span className="text-[12px] text-subtle">{plan.per}</span>
        </div>
        <ul className="mt-4 space-y-1.5 text-[12px] text-ink-warm">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-1.5">
              <Check
                className="mt-0.5 size-3 shrink-0 text-success-fg"
                strokeWidth={2.4}
              />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <motion.button
          disabled
          animate={selected ? { scale: [1, 0.96, 1] } : {}}
          className={cn(
            "mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[12.5px] font-medium",
            selected
              ? "bg-warning-fg text-card-warm"
              : plan.recommended
                ? "bg-forest-mid text-card-warm"
                : "border border-border-default bg-card-warm text-ink-warm",
          )}
        >
          {selected ? (
            <>
              <Lock className="size-3" strokeWidth={2.4} />
              Going to Checkout…
            </>
          ) : (
            <>Choose {plan.name}</>
          )}
        </motion.button>
      </motion.div>
      {selected ? (
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
          className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-warning-fg text-card-warm shadow-md"
        >
          <Check className="size-4" strokeWidth={2.6} />
        </motion.div>
      ) : null}
    </motion.div>
  );
}

// =========================================================================
// Scene 2 — Stripe Checkout
// =========================================================================
type CardStage = "blank" | "typing-num" | "filled" | "processing" | "succeeded";
const CARD_NUMBER = "4242 4242 4242 4242";

export function CheckoutScene() {
  const [stage, setStage] = useState<CardStage>("blank");
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const t1 = setTimeout(() => setStage("typing-num"), 800);
    const timers: ReturnType<typeof setTimeout>[] = [t1];
    for (let i = 1; i <= CARD_NUMBER.length; i++) {
      timers.push(
        setTimeout(
          () => setTyped(CARD_NUMBER.slice(0, i)),
          900 + i * 50,
        ),
      );
    }
    timers.push(
      setTimeout(() => setStage("filled"), 900 + CARD_NUMBER.length * 50 + 200),
    );
    timers.push(
      setTimeout(() => setStage("processing"), 900 + CARD_NUMBER.length * 50 + 1500),
    );
    timers.push(
      setTimeout(() => setStage("succeeded"), 900 + CARD_NUMBER.length * 50 + 3000),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const succeeded = stage === "succeeded";

  return (
    <motion.div
      key="checkout-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 flex items-center justify-center bg-ink/20 p-6"
    >
      {/* Stripe-style modal */}
      <motion.div
        initial={{ scale: 0.94, y: 14, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-[440px] overflow-hidden rounded-2xl border border-border-default bg-card-warm shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border-default px-5 py-3">
          <div className="flex size-7 items-center justify-center rounded-md bg-[#635BFF] text-card-warm font-mono text-[10px] font-bold">
            S
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            Stripe Checkout · Test mode
          </span>
          <div className="ml-auto flex items-center gap-1 font-mono text-[9.5px] text-subtle">
            <Lock className="size-2.5" strokeWidth={2.4} />
            <span>secure</span>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
              Subscribe to Growth
            </span>
            <span className="font-serif text-[18px] font-medium text-ink">
              $99.00 / mo
            </span>
          </div>

          {!succeeded ? (
            <div className="mt-4 space-y-3">
              <Field label="Email" value="sarah.chen@pacificwharf.com" />
              <Field
                label="Card number"
                value={typed || "1234 1234 1234 1234"}
                hasCaret={stage === "typing-num"}
                muted={!typed}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Expiry"
                  value={stage === "blank" ? "MM / YY" : "12 / 28"}
                  muted={stage === "blank"}
                />
                <Field
                  label="CVC"
                  value={stage === "blank" ? "CVC" : "•••"}
                  muted={stage === "blank"}
                />
              </div>
              <Field
                label="Country"
                value="United States"
                muted={false}
              />

              <motion.button
                disabled
                animate={
                  stage === "processing" || stage === "filled"
                    ? { scale: [1, 0.96, 1] }
                    : {}
                }
                transition={{ duration: 0.4 }}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-[13px] font-medium",
                  "bg-[#635BFF] text-card-warm",
                )}
              >
                {stage === "processing" ? (
                  <>
                    <Lock className="size-3.5" strokeWidth={2.2} />
                    Processing payment…
                  </>
                ) : (
                  <>Subscribe · $99.00</>
                )}
              </motion.button>

              <div className="flex items-center justify-center gap-1.5 font-mono text-[9.5px] text-subtle">
                <ShieldCheck className="size-2.5" strokeWidth={2.4} />
                Powered by Stripe · PCI-compliant
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="mt-6 flex flex-col items-center gap-3 py-3"
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-success-bg text-success-fg">
                <Check className="size-6" strokeWidth={2.4} />
              </div>
              <div className="text-center">
                <div className="font-serif text-[16px] font-medium text-ink">
                  Payment succeeded
                </div>
                <div className="mt-1 font-mono text-[10.5px] text-subtle">
                  ch_3OqXk2GBgQ8YhB4d · $99.00
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({
  label,
  value,
  hasCaret,
  muted,
}: {
  label: string;
  value: string;
  hasCaret?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-subtle">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 flex items-center gap-1.5 rounded-md border bg-card-warm px-3 py-2 text-[12.5px]",
          hasCaret
            ? "border-[#635BFF] ring-2 ring-[#635BFF]/20"
            : "border-border-default",
        )}
      >
        <span className={cn(muted ? "text-subtle" : "text-ink")}>{value}</span>
        {hasCaret ? <BlinkingCaret /> : null}
        <CreditCard
          className="ml-auto size-3.5 text-subtle"
          strokeWidth={1.8}
        />
      </div>
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

// =========================================================================
// Scene 3 — Plan active, features unlock
// =========================================================================
const FEATURE_UNLOCKS = [
  "AI invoice import",
  "FIFO inventory tracking",
  "Plaid bank linking",
  "Branded PDFs",
  "Custom roles",
  "Audit log retention",
];

export function ActiveScene() {
  const [unlocked, setUnlocked] = useState(0);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= FEATURE_UNLOCKS.length; i++) {
      timers.push(setTimeout(() => setUnlocked(i), 600 + i * 350));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      key="active-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 flex flex-col bg-page"
    >
      <header className="border-b border-border-default bg-card-warm/60 px-6 py-4">
        <div className="flex items-center gap-2 text-[12.5px]">
          <Logomark size={20} />
          <span className="font-serif font-medium text-ink">Fluxora</span>
          <span className="text-subtle">/</span>
          <span className="text-ink-warm">Account</span>
          <span className="text-subtle">/</span>
          <span className="font-medium text-ink">Billing</span>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-[640px]">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="rounded-2xl border-2 border-success-border/60 bg-success-bg/15 p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-success-fg">
                  <Sparkles className="size-3" strokeWidth={2.2} />
                  Plan active
                </div>
                <h2 className="mt-1.5 font-serif text-[26px] font-medium tracking-tight text-ink">
                  Growth · $99 / mo
                </h2>
                <div className="mt-1 text-[12.5px] text-subtle">
                  Next invoice · Jun 19, 2026
                </div>
              </div>
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 320,
                  damping: 18,
                  delay: 0.2,
                }}
                className="flex size-12 items-center justify-center rounded-full bg-success-fg text-card-warm shadow"
              >
                <Check className="size-6" strokeWidth={2.6} />
              </motion.div>
            </div>

            <div className="mt-5 border-t border-success-border/40 pt-4">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                <Zap className="size-3 text-warning-fg" strokeWidth={2.2} />
                Features unlocked
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-2">
                {FEATURE_UNLOCKS.map((f, idx) => {
                  const unlockedNow = idx < unlocked;
                  return (
                    <motion.li
                      key={f}
                      initial={{ opacity: 0, x: -8 }}
                      animate={
                        unlockedNow
                          ? { opacity: 1, x: 0 }
                          : { opacity: 0, x: -8 }
                      }
                      transition={{ duration: 0.35 }}
                      className="flex items-center gap-2 rounded-md border border-border-default bg-card-warm px-3 py-1.5 text-[12px]"
                    >
                      <Check
                        className="size-3 text-success-fg"
                        strokeWidth={2.6}
                      />
                      <span className="text-ink">{f}</span>
                    </motion.li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                disabled
                className="rounded-md border border-border-default bg-card-warm px-3 py-1.5 text-[12px] text-ink-warm"
              >
                Manage in Stripe
              </button>
              <button
                disabled
                className="rounded-md bg-forest-mid px-3 py-1.5 text-[12px] font-medium text-card-warm"
              >
                Go to dashboard
              </button>
            </div>
          </motion.div>
        </div>
      </main>
    </motion.div>
  );
}
