"use client";

import { motion, type Variants } from "motion/react";
import {
  Check,
  Clock,
  FileSpreadsheet,
  Sparkles,
  Timer,
} from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { cn } from "@/lib/utils";

// Compare cards, marketing-redesign edition. Two stitched cards per beat:
//
//   Now           → visual chaos: a row of 4-5 tool tiles, each with a
//                   timestamp badge. The eye reads "5 systems open, time
//                   piling up."
//
//   With Fluxora  → visual calm: ONE Fluxora panel with check-row actions.
//                   ONE moment, one tool.
//
// Both cards have a HUGE time stat as the right-side focal point so the
// real comparison (25 min vs 4 sec) reads in under half a second.
//
// Each card opens with a FULL-FRAME TAKEOVER slate — a cinematic title
// card carrying the chapter label, the giant "Now" / "With Fluxora" phrase,
// and the moment's topic as subtext. The slate owns the entire 640px frame
// for ~2.4s, then slides up and dissolves to reveal the comparison.

type IconType = React.ComponentType<{
  className?: string;
  strokeWidth?: number;
}>;

export type CompareStep = {
  step: string;
  topic: string;
  before: BeforePayload;
  after: AfterPayload;
};

export type BeforePayload = {
  /** 4-5 tool tiles representing what's "open" on the operator's desk. */
  tools: { icon: IconType; label: string; badge?: string }[];
  /** Single sentence shown beneath the tools — the "chaos summary". */
  voiceover: string;
  /** Big stat at the right-side focal point (e.g. "25 min"). */
  stat: { value: string; label: string };
  /** Small detail under the stat (e.g. "+ 14 alt-tabs"). */
  statHint?: string;
};

export type AfterPayload = {
  /** 3-4 actions Fluxora performs inside one panel. */
  actions: { icon: IconType; label: string; meta?: string }[];
  /** One-line voiceover under the panel. */
  voiceover: string;
  /** Big stat at the right (e.g. "4 sec"). */
  stat: { value: string; label: string };
  statHint?: string;
  /** Final takeaway shown as a green callout at the bottom. */
  callout: string;
};

// =========================================================================
// BeforeCard
// =========================================================================
export function BeforeCard({ compare }: { compare: CompareStep }) {
  return (
    <motion.div
      key={`before-${compare.step}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7 }}
      className="relative flex h-full flex-col bg-page"
    >
      <Backdrop tone="danger" />

      {/* Full-frame takeover slate — owns the screen for ~2.4s, then slides
          up and dissolves to reveal the comparison underneath. */}
      <TitleReveal
        tone="danger"
        label="Now"
        step={compare.step}
        topic={compare.topic}
        icon={FileSpreadsheet}
      />

      <CardHeader
        tone="danger"
        chapterLabel={compare.step}
        sideLabel="Now"
        topic={compare.topic}
        icon={FileSpreadsheet}
      />

      <div className="relative flex flex-1 flex-col px-10 pb-8">
        <div className="grid flex-1 grid-cols-[1.6fr_1fr] items-center gap-8">
          {/* Tool chaos */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
              What&apos;s open on your desk
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              {compare.before.tools.map((t, idx) => (
                <ToolTile
                  key={t.label}
                  icon={t.icon}
                  label={t.label}
                  badge={t.badge}
                  // First tile lands 2.9s in — AFTER the big TitleReveal
                  // has finished (~2.0s) and the header has settled
                  // (~2.3s). Then each subsequent tile lands 0.6s later.
                  // 0.6s ≈ reading time for "Inbox · 8:42".
                  delay={2.9 + idx * 0.6}
                  askew={idx % 2 === 0}
                />
              ))}
            </div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                // Lands AFTER all tool tiles. For 5 tools at 0.6s stagger
                // starting at 2.9s: last tile = 2.9 + 4*0.6 = 5.3s. Add
                // ~0.5s reading buffer before voiceover starts fading in.
                delay: 2.9 + compare.before.tools.length * 0.6 + 0.5,
                duration: 1.0,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-5 max-w-[420px] font-serif text-[18px] italic leading-snug text-ink-warm md:text-[20px]"
            >
              &ldquo;{compare.before.voiceover}&rdquo;
            </motion.p>
          </div>

          {/* Hero stat — the focal point */}
          <HeroStat
            tone="danger"
            label={compare.before.stat.label}
            value={compare.before.stat.value}
            hint={compare.before.statHint}
            icon={Clock}
          />
        </div>

        <div className="mt-6 flex items-center justify-between border-t-2 border-dashed border-danger-border/40 pt-3 text-[10.5px] uppercase tracking-[0.18em] text-subtle">
          <span className="font-mono">
            {compare.before.tools.length} systems · alt-tab fatigue
          </span>
          <span className="font-mono">
            up next · with Fluxora →
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// =========================================================================
// AfterCard
// =========================================================================
export function AfterCard({ compare }: { compare: CompareStep }) {
  return (
    <motion.div
      key={`after-${compare.step}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7 }}
      className="relative flex h-full flex-col bg-page"
    >
      <Backdrop tone="success" />

      {/* Full-frame takeover slate — owns the screen for ~2.4s, then slides
          up and dissolves to reveal the comparison underneath. */}
      <TitleReveal
        tone="success"
        label="With Fluxora"
        step={compare.step}
        topic={compare.topic}
        icon={Sparkles}
      />

      <CardHeader
        tone="success"
        chapterLabel={compare.step}
        sideLabel="With Fluxora"
        topic={compare.topic}
        icon={Sparkles}
      />

      <div className="relative flex flex-1 flex-col px-10 pb-8">
        <div className="grid flex-1 grid-cols-[1.6fr_1fr] items-center gap-8">
          {/* Fluxora panel */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-success-fg">
              One tool · one moment
            </p>
            <FluxoraPanel actions={compare.after.actions} />

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                // Panel mounts at 2.9s (matches Before's first tool tile,
                // after TitleReveal). delayChildren 0.4 + stagger 0.6 →
                // last (4th) action lands at 2.9 + 0.4 + 3*0.6 = 5.1s.
                // Voiceover fades in shortly after.
                delay: 5.8,
                duration: 1.0,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-4 max-w-[420px] font-serif text-[18px] italic leading-snug text-ink-warm md:text-[20px]"
            >
              &ldquo;{compare.after.voiceover}&rdquo;
            </motion.p>
          </div>

          {/* Hero stat — the focal point */}
          <HeroStat
            tone="success"
            label={compare.after.stat.label}
            value={compare.after.stat.value}
            hint={compare.after.statHint}
            icon={Timer}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            // Callout = final punctuation. Voiceover lands at 5.8s,
            // stat lands at 8.3s, callout closes the beat at 9.6s.
            delay: 9.6,
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mt-6 flex items-center gap-2.5 rounded-lg border border-success-border/60 bg-success-bg/40 px-3 py-2"
        >
          <Check
            className="size-3.5 shrink-0 text-success-fg"
            strokeWidth={2.6}
          />
          <span className="text-[13px] font-medium text-success-fg">
            {compare.after.callout}
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}

// =========================================================================
// Tool tile (Before)
// =========================================================================
function ToolTile({
  icon: Icon,
  label,
  badge,
  delay,
  askew,
}: {
  icon: IconType;
  label: string;
  badge?: string;
  delay: number;
  askew?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, rotate: askew ? -3 : 2 }}
      animate={{ opacity: 1, y: 0, rotate: askew ? -1 : 1 }}
      // Slow enough that each tile reads as a separate beat. Earlier
      // 0.45s+0.1s-stagger blurred together; new 0.6s+0.22s gives the
      // visitor time to register each tool one at a time.
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex flex-col items-center gap-1 rounded-lg border border-danger-border/40 bg-card-warm px-3 py-2.5 shadow-sm"
      style={{ minWidth: 84 }}
    >
      <div className="flex size-9 items-center justify-center rounded-md bg-danger-bg/50 text-danger-fg">
        <Icon className="size-[18px]" strokeWidth={1.8} />
      </div>
      <div className="text-center text-[10.5px] font-medium text-ink">
        {label}
      </div>
      {badge ? (
        <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-danger-fg">
          {badge}
        </div>
      ) : null}
    </motion.div>
  );
}

// =========================================================================
// Fluxora panel (After)
// =========================================================================
function FluxoraPanel({ actions }: { actions: AfterPayload["actions"] }) {
  const list: Variants = {
    hidden: {},
    show: {
      // 0.6s between actions = roughly one reading beat. delayChildren
      // 0.4s relative to the panel mount.
      transition: { staggerChildren: 0.6, delayChildren: 0.4 },
    },
  };
  const item: Variants = {
    hidden: { opacity: 0, x: -12 },
    show: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
    },
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      // Panel mounts 2.9s in — after the TitleReveal sequence + header
      // settle. Matches the Before card's first tool tile.
      transition={{ duration: 0.7, delay: 2.9, ease: [0.22, 1, 0.36, 1] }}
      className="mt-3 overflow-hidden rounded-2xl border-2 border-success-border/70 bg-card-warm shadow-[0_22px_50px_-25px_rgba(74,107,47,0.4)]"
    >
      {/* Mini app shell header */}
      <div className="flex items-center gap-2 border-b border-success-border/40 bg-success-bg/30 px-4 py-2.5">
        <Logomark size={18} />
        <span className="font-serif text-[13px] font-medium text-ink">
          Fluxora
        </span>
        <span className="text-subtle">·</span>
        <span className="font-mono text-[11px] text-subtle">workspace</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success-fg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-card-warm">
          <Sparkles className="size-2.5" strokeWidth={2.4} />
          working
        </span>
      </div>

      {/* Action checklist */}
      <motion.ul
        variants={list}
        initial="hidden"
        animate="show"
        className="divide-y divide-success-border/30 px-4 py-1.5"
      >
        {actions.map((a) => (
          <motion.li
            key={a.label}
            variants={item}
            className="flex items-center gap-3 py-2.5"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-fg">
              <Check className="size-3.5" strokeWidth={2.6} />
            </div>
            <a.icon
              className="size-4 shrink-0 text-success-fg"
              strokeWidth={1.8}
            />
            <span className="flex-1 text-[13px] font-medium text-ink">
              {a.label}
            </span>
            {a.meta ? (
              <span className="font-mono text-[10.5px] text-subtle">
                {a.meta}
              </span>
            ) : null}
          </motion.li>
        ))}
      </motion.ul>
    </motion.div>
  );
}

// =========================================================================
// Hero stat — the focal point of each card
// =========================================================================
function HeroStat({
  tone,
  label,
  value,
  hint,
  icon: Icon,
}: {
  tone: "danger" | "success";
  label: string;
  value: string;
  hint?: string;
  icon: IconType;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        // The big number is the punchline. Lands AFTER the voiceover has
        // had ~2s of reading time. Voiceover Before = 6.4s, voiceover
        // After = 5.8s; stat lands at 8.3s on both for a consistent beat.
        delay: 8.3,
        type: "spring",
        stiffness: 200,
        damping: 20,
      }}
      className="flex flex-col items-end text-right"
    >
      <div
        className={cn(
          "flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em]",
          tone === "danger" ? "text-danger-fg" : "text-success-fg",
        )}
      >
        <Icon className="size-3" strokeWidth={2} />
        {label}
      </div>
      <div
        className={cn(
          "font-serif text-[88px] font-medium leading-[0.95] tracking-tight tabular-nums md:text-[112px]",
          tone === "danger"
            ? "text-danger-fg line-through decoration-[3px]"
            : "text-success-fg",
        )}
      >
        {value}
      </div>
      {hint ? (
        <div
          className={cn(
            "mt-1 font-mono text-[10.5px] uppercase tracking-[0.16em]",
            tone === "danger" ? "text-danger-fg/70" : "text-success-fg/80",
          )}
        >
          {hint}
        </div>
      ) : null}
    </motion.div>
  );
}

// =========================================================================
// Backdrop + header
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
        background: `radial-gradient(ellipse 80% 60% at 50% 35%, color-mix(in oklch, ${tint} 55%, transparent) 0%, transparent 70%)`,
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
  icon: IconType;
}) {
  const sidePill =
    tone === "danger"
      ? "border-danger-border/70 bg-danger-bg/50 text-danger-fg"
      : "border-success-border/70 bg-success-bg/50 text-success-fg";

  // Header lands as the takeover slate is finishing its slide-up. The
  // chapter label + topic glide in from the left; the side pill scales in
  // from a small starting point. By the time the slate is fully gone (~2.8s)
  // the header is in place and grounds the visitor as a recap of what the
  // slate just announced.
  return (
    <div className="relative flex items-start justify-between px-10 pb-5 pt-9">
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{
          delay: 2.9,
          duration: 0.55,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
          {chapterLabel}
        </div>
        <h2 className="mt-2 font-serif text-[24px] font-medium leading-tight tracking-tight text-ink md:text-[30px]">
          {topic}
        </h2>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          delay: 2.7,
          type: "spring",
          stiffness: 280,
          damping: 22,
        }}
        className={cn(
          "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5",
          sidePill,
        )}
      >
        <Icon className="size-3.5" strokeWidth={2.2} />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em]">
          {sideLabel}
        </span>
      </motion.div>
    </div>
  );
}

// =========================================================================
// TitleReveal — full-frame takeover slate
// =========================================================================
// Cinematic title card that owns the entire 640px frame for ~2.8s before
// sliding up and dissolving away. Stack (top → bottom):
//
//   chapter pill    e.g. "STEP 1 OF 5"
//   BIG TITLE       e.g. "Before"     ← the takeover word
//   accent line     drawn left-to-right
//   subtext         the moment's topic ("A supplier PDF lands at 8:42")
//
// The slate's background is an opaque tinted radial — pure red for Before,
// pure green for After — so the comparison underneath is hidden until the
// slate slides off-screen. Timing:
//
//   0.0 → 0.1   pre-roll
//   0.1 → 0.6   chapter pill drops in
//   0.3 → 1.0   title scales up
//   0.9 → 1.4   accent line sweeps
//   1.3 → 1.9   subtext fades in
//   1.9 → 2.4   HOLD (visitor reads the topic)
//   2.4 → 2.8   slate slides up + fades out, revealing the comparison
//
// By 2.8s the slate is gone and the card's header/tiles take over.
function TitleReveal({
  tone,
  label,
  step,
  topic,
  icon: Icon,
}: {
  tone: "danger" | "success";
  label: string;
  step: string;
  topic: string;
  icon: IconType;
}) {
  const isDanger = tone === "danger";

  const slateBackground = isDanger
    ? "radial-gradient(ellipse 95% 70% at 50% 45%, color-mix(in oklch, var(--color-danger-bg) 92%, var(--color-page)) 0%, color-mix(in oklch, var(--color-danger-bg) 55%, var(--color-page)) 55%, var(--color-page) 100%)"
    : "radial-gradient(ellipse 95% 70% at 50% 45%, color-mix(in oklch, var(--color-success-bg) 92%, var(--color-page)) 0%, color-mix(in oklch, var(--color-success-bg) 55%, var(--color-page)) 55%, var(--color-page) 100%)";

  const titleColor = isDanger ? "text-danger-fg" : "text-success-fg";
  const accentColor = isDanger ? "bg-danger-fg" : "bg-success-fg";
  const pillBorder = isDanger
    ? "border-danger-border/70 bg-danger-bg/60 text-danger-fg"
    : "border-success-border/70 bg-success-bg/60 text-success-fg";

  return (
    <motion.div
      aria-hidden
      // The slate sits above the Backdrop and the card header (which
      // begins fading in around 2.7s — slightly before the slate leaves,
      // for a clean cross-fade).
      className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center px-12"
      style={{ background: slateBackground }}
      initial={{ opacity: 1, y: 0 }}
      animate={{
        opacity: [1, 1, 0],
        y: [0, 0, -36],
      }}
      transition={{
        duration: 2.8,
        times: [0, 0.86, 1],
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {/* Chapter pill — drops in from above */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] shadow-sm",
          pillBorder,
        )}
      >
        <Icon className="size-3" strokeWidth={2.2} />
        {step}
      </motion.div>

      {/* The big word — scales up and settles */}
      <motion.h2
        initial={{ opacity: 0, scale: 0.82, letterSpacing: "0.04em" }}
        animate={{ opacity: 1, scale: 1, letterSpacing: "-0.02em" }}
        transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "mt-6 text-center font-serif font-medium leading-[0.92]",
          // Sized so the longest label ("With Fluxora") fits inside the
          // 640px-tall, ~1000px-wide takeover slate without wrapping.
          "text-[64px] md:text-[108px]",
          titleColor,
        )}
        style={{
          textShadow: isDanger
            ? "0 12px 40px rgba(139, 52, 21, 0.28)"
            : "0 12px 40px rgba(74, 107, 47, 0.28)",
        }}
      >
        {label}
      </motion.h2>

      {/* Accent line — sweeps from center outward */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.55, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "mt-6 h-[3px] w-28 origin-center rounded-full",
          accentColor,
        )}
      />

      {/* Subtext — the moment's topic, in italic serif */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.3, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6 max-w-[600px] text-center font-serif italic leading-snug text-ink-warm text-[22px] md:text-[26px]"
      >
        {topic}
      </motion.p>
    </motion.div>
  );
}
