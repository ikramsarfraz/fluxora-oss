import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  FileText,
  Landmark,
  Layers,
  Receipt,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  AiExtractMoment,
  DashboardMoment,
  InventoryLotsMoment,
  InvoicePdfMoment,
  PaymentsMoment,
  PlaidMoment,
  RolesMoment,
  SalesOrderMoment,
} from "../_components/moments";
import { MarketingFooter, MarketingNav } from "../_components/nav";
import { ReelEmbed } from "../_components/reel-embed";

export const metadata: Metadata = {
  title: "Fluxora — the product tour",
  description:
    "Take the seven-minute tour. AI invoice import, FIFO inventory, sales orders, payments, dashboard — the whole product, in order.",
};

type Chapter = {
  n: string;
  module: string;
  title: string;
  body: string;
  bullets: string[];
  moment: React.ReactNode;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

const CHAPTERS: Chapter[] = [
  {
    n: "01",
    module: "Inbox to invoice",
    title: "AI supplier invoice import.",
    body:
      "Drag in a supplier PDF — Fluxora extracts the lines, matches them to your catalog, and posts the bill. Aliases learn forever.",
    bullets: [
      "Up to 94% accuracy on first read",
      "Aliases persist across receipts",
      "Posts to AP + receives into inventory",
    ],
    moment: <AiExtractMoment />,
    icon: Sparkles,
  },
  {
    n: "02",
    module: "Take the order",
    title: "Sales orders backed by FIFO.",
    body:
      "Search the customer, watch FIFO pull lots oldest-first, tier prices apply automatically, margin updates live as you build the order.",
    bullets: [
      "Customer search with tier-aware pricing",
      "Visual lot allocation per line",
      "Live margin tracker in the header",
    ],
    moment: <SalesOrderMoment />,
    icon: FileText,
  },
  {
    n: "03",
    module: "Send the doc",
    title: "Branded invoice PDFs in one click.",
    body:
      "Set your letterhead once. Every invoice composes itself with your logo, palette, and footer — and goes straight to the customer's inbox.",
    bullets: [
      "Logo, palette, footer — branded once",
      "Email send with delivery tracking",
      "Audit-ready, signed PDFs",
    ],
    moment: <InvoicePdfMoment />,
    icon: Receipt,
  },
  {
    n: "04",
    module: "Money in",
    title: "Payments. FIFO across invoices.",
    body:
      "Record one payment, watch Fluxora apply it oldest-first across open invoices. Aging buckets shift the second the payment posts.",
    bullets: [
      "Auto-FIFO allocation",
      "Aging before / after split-screen",
      "Overpayments → credit, untouched",
    ],
    moment: <PaymentsMoment />,
    icon: Wallet,
  },
  {
    n: "05",
    module: "Know the stock",
    title: "Inventory + lot ledger.",
    body:
      "Every lot, every move, every dollar — traceable. Expiry alerts two days ahead of trouble. Adjustments audit-trailed.",
    bullets: [
      "Lot timeline with FIFO indicator",
      "Expiry-aware filters",
      "Movement ledger for every gram",
    ],
    moment: <InventoryLotsMoment />,
    icon: Boxes,
  },
  {
    n: "06",
    module: "Bank in",
    title: "Plaid bank linking.",
    body:
      "Hook up your bank once. Transactions flow in on a schedule and auto-match to invoices, bills, and expenses with confidence scores.",
    bullets: [
      "12,000+ institutions",
      "Daily sync, on a cron",
      "Auto-match with confidence bars",
    ],
    moment: <PlaidMoment />,
    icon: Landmark,
  },
  {
    n: "07",
    module: "Run a team",
    title: "Roles & permissions.",
    body:
      "The warehouse crew sees lots and pick lists. Your CFO sees the full P&L. Server-enforced, audit-logged, no foot-guns.",
    bullets: [
      "Permission matrix at a glance",
      "Per-person sidebar morphs",
      "Audit log of allowed + denied",
    ],
    moment: <RolesMoment />,
    icon: Users,
  },
  {
    n: "08",
    module: "Open the laptop",
    title: "Dashboard KPIs.",
    body:
      "Revenue, margin, aging, today's wins, stock at risk — every number you check first thing, on one screen, refreshed on load.",
    bullets: [
      "Live KPIs, drill any number",
      "Aging buckets + top owing",
      "Today's wins spotlight",
    ],
    moment: <DashboardMoment />,
    icon: BarChart3,
  },
];

export default function TourLanding() {
  return (
    <div className="min-h-screen bg-page">
      <MarketingNav variant="tour" variantLabel="tour" />

      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 0%, color-mix(in oklch, var(--color-forest-tint) 45%, transparent) 0%, transparent 70%)",
          }}
        />
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-10 md:pt-24">
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[1fr_1.1fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-card-warm px-3 py-1">
                <span className="size-1.5 rounded-full bg-forest-mid" />
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-forest-mid">
                  7-minute product tour
                </span>
              </div>
              <h1 className="mt-5 font-serif text-[42px] font-medium leading-[1.04] tracking-tight text-ink md:text-[60px]">
                The whole product.
                <br />
                <span className="text-forest-mid">In one scroll.</span>
              </h1>
              <p className="mt-5 max-w-md text-[15.5px] leading-[1.6] text-ink-warm">
                Eight chapters. Each one a real workflow on a real screen — no
                screenshots, no hand-waving. Start at chapter one or jump
                anywhere.
              </p>
              <div className="mt-7 flex items-center gap-3">
                <Button size="lg" asChild>
                  <Link href="#chapter-01">
                    Start the tour
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Link
                  href="#pricing"
                  className="text-[13px] text-ink-warm underline-offset-4 hover:text-ink hover:underline"
                >
                  Or skip to pricing →
                </Link>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                <span className="inline-flex items-center gap-1">
                  <Check className="size-2.5 text-forest-mid" strokeWidth={2.6} />
                  No login
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Check className="size-2.5 text-forest-mid" strokeWidth={2.6} />
                  Watches on its own
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Check className="size-2.5 text-forest-mid" strokeWidth={2.6} />
                  Real data
                </span>
              </div>
            </div>

            {/* The single iframe — only one on the page */}
            <ReelEmbed slug="invoice-import" aspect="video" />
          </div>
        </div>
      </section>

      {/* ============================ TOC ============================ */}
      <section className="border-y border-border-default/60 bg-surface/30">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
              Table of contents
            </p>
            <p className="text-[11px] text-subtle">
              8 chapters · ~30 sec each
            </p>
          </div>
          <ol className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
            {CHAPTERS.map((c) => (
              <li key={c.n}>
                <Link
                  href={`#chapter-${c.n}`}
                  className="group flex items-baseline gap-2 border-b border-border-default/60 pb-2"
                >
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-forest-mid">
                    {c.n}
                  </span>
                  <span className="text-[13px] font-medium text-ink group-hover:text-forest-mid">
                    {c.module}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============================ CHAPTERS ============================ */}
      <section id="product">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid grid-cols-1 gap-0 md:grid-cols-[180px_1fr] md:gap-16">
            {/* Sticky chapter rail */}
            <aside className="hidden md:block">
              <div className="sticky top-24">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">
                  Chapters
                </p>
                <ol className="mt-3 space-y-2">
                  {CHAPTERS.map((c) => (
                    <li key={c.n}>
                      <Link
                        href={`#chapter-${c.n}`}
                        className="group flex items-center gap-2 text-[12px] text-ink-warm hover:text-ink"
                      >
                        <span className="font-mono text-[10px] text-subtle group-hover:text-forest-mid">
                          {c.n}
                        </span>
                        <span>{c.module}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>

            {/* Chapters */}
            <div className="space-y-24">
              {CHAPTERS.map((c) => (
                <Chapter key={c.n} chapter={c} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================ STATS ============================ */}
      <section className="border-y border-border-default/60 bg-ink py-14 text-card-warm">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 md:grid-cols-4">
          <BigStat label="Workspaces" value="217" />
          <BigStat label="Invoices imported" value="5,432" />
          <BigStat label="$ on hand tracked" value="$8.4M" tone="accent" />
          <BigStat label="Avg setup time" value="< 2 min" />
        </div>
      </section>

      {/* ============================ INTEGRATIONS ============================ */}
      <section className="bg-page py-20">
        <div className="mx-auto max-w-6xl px-6">
          <header className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-mid">
              Plays well with
            </p>
            <h2 className="mt-3 font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[42px]">
              The tools you&apos;re already using.
            </h2>
          </header>
          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
            <IntegrationCard label="Stripe" sub="Billing + Checkout" />
            <IntegrationCard label="Plaid" sub="Banking + sync" />
            <IntegrationCard label="Cloudflare R2" sub="File storage" />
            <IntegrationCard label="OpenAI" sub="Invoice + receipt AI" />
            <IntegrationCard label="Resend" sub="Branded email" />
            <IntegrationCard label="Sentry" sub="Error monitoring" />
            <IntegrationCard label="PostHog" sub="Product analytics" />
            <IntegrationCard label="Better Stack" sub="Uptime" />
          </div>
        </div>
      </section>

      {/* ============================ PRICING ============================ */}
      <section id="pricing" className="border-y border-border-default/60 bg-surface/30">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <header className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-mid">
              Pricing
            </p>
            <h2 className="mt-3 font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[44px]">
              Same product. Three sizes.
            </h2>
          </header>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            <PlanCard
              name="Starter"
              price="$29"
              per="/mo"
              features={[
                "1 workspace · 2 users",
                "Up to 100 SKUs",
                "Basic invoicing",
                "Email support",
              ]}
              cta="Try Starter"
            />
            <PlanCard
              name="Growth"
              price="$99"
              per="/mo"
              recommended
              features={[
                "5,000 SKUs · 10 users",
                "FIFO inventory + lots",
                "Plaid bank linking",
                "AI invoice import",
                "Priority support",
              ]}
              cta="Choose Growth"
            />
            <PlanCard
              name="Enterprise"
              price="Custom"
              per=""
              features={[
                "Unlimited SKUs &amp; users",
                "Custom roles &amp; SSO",
                "Audit retention",
                "Named CSM",
              ]}
              cta="Talk to us"
            />
          </div>
        </div>
      </section>

      {/* ============================ FINAL CTA ============================ */}
      <section className="bg-page py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-serif text-[42px] font-medium leading-[1.05] tracking-tight text-ink md:text-[56px]">
            You&apos;ve seen the tour.
            <br />
            <span className="text-forest-mid">Want a workspace?</span>
          </h2>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="#">
                Start free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#">
                Book 15 minutes with us
              </Link>
            </Button>
          </div>
          <p className="mt-3 font-mono text-[10.5px] text-subtle">
            14 days free · no card · cancel anytime
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

// ---------- atoms ----------

function Chapter({ chapter }: { chapter: Chapter; flip?: boolean }) {
  const Icon = chapter.icon;
  return (
    <article id={`chapter-${chapter.n}`} className="scroll-mt-24">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-mid">
          Chapter {chapter.n}
        </span>
        <span className="h-px flex-1 bg-border-default" />
      </div>

      {/* Text lead, full-width moment below. Each moment carries its own
          sidebar + header — can't share a half-column with body copy. */}
      <div className="mt-6 max-w-2xl">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">
          <Icon className="size-3" strokeWidth={2.2} />
          {chapter.module}
        </div>
        <h3 className="mt-3 font-serif text-[28px] font-medium leading-[1.1] tracking-tight text-ink md:text-[36px]">
          {chapter.title}
        </h3>
        <p className="mt-4 text-[14.5px] leading-[1.65] text-ink-warm">
          {chapter.body}
        </p>
        <ul className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {chapter.bullets.map((b) => (
            <li
              key={b}
              className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-warm"
            >
              <Check
                className="size-3 shrink-0 text-forest-mid"
                strokeWidth={2.4}
              />
              {b}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">{chapter.moment}</div>
    </article>
  );
}

function BigStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent";
}) {
  return (
    <div>
      <div
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.18em]",
          tone === "accent" ? "text-forest-tint" : "text-card-warm/60",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-serif text-[40px] font-medium leading-none tabular-nums",
          tone === "accent" ? "text-forest-tint" : "text-card-warm",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function IntegrationCard({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-default bg-card-warm p-4">
      <div className="flex size-9 items-center justify-center rounded-md bg-forest-tint text-forest-mid">
        <Layers className="size-4" strokeWidth={1.6} />
      </div>
      <div>
        <div className="text-[12.5px] font-medium text-ink">{label}</div>
        <div className="font-mono text-[10px] text-subtle">{sub}</div>
      </div>
    </div>
  );
}

function PlanCard({
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
