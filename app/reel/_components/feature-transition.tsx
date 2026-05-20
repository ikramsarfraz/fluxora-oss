import Link from "next/link";
import { ArrowLeft, ArrowRight, PlayCircle } from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { Feature, FeatureAccent } from "../_data/features";
import { GROUP_LABEL } from "../_data/features";

// Engaging full-frame "trailer" card for a single feature. The same layout as
// the OpeningSplash inside /reel/invoice-import — promoted to a real page so
// every feature in docs/feature-flows.md has its own animated title card.

type ThemeTokens = {
  /** Inline-style backdrop using the accent's tinted color via color-mix. */
  radial: string;
  /** Tailwind class for the brand chip border + glow. */
  ring: string;
  /** Tailwind text class used for the headline accent line + chip. */
  text: string;
  /** Tailwind bg class for the eyebrow dot. */
  dot: string;
  /** Tailwind bg class for the highlight stat icon. */
  pill: string;
  /** Tailwind class for the highlight icon stroke. */
  pillIcon: string;
  /** Tailwind soft border class for the highlight pill. */
  pillBorder: string;
};

const ACCENT_THEMES: Record<FeatureAccent, ThemeTokens> = {
  forest: {
    radial:
      "radial-gradient(ellipse 70% 55% at 50% 40%, color-mix(in oklch, var(--color-forest-tint) 65%, transparent) 0%, transparent 70%)",
    ring: "ring-forest-tint/70",
    text: "text-forest-mid",
    dot: "bg-forest-mid",
    pill: "bg-forest-tint",
    pillIcon: "text-forest-mid",
    pillBorder: "border-forest-tint-deep/70",
  },
  success: {
    radial:
      "radial-gradient(ellipse 70% 55% at 50% 40%, color-mix(in oklch, var(--color-success-bg) 75%, transparent) 0%, transparent 70%)",
    ring: "ring-success-border/80",
    text: "text-success-fg",
    dot: "bg-success-fg",
    pill: "bg-success-bg",
    pillIcon: "text-success-fg",
    pillBorder: "border-success-border/80",
  },
  warning: {
    radial:
      "radial-gradient(ellipse 70% 55% at 50% 40%, color-mix(in oklch, var(--color-warning-bg) 75%, transparent) 0%, transparent 70%)",
    ring: "ring-warning-border/80",
    text: "text-warning-fg",
    dot: "bg-warning-fg",
    pill: "bg-warning-bg",
    pillIcon: "text-warning-fg",
    pillBorder: "border-warning-border/80",
  },
  info: {
    radial:
      "radial-gradient(ellipse 70% 55% at 50% 40%, color-mix(in oklch, var(--color-info-bg) 70%, transparent) 0%, transparent 70%)",
    ring: "ring-info-border/80",
    text: "text-info-fg",
    dot: "bg-info-fg",
    pill: "bg-info-bg",
    pillIcon: "text-info-fg",
    pillBorder: "border-info-border/80",
  },
};

export function FeatureTransition({
  feature,
  total,
  prevSlug,
  nextSlug,
}: {
  feature: Feature;
  total: number;
  prevSlug?: string;
  nextSlug?: string;
}) {
  const theme = ACCENT_THEMES[feature.accent];
  const Icon = feature.icon;
  const liveDemo = feature.liveDemoHref;

  return (
    <main className="relative min-h-screen overflow-hidden bg-page">
      {/* Decorative dotted grid — almost invisible, but adds depth */}
      <DottedBackdrop />

      {/* Accent radial — color-mixed against the feature's accent tint */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: theme.radial }}
      />

      {/* Top bar — back to directory + chapter chip */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 pt-8">
        <Link
          href="/reel"
          className="inline-flex items-center gap-2 rounded-full border border-border-default bg-card-warm/80 px-3 py-1.5 text-[11px] text-ink-warm backdrop-blur transition hover:text-ink"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2} />
          <span className="font-mono uppercase tracking-[0.12em]">
            All features
          </span>
        </Link>

        <div
          className={cn(
            "inline-flex items-center gap-2.5 rounded-full border bg-card-warm/85 px-3 py-1.5 backdrop-blur",
            theme.pillBorder,
          )}
        >
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-card-warm",
              theme.dot,
            )}
          >
            {feature.index}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            {GROUP_LABEL[feature.group]} · {feature.index} of {total}
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 pt-14 pb-10 text-center md:pt-20">
        {/* Brand mark + icon chip */}
        <div className="flex items-center gap-2 rounded-full border border-border-default bg-card-warm px-3 py-1.5 shadow-sm">
          <Logomark size={20} />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            Fluxora
          </span>
          <span className="text-subtle">·</span>
          <span className={cn("text-[11px] font-medium", theme.text)}>
            Watch
          </span>
        </div>

        {/* Eyebrow with accent dots */}
        <div
          className={cn(
            "mt-7 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]",
            theme.text,
          )}
        >
          <span className={cn("size-1 rounded-full", theme.dot)} />
          <span>{feature.eyebrow}</span>
          <span className={cn("size-1 rounded-full", theme.dot)} />
        </div>

        {/* Headline — the third line is the accent line */}
        <h1 className="mt-6 max-w-[680px] font-serif text-[42px] font-medium leading-[1.05] tracking-tight text-ink md:text-[60px]">
          {feature.headline[0]}
          <br />
          {feature.headline[1]}
          <br />
          <span className={theme.text}>{feature.headline[2]}</span>
        </h1>

        {/* Body */}
        <p className="mt-6 max-w-[560px] text-[15px] leading-[1.6] text-subtle md:text-[16px]">
          {feature.body}
        </p>

        {/* Highlight pills */}
        <ul className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
          {feature.highlights.map(({ icon: HighlightIcon, label }) => (
            <li
              key={label}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border bg-card-warm px-3 py-1.5 shadow-sm",
                theme.pillBorder,
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full",
                  theme.pill,
                )}
              >
                <HighlightIcon
                  className={cn("size-3", theme.pillIcon)}
                  strokeWidth={2}
                />
              </span>
              <span className="text-[12.5px] font-medium text-ink">
                {label}
              </span>
            </li>
          ))}
        </ul>

        {/* CTA row */}
        <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/signup">
              Try Fluxora free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          {liveDemo ? (
            <Button size="lg" variant="outline" asChild>
              <Link href={liveDemo}>
                <PlayCircle className="size-4" />
                Watch the live demo
              </Link>
            </Button>
          ) : null}
        </div>

        <span className="mt-3 text-[11px] text-subtle">
          No credit card · 14-day trial
        </span>
      </section>

      {/* Big translucent icon — the visual anchor in the lower half */}
      <div
        aria-hidden
        className="pointer-events-none relative z-0 mx-auto -mt-2 flex max-w-3xl justify-center"
      >
        <Icon
          className={cn(
            "size-40 opacity-[0.07] md:size-56",
            theme.text,
          )}
          strokeWidth={1}
        />
      </div>

      {/* Bottom navigation — prev / next feature */}
      <footer className="relative z-10 mx-auto mt-2 mb-12 flex max-w-6xl items-center justify-between gap-3 px-6">
        <FeatureNav
          slug={prevSlug}
          direction="prev"
          fallbackHref="/reel"
          fallbackLabel="All features"
          theme={theme}
        />
        <FeatureNav
          slug={nextSlug}
          direction="next"
          fallbackHref="/reel"
          fallbackLabel="All features"
          theme={theme}
        />
      </footer>
    </main>
  );
}

function FeatureNav({
  slug,
  direction,
  fallbackHref,
  fallbackLabel,
  theme,
}: {
  slug?: string;
  direction: "prev" | "next";
  fallbackHref: string;
  fallbackLabel: string;
  theme: ThemeTokens;
}) {
  const href = slug ? `/reel/${slug}` : fallbackHref;
  const label = slug ? slug.replace(/-/g, " ") : fallbackLabel;
  const isNext = direction === "next";

  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border border-border-default bg-card-warm/80 px-4 py-2 text-[12px] backdrop-blur transition",
        "hover:border-ink-warm/40 hover:text-ink",
        isNext ? "flex-row" : "flex-row-reverse",
      )}
    >
      <span
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.14em]",
          theme.text,
        )}
      >
        {isNext ? "Next" : "Previous"}
      </span>
      <span className="font-medium capitalize text-ink-warm">{label}</span>
      <ArrowRight
        className={cn(
          "size-3.5 text-subtle transition-transform",
          isNext
            ? "group-hover:translate-x-0.5"
            : "rotate-180 group-hover:-translate-x-0.5",
        )}
        strokeWidth={2}
      />
    </Link>
  );
}

function DottedBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-60"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, color-mix(in oklch, var(--color-border-default) 80%, transparent) 1px, transparent 0)",
        backgroundSize: "24px 24px",
        maskImage:
          "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)",
      }}
    />
  );
}
