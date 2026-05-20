"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  type Variants,
  type Transition as MotionTransition,
} from "motion/react";
import {
  ArrowRight,
  Boxes,
  Check,
  Database,
  FileText,
  Package,
  Receipt,
  RotateCw,
  ScanLine,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { cn } from "@/lib/utils";

import { TransitionBackdrop } from "./backdrop";
import { useReel } from "./reel-state";
import type { ExplainerVisual, InterstitialIcon } from "./types";

// motion-powered transition layer. Four flavors:
//
//   - OpeningSplash — staggered reveal, spring entry, fade exit.
//   - ChapterCard — full-frame card morphs into a top pill via shared layoutId.
//   - Interstitial — small spring-pop card.
//   - Explainer — full-frame story card with sequenced child reveals.
//   - OutroSplash — closing card with sequenced stat reveal.
//
// AnimatePresence on the TransitionLayer ensures exits play out before the
// next transition mounts.

const easeOut = [0.16, 1, 0.3, 1] as const; // material easing — used for non-spring transitions
const SPRING_GENTLE: MotionTransition = { type: "spring", stiffness: 200, damping: 28 };
const SPRING_POP: MotionTransition = { type: "spring", stiffness: 300, damping: 22 };

export function TransitionLayer() {
  const { state } = useReel();
  const t = state.transition;

  return (
    <AnimatePresence mode="wait">
      {t.kind === "splash" && <OpeningSplash key="splash" />}
      {t.kind === "outro" && <OutroSplash key="outro" />}
      {t.kind === "chapter" && (
        <ChapterCard key={`chapter-${t.index}`} chapter={t} />
      )}
      {t.kind === "explainer" && (
        <Explainer key={`explainer-${t.title}`} explainer={t} />
      )}
      {t.kind === "interstitial" && (
        <Interstitial
          key={`interstitial-${t.title}`}
          icon={t.icon}
          title={t.title}
          body={t.body}
        />
      )}
    </AnimatePresence>
  );
}

// ---------- Opening splash ----------
const splashContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.18, delayChildren: 0.1, duration: 0.4 },
  },
  exit: { opacity: 0, transition: { duration: 0.45, ease: easeOut } },
};

const splashChild: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: SPRING_GENTLE },
  exit: { opacity: 0, y: -8, transition: { duration: 0.3 } },
};

function OpeningSplash() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-page/95 backdrop-blur-sm"
      initial="hidden"
      animate="show"
      exit="exit"
      variants={splashContainer}
    >
      <TransitionBackdrop tone="forest" density="high" />
      <motion.div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at center, color-mix(in oklch, var(--color-forest-tint) 60%, transparent) 0%, transparent 70%)",
        }}
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8, ease: easeOut }}
      />

      <div className="relative flex flex-col items-center gap-7 px-8 text-center">
        <motion.div
          className="flex items-center gap-2 rounded-full border border-border-default bg-card-warm px-3 py-1.5"
          variants={splashChild}
        >
          <Logomark size={20} />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            Fluxora
          </span>
          <span className="text-subtle">·</span>
          <span className="text-[11px] text-ink-warm">Watch</span>
        </motion.div>

        <motion.div
          className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-forest-mid"
          variants={splashChild}
        >
          <span className="size-1 rounded-full bg-forest-mid" />
          <span>PDF invoice import</span>
          <span className="size-1 rounded-full bg-forest-mid" />
        </motion.div>

        <motion.h1
          className="max-w-[680px] font-serif text-[42px] font-medium leading-[1.05] tracking-tight text-ink md:text-[56px]"
          variants={splashChild}
        >
          From PDF on a desk
          <br />
          to stock on the shelf —
          <br />
          <span className="text-forest-mid">in under a minute.</span>
        </motion.h1>

        <motion.p
          className="max-w-[520px] text-[14px] leading-[1.55] text-subtle md:text-[15px]"
          variants={splashChild}
        >
          Drop a supplier invoice. AI reads it, matches it to your catalog, and
          posts a bill that updates stock and cost — automatically.
        </motion.p>

        <motion.div
          className="flex items-center gap-2 text-[11px] text-subtle"
          variants={splashChild}
        >
          <span className="relative flex size-2">
            <motion.span
              className="absolute inset-0 rounded-full bg-forest-mid/40"
              animate={{ scale: [1, 1.8, 1.8], opacity: [0.7, 0, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: easeOut }}
            />
            <span className="relative size-2 rounded-full bg-forest-mid" />
          </span>
          <span className="font-mono uppercase tracking-[0.12em]">
            Demo starting
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ---------- Chapter card → pill morph ----------
function ChapterCard({
  chapter,
}: {
  chapter: { index: number; total: number; title: string; subtitle: string };
}) {
  // Two phases: full-frame hero card → top pill. `layoutId` on the card +
  // pill containers means motion smoothly interpolates the size, position,
  // and shape between them. The inner content fades through with its own
  // AnimatePresence.
  const [phase, setPhase] = useState<"hero" | "pill">("hero");
  useEffect(() => {
    const t = window.setTimeout(() => setPhase("pill"), 900);
    return () => window.clearTimeout(t);
  }, [chapter.index]);

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Dim backdrop only while in hero phase */}
      <AnimatePresence>
        {phase === "hero" && (
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-page/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </AnimatePresence>

      <motion.div
        layoutId={`chapter-card-${chapter.index}`}
        layout
        className={cn(
          "absolute flex items-center bg-card-warm/95 backdrop-blur shadow-2xl",
          phase === "hero"
            ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 gap-5 rounded-2xl border border-border-default px-8 py-6"
            : "left-1/2 top-6 -translate-x-1/2 gap-3 rounded-full border border-border-default px-4 py-2 shadow-lg",
        )}
        transition={SPRING_GENTLE}
      >
        {phase === "hero" ? (
          <motion.div
            key="hero"
            className="flex items-center gap-5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: easeOut, delay: 0.1 }}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                Step
              </span>
              <span className="font-serif text-[40px] font-medium leading-none text-forest-mid">
                {chapter.index}
              </span>
              <span className="font-mono text-[10px] text-subtle">
                of {chapter.total}
              </span>
            </div>
            <div className="h-12 w-px bg-border-default" />
            <div className="flex flex-col gap-1">
              <h2 className="font-serif text-[26px] font-medium leading-tight tracking-tight text-ink">
                {chapter.title}
              </h2>
              <p className="max-w-[360px] text-[13px] text-subtle">
                {chapter.subtitle}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="pill"
            className="flex items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-forest-mid text-[11px] font-bold text-card-warm">
              {chapter.index}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
                Step {chapter.index} of {chapter.total}
              </span>
              <span className="text-subtle">·</span>
              <span className="text-[13px] font-medium text-ink">
                {chapter.title}
              </span>
            </div>
            <span className="text-[12px] text-subtle">— {chapter.subtitle}</span>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ---------- Interstitial ----------
function Interstitial({
  icon,
  title,
  body,
}: {
  icon: InterstitialIcon;
  title: string;
  body: string;
}) {
  const Icon = ICON_BY_KIND[icon];
  const tone = TONE_BY_KIND[icon];

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-page/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      />
      <motion.div
        className="relative flex items-center gap-4 rounded-2xl border bg-card-warm/95 px-6 py-4 shadow-xl backdrop-blur"
        style={{ borderColor: tone.border }}
        initial={{ opacity: 0, scale: 0.85, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -8 }}
        transition={SPRING_POP}
      >
        <motion.div
          className="flex size-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: tone.bg, color: tone.fg }}
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ ...SPRING_POP, delay: 0.1 }}
        >
          <Icon className="size-5" strokeWidth={2.2} />
        </motion.div>
        <div className="flex flex-col gap-0.5">
          <motion.h3
            className="font-serif text-[18px] font-medium leading-tight text-ink"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.2, ease: easeOut }}
          >
            {title}
          </motion.h3>
          <motion.p
            className="max-w-[420px] text-[12.5px] text-subtle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3, ease: easeOut }}
          >
            {body}
          </motion.p>
        </div>
      </motion.div>
    </motion.div>
  );
}

const ICON_BY_KIND: Record<
  InterstitialIcon,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  check: Check,
  sparkle: Sparkles,
  package: Package,
  scan: ScanLine,
};

const TONE_BY_KIND: Record<
  InterstitialIcon,
  { bg: string; fg: string; border: string }
> = {
  check: {
    bg: "var(--color-success-bg)",
    fg: "var(--color-success-fg)",
    border: "color-mix(in oklch, var(--color-success-fg) 30%, transparent)",
  },
  sparkle: {
    bg: "var(--color-forest-tint)",
    fg: "var(--color-forest)",
    border: "color-mix(in oklch, var(--color-forest-mid) 30%, transparent)",
  },
  package: {
    bg: "color-mix(in oklch, var(--color-forest-tint) 70%, white)",
    fg: "var(--color-forest-mid)",
    border: "var(--color-border-default)",
  },
  scan: {
    bg: "color-mix(in oklch, var(--color-warning-bg) 80%, white)",
    fg: "var(--color-warning-fg)",
    border: "color-mix(in oklch, var(--color-warning-fg) 30%, transparent)",
  },
};

// ---------- Outro splash ----------
const outroContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.18, delayChildren: 0.1 },
  },
  exit: { opacity: 0, transition: { duration: 0.4 } },
};

const outroChild: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: SPRING_GENTLE },
};

function OutroSplash() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-page/95"
      initial="hidden"
      animate="show"
      exit="exit"
      variants={outroContainer}
    >
      <TransitionBackdrop tone="success" density="high" />
      <motion.div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at center, color-mix(in oklch, var(--color-success-bg) 70%, transparent) 0%, transparent 70%)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: easeOut }}
      />

      <div className="relative flex flex-col items-center gap-6 px-8 text-center">
        <motion.div
          className="flex size-12 items-center justify-center rounded-full bg-success-bg text-success-fg"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ ...SPRING_POP, delay: 0.1 }}
        >
          <Check className="size-6" strokeWidth={2.4} />
        </motion.div>

        <motion.h1
          className="max-w-[640px] font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[44px]"
          variants={outroChild}
        >
          One PDF, posted.
          <br />
          <span className="text-forest-mid">Stock is now current.</span>
        </motion.h1>

        <motion.div
          className="mt-2 flex items-center gap-6"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.12, delayChildren: 0.6 } },
          }}
        >
          <StatPill icon={FileText} label="1 invoice" />
          <StatDivider />
          <StatPill icon={Sparkles} label="2 aliases learned" />
          <StatDivider />
          <StatPill icon={TrendingUp} label="9 lines posted" />
        </motion.div>

        <motion.div
          className="mt-3 flex flex-col items-center gap-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_GENTLE, delay: 1.1 }}
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

function StatPill({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
}) {
  return (
    <motion.div
      className="flex items-center gap-2"
      variants={{
        hidden: { opacity: 0, y: 6 },
        show: { opacity: 1, y: 0, transition: SPRING_GENTLE },
      }}
    >
      <Icon className="size-3.5 text-forest-mid" strokeWidth={1.8} />
      <span className="text-[13px] font-medium text-ink">{label}</span>
    </motion.div>
  );
}

function StatDivider() {
  return (
    <motion.span
      className="text-border-default"
      variants={{
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { duration: 0.3 } },
      }}
    >
      ·
    </motion.span>
  );
}

// ---------- Explainer ----------
const explainerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.18, delayChildren: 0.15 },
  },
  exit: { opacity: 0, transition: { duration: 0.4 } },
};

const explainerChild: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: SPRING_GENTLE },
};

function Explainer({
  explainer,
}: {
  explainer: {
    eyebrow: string;
    title: string;
    body: string;
    visual: ExplainerVisual;
  };
}) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-page/95 backdrop-blur-sm"
      initial="hidden"
      animate="show"
      exit="exit"
      variants={explainerContainer}
    >
      <TransitionBackdrop tone="forest" density="medium" />
      <motion.div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 50% at center, color-mix(in oklch, var(--color-forest-tint) 55%, transparent) 0%, transparent 70%)",
        }}
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: easeOut }}
      />

      <div className="relative flex flex-col items-center gap-7 px-8 text-center">
        <motion.div variants={explainerChild}>
          <ExplainerVisualGlyph kind={explainer.visual} />
        </motion.div>

        <motion.div
          className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-forest-mid"
          variants={explainerChild}
        >
          <span className="size-1 rounded-full bg-forest-mid" />
          <span>{explainer.eyebrow}</span>
          <span className="size-1 rounded-full bg-forest-mid" />
        </motion.div>

        <motion.h2
          className="max-w-[680px] font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[44px]"
          variants={explainerChild}
        >
          {explainer.title}
        </motion.h2>

        <motion.p
          className="max-w-[540px] text-[14px] leading-[1.6] text-subtle md:text-[15px]"
          variants={explainerChild}
        >
          {explainer.body}
        </motion.p>
      </div>
    </motion.div>
  );
}

function ExplainerVisualGlyph({ kind }: { kind: ExplainerVisual }) {
  const tile: MotionTransition = { ...SPRING_POP, delay: 0.05 };
  switch (kind) {
    case "pdf-to-stock":
      return (
        <motion.div
          className="flex items-center gap-3"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
          }}
        >
          <GlyphTileMotion icon={FileText} tone="warn" />
          <GlyphArrowMotion />
          <GlyphTileMotion icon={Sparkles} tone="forest" />
          <GlyphArrowMotion />
          <GlyphTileMotion icon={Boxes} tone="success" />
        </motion.div>
      );
    case "ai-match":
      return (
        <motion.div
          className="flex items-center gap-3"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.15, delayChildren: 0.2 } },
          }}
        >
          <GlyphTileMotion icon={Sparkles} tone="forest" />
          <div className="flex flex-col gap-1.5">
            <CandidatePillMotion score={86} />
            <CandidatePillMotion score={71} muted />
          </div>
        </motion.div>
      );
    case "five-effects":
      return (
        <motion.div
          className="flex items-center gap-4"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
          }}
        >
          <GlyphTileMotion icon={Check} tone="success" />
          <GlyphArrowMotion />
          <div className="grid grid-cols-3 gap-1.5">
            <MiniDotMotion icon={Boxes} />
            <MiniDotMotion icon={TrendingUp} />
            <MiniDotMotion icon={Sparkles} />
            <MiniDotMotion icon={Receipt} />
            <MiniDotMotion icon={Package} />
            <motion.span className="block size-7" variants={miniDotVariant} />
          </div>
        </motion.div>
      );
    case "memory":
      return (
        <motion.div
          className="flex items-center gap-3"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
          }}
        >
          <GlyphTileMotion icon={Database} tone="forest" />
          <GlyphArrowMotion />
          <motion.div
            className="flex size-14 items-center justify-center rounded-2xl border border-border-default bg-success-bg text-success-fg shadow-sm"
            variants={glyphTileVariant}
            animate={{ rotate: [0, 360] }}
            transition={{
              rotate: { duration: 6, repeat: Infinity, ease: "linear" },
            }}
          >
            <RotateCw className="size-6" strokeWidth={1.6} />
          </motion.div>
        </motion.div>
      );
  }
}

const glyphTileVariant: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  show: { opacity: 1, scale: 1, transition: SPRING_POP },
};

function GlyphTileMotion({
  icon: Icon,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: "forest" | "success" | "warn";
}) {
  const palette = {
    forest: { bg: "var(--color-forest-tint)", fg: "var(--color-forest)" },
    success: { bg: "var(--color-success-bg)", fg: "var(--color-success-fg)" },
    warn: { bg: "var(--color-warning-bg)", fg: "var(--color-warning-fg)" },
  }[tone];
  return (
    <motion.div
      className="flex size-14 items-center justify-center rounded-2xl border border-border-default shadow-sm"
      style={{ background: palette.bg, color: palette.fg }}
      variants={glyphTileVariant}
    >
      <Icon className="size-6" strokeWidth={1.6} />
    </motion.div>
  );
}

function GlyphArrowMotion() {
  return (
    <motion.span
      className="inline-flex"
      variants={{
        hidden: { opacity: 0, x: -6 },
        show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: easeOut } },
      }}
    >
      <ArrowRight className="size-4 text-subtle" strokeWidth={1.6} />
    </motion.span>
  );
}

function CandidatePillMotion({
  score,
  muted = false,
}: {
  score: number;
  muted?: boolean;
}) {
  return (
    <motion.div
      className={cn(
        "flex items-center gap-2 rounded-[7px] border border-border-default bg-card px-2.5 py-1 text-[11px]",
        muted && "opacity-60",
      )}
      variants={{
        hidden: { opacity: 0, x: -8 },
        show: { opacity: muted ? 0.6 : 1, x: 0, transition: SPRING_GENTLE },
      }}
    >
      <span className="size-1.5 rounded-full bg-forest-mid" />
      <span className="text-ink">Suggested match</span>
      <span className="rounded bg-divider px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-subtle">
        {score}%
      </span>
    </motion.div>
  );
}

const miniDotVariant: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  show: { opacity: 1, scale: 1, transition: SPRING_POP },
};

function MiniDotMotion({
  icon: Icon,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <motion.div
      className="flex size-7 items-center justify-center rounded-md border border-border-default bg-card text-forest-mid shadow-xs"
      variants={miniDotVariant}
    >
      <Icon className="size-3.5" strokeWidth={1.8} />
    </motion.div>
  );
}
