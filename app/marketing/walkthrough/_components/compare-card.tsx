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

// Compare cards, marketing-redesign edition. Two stitched cards per beat,
// each unfolds in three deliberate acts (after the takeover slate):
//
//   ACT 1: SLATE   — full-frame takeover. "Now" or "With Fluxora" as the
//                   giant title, the moment's topic as italic subtext.
//                   Sets the scene. Slides up and dissolves at 2.8s.
//
//   ACT 2: HOOK    — the headline NUMBER lands first, centered and huge:
//                   "Now takes 25 min" or "With Fluxora · only 4 sec".
//                   The visitor sees the time hit BEFORE the explanation.
//                   This is the "current problems" / "what if?" beat.
//
//   ACT 3: PROCESS — only now do we show the WHY. The Now card cascades
//                   4-5 tool tiles (the chaos that produces the 25 min).
//                   The With Fluxora card mounts one panel with check-row
//                   actions (the single screen that produces the 4 sec).
//                   Voiceover closes each card; With Fluxora gets a green
//                   callout as the final punctuation.
//
// The vertical top-to-bottom layout (header → hook → process → footer)
// mirrors how the visitor should read the story: scene → hit → reason.

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

      <div className="relative flex flex-1 flex-col px-10 pb-6">
        {/* HOOK — the problem as a single number. Lands right after the
            slate clears, BEFORE the process tiles. The visitor sees the
            time hit first; the chaos below is the explanation. */}
        <HookStat
          tone="danger"
          label="Now takes"
          value={compare.before.stat.value}
          hint={compare.before.statHint}
          icon={Clock}
        />

        {/* PROCESS — the chaos that produces the number above. Tools
            cascade in 0.6s apart starting at 4.5s, AFTER the visitor has
            had ~1 second to absorb the stat. */}
        <div className="mt-5 flex-1">
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 5.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-subtle"
          >
            What&apos;s open on your desk
          </motion.p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            {compare.before.tools.map((t, idx) => (
              <ToolTile
                key={t.label}
                icon={t.icon}
                label={t.label}
                badge={t.badge}
                // First tile lands 5.5s in — AFTER the hook stat has
                // punched in (4.0s) and breathed for ~1.5s. Then each
                // subsequent tile lands 0.6s later.
                delay={5.5 + idx * 0.6}
                askew={idx % 2 === 0}
              />
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              // Lands AFTER all tool tiles. For 5 tools at 0.6s stagger
              // starting at 5.5s: last tile = 5.5 + 4*0.6 = 7.9s. Add a
              // 0.4s reading buffer before the voiceover fades in.
              delay: 5.5 + compare.before.tools.length * 0.6 + 0.4,
              duration: 0.9,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="mt-5 max-w-[640px] font-serif text-[16px] italic leading-snug text-ink-warm md:text-[18px]"
          >
            &ldquo;{compare.before.voiceover}&rdquo;
          </motion.p>
        </div>

        <div className="flex items-center justify-between border-t-2 border-dashed border-danger-border/40 pt-3 text-[10.5px] uppercase tracking-[0.18em] text-subtle">
          <span className="font-mono">
            {compare.before.tools.length} systems · alt-tab fatigue
          </span>
          <span className="font-mono">what if? · with Fluxora →</span>
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

      <div className="relative flex flex-1 flex-col px-10 pb-6">
        {/* HOOK — the answer. "With Fluxora · 4 sec" lands first. The
            visitor sees the relief before the explanation. */}
        <HookStat
          tone="success"
          label="With Fluxora · only"
          value={compare.after.stat.value}
          hint={compare.after.statHint}
          icon={Timer}
        />

        {/* PROCESS — the single panel that produces the number above. */}
        <div className="mt-5 flex-1">
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 5.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-success-fg"
          >
            One tool · one moment
          </motion.p>
          <FluxoraPanel actions={compare.after.actions} />

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              // Panel mounts at 5.5s. delayChildren 0.4 + stagger 0.6 →
              // last (4th) action lands at 5.5 + 0.4 + 3*0.6 = 7.7s.
              // Voiceover fades in shortly after.
              delay: 8.1,
              duration: 0.9,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="mt-4 max-w-[640px] font-serif text-[16px] italic leading-snug text-ink-warm md:text-[18px]"
          >
            &ldquo;{compare.after.voiceover}&rdquo;
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            // Final punctuation — closes the beat at 9.6s after the
            // voiceover (8.1s) has had time to read.
            delay: 9.6,
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="flex items-center gap-2.5 rounded-lg border border-success-border/60 bg-success-bg/40 px-3 py-2"
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
      // Panel mounts 5.5s in — AFTER the hook stat has punched in (4.0s)
      // and had ~1.5s to breathe. Matches the Now card's first tool tile
      // so both cards' processes start at the same beat.
      transition={{ duration: 0.7, delay: 5.5, ease: [0.22, 1, 0.36, 1] }}
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
// HookStat — the headline number, displayed FIRST after the slate clears
// =========================================================================
// Centered banner that takes the spotlight at the top of the card. Three
// staggered beats:
//
//   3.9s   small label fades in ("Now takes" / "With Fluxora · only")
//   4.0s   HUGE value springs in (the punchline number)
//   4.5s   small hint fades in (e.g. "+ 14 alt-tabs", "1 click")
//
// By 5.0s the hook is fully landed. The process tiles / Fluxora panel
// then start cascading in at 5.5s — visitor first sees the WHAT (the
// number), then the WHY (the chaos or the one panel that produces it).
function HookStat({
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
    <div className="flex flex-col items-center text-center">
      {/* Small uppercase label — sets context for the number */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3.9, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.22em]",
          tone === "danger" ? "text-danger-fg" : "text-success-fg",
        )}
      >
        <Icon className="size-3" strokeWidth={2.2} />
        {label}
      </motion.div>

      {/* HUGE value — the punchline */}
      <motion.div
        initial={{ opacity: 0, scale: 0.72 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          delay: 4.0,
          type: "spring",
          stiffness: 220,
          damping: 18,
        }}
        className={cn(
          "mt-1 font-serif font-medium leading-[0.95] tracking-tight tabular-nums",
          "text-[72px] md:text-[108px]",
          tone === "danger" ? "text-danger-fg" : "text-success-fg",
        )}
      >
        {value}
      </motion.div>

      {/* Hint — small detail under the value */}
      {hint ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 4.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "mt-2 font-mono text-[10.5px] uppercase tracking-[0.16em]",
            tone === "danger" ? "text-danger-fg/75" : "text-success-fg/85",
          )}
        >
          {hint}
        </motion.div>
      ) : null}
    </div>
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
  // from a small starting point. By the time the slate is fully gone (~3.8s)
  // the header is in place and grounds the visitor as a recap of what the
  // slate just announced.
  return (
    <div className="relative flex items-start justify-between px-10 pb-5 pt-9">
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{
          delay: 3.9,
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
          delay: 3.7,
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
// Cinematic title card that owns the entire 640px frame for ~3.8s before
// sliding up and dissolving away. Stack (top → bottom):
//
//   chapter pill    e.g. "STEP 1 OF 5"
//   BIG TITLE       e.g. "With Fluxora"  ← the takeover word
//   accent line     drawn left-to-right
//   subtext         the moment's topic ("A supplier PDF lands at 8:42")
//
// The slate's background is an opaque tinted radial — pure red for Now,
// pure green for With Fluxora — so the comparison underneath is hidden
// until the slate slides off-screen. Timing (tuned so the SUBTEXT gets a
// clean ~1.5s of read time after fading in; earlier 2.8s slate only gave
// the subtext ~0.5s before slide-out):
//
//   0.0 → 0.05  pre-roll
//   0.05 → 0.45 chapter pill drops in
//   0.2 → 0.85  title scales up
//   0.75 → 1.15 accent line sweeps
//   1.05 → 1.55 subtext fades in (smaller-distance slide, faster fade)
//   1.55 → 3.30 HOLD (visitor reads the topic — ~1.75s)
//   3.30 → 3.80 slate slides up + fades out, revealing the comparison
//
// By 3.8s the slate is gone and the card's header / hook / process take
// over (header begins cross-fading in ~0.1s before slate exit).
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
      // begins fading in around 3.7s — slightly before the slate leaves,
      // for a clean cross-fade).
      className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center px-12"
      style={{ background: slateBackground }}
      initial={{ opacity: 1, y: 0 }}
      animate={{
        opacity: [1, 1, 0],
        y: [0, 0, -36],
      }}
      transition={{
        // 3.8s total: 3.3s of held visibility (subtext gets ~1.5-1.75s of
        // clean read time inside the hold) + 0.5s slide-up/fade exit.
        duration: 3.8,
        times: [0, 0.868, 1],
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {/* Chapter pill — drops in from above (0.05 → 0.45s) */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] shadow-sm",
          pillBorder,
        )}
      >
        <Icon className="size-3" strokeWidth={2.2} />
        {step}
      </motion.div>

      {/* The big word — scales up and settles (0.2 → 0.85s) */}
      <motion.h2
        initial={{ opacity: 0, scale: 0.82, letterSpacing: "0.04em" }}
        animate={{ opacity: 1, scale: 1, letterSpacing: "-0.02em" }}
        transition={{ duration: 0.65, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
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

      {/* Accent line — sweeps from center outward (0.75 → 1.15s) */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.75, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "mt-6 h-[3px] w-28 origin-center rounded-full",
          accentColor,
        )}
      />

      {/* Subtext — the moment's topic, in italic serif. Lands earlier
          (1.05s) and the slate holds longer so this gets ~1.75s of clean
          read time before the slide-out begins (3.3s). */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.05, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6 max-w-[600px] text-center font-serif italic leading-snug text-ink-warm text-[22px] md:text-[26px]"
      >
        {topic}
      </motion.p>
    </motion.div>
  );
}
