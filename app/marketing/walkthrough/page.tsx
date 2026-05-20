import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock,
  Coffee,
  Quote,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { MarketingFooter, MarketingNav } from "../_components/nav";
import { WalkthroughHero } from "./_components/walkthrough-hero";

export const metadata: Metadata = {
  title: "Fluxora — A Tuesday at Pacific Wharf, the walkthrough",
  description:
    "One distributor, one morning, five workflows. Watch what each step takes on a spreadsheet — and what it takes in Fluxora.",
};

export default function WalkthroughLanding() {
  return (
    <div className="min-h-screen bg-page">
      <MarketingNav variant="editorial" variantLabel="walkthrough" />

      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in oklch, var(--color-forest-tint) 45%, transparent) 0%, transparent 70%)",
          }}
        />

        <div className="mx-auto max-w-6xl px-6 pt-14 pb-10 md:pt-20">
          {/* Above-hero copy */}
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-card-warm px-3 py-1">
              <Coffee className="size-3 text-forest-mid" strokeWidth={2.2} />
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-forest-mid">
                A morning at Pacific Wharf · walkthrough
              </span>
            </div>
            <h1 className="mt-6 font-serif text-[44px] font-medium leading-[1.05] tracking-tight text-ink md:text-[64px]">
              From 7 a.m. coffee to 10 a.m. invoices,
              <br />
              <span className="text-forest-mid italic">in one minute.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-[600px] text-[15.5px] leading-[1.6] text-ink-warm md:text-[17px]">
              Five workflows a distributor runs every Tuesday. Each one in the
              app, each one compared side-by-side with the spreadsheet way.
              Auto-plays — or click a chapter to jump.
            </p>
          </div>

          {/* The merged hero demo */}
          <div className="mt-10">
            <WalkthroughHero />
          </div>

          {/* CTA strip directly under hero */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="#">
                Try Fluxora free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Link
              href="/reel"
              className="text-[13px] text-ink-warm underline-offset-4 hover:text-ink hover:underline"
            >
              Or watch the long-form reel of each feature →
            </Link>
          </div>
          <p className="mt-3 text-center font-mono text-[10.5px] text-subtle">
            14 days free · no card · no calls
          </p>
        </div>
      </section>

      {/* ============================ TOTAL TIME BAR ============================ */}
      <section className="border-y border-border-default/60 bg-ink py-12 text-card-warm">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-6 md:grid-cols-4">
          <BigStat
            icon={Clock}
            label="The old way"
            value="≈ 2h 14m"
            sub="Every Tuesday morning"
            tone="muted"
          />
          <BigStat
            icon={Sparkles}
            label="Fluxora"
            value="2m 43s"
            sub="Same Tuesday, finished"
            tone="accent"
          />
          <BigStat label="Steps avoided" value="38" sub="copy-paste, re-tabbing" />
          <BigStat label="Errors caught" value="3" sub="before the truck rolls" />
        </div>
      </section>

      {/* ============================ QUOTE ============================ */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <Quote
          className="mx-auto size-7 text-forest-mid/60"
          strokeWidth={1.6}
        />
        <p className="mt-5 text-center font-serif text-[26px] leading-[1.3] tracking-tight text-ink md:text-[30px]">
          “Tuesday used to take until lunch. Now I&apos;m bored by 9:15. I
          don&apos;t miss spreadsheets — I miss the espresso shot I used to
          buy when payroll ran late.”
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-forest-tint font-mono text-[11px] font-bold text-forest-mid">
            SC
          </div>
          <div className="text-left">
            <div className="text-[13px] font-medium text-ink">Sarah Chen</div>
            <div className="font-mono text-[10.5px] text-subtle">
              Owner · Pacific Wharf Provisions
            </div>
          </div>
        </div>
      </section>

      {/* ============================ WHO IT'S FOR ============================ */}
      <section className="border-t border-border-default/60 bg-surface/30">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-mid">
              Who this is for
            </p>
            <h2 className="mt-3 font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[42px]">
              Distributors with one foot in the warehouse,
              <br />
              one in the accountant&apos;s office.
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            <Fit
              who="Owner-operators"
              detail="One person doing receiving, invoicing, AND payroll on a single laptop."
            />
            <Fit
              who="Small distribution teams"
              detail="2–10 people, mostly running on a shared Excel and a prayer."
            />
            <Fit
              who="Specialty + perishable"
              detail="Seafood, produce, dairy — anywhere lot tracking and expiry actually matter."
            />
          </div>
        </div>
      </section>

      {/* ============================ PRICING ============================ */}
      <section id="pricing" className="border-t border-border-default/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <header className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-mid">
              Pricing
            </p>
            <h2 className="mt-3 font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[44px]">
              Plain plans. No seat tax.
            </h2>
          </header>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            <PriceCard
              name="Starter"
              price="$29"
              per="/mo"
              cta="Try Starter"
              features={[
                "1 workspace · 2 users",
                "Up to 100 SKUs",
                "Email support",
              ]}
            />
            <PriceCard
              name="Growth"
              price="$99"
              per="/mo"
              recommended
              cta="Choose Growth"
              features={[
                "Up to 5,000 SKUs · 10 users",
                "FIFO inventory + lots",
                "Plaid bank linking",
                "AI invoice import",
                "Priority support",
              ]}
            />
            <PriceCard
              name="Enterprise"
              price="Custom"
              per=""
              cta="Talk to us"
              features={[
                "Unlimited SKUs &amp; users",
                "Custom roles &amp; SSO",
                "Audit retention",
                "Named CSM",
              ]}
            />
          </div>
        </div>
      </section>

      {/* ============================ FINAL CTA ============================ */}
      <section className="border-t border-border-default/60 bg-surface/20">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="font-serif text-[40px] font-medium leading-[1.1] tracking-tight text-ink md:text-[52px]">
            Pick a Tuesday.
            <br />
            <span className="text-forest-mid">Be bored by 9:15.</span>
          </h2>
          <div className="mt-8">
            <Button size="lg" asChild>
              <Link href="#">
                Start a free workspace
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <p className="mt-3 font-mono text-[10.5px] text-subtle">
              14 days free · no card · cancel anytime
            </p>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

// ---------- atoms ----------

function BigStat({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  sub?: string;
  tone?: "muted" | "accent";
}) {
  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em]",
          tone === "muted" ? "text-card-warm/50" : "text-card-warm/60",
          tone === "accent" && "text-forest-tint",
        )}
      >
        {Icon ? <Icon className="size-3" strokeWidth={2} /> : null}
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-serif text-[40px] font-medium leading-none tabular-nums",
          tone === "muted"
            ? "text-card-warm/60 line-through decoration-2"
            : tone === "accent"
              ? "text-forest-tint"
              : "text-card-warm",
        )}
      >
        {value}
      </div>
      {sub ? (
        <div
          className={cn(
            "mt-2 text-[11px]",
            tone === "muted" ? "text-card-warm/40" : "text-card-warm/60",
          )}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function Fit({ who, detail }: { who: string; detail: string }) {
  return (
    <article className="rounded-2xl border border-border-default bg-card-warm p-5">
      <div className="flex size-9 items-center justify-center rounded-xl bg-forest-tint text-forest-mid">
        <Check className="size-4" strokeWidth={2.4} />
      </div>
      <h3 className="mt-4 font-serif text-[18px] font-medium leading-tight text-ink">
        {who}
      </h3>
      <p className="mt-2 text-[13px] leading-[1.55] text-ink-warm">{detail}</p>
    </article>
  );
}

function PriceCard({
  name,
  price,
  per,
  features,
  cta,
  recommended,
}: {
  name: string;
  price: string;
  per: string;
  features: string[];
  cta: string;
  recommended?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl border-2 bg-card-warm p-6",
        recommended
          ? "border-forest-mid shadow-[0_22px_50px_-25px_rgba(31,58,46,0.45)]"
          : "border-border-default",
      )}
    >
      {recommended ? (
        <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-forest-mid px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-card-warm">
          Most popular
        </span>
      ) : null}
      <h3 className="font-serif text-[20px] font-medium text-ink">{name}</h3>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-serif text-[34px] font-medium leading-none text-ink">
          {price}
        </span>
        {per ? <span className="text-[12px] text-subtle">{per}</span> : null}
      </div>
      <ul className="mt-4 flex-1 space-y-1.5 text-[12.5px] text-ink-warm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-1.5">
            <Check
              className="mt-0.5 size-3 shrink-0 text-success-fg"
              strokeWidth={2.4}
            />
            <span dangerouslySetInnerHTML={{ __html: f }} />
          </li>
        ))}
      </ul>
      <Button
        size="lg"
        variant={recommended ? "default" : "outline"}
        className="mt-5"
        asChild
      >
        <Link href="#">{cta}</Link>
      </Button>
    </div>
  );
}
