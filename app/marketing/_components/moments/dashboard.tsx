"use client";

import { motion } from "motion/react";
import {
  ArrowUp,
  CalendarDays,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { MomentFrame } from "./moment-frame";

// Marketing dashboard moment: 4 big KPI tiles, sparkline, no chrome. Larger
// than the in-app version — designed for marketing-page legibility.

const REVENUE_TREND = [
  42, 46, 39, 36, 28, 18, 16, 41, 44, 51, 49, 43, 25, 19,
  44, 52, 56, 50, 53, 26, 20, 46, 58, 64, 56, 54, 28, 22, 50, 49,
];

export function DashboardMoment() {
  return (
    <MomentFrame label="Dashboard" tone="info">
      <div className="p-6">
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="font-serif text-[22px] font-medium tracking-tight text-ink">
              Good morning, Sarah.
            </h3>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-[10.5px] text-subtle">
              <CalendarDays className="size-3" strokeWidth={2} />
              Tuesday, May 19
            </div>
          </div>
          <div className="hidden text-right md:block">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
              30-day revenue
            </div>
            <div className="font-serif text-[20px] font-medium text-ink">
              $112,847
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Revenue today" value="$4,287" delta="+12.4%" good delay={0.1} />
          <Kpi label="Open orders" value="18" delta="+5.9%" good delay={0.2} />
          <Kpi label="Outstanding AR" value="$42,180" delta="−3.1%" good delay={0.3} />
          <Kpi label="Margin" value="42.7%" delta="+1.4 pts" good highlight delay={0.4} />
        </div>

        <div className="mt-5 rounded-xl border border-border-default bg-surface/30 p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-info-fg">
              Revenue · last 30 days
            </span>
            <span className="font-mono text-[10px] text-subtle">
              peak $5,180 · low $1,820
            </span>
          </div>
          <Sparkline values={REVENUE_TREND} />
        </div>
      </div>
    </MomentFrame>
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
        highlight
          ? "border-info-border bg-info-bg/30"
          : "border-border-default",
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
          {good ? (
            <TrendingUp className="size-2.5" strokeWidth={2.4} />
          ) : (
            <ArrowUp className="size-2.5 rotate-180" strokeWidth={2.4} />
          )}
          {delta}
        </div>
      ) : null}
    </motion.div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 720;
  const h = 80;
  const padX = 4;
  const padY = 6;
  const usableW = w - padX * 2;
  const usableH = h - padY * 2;
  const points = values.map((v, i) => ({
    x: padX + (i / (values.length - 1)) * usableW,
    y: padY + (1 - (v - min) / range) * usableH,
  }));
  const path = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");
  const area = `${path} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-20 w-full">
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
