"use client";

import {
  ArrowRight,
  Check,
  FileText,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { cn } from "@/lib/utils";

import { useReel } from "./reel-state";

// Layered transition chrome — drawn on top of the reel surface but inside the
// browser frame. Three flavors:
//
// 1. OpeningSplash — full-frame title card that auto-fades in/out at the start
//    of every loop. Sets the stage: what you're about to watch, in plain
//    language. Brand mark + serif headline + body + a "Loading…" cue.
//
// 2. ChapterPill — slim banner that slides down from the top of the frame at
//    each phase change (Receive / Review / Post / Done). Stays visible for
//    ~1.5s, then slides back up. Doesn't block the underlying UI.
//
// 3. OutroSplash — closing card with the "stats" of what just happened plus
//    the marketing CTA. Auto-fades before the loop restarts.

export function TransitionLayer() {
  const { state } = useReel();
  const t = state.transition;

  if (t.kind === "none") return null;

  if (t.kind === "splash") {
    return <OpeningSplash />;
  }

  if (t.kind === "outro") {
    return <OutroSplash />;
  }

  return <ChapterPill chapter={t} />;
}

// ---------- Opening splash ----------
function OpeningSplash() {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-50",
        "flex items-center justify-center bg-page",
        "animate-in fade-in duration-500",
      )}
    >
      {/* Subtle radial gradient anchor so the eye lands on the title */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at center, color-mix(in oklch, var(--color-forest-tint) 55%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-7 px-8 text-center">
        {/* Brand mark */}
        <div className="flex items-center gap-2 rounded-full border border-border-default bg-card-warm px-3 py-1.5">
          <Logomark size={20} />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            Fluxora
          </span>
          <span className="text-subtle">·</span>
          <span className="text-[11px] text-ink-warm">Watch</span>
        </div>

        {/* Eyebrow */}
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-forest-mid">
          <span className="size-1 rounded-full bg-forest-mid" />
          <span>PDF invoice import</span>
          <span className="size-1 rounded-full bg-forest-mid" />
        </div>

        {/* Headline */}
        <h1 className="max-w-[680px] font-serif text-[42px] font-medium leading-[1.05] tracking-tight text-ink md:text-[56px]">
          From PDF on a desk
          <br />
          to stock on the shelf —
          <br />
          <span className="text-forest-mid">in under a minute.</span>
        </h1>

        {/* Body */}
        <p className="max-w-[520px] text-[14px] leading-[1.55] text-subtle md:text-[15px]">
          Drop a supplier invoice. AI reads it, matches it to your catalog, and
          posts a bill that updates stock and cost — automatically.
        </p>

        {/* "Starting" cue */}
        <div className="flex items-center gap-2 text-[11px] text-subtle">
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

// ---------- Chapter pill ----------
function ChapterPill({
  chapter,
}: {
  chapter: { index: number; total: number; title: string; subtitle: string };
}) {
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

// ---------- Outro splash ----------
function OutroSplash() {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-50",
        "flex items-center justify-center bg-page",
        "animate-in fade-in duration-500",
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at center, color-mix(in oklch, var(--color-success-bg) 65%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-6 px-8 text-center">
        {/* Success mark */}
        <div className="flex size-12 items-center justify-center rounded-full bg-success-bg text-success-fg">
          <Check className="size-6" strokeWidth={2.4} />
        </div>

        {/* Headline */}
        <h1 className="max-w-[640px] font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[44px]">
          One PDF, posted.
          <br />
          <span className="text-forest-mid">Stock is now current.</span>
        </h1>

        {/* Stats row — the "proof" */}
        <div className="mt-2 flex items-center gap-6">
          <StatPill icon={FileText} label="1 invoice" />
          <StatDivider />
          <StatPill icon={Sparkles} label="2 aliases learned" />
          <StatDivider />
          <StatPill icon={TrendingUp} label="9 lines posted" />
        </div>

        {/* CTA */}
        <div className="mt-3 flex flex-col items-center gap-2">
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
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 text-forest-mid" strokeWidth={1.8} />
      <span className="text-[13px] font-medium text-ink">{label}</span>
    </div>
  );
}

function StatDivider() {
  return <span className="text-border-default">·</span>;
}
