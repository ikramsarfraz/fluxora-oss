"use client";

import { useEffect, useState } from "react";
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

import { useReel } from "./reel-state";
import type { ExplainerVisual, InterstitialIcon } from "./types";

// Layered transition chrome — drawn on top of the reel surface. Four flavors:
//
// 1. OpeningSplash — full-frame title card with crossfade + scale-in.
// 2. ChapterPill — large card that lands centered for a beat, then collapses
//    into a pinned top pill. Backing app stays visible but dim+blurred.
// 3. Interstitial — small centered confirmation card ("✓ Supplier linked"),
//    backing app stays barely visible behind a heavy blur.
// 4. OutroSplash — closing card with sequenced stat reveal.

export function TransitionLayer() {
  const { state } = useReel();
  const t = state.transition;
  if (t.kind === "none") return null;
  if (t.kind === "splash") return <OpeningSplash />;
  if (t.kind === "outro") return <OutroSplash />;
  if (t.kind === "chapter") return <ChapterCard chapter={t} />;
  if (t.kind === "explainer") return <Explainer explainer={t} />;
  return <Interstitial icon={t.icon} title={t.title} body={t.body} />;
}

/**
 * True when the transition should dim + blur the backing app. Splash/outro
 * fully obscure; chapter + interstitial dim partially so the surface remains
 * visible underneath.
 */
export function transitionBackingTreatment(state: ReturnType<typeof useReel>["state"]) {
  switch (state.transition.kind) {
    case "splash":
    case "outro":
      return { dim: 1, blur: 8 } as const;
    case "chapter":
      return { dim: 0.55, blur: 4 } as const;
    case "interstitial":
      return { dim: 0.4, blur: 3 } as const;
    default:
      return { dim: 0, blur: 0 } as const;
  }
}

// ---------- Opening splash ----------
function OpeningSplash() {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-50",
        "flex items-center justify-center bg-page/95 backdrop-blur-sm",
        "animate-in fade-in zoom-in-95 duration-700",
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at center, color-mix(in oklch, var(--color-forest-tint) 60%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-7 px-8 text-center">
        <div className="flex animate-in fade-in slide-in-from-top-2 items-center gap-2 rounded-full border border-border-default bg-card-warm px-3 py-1.5 duration-700 delay-150 fill-mode-both">
          <Logomark size={20} />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            Fluxora
          </span>
          <span className="text-subtle">·</span>
          <span className="text-[11px] text-ink-warm">Watch</span>
        </div>

        <div className="flex animate-in fade-in items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-forest-mid duration-700 delay-300 fill-mode-both">
          <span className="size-1 rounded-full bg-forest-mid" />
          <span>PDF invoice import</span>
          <span className="size-1 rounded-full bg-forest-mid" />
        </div>

        <h1 className="max-w-[680px] animate-in fade-in slide-in-from-bottom-3 font-serif text-[42px] font-medium leading-[1.05] tracking-tight text-ink duration-700 delay-500 md:text-[56px] fill-mode-both">
          From PDF on a desk
          <br />
          to stock on the shelf —
          <br />
          <span className="text-forest-mid">in under a minute.</span>
        </h1>

        <p className="max-w-[520px] animate-in fade-in text-[14px] leading-[1.55] text-subtle duration-700 delay-700 md:text-[15px] fill-mode-both">
          Drop a supplier invoice. AI reads it, matches it to your catalog, and
          posts a bill that updates stock and cost — automatically.
        </p>

        <div className="flex animate-in fade-in items-center gap-2 text-[11px] text-subtle duration-700 delay-1000 fill-mode-both">
          <span className="relative flex size-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-forest-mid/40" />
            <span className="relative size-2 rounded-full bg-forest-mid" />
          </span>
          <span className="font-mono uppercase tracking-[0.12em]">
            Demo starting
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------- Chapter card ----------
function ChapterCard({
  chapter,
}: {
  chapter: { index: number; total: number; title: string; subtitle: string };
}) {
  // Briefly show as a full-frame centered card, then collapse to a small pill
  // pinned to the top — visually announces the new phase then gets out of the
  // way so the user can see the underlying screen change.
  const [phase, setPhase] = useState<"hero" | "pill">("hero");
  useEffect(() => {
    const t = window.setTimeout(() => setPhase("pill"), 900);
    return () => window.clearTimeout(t);
  }, [chapter.index]);

  if (phase === "hero") {
    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-40 flex items-center justify-center",
          "animate-in fade-in duration-300",
        )}
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-page/30"
        />
        <div
          className={cn(
            "relative flex items-center gap-5 rounded-2xl border border-border-default bg-card-warm/95 px-8 py-6 shadow-2xl backdrop-blur",
            "animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 ease-out",
          )}
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
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center",
        "animate-in slide-in-from-top-4 fade-in duration-300",
      )}
    >
      <div
        className={cn(
          "mt-6 flex items-center gap-3 rounded-full",
          "border border-border-default bg-card-warm/95 px-4 py-2 shadow-lg backdrop-blur",
        )}
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
      </div>
    </div>
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
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-40 flex items-center justify-center",
        "animate-in fade-in duration-200",
      )}
    >
      <div aria-hidden className="absolute inset-0 bg-page/40 backdrop-blur-sm" />
      <div
        className={cn(
          "relative flex items-center gap-4 rounded-2xl border bg-card-warm/95 px-6 py-4 shadow-xl backdrop-blur",
          "animate-in zoom-in-95 slide-in-from-bottom-2 duration-400 ease-out fill-mode-both",
        )}
        style={{ borderColor: tone.border }}
      >
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: tone.bg, color: tone.fg }}
        >
          <Icon className="size-5" strokeWidth={2.2} />
        </div>
        <div className="flex flex-col gap-0.5">
          <h3 className="font-serif text-[18px] font-medium leading-tight text-ink">
            {title}
          </h3>
          <p className="max-w-[420px] text-[12.5px] text-subtle">{body}</p>
        </div>
      </div>
    </div>
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
function OutroSplash() {
  // Sequenced stat reveal — each stat fades in after a short delay.
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-50",
        "flex items-center justify-center bg-page/95",
        "animate-in fade-in duration-500",
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at center, color-mix(in oklch, var(--color-success-bg) 70%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-6 px-8 text-center">
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-full bg-success-bg text-success-fg",
            "animate-in zoom-in-50 duration-500 ease-out fill-mode-both",
          )}
        >
          <Check className="size-6" strokeWidth={2.4} />
        </div>

        <h1
          className={cn(
            "max-w-[640px] font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[44px]",
            "animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200 fill-mode-both",
          )}
        >
          One PDF, posted.
          <br />
          <span className="text-forest-mid">Stock is now current.</span>
        </h1>

        {/* Stats row — each fades in sequentially */}
        <div className="mt-2 flex items-center gap-6">
          <StatPill
            icon={FileText}
            label="1 invoice"
            delay="delay-500"
          />
          <StatDivider delay="delay-500" />
          <StatPill
            icon={Sparkles}
            label="2 aliases learned"
            delay="delay-700"
          />
          <StatDivider delay="delay-700" />
          <StatPill
            icon={TrendingUp}
            label="9 lines posted"
            delay="delay-1000"
          />
        </div>

        <div
          className={cn(
            "mt-3 flex flex-col items-center gap-2",
            "animate-in fade-in slide-in-from-bottom-2 duration-700 delay-1000 fill-mode-both",
          )}
        >
          <div className="inline-flex h-10 items-center gap-2 rounded-md bg-forest-mid px-5 text-[14px] font-medium text-card-warm">
            Try Fluxora free
            <ArrowRight className="size-3.5" />
          </div>
          <span className="text-[11px] text-subtle">
            No credit card · 14-day trial
          </span>
        </div>
      </div>
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  delay,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  delay: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1 duration-500 fill-mode-both",
        delay,
      )}
    >
      <Icon className="size-3.5 text-forest-mid" strokeWidth={1.8} />
      <span className="text-[13px] font-medium text-ink">{label}</span>
    </div>
  );
}

function StatDivider({ delay }: { delay: string }) {
  return (
    <span
      className={cn(
        "text-border-default animate-in fade-in duration-500 fill-mode-both",
        delay,
      )}
    >
      ·
    </span>
  );
}

// ---------- Explainer (full-frame narrative card) ----------
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
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-50",
        "flex items-center justify-center bg-page/95 backdrop-blur-sm",
        "animate-in fade-in zoom-in-95 duration-500",
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 50% at center, color-mix(in oklch, var(--color-forest-tint) 55%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-7 px-8 text-center">
        {/* Decorative visual at the top */}
        <div className="animate-in fade-in slide-in-from-top-1 duration-700 delay-100 fill-mode-both">
          <ExplainerVisualGlyph kind={explainer.visual} />
        </div>

        {/* Eyebrow */}
        <div className="flex animate-in fade-in items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-forest-mid duration-700 delay-300 fill-mode-both">
          <span className="size-1 rounded-full bg-forest-mid" />
          <span>{explainer.eyebrow}</span>
          <span className="size-1 rounded-full bg-forest-mid" />
        </div>

        {/* Title */}
        <h2 className="max-w-[680px] animate-in fade-in slide-in-from-bottom-3 font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink duration-700 delay-500 md:text-[44px] fill-mode-both">
          {explainer.title}
        </h2>

        {/* Body */}
        <p className="max-w-[540px] animate-in fade-in text-[14px] leading-[1.6] text-subtle duration-700 delay-700 md:text-[15px] fill-mode-both">
          {explainer.body}
        </p>
      </div>
    </div>
  );
}

function ExplainerVisualGlyph({ kind }: { kind: ExplainerVisual }) {
  switch (kind) {
    case "pdf-to-stock":
      return (
        <div className="flex items-center gap-3">
          <GlyphTile icon={FileText} tone="warn" />
          <GlyphArrow />
          <GlyphTile icon={Sparkles} tone="forest" />
          <GlyphArrow />
          <GlyphTile icon={Boxes} tone="success" />
        </div>
      );
    case "ai-match":
      return (
        <div className="flex items-center gap-3">
          <GlyphTile icon={Sparkles} tone="forest" />
          <div className="flex flex-col gap-1.5">
            <CandidatePill score={86} />
            <CandidatePill score={71} muted />
          </div>
        </div>
      );
    case "five-effects":
      return (
        <div className="flex items-center gap-4">
          <GlyphTile icon={Check} tone="success" />
          <GlyphArrow />
          <div className="grid grid-cols-3 gap-1.5">
            <MiniDot icon={Boxes} />
            <MiniDot icon={TrendingUp} />
            <MiniDot icon={Sparkles} />
            <MiniDot icon={Receipt} />
            <MiniDot icon={Package} />
            <span className="block size-7" />
          </div>
        </div>
      );
    case "memory":
      return (
        <div className="flex items-center gap-3">
          <GlyphTile icon={Database} tone="forest" />
          <GlyphArrow />
          <GlyphTile icon={RotateCw} tone="success" />
        </div>
      );
  }
}

function GlyphTile({
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
    <div
      className="flex size-14 items-center justify-center rounded-2xl border border-border-default shadow-sm"
      style={{ background: palette.bg, color: palette.fg }}
    >
      <Icon className="size-6" strokeWidth={1.6} />
    </div>
  );
}

function GlyphArrow() {
  return <ArrowRight className="size-4 text-subtle" strokeWidth={1.6} />;
}

function CandidatePill({ score, muted = false }: { score: number; muted?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-[7px] border border-border-default bg-card px-2.5 py-1 text-[11px]",
        muted && "opacity-60",
      )}
    >
      <span className="size-1.5 rounded-full bg-forest-mid" />
      <span className="text-ink">Suggested match</span>
      <span className="rounded bg-divider px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-subtle">
        {score}%
      </span>
    </div>
  );
}

function MiniDot({
  icon: Icon,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <div className="flex size-7 items-center justify-center rounded-md border border-border-default bg-card text-forest-mid shadow-xs">
      <Icon className="size-3.5" strokeWidth={1.8} />
    </div>
  );
}
