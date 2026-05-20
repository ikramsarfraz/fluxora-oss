import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  FileSpreadsheet,
  Inbox,
  Mail,
  Receipt,
  ShoppingCart,
  Sparkles,
  Timer,
  X,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { MarketingFooter, MarketingNav } from "../_components/nav";
import { ReelEmbed } from "../_components/reel-embed";

export const metadata: Metadata = {
  title: "Fluxora — stop running on spreadsheets",
  description:
    "Side-by-side: distribution ops in spreadsheets vs Fluxora. 36 minutes becomes 4 seconds.",
};

export default function CompareLanding() {
  return (
    <div className="min-h-screen bg-page">
      <MarketingNav variant="compare" variantLabel="compare" />

      {/* ============================ HERO ============================ */}
      <section className="relative">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklch, var(--color-forest-tint) 25%, transparent), transparent 60%)",
          }}
        />
        <div className="mx-auto max-w-6xl px-6 pt-14 pb-10 md:pt-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-warning-border/70 bg-warning-bg/40 px-3 py-1">
            <AlertTriangle
              className="size-3 text-warning-fg"
              strokeWidth={2.4}
            />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-warning-fg">
              You&apos;re burning 14 hours a week on this
            </span>
          </div>
          <h1 className="mt-5 max-w-[920px] font-serif text-[52px] font-medium leading-[1.02] tracking-tight text-ink md:text-[80px]">
            Stop running your
            <br />
            distribution business in
            <br />
            <s className="text-subtle decoration-danger-fg/70 decoration-[6px]">
              spreadsheets
            </s>
            <span className="text-forest-mid"> Fluxora</span>.
          </h1>
          <p className="mt-6 max-w-[620px] text-[17px] leading-[1.55] text-ink-warm">
            One operator, one Tuesday morning. Same orders, same invoices, same
            customers. <strong className="font-semibold text-ink">36 minutes</strong> vs
            <strong className="font-semibold text-forest-mid"> 4 seconds.</strong>
          </p>
          <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button size="lg" asChild>
              <Link href="#">
                Try it free for 14 days
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle">
              No card · cancel any time · book a 15-min walkthrough
            </span>
          </div>
        </div>

        {/* Split-screen hero */}
        <div className="mx-auto max-w-6xl px-6 pb-14">
          <SplitHero />
        </div>
      </section>

      {/* ============================ TIME COUNTER ============================ */}
      <section className="border-y border-ink/10 bg-ink py-12 text-card-warm">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 md:grid-cols-3">
          <CounterStat
            label="Hours saved per week"
            value="14h"
            suffix="back in your week"
          />
          <CounterStat
            label="Invoices imported in May"
            value="5,432"
            suffix="across 217 workspaces"
            tone="accent"
          />
          <CounterStat
            label="Average margin recovered"
            value="$3.4k"
            suffix="from priced lots, per month"
          />
        </div>
      </section>

      {/* ============================ FOUR PAINS ============================ */}
      <section id="product" className="border-b border-border-default/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <header className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-warning-fg">
              The four pains
            </p>
            <h2 className="mt-3 font-serif text-[40px] font-medium leading-[1.05] tracking-tight text-ink md:text-[52px]">
              Where the spreadsheets break.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-[14.5px] leading-[1.6] text-ink-warm">
              We talked to 60 distributors. Every single one mentioned at least
              three of these. Here&apos;s what each one looks like — and what
              Fluxora does instead.
            </p>
          </header>

          <div className="mt-14 space-y-20">
            <PainBlock
              order={1}
              flip={false}
              pain={{
                kicker: "Supplier invoices",
                title: "You're typing PDFs into a system, one line at a time.",
                bullets: [
                  "30+ minutes per invoice",
                  "Aliases lost every time someone leaves",
                  "Bills posted to wrong vendor (still)",
                ],
              }}
              solution={{
                kicker: "What Fluxora does",
                title: "Drop the PDF. We do the typing.",
                bullets: [
                  "<94% accuracy across 12 supplier formats",
                  "Aliases learn and persist forever",
                  "Posts to AP + receives into inventory in one click",
                ],
                slug: "invoice-import",
                stat: "Average time: 26s",
              }}
            />
            <PainBlock
              order={2}
              flip
              pain={{
                kicker: "Customer book",
                title: "Your customer list is in three places. None of them agree.",
                bullets: [
                  "Excel master copy on the shared drive",
                  "Last invoiced addresses in QuickBooks",
                  "Phone numbers only the dispatcher knows",
                ],
              }}
              solution={{
                kicker: "What Fluxora does",
                title: "One drop. Eighteen customers. Five seconds.",
                bullets: [
                  "Bulk import from .xlsx / .csv",
                  "Tier pricing + Net terms per customer",
                  "Aging, balance, lifetime — all on the card",
                ],
                slug: "customer-bulk-import",
                stat: "18 customers in 4.2s",
              }}
            />
            <PainBlock
              order={3}
              flip={false}
              pain={{
                kicker: "Inventory",
                title: "You only find out a lot expired when the truck rolls back.",
                bullets: [
                  "No expiry view in your current system",
                  "FIFO is a sticky note on the warehouse wall",
                  "Spoilage isn't logged — it's whispered",
                ],
              }}
              solution={{
                kicker: "What Fluxora does",
                title: "Every lot. Every move. Every dollar.",
                bullets: [
                  "Expiry-aware alerts 2 days out",
                  "FIFO allocation on every order",
                  "Spoilage adjustments, audit-trailed",
                ],
                slug: "inventory-lots",
                stat: "4 at-risk lots caught this week",
              }}
            />
            <PainBlock
              order={4}
              flip
              pain={{
                kicker: "AR + aging",
                title: "Aging? Someone exports it the night before payroll.",
                bullets: [
                  "Static report, already stale",
                  "Manual ACH matching, line by line",
                  "Anchor Tavern owes you. You forget to call.",
                ],
              }}
              solution={{
                kicker: "What Fluxora does",
                title: "Bank feed in. FIFO match. Aging clears itself.",
                bullets: [
                  "Plaid pulls daily, auto-matches confidence-scored",
                  "Payments apply oldest invoice first",
                  "Watch-list spotlights overdue accounts on the dashboard",
                ],
                slug: "payments",
                stat: "3 invoices cleared from one payment",
              }}
            />
          </div>
        </div>
      </section>

      {/* ============================ MATRIX ============================ */}
      <section className="bg-surface/30">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <header className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-warning-fg">
              Side-by-side
            </p>
            <h2 className="mt-3 font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[44px]">
              Sheet + email vs Fluxora.
            </h2>
          </header>

          <div className="mt-12 overflow-hidden rounded-2xl border border-border-default bg-card-warm shadow-sm">
            <div className="grid grid-cols-[1.2fr_1fr_1fr]">
              <div className="border-b border-border-default px-6 py-4 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                Job to be done
              </div>
              <div className="border-b border-l border-border-default px-6 py-4">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-danger-fg">
                  <FileSpreadsheet className="size-3" strokeWidth={2.2} />
                  Spreadsheet + email
                </div>
              </div>
              <div className="border-b border-l border-border-default bg-forest-tint/30 px-6 py-4">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
                  <Sparkles className="size-3" strokeWidth={2.2} />
                  Fluxora
                </div>
              </div>
              <MatrixRow
                job="Capture a supplier invoice"
                bad="20+ minutes per bill"
                good="Drop the PDF · 26 sec"
              />
              <MatrixRow
                job="Add 18 new customers"
                bad="40 minutes of typing"
                good="Drop a .xlsx · 4.2 sec"
              />
              <MatrixRow
                job="Apply a $4,880 payment"
                bad="Open 5 invoices, edit each"
                good="Auto-FIFO across opens"
              />
              <MatrixRow
                job="See aging on a Monday"
                bad="Export, pivot, hope"
                good="Live on the dashboard"
              />
              <MatrixRow
                job="Catch expiring stock"
                bad="The truck tells you"
                good="Filter chip · 2 days out"
              />
              <MatrixRow
                job="Send a branded invoice"
                bad="Word + attach + send"
                good="One click · template applied"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============================ TESTIMONIALS ============================ */}
      <section className="bg-page py-20">
        <div className="mx-auto max-w-6xl px-6">
          <header className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-warning-fg">
              The receipts
            </p>
            <h2 className="mt-3 font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[44px]">
              From the operators running it.
            </h2>
          </header>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Testimonial
              quote="We dropped our part-time bookkeeper. Not because we wanted to — we just didn't have hours for them to bill anymore."
              name="Mateo Rivera"
              role="Owner · Anchor Tavern"
            />
            <Testimonial
              quote="The FIFO thing is the killer feature. My old system pretended FIFO existed. Fluxora actually does it."
              name="Lily Park"
              role="Ops · Bramble &amp; Bay"
              highlight
            />
            <Testimonial
              quote="I open Fluxora before I open my email now. That's the test."
              name="Diego Patel"
              role="GM · Pacific Wharf"
            />
          </div>
        </div>
      </section>

      {/* ============================ PRICING ============================ */}
      <section id="pricing" className="border-y border-border-default/50 bg-surface/20 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <header className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-warning-fg">
              Pricing
            </p>
            <h2 className="mt-3 font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[44px]">
              One price. Pays itself back the first week.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[13px] text-subtle">
              We don&apos;t do seat tax. Pick the size, get the platform.
            </p>
          </header>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            <FlatPrice
              name="Starter"
              price="$29"
              per="/mo"
              cta="Try Starter"
              features={[
                "1 workspace",
                "Up to 100 SKUs",
                "Up to 2 users",
              ]}
            />
            <FlatPrice
              name="Growth"
              price="$99"
              per="/mo"
              cta="Choose Growth"
              recommended
              features={[
                "Up to 5,000 SKUs",
                "Up to 10 users",
                "FIFO + Plaid + AI import",
                "Priority support",
              ]}
            />
            <FlatPrice
              name="Enterprise"
              price="Custom"
              per=""
              cta="Talk to us"
              features={[
                "Unlimited everything",
                "Custom roles &amp; SSO",
                "Audit retention",
                "Named CSM",
              ]}
            />
          </div>
        </div>
      </section>

      {/* ============================ FINAL CTA ============================ */}
      <section className="bg-ink py-20 text-card-warm">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-serif text-[42px] font-medium leading-[1.05] tracking-tight md:text-[56px]">
            Pick a Tuesday.
            <br />
            <span className="text-forest-tint">Be done by lunch.</span>
          </h2>
          <p className="mt-5 text-[14px] text-card-warm/70">
            Switching takes a morning. The relief lasts forever.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" variant="default" className="bg-card-warm text-ink hover:bg-card-warm/90 border-card-warm" asChild>
              <Link href="#">
                Start free for 14 days
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Link
              href="/reel"
              className="text-[13px] text-card-warm/80 underline-offset-4 hover:text-card-warm hover:underline"
            >
              Or just watch the demos →
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

// ============================ HERO SPLIT ============================

function SplitHero() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Spreadsheet side */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-danger-border/40 bg-card-warm/70 p-5">
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-danger-bg/70 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-danger-fg">
          <X className="size-2.5" strokeWidth={2.6} />
          The old way
        </div>
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-[#217346] text-card-warm">
            <FileSpreadsheet className="size-3.5" strokeWidth={2.2} />
          </div>
          <span className="font-mono text-[11px] text-ink-warm">
            tuesday-orders-FINAL-v3.xlsx
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
          <PainPanel
            icon={Inbox}
            title="9 emails"
            sub="3 vendors, 2 customers, 4 questions"
          />
          <PainPanel
            icon={Mail}
            title="2 forwards"
            sub="from the dispatcher this hour"
          />
          <PainPanel
            icon={ShoppingCart}
            title="Order chaos"
            sub="6 in the spreadsheet, 2 on sticky notes"
          />
          <PainPanel
            icon={Receipt}
            title="Invoice TODO"
            sub="14 still to type up"
          />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Big
            label="Manual entry"
            value="36 min"
            tone="danger"
          />
          <Big
            label="Errors caught"
            value="0 of 3"
            tone="danger"
          />
        </div>
      </div>

      {/* Fluxora side */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-forest-mid/50 bg-card-warm">
        <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-forest-mid px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-card-warm">
          <Check className="size-2.5" strokeWidth={2.6} />
          The Fluxora way
        </div>
        <ReelEmbed
          slug="invoice-import"
          aspect="video"
          showOpen={false}
          className="!shadow-none [&>div:first-child]:rounded-none [&>div:first-child]:border-0"
        />
        <div className="grid grid-cols-2 gap-3 px-5 pb-5">
          <Big label="Time spent" value="4 sec" tone="success" />
          <Big label="Lines posted" value="9 of 9" tone="success" />
        </div>
      </div>
    </div>
  );
}

function PainPanel({
  icon: Icon,
  title,
  sub,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  sub: string;
}) {
  return (
    <div className="rounded-md border border-border-default bg-surface/40 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-warning-fg">
        <Icon className="size-3" strokeWidth={2} />
        <span className="text-[10.5px] font-medium uppercase tracking-[0.12em]">
          {title}
        </span>
      </div>
      <p className="mt-0.5 text-[10.5px] leading-[1.5] text-subtle">{sub}</p>
    </div>
  );
}

function Big({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card-warm px-3 py-2.5",
        tone === "success"
          ? "border-success-border/70 bg-success-bg/30"
          : "border-danger-border/70 bg-danger-bg/30",
      )}
    >
      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-subtle">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-serif text-[20px] font-medium leading-none",
          tone === "success" ? "text-success-fg" : "text-danger-fg",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function CounterStat({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
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
          "mt-1 font-serif text-[48px] font-medium leading-none tabular-nums",
          tone === "accent" ? "text-forest-tint" : "text-card-warm",
        )}
      >
        {value}
      </div>
      {suffix ? (
        <div className="mt-1.5 text-[12px] text-card-warm/60">{suffix}</div>
      ) : null}
    </div>
  );
}

// ============================ PAIN BLOCK ============================

function PainBlock({
  order,
  flip,
  pain,
  solution,
}: {
  order: number;
  flip: boolean;
  pain: {
    kicker: string;
    title: string;
    bullets: string[];
  };
  solution: {
    kicker: string;
    title: string;
    bullets: string[];
    slug: string;
    stat: string;
  };
}) {
  return (
    <article>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-subtle">
          Pain n°{order.toString().padStart(2, "0")}
        </span>
        <span className="h-px flex-1 bg-border-default" />
      </div>
      <div
        className={cn(
          "mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8",
          flip && "md:[&>*:first-child]:order-2",
        )}
      >
        {/* Pain card */}
        <div className="rounded-2xl border-2 border-danger-border/40 bg-card-warm/60 p-6">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-danger-fg">
            <X className="size-3" strokeWidth={2.4} />
            {pain.kicker}
          </div>
          <h3 className="mt-3 font-serif text-[24px] font-medium leading-[1.2] tracking-tight text-ink md:text-[28px]">
            {pain.title}
          </h3>
          <ul className="mt-4 space-y-1.5 text-[12.5px] text-ink-warm">
            {pain.bullets.map((b) => (
              <li key={b} className="flex items-start gap-1.5">
                <X
                  className="mt-1 size-2.5 shrink-0 text-danger-fg"
                  strokeWidth={2.6}
                />
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Solution card */}
        <div className="overflow-hidden rounded-2xl border-2 border-forest-mid/50 bg-card-warm shadow-[0_22px_50px_-25px_rgba(31,58,46,0.4)]">
          <div className="border-b border-border-default p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
                <Sparkles className="size-3" strokeWidth={2.4} />
                {solution.kicker}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-success-bg/60 px-2 py-0.5 font-mono text-[10px] text-success-fg">
                <Zap className="size-2.5" strokeWidth={2.4} />
                {solution.stat}
              </div>
            </div>
            <h3 className="mt-3 font-serif text-[24px] font-medium leading-[1.2] tracking-tight text-ink md:text-[28px]">
              {solution.title}
            </h3>
            <ul className="mt-4 space-y-1.5 text-[12.5px] text-ink-warm">
              {solution.bullets.map((b) => (
                <li key={b} className="flex items-start gap-1.5">
                  <Check
                    className="mt-1 size-2.5 shrink-0 text-success-fg"
                    strokeWidth={2.8}
                  />
                  <span dangerouslySetInnerHTML={{ __html: b }} />
                </li>
              ))}
            </ul>
          </div>
          <ReelEmbed slug={solution.slug} aspect="video" showOpen={false} className="!shadow-none [&>div:first-child]:rounded-none [&>div:first-child]:border-0" />
        </div>
      </div>
    </article>
  );
}

function MatrixRow({
  job,
  bad,
  good,
}: {
  job: string;
  bad: string;
  good: string;
}) {
  return (
    <>
      <div className="border-b border-border-default px-6 py-4 text-[12.5px] text-ink-warm">
        {job}
      </div>
      <div className="flex items-center gap-2 border-b border-l border-border-default px-6 py-4 text-[12.5px] text-danger-fg">
        <X className="size-3 shrink-0" strokeWidth={2.6} />
        <span>{bad}</span>
      </div>
      <div className="flex items-center gap-2 border-b border-l border-border-default bg-forest-tint/15 px-6 py-4 text-[12.5px] font-medium text-forest-mid">
        <Check className="size-3 shrink-0" strokeWidth={2.8} />
        <span>{good}</span>
      </div>
    </>
  );
}

function Testimonial({
  quote,
  name,
  role,
  highlight,
}: {
  quote: string;
  name: string;
  role: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-6",
        highlight
          ? "border-forest-mid/60 bg-card-warm shadow-[0_22px_50px_-25px_rgba(31,58,46,0.4)]"
          : "border-border-default bg-card-warm",
      )}
    >
      <Clock
        className={cn(
          "size-5",
          highlight ? "text-forest-mid" : "text-subtle",
        )}
        strokeWidth={1.6}
      />
      <p
        className="mt-3 font-serif text-[17px] leading-[1.4] tracking-tight text-ink"
      >
        “{quote}”
      </p>
      <div className="mt-5 flex items-center gap-2.5">
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-full font-mono text-[11px] font-bold",
            highlight
              ? "bg-forest-mid text-card-warm"
              : "bg-forest-tint text-forest-mid",
          )}
        >
          {name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </div>
        <div>
          <div className="text-[12.5px] font-medium text-ink">{name}</div>
          <div
            className="font-mono text-[10.5px] text-subtle"
            dangerouslySetInnerHTML={{ __html: role }}
          />
        </div>
      </div>
    </div>
  );
}

function FlatPrice({
  name,
  price,
  per,
  cta,
  features,
  recommended,
}: {
  name: string;
  price: string;
  per: string;
  cta: string;
  features: string[];
  recommended?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 bg-card-warm p-6 flex flex-col",
        recommended
          ? "border-forest-mid shadow-[0_22px_50px_-25px_rgba(31,58,46,0.45)]"
          : "border-border-default",
      )}
    >
      {recommended ? (
        <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-forest-mid px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-card-warm">
          <Timer className="size-2.5" strokeWidth={2.4} />
          Pays back in 9 days
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
