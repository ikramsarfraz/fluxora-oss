import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  FEATURES,
  GROUP_LABEL,
  GROUP_ORDER,
  getFeaturesByGroup,
} from "./_data/features";
import type { Feature, FeatureAccent } from "./_data/features";

export const metadata: Metadata = {
  title: "Fluxora — see every feature",
  description:
    "A title card for every Fluxora feature. From auth to inventory to AI-powered invoice import — click through and see what each one does.",
};

const CARD_ACCENT: Record<FeatureAccent, string> = {
  forest: "border-forest-tint-deep/60 hover:border-forest-mid/60",
  success: "border-success-border/70 hover:border-success-fg/60",
  warning: "border-warning-border/70 hover:border-warning-fg/60",
  info: "border-info-border/70 hover:border-info-fg/60",
};

const ICON_ACCENT: Record<FeatureAccent, string> = {
  forest: "bg-forest-tint text-forest-mid",
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  info: "bg-info-bg text-info-fg",
};

const EYEBROW_ACCENT: Record<FeatureAccent, string> = {
  forest: "text-forest-mid",
  success: "text-success-fg",
  warning: "text-warning-fg",
  info: "text-info-fg",
};

export default function ReelIndexPage() {
  const grouped = getFeaturesByGroup();
  const total = FEATURES.length;

  return (
    <main className="min-h-screen bg-page">
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-24 md:pt-24">
        {/* Header */}
        <header className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-card-warm px-3 py-1.5 shadow-sm">
            <Logomark size={20} />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
              Fluxora
            </span>
            <span className="text-subtle">·</span>
            <span className="text-[11px] text-ink-warm">Feature reel</span>
          </div>

          <h1 className="mt-7 font-serif text-[44px] font-medium leading-[1.05] tracking-tight text-ink md:text-[64px]">
            Every part of Fluxora,
            <br />
            <span className="text-forest-mid">on a single card.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.6] text-subtle md:text-[16px]">
            {total} features. {GROUP_ORDER.length} groups. One trailer card for
            each — click through to see how the piece fits.
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/signup">
                Try Fluxora free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/reel/invoice-import">
                <PlayCircle className="size-4" />
                Watch the live invoice demo
              </Link>
            </Button>
          </div>
        </header>

        {/* Grouped grids */}
        <div className="mt-20 space-y-16">
          {GROUP_ORDER.map((group) => {
            const features = grouped[group];
            if (features.length === 0) return null;

            return (
              <section key={group}>
                <div className="mb-6 flex items-baseline gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">
                    {GROUP_LABEL[group]}
                  </span>
                  <span className="text-subtle">·</span>
                  <span className="text-[11px] text-subtle">
                    {features.length} feature{features.length === 1 ? "" : "s"}
                  </span>
                  <span className="ml-2 h-px flex-1 bg-border-default/70" />
                </div>

                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {features.map((feature) => (
                    <li key={feature.slug}>
                      <FeatureCard feature={feature} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;

  return (
    <Link
      href={`/reel/${feature.slug}`}
      className={cn(
        "group relative flex h-full flex-col rounded-2xl border-2 bg-card-warm p-5 shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(31,58,46,0.35)]",
        CARD_ACCENT[feature.accent],
      )}
    >
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            ICON_ACCENT[feature.accent],
          )}
        >
          <Icon className="size-5" strokeWidth={1.8} />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
          {String(feature.index).padStart(2, "0")}
        </span>
      </div>

      <p
        className={cn(
          "mt-5 font-mono text-[10px] uppercase tracking-[0.14em]",
          EYEBROW_ACCENT[feature.accent],
        )}
      >
        {feature.eyebrow}
      </p>
      <h3 className="mt-1.5 font-serif text-[22px] font-medium leading-[1.15] tracking-tight text-ink">
        {feature.title}
      </h3>

      <p className="mt-3 line-clamp-3 text-[13.5px] leading-[1.55] text-subtle">
        {feature.body}
      </p>

      <div className="mt-5 flex items-center gap-1.5 text-[11.5px] font-medium text-ink-warm">
        <span>Open transition</span>
        <ArrowRight
          className="size-3.5 transition-transform group-hover:translate-x-0.5"
          strokeWidth={2}
        />
      </div>
    </Link>
  );
}
