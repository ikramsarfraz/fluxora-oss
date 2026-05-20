"use client";

import { motion } from "motion/react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Coffee,
  Clock,
  Sparkles,
} from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { cn } from "@/lib/utils";

// Opening and closing title cards for the walkthrough. Same frame size as
// the scene moments so the A→B swap is layout-stable.

export function IntroCard() {
  return (
    <motion.div
      key="intro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-page p-10"
    >
      <motion.div
        aria-hidden
        className="absolute inset-0"
        initial={{ opacity: 0, scale: 1.2 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at center, color-mix(in oklch, var(--color-forest-tint) 55%, transparent) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 20, delay: 0.1 }}
        className="relative flex items-center gap-2 rounded-full border border-border-default bg-card-warm px-3 py-1.5 shadow-sm"
      >
        <Logomark size={20} />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
          Fluxora
        </span>
        <span className="text-subtle">·</span>
        <span className="text-[11px] text-ink-warm">A Tuesday morning</span>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, delay: 0.3 }}
        className="relative mt-7 max-w-[680px] text-center font-serif text-[40px] font-medium leading-[1.05] tracking-tight text-ink md:text-[52px]"
      >
        7 a.m. to 10 a.m.
        <br />
        <span className="text-forest-mid">at Pacific Wharf Provisions.</span>
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.55 }}
        className="relative mx-auto mt-6 max-w-[520px] text-center text-[14px] leading-[1.6] text-ink-warm"
      >
        Five things a distributor does between coffee and the first
        delivery. Watch what each step takes on a spreadsheet — and what it
        takes in Fluxora.
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.85 }}
        className="relative mt-7 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle"
      >
        <Coffee className="size-3" strokeWidth={2.2} />
        <span>Starting at 7:00 AM</span>
        <span>·</span>
        <CalendarClock className="size-3" strokeWidth={2.2} />
        <span>Walkthrough · 1 min</span>
      </motion.div>
    </motion.div>
  );
}

export function OutroCard() {
  return (
    <motion.div
      key="outro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-page p-10"
    >
      <motion.div
        aria-hidden
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at center, color-mix(in oklch, var(--color-success-bg) 70%, transparent) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 18 }}
        className="relative flex size-14 items-center justify-center rounded-full bg-success-bg text-success-fg"
      >
        <Check className="size-7" strokeWidth={2.4} />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, delay: 0.25 }}
        className="relative mt-6 max-w-[680px] text-center font-serif text-[40px] font-medium leading-[1.05] tracking-tight text-ink md:text-[48px]"
      >
        9:43 a.m. Everything posted.
        <br />
        <span className="text-forest-mid">Time to go get coffee.</span>
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.55 }}
        className="relative mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4"
      >
        <Stat icon={Clock} label="Manual total" value="≈ 2h 14m" tone="danger" />
        <Stat icon={Sparkles} label="Fluxora total" value="2m 43s" tone="success" />
        <Stat label="Steps avoided" value="38" />
        <Stat label="Errors caught" value="3" />
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.85 }}
        className="relative mt-7 inline-flex items-center gap-1.5 rounded-md bg-forest-mid px-4 py-2 text-[13px] font-medium text-card-warm shadow-sm"
      >
        Try Fluxora free
        <ArrowRight className="size-3.5" />
      </motion.p>
    </motion.div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
        {Icon ? <Icon className="size-3" strokeWidth={2} /> : null}
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-serif text-[22px] font-medium leading-none tabular-nums",
          tone === "danger"
            ? "text-danger-fg"
            : tone === "success"
              ? "text-success-fg"
              : "text-ink",
        )}
      >
        {value}
      </div>
    </div>
  );
}
