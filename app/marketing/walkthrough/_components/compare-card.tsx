"use client";

import { motion, type Variants } from "motion/react";
import {
  AlertTriangle,
  Check,
  Clock,
  FileSpreadsheet,
  Sparkles,
  Timer,
} from "lucide-react";

import { cn } from "@/lib/utils";

// "Before" and "After" cards stitched into a sequence. Each takes the full
// frame and has room to breathe — vertical narrative timelines with real
// timestamps, specific friction descriptions, and a single stat ribbon at
// the bottom. The walkthrough autopilot plays them back-to-back.

export type TimelineEvent = {
  at: string;
  what: string;
  /** Optional icon for the row. Defaults to a dot. */
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

export type CompareStep = {
  /** Cross-card chapter label, e.g. "Step 1 of 5". */
  step: string;
  /** Headline shown on both cards so visitors know it's the same beat. */
  topic: string;
  before: {
    title: string;
    detail: string;
    events: TimelineEvent[];
    statLabel: string;
    statValue: string;
    tag?: string;
  };
  after: {
    title: string;
    detail: string;
    events: TimelineEvent[];
    statLabel: string;
    statValue: string;
    tag?: string;
    /** Single takeaway under the timeline. */
    callout: string;
  };
};

// =========================================================================
// BeforeCard — the spreadsheet pain, broken out
// =========================================================================
export function BeforeCard({ compare }: { compare: CompareStep }) {
  return (
    <motion.div
      key={`before-${compare.step}`}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex h-full flex-col bg-page"
    >
      <Backdrop tone="danger" />
      <CardHeader
        tone="danger"
        chapterLabel={compare.step}
        sideLabel="The old way"
        topic={compare.topic}
        icon={FileSpreadsheet}
      />

      <div className="relative flex flex-1 flex-col gap-5 px-10 pb-8">
        {/* Detail + tag */}
        <div>
          <h2 className="font-serif text-[28px] font-medium leading-[1.1] tracking-tight text-ink md:text-[32px]">
            {compare.before.title}
          </h2>
          <p className="mt-2 max-w-[640px] text-[14px] leading-[1.6] text-ink-warm">
            {compare.before.detail}
          </p>
          {compare.before.tag ? (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-danger-bg/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-danger-fg">
              <AlertTriangle className="size-3" strokeWidth={2.2} />
              {compare.before.tag}
            </div>
          ) : null}
        </div>

        {/* Timeline — where the extra info lives */}
        <Timeline events={compare.before.events} tone="danger" />

        {/* Stat ribbon at the bottom */}
        <div className="mt-auto flex items-end justify-between gap-4 border-t-2 border-dashed border-danger-border/50 pt-4">
          <StatBlock
            label={compare.before.statLabel}
            value={compare.before.statValue}
            tone="danger"
            strikethrough
          />
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-subtle">
            up next · the Fluxora way →
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// =========================================================================
// AfterCard — the Fluxora outcome
// =========================================================================
export function AfterCard({ compare }: { compare: CompareStep }) {
  return (
    <motion.div
      key={`after-${compare.step}`}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex h-full flex-col bg-page"
    >
      <Backdrop tone="success" />
      <CardHeader
        tone="success"
        chapterLabel={compare.step}
        sideLabel="The Fluxora way"
        topic={compare.topic}
        icon={Sparkles}
      />

      <div className="relative flex flex-1 flex-col gap-5 px-10 pb-8">
        <div>
          <h2 className="font-serif text-[28px] font-medium leading-[1.1] tracking-tight text-ink md:text-[32px]">
            {compare.after.title}
          </h2>
          <p className="mt-2 max-w-[640px] text-[14px] leading-[1.6] text-ink-warm">
            {compare.after.detail}
          </p>
          {compare.after.tag ? (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success-bg/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-success-fg">
              <Sparkles className="size-3" strokeWidth={2.2} />
              {compare.after.tag}
            </div>
          ) : null}
        </div>

        <Timeline events={compare.after.events} tone="success" />

        {/* Callout — single most important takeaway */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex items-center gap-2.5 rounded-lg border border-success-border/60 bg-success-bg/40 px-3 py-2"
        >
          <Check className="size-3.5 text-success-fg" strokeWidth={2.6} />
          <span className="text-[13px] font-medium text-success-fg">
            {compare.after.callout}
          </span>
        </motion.div>

        <div className="mt-auto flex items-end justify-between gap-4 border-t-2 border-success-border/40 pt-4">
          <StatBlock
            label={compare.after.statLabel}
            value={compare.after.statValue}
            tone="success"
          />
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-subtle">
            next step →
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// =========================================================================
// Atoms
// =========================================================================

function Backdrop({ tone }: { tone: "danger" | "success" }) {
  const tint =
    tone === "danger" ? "var(--color-danger-bg)" : "var(--color-success-bg)";
  return (
    <motion.div
      aria-hidden
      className="absolute inset-0 opacity-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.5 }}
      transition={{ duration: 0.8 }}
      style={{
        background: `radial-gradient(ellipse 75% 60% at 50% 35%, color-mix(in oklch, ${tint} 60%, transparent) 0%, transparent 70%)`,
      }}
    />
  );
}

function CardHeader({
  tone,
  chapterLabel,
  sideLabel,
  topic,
  icon: Icon,
}: {
  tone: "danger" | "success";
  chapterLabel: string;
  sideLabel: string;
  topic: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  const sidePill =
    tone === "danger"
      ? "border-danger-border/70 bg-danger-bg/50 text-danger-fg"
      : "border-success-border/70 bg-success-bg/50 text-success-fg";
  return (
    <div className="relative flex items-center justify-between px-10 pb-6 pt-10">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
          {chapterLabel}
        </div>
        <div className="mt-1 font-serif text-[17px] font-medium text-ink-warm">
          {topic}
        </div>
      </div>
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5",
          sidePill,
        )}
      >
        <Icon className="size-3.5" strokeWidth={2.2} />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em]">
          {sideLabel}
        </span>
      </div>
    </div>
  );
}

const timelineList: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
  },
};

const timelineItem: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

function Timeline({
  events,
  tone,
}: {
  events: TimelineEvent[];
  tone: "danger" | "success";
}) {
  return (
    <motion.ol
      variants={timelineList}
      initial="hidden"
      animate="show"
      className="relative flex flex-col"
    >
      {/* Vertical rail running through the timestamps */}
      <span
        aria-hidden
        className={cn(
          "absolute left-[68px] top-3 bottom-3 w-px",
          tone === "danger" ? "bg-danger-border/40" : "bg-success-border/50",
        )}
      />

      {events.map((e, idx) => (
        <motion.li
          key={`${e.at}-${idx}`}
          variants={timelineItem}
          className="relative flex items-start gap-3 py-1.5"
        >
          {/* Timestamp */}
          <span className="w-[60px] shrink-0 pt-0.5 text-right font-mono text-[10.5px] uppercase tracking-[0.12em] text-subtle tabular-nums">
            {e.at}
          </span>

          {/* Node */}
          <span
            className={cn(
              "relative z-10 mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
              tone === "danger"
                ? "border-danger-border bg-card-warm"
                : "border-success-border bg-card-warm",
            )}
          >
            {e.icon ? (
              <e.icon
                className={cn(
                  "size-2",
                  tone === "danger" ? "text-danger-fg" : "text-success-fg",
                )}
                strokeWidth={2.4}
              />
            ) : (
              <span
                className={cn(
                  "size-1 rounded-full",
                  tone === "danger" ? "bg-danger-fg" : "bg-success-fg",
                )}
              />
            )}
          </span>

          {/* What */}
          <span className="pt-0 text-[13px] leading-[1.4] text-ink-warm">
            {e.what}
          </span>
        </motion.li>
      ))}
    </motion.ol>
  );
}

function StatBlock({
  label,
  value,
  tone,
  strikethrough,
}: {
  label: string;
  value: string;
  tone: "danger" | "success";
  strikethrough?: boolean;
}) {
  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em]",
          tone === "danger" ? "text-danger-fg" : "text-success-fg",
        )}
      >
        {tone === "danger" ? (
          <Clock className="size-3" strokeWidth={2} />
        ) : (
          <Timer className="size-3" strokeWidth={2} />
        )}
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-serif text-[44px] font-medium leading-none tabular-nums",
          tone === "danger" ? "text-danger-fg" : "text-success-fg",
          strikethrough && "line-through decoration-2",
        )}
      >
        {value}
      </div>
    </div>
  );
}
