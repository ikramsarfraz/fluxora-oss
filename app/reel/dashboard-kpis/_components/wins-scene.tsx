"use client";

import { motion, type Variants } from "motion/react";
import {
  ArrowUp,
  Award,
  Boxes,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";

import {
  SPOTLIGHTS,
  TOP_MARGIN_SKUS,
  type Spotlight,
  type TopSku,
} from "../_data/dashboard";
import { FakeAppShell } from "./fake-app-shell";

// Scene 3: today's wins + watch-list. Spotlight cards land in, top margin
// SKUs animate in with little margin meters.

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.25 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

const TONE_BORDER: Record<Spotlight["tone"], string> = {
  success: "border-success-border/70",
  warning: "border-warning-border/70",
  info: "border-info-border/70",
};

const TONE_BG: Record<Spotlight["tone"], string> = {
  success: "bg-success-bg/40",
  warning: "bg-warning-bg/40",
  info: "bg-info-bg/40",
};

const TONE_TEXT: Record<Spotlight["tone"], string> = {
  success: "text-success-fg",
  warning: "text-warning-fg",
  info: "text-info-fg",
};

const TONE_ICON: Record<Spotlight["tone"], React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  success: Award,
  warning: TrendingUp,
  info: Boxes,
};

export function WinsScene() {
  return (
    <motion.div
      key="wins-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell crumbs={["Dashboard", "Today's wins"]}>
        <div className="grid h-full grid-cols-[1fr_1fr] gap-0">
          {/* Spotlights */}
          <div className="overflow-y-auto p-6">
            <header>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                Today
              </span>
              <h2 className="mt-1 font-serif text-[24px] font-medium tracking-tight text-ink">
                What to celebrate, what to chase
              </h2>
            </header>

            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="mt-6 space-y-3"
            >
              {SPOTLIGHTS.map((spot) => (
                <motion.div key={spot.title} variants={item}>
                  <SpotlightCard spotlight={spot} />
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Top margin SKUs */}
          <aside className="flex flex-col overflow-hidden border-l border-border-default bg-card-warm/30 p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-forest-mid" strokeWidth={2} />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
                Top margin · 7-day
              </span>
            </div>

            <motion.ul
              variants={stagger}
              initial="hidden"
              animate="show"
              className="mt-4 space-y-2.5"
            >
              {TOP_MARGIN_SKUS.map((s, idx) => (
                <motion.li key={s.sku} variants={item}>
                  <TopSkuRow sku={s} rank={idx + 1} />
                </motion.li>
              ))}
            </motion.ul>
          </aside>
        </div>
      </FakeAppShell>
    </motion.div>
  );
}

function SpotlightCard({ spotlight }: { spotlight: Spotlight }) {
  const Icon = TONE_ICON[spotlight.tone];
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-card-warm p-4",
        TONE_BORDER[spotlight.tone],
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          TONE_BG[spotlight.tone],
        )}
      >
        <Icon
          className={cn("size-4.5", TONE_TEXT[spotlight.tone])}
          strokeWidth={2}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
          {spotlight.badge}
        </div>
        <div
          className={cn(
            "mt-0.5 font-serif text-[15px] font-medium leading-tight",
            TONE_TEXT[spotlight.tone],
          )}
        >
          {spotlight.title}
        </div>
        <p className="mt-1 text-[12px] leading-[1.55] text-ink-warm">
          {spotlight.detail}
        </p>
      </div>
    </div>
  );
}

function TopSkuRow({ sku, rank }: { sku: TopSku; rank: number }) {
  return (
    <div className="rounded-md border border-border-default bg-card-warm px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] text-subtle">#{rank}</span>
          <span className="text-[12.5px] font-medium text-ink">{sku.name}</span>
        </div>
        <span className="font-serif text-[16px] font-medium text-forest-mid tabular-nums">
          {sku.marginPct.toFixed(1)}%
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[10.5px]">
        <span className="font-mono text-subtle">{sku.sku}</span>
        <span className="text-subtle">·</span>
        <span className="font-mono text-ink-warm">{sku.units} units</span>
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-0.5 font-mono",
            sku.unitsDelta >= 0 ? "text-success-fg" : "text-warning-fg",
          )}
        >
          {sku.unitsDelta >= 0 ? (
            <ArrowUp className="size-2.5" strokeWidth={2.4} />
          ) : (
            <ArrowUp className="size-2.5 rotate-180" strokeWidth={2.4} />
          )}
          {sku.unitsDelta > 0 ? "+" : ""}
          {sku.unitsDelta}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${sku.marginPct}%` }}
          transition={{
            duration: 0.85,
            delay: 0.4 + rank * 0.05,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="h-full bg-forest-mid"
        />
      </div>
    </div>
  );
}
