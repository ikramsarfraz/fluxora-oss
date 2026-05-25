"use client";

import { motion } from "motion/react";
import {
  AlertTriangle,
  Award,
  CalendarDays,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { MarketingAppShell } from "./app-shell";

const REVENUE_TREND = [
  42, 46, 39, 36, 28, 18, 16, 41, 44, 51, 49, 43, 25, 19, 44, 52, 56, 50, 53,
  26, 20, 46, 58, 64, 56, 54, 28, 22, 50, 49,
];

export function DashboardMoment() {
  return (
    <MarketingAppShell
      activeNav="dashboard"
      crumbs={["Dashboard"]}
      label="Dashboard · morning glance"
      tone="info"
      rightSlot={
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-subtle">
          <CalendarDays className="size-3" strokeWidth={2} />
          Tuesday, May 19
        </span>
      }
    >
      <div className="flex h-full flex-col p-5">
        <div>
          <h2 className="font-serif text-[22px] font-medium tracking-tight text-ink">
            Good morning, Sarah.
          </h2>
          <p className="mt-1 text-[12.5px] text-subtle">
            Here&apos;s what changed since you closed yesterday.
          </p>
        </div>

        {/* KPI tiles */}
        <div className="mt-5 grid grid-cols-4 gap-3">
          <Kpi label="Revenue today" value="$4,287" delta="+12.4%" good delay={0.1} />
          <Kpi label="Open orders" value="18" delta="+5.9%" good delay={0.2} />
          <Kpi label="Outstanding AR" value="$42,180" delta="−3.1%" good delay={0.3} />
          <Kpi
            label="Margin"
            value="42.7%"
            delta="+1.4 pts"
            good
            highlight
            delay={0.4}
          />
        </div>

        {/* Revenue chart + spotlight grid */}
        <div className="mt-5 grid flex-1 grid-cols-[1.5fr_1fr] gap-4">
          {/* Chart */}
          <div className="rounded-xl border border-border-default bg-card-warm p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-info-fg">
                  Revenue · last 30 days
                </span>
                <div className="mt-1 font-serif text-[20px] font-medium text-ink">
                  $112,847
                </div>
              </div>
              <span className="rounded-full bg-success-bg/60 px-2 py-0.5 font-mono text-[10px] text-success-fg">
                +18.2% vs prior 30d
              </span>
            </div>
            <Sparkline values={REVENUE_TREND} />
            <div className="mt-1 flex justify-between font-mono text-[9.5px] text-subtle">
              <span>Apr 20</span>
              <span>May 4</span>
              <span>May 19</span>
            </div>
          </div>

          {/* Spotlight stack */}
          <div className="flex flex-col gap-2">
            <Spotlight
              icon={Award}
              tone="success"
              badge="Today's win"
              title="Olive Branch · 51% margin"
              detail="Wagyu + heirloom run, 12 lines, posted at 7:42 AM."
              delay={0.5}
            />
            <Spotlight
              icon={TrendingUp}
              tone="warning"
              badge="Watch this"
              title="Lighthouse Cafe · 67d overdue"
              detail="$4,880 sitting past 60 days. Nudge today?"
              delay={0.7}
            />
            <Spotlight
              icon={AlertTriangle}
              tone="info"
              badge="Stock at risk"
              title="L-1245 expires in 2 days"
              detail="18 lb salmon on hand. Pre-offer to Anchor?"
              delay={0.9}
            />
          </div>
        </div>
      </div>
    </MarketingAppShell>
  );
}

function Kpi({
  label,
  value,
  delta,
  good,
  highlight,
  delay,
}: {
  label: string;
  value: string;
  delta?: string;
  good?: boolean;
  highlight?: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "rounded-lg border bg-card-warm p-3",
        highlight ? "border-info-border bg-info-bg/30" : "border-border-default",
      )}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
        {label}
      </div>
      <div className="mt-1.5 font-serif text-[22px] font-medium leading-none text-ink tabular-nums">
        {value}
      </div>
      {delta ? (
        <div
          className={cn(
            "mt-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[9.5px]",
            good
              ? "bg-success-bg/70 text-success-fg"
              : "bg-warning-bg/70 text-warning-fg",
          )}
        >
          <TrendingUp className="size-2.5" strokeWidth={2.4} />
          {delta}
        </div>
      ) : null}
    </motion.div>
  );
}

function Spotlight({
  icon: Icon,
  tone,
  badge,
  title,
  detail,
  delay,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: "success" | "warning" | "info";
  badge: string;
  title: string;
  detail: string;
  delay: number;
}) {
  const toneBorder =
    tone === "success"
      ? "border-success-border/60"
      : tone === "warning"
        ? "border-warning-border/60"
        : "border-info-border/60";
  const toneText =
    tone === "success"
      ? "text-success-fg"
      : tone === "warning"
        ? "text-warning-fg"
        : "text-info-fg";
  const toneBg =
    tone === "success"
      ? "bg-success-bg/40"
      : tone === "warning"
        ? "bg-warning-bg/40"
        : "bg-info-bg/40";
  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex items-start gap-2.5 rounded-lg border bg-card-warm p-3", toneBorder)}
    >
      <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", toneBg)}>
        <Icon className={cn("size-3.5", toneText)} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <div className={cn("font-mono text-[9.5px] uppercase tracking-[0.12em]", toneText)}>
          {badge}
        </div>
        <div className="mt-0.5 text-[12px] font-medium text-ink">{title}</div>
        <p className="mt-0.5 text-[10.5px] leading-[1.5] text-ink-warm">{detail}</p>
      </div>
    </motion.div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 540;
  const h = 80;
  const padX = 4;
  const padY = 6;
  const points = values.map((v, i) => ({
    x: padX + (i / (values.length - 1)) * (w - padX * 2),
    y: padY + (1 - (v - min) / range) * (h - padY * 2),
  }));
  const path = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");
  const area = `${path} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-20 w-full">
      <defs>
        <linearGradient id="dash-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-info-fg)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--color-info-fg)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill="url(#dash-fill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
      />
      <motion.path
        d={path}
        fill="none"
        stroke="var(--color-info-fg)"
        strokeWidth="2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={3.5}
        fill="var(--color-info-fg)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, delay: 1.7 }}
      />
    </svg>
  );
}
