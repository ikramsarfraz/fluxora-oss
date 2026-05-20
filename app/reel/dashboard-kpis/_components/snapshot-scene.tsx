"use client";

import { motion, type Variants } from "motion/react";
import { ArrowDown, ArrowUp, CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  GREETING,
  KPIS,
  REVENUE_TREND,
  TODAY_LABEL,
  type Kpi,
} from "../_data/dashboard";
import {
  formatCount,
  formatMoney,
  formatPercent,
  useCountUp,
} from "./count-up";
import { FakeAppShell } from "./fake-app-shell";

// Scene 1: greeting + 4 KPI cards counting up + revenue area chart drawing.

const cardStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};

const cardEntry: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

export function SnapshotScene() {
  return (
    <motion.div
      key="snapshot-scene"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0"
    >
      <FakeAppShell crumbs={["Dashboard"]}>
        <div className="flex h-full flex-col overflow-y-auto p-6">
          {/* Greeting */}
          <header>
            <h1 className="font-serif text-[24px] font-medium tracking-tight text-ink">
              {GREETING}
            </h1>
            <div className="mt-1 flex items-center gap-1.5 text-[12px] text-subtle">
              <CalendarDays className="size-3" strokeWidth={2} />
              <span>{TODAY_LABEL}</span>
            </div>
          </header>

          {/* KPI cards */}
          <motion.div
            variants={cardStagger}
            initial="hidden"
            animate="show"
            className="mt-6 grid grid-cols-4 gap-3"
          >
            {KPIS.map((kpi) => (
              <motion.div key={kpi.key} variants={cardEntry}>
                <KpiCard kpi={kpi} />
              </motion.div>
            ))}
          </motion.div>

          {/* Revenue chart */}
          <div className="mt-6 flex-1 overflow-hidden rounded-xl border border-border-default bg-card-warm p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                  Revenue
                </span>
                <h2 className="mt-1 font-serif text-[17px] font-medium text-ink">
                  Last 30 days
                </h2>
              </div>
              <div className="text-right">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                  30-day total
                </span>
                <div className="font-serif text-[20px] font-medium text-ink">
                  $112,847
                </div>
              </div>
            </div>
            <RevenueChart values={REVENUE_TREND} />
          </div>
        </div>
      </FakeAppShell>
    </motion.div>
  );
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  const value = useCountUp(kpi.value, 1400, 400);
  const formatted =
    kpi.format === "money"
      ? formatMoney(value)
      : kpi.format === "percent"
        ? formatPercent(value)
        : formatCount(value);

  const isDown = (kpi.deltaPct ?? 0) < 0;
  const goodDirection = kpi.key === "ar" ? isDown : !isDown;

  return (
    <div className="rounded-lg border border-border-default bg-card-warm p-4 shadow-sm">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
        {kpi.label}
      </div>
      <div className="mt-1.5 font-serif text-[26px] font-medium leading-none text-ink tabular-nums">
        {formatted}
      </div>
      {kpi.deltaPct !== undefined ? (
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[10px]",
              goodDirection
                ? "bg-success-bg/70 text-success-fg"
                : "bg-warning-bg/70 text-warning-fg",
            )}
          >
            {isDown ? (
              <ArrowDown className="size-2.5" strokeWidth={2.4} />
            ) : (
              <ArrowUp className="size-2.5" strokeWidth={2.4} />
            )}
            {kpi.deltaPct > 0 ? "+" : ""}
            {kpi.deltaPct.toFixed(1)}%
          </span>
          <span className="text-subtle">{kpi.deltaLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

function RevenueChart({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 920;
  const h = 220;
  const padX = 16;
  const padY = 24;
  const usableW = w - padX * 2;
  const usableH = h - padY * 2;

  const points = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * usableW;
    const y = padY + (1 - (v - min) / range) * usableH;
    return { x, y };
  });

  const linePath = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${h - padY} L ${points[0].x} ${h - padY} Z`;

  // Horizontal grid lines (4 of them)
  const gridLines = [0.25, 0.5, 0.75].map((t) => ({
    y: padY + t * usableH,
    label: Math.round(max - t * range),
  }));

  return (
    <div className="relative h-[220px] w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="dashboard-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-forest-mid)"
              stopOpacity="0.32"
            />
            <stop
              offset="100%"
              stopColor="var(--color-forest-mid)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {/* Grid */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={padX}
              x2={w - padX}
              y1={g.y}
              y2={g.y}
              stroke="var(--color-border-default)"
              strokeOpacity="0.4"
              strokeDasharray="3 3"
            />
            <text
              x={padX}
              y={g.y - 3}
              fontSize="9"
              fill="var(--color-subtle)"
              fontFamily="var(--font-mono, monospace)"
            >
              ${g.label.toLocaleString()}
            </text>
          </g>
        ))}

        {/* Area */}
        <motion.path
          d={areaPath}
          fill="url(#dashboard-chart-fill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.1 }}
        />
        {/* Line */}
        <motion.path
          d={linePath}
          fill="none"
          stroke="var(--color-forest-mid)"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        {/* End-point dot */}
        <motion.circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={4}
          fill="var(--color-forest-mid)"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 2.4 }}
        />
      </svg>
    </div>
  );
}
