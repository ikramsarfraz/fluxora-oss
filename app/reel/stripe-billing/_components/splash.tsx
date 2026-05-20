"use client";

import { motion } from "motion/react";
import { ArrowRight, Check, CreditCard, ShieldCheck } from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { cn } from "@/lib/utils";

export function IntroSplash() {
  return (
    <motion.div
      key="intro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-page"
    >
      <motion.div
        aria-hidden
        className="absolute inset-0"
        initial={{ opacity: 0, scale: 1.2 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at center, color-mix(in oklch, var(--color-warning-bg) 60%, transparent) 0%, transparent 70%)",
        }}
      />
      <div className="relative flex flex-col items-center gap-7 px-8 text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 20, delay: 0.15 }}
          className="flex items-center gap-2 rounded-full border border-border-default bg-card-warm px-3 py-1.5"
        >
          <Logomark size={20} />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            Fluxora
          </span>
          <span className="text-subtle">·</span>
          <span className="text-[11px] text-ink-warm">Watch</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-warning-fg"
        >
          <span className="size-1 rounded-full bg-warning-fg" />
          <span>Billing · Stripe Checkout</span>
          <span className="size-1 rounded-full bg-warning-fg" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="max-w-[680px] font-serif text-[42px] font-medium leading-[1.05] tracking-tight text-ink md:text-[56px]"
        >
          Pick a plan.
          <br />
          Pay.
          <br />
          <span className="text-warning-fg">You&apos;re on.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="max-w-[520px] text-[14px] leading-[1.55] text-subtle md:text-[15px]"
        >
          Stripe-hosted Checkout. PCI is their problem. The webhook flips
          features on the moment payment settles.
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.9 }}
          className="flex items-center gap-2 text-[11px] text-subtle"
        >
          <span className="relative flex size-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-warning-fg/40" />
            <span className="relative size-2 rounded-full bg-warning-fg" />
          </span>
          <span className="font-mono uppercase tracking-[0.12em]">
            Demo starting
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function ChapterPill({
  index,
  title,
  subtitle,
}: {
  index: number;
  title: string;
  subtitle: string;
}) {
  return (
    <motion.div
      key={`pill-${index}-${title}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-page/85 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 14 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: -8 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        className="flex items-center gap-4 rounded-full border border-warning-border/70 bg-card-warm/95 px-5 py-3 shadow-2xl backdrop-blur"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-warning-fg text-[13px] font-bold text-card-warm">
          {index}
        </span>
        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            Chapter {index} of 3
          </span>
          <span className="font-serif text-[18px] font-medium text-ink">
            {title}
          </span>
          <span className="text-[11.5px] text-subtle">{subtitle}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function OutroSplash() {
  return (
    <motion.div
      key="outro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-page"
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
      <div className="relative flex flex-col items-center gap-6 px-8 text-center">
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 18 }}
          className="flex size-14 items-center justify-center rounded-full bg-success-bg text-success-fg"
        >
          <Check className="size-7" strokeWidth={2.4} />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="max-w-[640px] font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[44px]"
        >
          You&apos;re on Growth.
          <br />
          <span className="text-warning-fg">Stripe handled the rest.</span>
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-2 flex items-center gap-6"
        >
          <Stat icon={CreditCard} label="Plan" value="Growth · $99/mo" />
          <Divider />
          <Stat icon={ShieldCheck} label="PCI" value="Stripe-handled" highlight />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-2 flex flex-col items-center gap-1"
        >
          <div className="inline-flex h-10 items-center gap-2 rounded-md bg-forest-mid px-5 text-[14px] font-medium text-card-warm">
            Try Fluxora free
            <ArrowRight className="size-3.5" />
          </div>
          <span className="text-[11px] text-subtle">
            No credit card · 14-day trial
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
        <Icon
          className={cn("size-3", highlight ? "text-warning-fg" : "text-subtle")}
          strokeWidth={2}
        />
        {label}
      </div>
      <div
        className={cn(
          "font-serif text-[22px] font-medium leading-none",
          highlight ? "text-warning-fg" : "text-ink",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Divider() {
  return <span className="text-border-default">·</span>;
}
