import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  DollarSign,
  HelpCircle,
  Lock,
  Phone,
  Quote,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { MarketingFooter, MarketingNav } from "../_components/nav";
import { WalkthroughHero } from "./_components/walkthrough-hero";

export const metadata: Metadata = {
  title: "Fluxora — See a distribution business run end-to-end in 90 seconds",
  description:
    "Five Tuesday-morning workflows for food and specialty distributors. The spreadsheet way and the Fluxora way, side-by-side. Try free for 14 days, no card required.",
};

export default function WalkthroughLanding() {
  return (
    <div className="min-h-screen bg-page">
      {/* ============================ TOP RIBBON ============================ */}
      <div className="bg-ink py-1.5 text-card-warm">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-6 font-mono text-[10.5px] uppercase tracking-[0.14em]">
          <Sparkles className="size-3 text-forest-tint" strokeWidth={2.2} />
          <span className="text-card-warm/80">
            217 distributors run Tuesday morning on Fluxora
          </span>
          <span className="text-card-warm/30">·</span>
          <Link
            href="#testimonials"
            className="text-forest-tint underline-offset-2 hover:underline"
          >
            See how →
          </Link>
        </div>
      </div>

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
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-card-warm px-3 py-1">
              <Award className="size-3 text-forest-mid" strokeWidth={2.2} />
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-forest-mid">
                Built for food &amp; specialty distributors
              </span>
            </div>

            <h1 className="mt-6 font-serif text-[44px] font-medium leading-[1.02] tracking-tight text-ink md:text-[68px]">
              See a distribution business run,
              <br />
              end-to-end,{" "}
              <span className="text-forest-mid italic">
                in 90 seconds.
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-[600px] text-[16px] leading-[1.55] text-ink-warm md:text-[18px]">
              From the supplier PDF that lands at 8 a.m. to the invoice that
              hits the customer&apos;s inbox by 9. Five workflows, the
              spreadsheet way and the Fluxora way — side-by-side.
            </p>

            <ul className="mx-auto mt-7 flex max-w-2xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-ink-warm">
              {[
                "Real workflows, not staged screens",
                "Time + steps side-by-side",
                "No login, no sales call",
              ].map((label) => (
                <li key={label} className="inline-flex items-center gap-1.5">
                  <Check
                    className="size-3 text-forest-mid"
                    strokeWidth={2.6}
                  />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10">
            <WalkthroughHero />
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="#">
                Start your free workspace
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#">
                <Phone className="size-4" />
                Book a 15-min walkthrough
              </Link>
            </Button>
          </div>
          <p className="mt-3 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle">
            14-day free trial · no credit card · cancel anytime
          </p>

          <div className="mt-12 border-y border-border-default/60 bg-card-warm/40 py-5">
            <div className="flex items-center justify-between gap-2 text-center">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">
                Used by
              </span>
              <div className="hidden flex-1 items-center justify-around gap-4 md:flex">
                <LogoText name="Pacific Wharf" />
                <LogoText name="Marin Provisions" />
                <LogoText name="Bay Foods Co" />
                <LogoText name="Coastal Distribution" />
                <LogoText name="Highland Provisions" />
                <LogoText name="Tidewater Foods" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">
                + 211 more
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ OPERATOR NUMBERS ============================ */}
      <section className="border-y border-border-default/60 bg-ink py-14 text-card-warm">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-tint">
              Numbers from real operators
            </p>
            <h2 className="mt-3 font-serif text-[28px] font-medium leading-tight tracking-tight md:text-[36px]">
              The hours Fluxora gives back, by Tuesday.
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
            <OpStat
              value="14 hrs"
              label="back in the week"
              detail="median saved on supplier invoicing + AR reconcile"
            />
            <OpStat
              value="9.4 days"
              label="off month-end close"
              detail="vs QuickBooks + spreadsheet workflows"
              highlight
            />
            <OpStat
              value="$3,400"
              label="recovered margin"
              detail="from priced-lot tracking, monthly average"
            />
            <OpStat
              value="93%"
              label="invoices auto-matched"
              detail="from Plaid bank feed to open AR"
            />
          </div>

          <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-card-warm/40">
            Source · Fluxora workspace telemetry, March–May 2026 · n=78 active
            distributors
          </p>
        </div>
      </section>

      {/* ============================ WHAT YOU'RE BUYING ============================ */}
      <section className="border-b border-border-default/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <header className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-mid">
              What you&apos;re actually buying
            </p>
            <h2 className="mt-3 font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[44px]">
              Three changes a distribution operator can feel.
            </h2>
          </header>

          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
            <BuyingCard
              icon={Clock}
              kicker="The morning ends"
              title="Tuesdays back to email by 9:15."
              body="The supplier-PDF retype, the FIFO sticky note, the manual ACH reconcile — all gone. Your team finishes the morning routine before the second cup."
              proof="Median saved: 14 hours / week"
            />
            <BuyingCard
              icon={DollarSign}
              kicker="The margins surface"
              title="Recover $3,400 in priced-lot margin."
              body="Tier-aware pricing and FIFO allocation expose the margin you've been giving away on aging stock. Same orders, more dollars to the bottom line."
              proof="Average operator · monthly"
            />
            <BuyingCard
              icon={ShieldCheck}
              kicker="The closes calm down"
              title="Month-end becomes an afternoon."
              body="Aging is live, payments apply oldest-first, the lot ledger handles itself. Your accountant gets a clean handoff instead of a 90-tab spreadsheet."
              proof="9.4 days saved on close"
            />
          </div>
        </div>
      </section>

      {/* ============================ SWITCHING ============================ */}
      <section className="border-b border-border-default/50 bg-surface/30">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <header className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-mid">
              Switching from QuickBooks or Excel
            </p>
            <h2 className="mt-3 font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[44px]">
              A morning, not a quarter.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[14px] leading-[1.6] text-ink-warm">
              We&apos;ve onboarded 217 distributors. The longest one took
              eight hours. We bring your data over, you sign off, you ship
              the next day.
            </p>
          </header>

          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Step
              n="01"
              title="Day 1 · We move the data"
              body="Send us a CSV export or a screen-share. We import customers, products, open invoices, open bills, and the last 90 days of inventory. Reconciled before you sign on."
              when="~ 4 hours · our team"
            />
            <Step
              n="02"
              title="Day 2 · You operate in parallel"
              body="Keep your old system live for a week. We run a daily diff so you can see the same orders in both. When you're happy, you flip the switch."
              when="~ 1 week · light touch"
            />
            <Step
              n="03"
              title="Day 8 · QuickBooks is read-only"
              body="Your team is on Fluxora. We keep QuickBooks read-only for 90 days so your accountant has a comfort blanket. After that, full export and you own it forever."
              when="forever, your data"
            />
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 rounded-2xl border border-success-border/60 bg-success-bg/30 p-5 md:grid-cols-3 md:gap-6">
            <RiskItem
              icon={BadgeCheck}
              title="Free migration"
              body="We do the data move. No setup fee, no consulting charge."
            />
            <RiskItem
              icon={Database}
              title="Your data, exportable"
              body="Full export to CSV / Excel / SQL anytime. We can't hold you hostage."
            />
            <RiskItem
              icon={Lock}
              title="60-day no-risk"
              body="If it isn't faster than your old setup, you get a full refund. We've never had to issue one."
            />
          </div>
        </div>
      </section>

      {/* ============================ TESTIMONIALS ============================ */}
      <section id="testimonials" className="border-b border-border-default/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <header className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-mid">
              Operators who switched
            </p>
            <h2 className="mt-3 font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[44px]">
              Specific outcomes, not testimonials.
            </h2>
          </header>

          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
            <Testimonial
              outcome="$54,000 / year saved"
              outcomeSub="Replaced QuickBooks Enterprise + part-time bookkeeper"
              quote="We dropped the bookkeeper. Not because we wanted to — there just weren't enough hours for them to bill. Fluxora absorbed the work that took her four days a month."
              name="Sarah Chen"
              role="Owner"
              company="Pacific Wharf Provisions · Tiburon, CA"
              avatar="SC"
            />
            <Testimonial
              highlight
              outcome="9 days off month-end"
              outcomeSub="From 12-day close to 3-day close"
              quote="The FIFO thing is the killer feature. My old system pretended FIFO existed. Fluxora actually does it, and my P&L finally tells the truth about what each lot earned."
              name="Lily Park"
              role="Operations Manager"
              company="Bramble &amp; Bay Bistro Supply · Oakland, CA"
              avatar="LP"
            />
            <Testimonial
              outcome="14 hrs / week back"
              outcomeSub="Across receiving, invoicing, and AR matching"
              quote="I open Fluxora before I open my email now. That's the real test. The team doesn't ping me at 6 p.m. anymore because everything they need is in there."
              name="Diego Patel"
              role="General Manager"
              company="Coastal Distribution Co. · San Francisco, CA"
              avatar="DP"
            />
          </div>

          <div className="mt-8 text-center">
            <Link
              href="#"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-forest-mid hover:text-forest"
            >
              Read 14 more case studies
              <ChevronRight className="size-3" strokeWidth={2.4} />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================ VS ALTERNATIVES ============================ */}
      <section className="border-b border-border-default/50 bg-surface/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <header className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-mid">
              Compared to what you&apos;re running today
            </p>
            <h2 className="mt-3 font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[44px]">
              The shortlist, side by side.
            </h2>
          </header>

          <div className="mt-12 overflow-hidden rounded-2xl border border-border-default bg-card-warm">
            <div className="grid grid-cols-5 border-b border-border-default bg-surface/60 text-[10px] uppercase tracking-[0.12em] text-subtle">
              <div className="px-4 py-3 font-medium">The job</div>
              <div className="px-4 py-3 text-center font-medium">
                Excel + email
              </div>
              <div className="px-4 py-3 text-center font-medium">
                QuickBooks
              </div>
              <div className="px-4 py-3 text-center font-medium">NetSuite</div>
              <div className="bg-forest-tint/40 px-4 py-3 text-center font-medium text-forest-mid">
                Fluxora
              </div>
            </div>

            <CompareRow
              job="FIFO lot allocation"
              excel="—"
              qb="add-on"
              netsuite="✓ (configured)"
              fluxora="✓ built-in"
            />
            <CompareRow
              job="AI PDF invoice import"
              excel="—"
              qb="—"
              netsuite="—"
              fluxora="✓ 94% accuracy"
            />
            <CompareRow
              job="Live AR aging"
              excel="manual export"
              qb="report only"
              netsuite="✓"
              fluxora="✓ on every page"
            />
            <CompareRow
              job="Plaid bank auto-match"
              excel="—"
              qb="basic"
              netsuite="add-on"
              fluxora="✓ FIFO across opens"
            />
            <CompareRow
              job="Branded invoice email"
              excel="manual"
              qb="basic"
              netsuite="✓"
              fluxora="✓ delivery-tracked"
            />
            <CompareRow
              job="Setup time"
              excel="—"
              qb="2 weeks"
              netsuite="3–6 months"
              fluxora="1 morning"
              winner
            />
            <CompareRow
              job="Monthly cost (10-user team)"
              excel="$0"
              qb="$200–$2,500"
              netsuite="$4,500+"
              fluxora="$99"
              winner
              last
            />
          </div>

          <p className="mt-5 text-center font-mono text-[10.5px] text-subtle">
            Pricing comparisons reflect each vendor&apos;s published rates for
            a 10-user food-distribution workspace, May 2026.
          </p>
        </div>
      </section>

      {/* ============================ CALCULATOR ============================ */}
      <section className="border-b border-border-default/50">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <header className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-mid">
              The stack swap
            </p>
            <h2 className="mt-3 font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[44px]">
              Replace four tools. Save $1,728 / month.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[14px] leading-[1.6] text-ink-warm">
              The math from the typical 10-person food-distribution shop we
              onboard. Your numbers may differ — but the shape doesn&apos;t.
            </p>
          </header>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-2xl border-2 border-border-default bg-card-warm p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                What you&apos;re paying now
              </div>
              <h3 className="mt-2 font-serif text-[20px] font-medium text-ink">
                The cobbled stack
              </h3>
              <ul className="mt-4 divide-y divide-border-default text-[13px]">
                <StackRow label="QuickBooks Enterprise" price="$420" />
                <StackRow label="Inventory add-on (e.g. SOS)" price="$215" />
                <StackRow label="Document storage + e-sign" price="$53" />
                <StackRow
                  label="Part-time bookkeeper"
                  price="$1,140"
                  detail="6 hrs/week @ $45/hr"
                />
              </ul>
              <div className="mt-4 flex items-baseline justify-between border-t-2 border-dashed border-danger-border/40 pt-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-subtle">
                  Total / month
                </span>
                <span className="font-serif text-[28px] font-medium text-danger-fg tabular-nums">
                  $1,828
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-2 md:py-12">
              <ArrowRight className="size-7 text-forest-mid" strokeWidth={1.8} />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
                save 94%
              </span>
            </div>

            <div className="rounded-2xl border-2 border-success-border/80 bg-success-bg/20 p-5 shadow-[0_22px_50px_-25px_rgba(74,107,47,0.4)]">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-success-fg">
                What you&apos;d pay instead
              </div>
              <h3 className="mt-2 font-serif text-[20px] font-medium text-ink">
                Fluxora · Growth
              </h3>
              <ul className="mt-4 divide-y divide-success-border/30 text-[13px]">
                <StackRow label="Fluxora Growth plan" price="$99" />
                <StackRow label="AP / AR · inventory" price="included" muted />
                <StackRow label="AI invoice import" price="included" muted />
                <StackRow label="Plaid bank linking" price="included" muted />
              </ul>
              <div className="mt-4 flex items-baseline justify-between border-t-2 border-success-border/40 pt-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-subtle">
                  Total / month
                </span>
                <span className="font-serif text-[28px] font-medium text-success-fg tabular-nums">
                  $99
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-forest-mid/60 bg-forest-tint/30 px-6 py-4 text-center md:flex-row md:gap-5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
              Net savings
            </span>
            <span className="font-serif text-[28px] font-medium text-forest-mid tabular-nums md:text-[34px]">
              $1,728 / month
            </span>
            <span className="text-[12.5px] text-ink-warm">
              = <strong>$20,736 / year</strong>, before the time savings.
            </span>
          </div>
        </div>
      </section>

      {/* ============================ PRICING ============================ */}
      <section id="pricing" className="border-b border-border-default/50 bg-surface/20">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <header className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-mid">
              Pricing
            </p>
            <h2 className="mt-3 font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[44px]">
              Plain plans. No seat tax. No setup fee.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[14px] leading-[1.6] text-ink-warm">
              Most distributors land on <strong>Growth</strong> — it covers
              everything in the walkthrough above, including AI invoice
              import and FIFO. Annual billing saves 20%.
            </p>
          </header>

          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            <PriceCard
              name="Starter"
              price="$29"
              per="/mo"
              cta="Try Starter"
              forWho="For 1–2 person shops"
              features={[
                "1 workspace · 2 users",
                "Up to 100 SKUs",
                "Branded invoicing",
                "Email support",
              ]}
            />
            <PriceCard
              name="Growth"
              price="$99"
              per="/mo"
              recommended
              cta="Choose Growth"
              forWho="Most distributors land here"
              features={[
                "Up to 5,000 SKUs · 10 users",
                "FIFO inventory + lots",
                "AI invoice import",
                "Plaid bank linking",
                "Free data migration",
                "Priority support",
              ]}
            />
            <PriceCard
              name="Enterprise"
              price="Custom"
              per=""
              cta="Talk to us"
              forWho="Multi-warehouse + SSO"
              features={[
                "Unlimited SKUs &amp; users",
                "Custom roles &amp; SSO",
                "Audit log retention",
                "SOC 2 documentation",
                "Named CSM + SLA",
              ]}
            />
          </div>

          <p className="mt-8 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle">
            All plans include the 60-day no-risk guarantee · free data
            migration · audit-trailed history
          </p>
        </div>
      </section>

      {/* ============================ FAQ ============================ */}
      <section className="border-b border-border-default/50">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <header className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-mid">
              The objections people actually have
            </p>
            <h2 className="mt-3 font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[44px]">
              Answered, before you ask.
            </h2>
          </header>

          <div className="mt-12 divide-y divide-border-default rounded-2xl border border-border-default bg-card-warm">
            <Faq
              q="We just moved to QuickBooks last year — switching again sounds painful."
              a="Onboarding has averaged 6.4 hours of your team's time across our last 30 customers. We handle the data import; you keep QuickBooks live for a week of parallel running. If you're not faster on Fluxora in 60 days, we refund the year."
            />
            <Faq
              q="What about our existing data, history, attachments?"
              a="Everything imports — customers, products, lots, open AR, open AP, last 18 months of transactions, attached PDFs. Nothing is held hostage. Full SQL / CSV / Excel export anytime, even after you cancel."
            />
            <Faq
              q="We're 3 people. Do we really need this?"
              a="If you're spending more than 4 hours a week on supplier invoices, customer billing, or aging reports — yes. Most 2–3 person shops we onboard save 8–12 hours their first month. Starter ($29) covers the basics; you can move to Growth when SKUs grow."
            />
            <Faq
              q="What about IT, security, SOC 2?"
              a="Data is hosted on Neon (US-East), all traffic is TLS, daily encrypted backups with 30-day retention. SOC 2 Type II audit closes Q3 2026 — we'll share the draft on request. Single sign-on (Google + custom SAML) is included on Enterprise."
            />
            <Faq
              q="What if the AI invoice import gets a line wrong?"
              a="Every extracted line shows a confidence score. Anything under 90% lands in a review queue before posting. You confirm or correct in one click; the correction trains the alias map so the same supplier reads cleanly next time."
            />
            <Faq
              q="What does the trial look like?"
              a="14 days, no credit card. You get the Growth plan with sample data preloaded plus the ability to import your real data. If you want a guided walkthrough, we'll book 15 minutes with an operator — no sales pitch, just answers."
            />
          </div>
        </div>
      </section>

      {/* ============================ FINAL CTA ============================ */}
      <section className="bg-ink py-20 text-card-warm">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-serif text-[40px] font-medium leading-[1.05] tracking-tight md:text-[56px]">
            Pick a Tuesday.
            <br />
            <span className="text-forest-tint">Be bored by 9:15.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[14.5px] leading-[1.6] text-card-warm/70">
            14 days free, no credit card. We migrate your data, you decide if
            it&apos;s faster. If it isn&apos;t, we refund the year — though
            we&apos;ve never had to.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              variant="default"
              className="border-card-warm bg-card-warm text-ink hover:bg-card-warm/90"
              asChild
            >
              <Link href="#">
                Start your free workspace
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-card-warm/40 text-card-warm hover:bg-card-warm/10"
              asChild
            >
              <Link href="#">
                <Calendar className="size-4" />
                Book a 15-min walkthrough
              </Link>
            </Button>
          </div>

          <div className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-3 text-left md:grid-cols-4">
            <Trust icon={ShieldCheck} label="60-day refund" sub="Full money back" />
            <Trust icon={BadgeCheck} label="Free migration" sub="Our team does it" />
            <Trust icon={Database} label="Your data exportable" sub="No lock-in" />
            <Trust icon={Lock} label="SOC 2 in progress" sub="Q3 2026" />
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

// ============================ ATOMS ============================

function LogoText({ name }: { name: string }) {
  return (
    <span className="font-serif text-[14px] tracking-tight text-ink-warm">
      {name}
    </span>
  );
}

function OpStat({
  value,
  label,
  detail,
  highlight,
}: {
  value: string;
  label: string;
  detail: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div
        className={cn(
          "font-serif text-[40px] font-medium leading-none tabular-nums md:text-[52px]",
          highlight ? "text-forest-tint" : "text-card-warm",
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          "mt-1 text-[13px] font-medium",
          highlight ? "text-forest-tint" : "text-card-warm",
        )}
      >
        {label}
      </div>
      <div className="mt-1 text-[11px] leading-[1.5] text-card-warm/60">
        {detail}
      </div>
    </div>
  );
}

function BuyingCard({
  icon: Icon,
  kicker,
  title,
  body,
  proof,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  kicker: string;
  title: string;
  body: string;
  proof: string;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-border-default bg-card-warm p-6">
      <div className="flex size-10 items-center justify-center rounded-xl bg-forest-tint text-forest-mid">
        <Icon className="size-5" strokeWidth={1.8} />
      </div>
      <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
        {kicker}
      </p>
      <h3 className="mt-1 font-serif text-[22px] font-medium leading-tight tracking-tight text-ink">
        {title}
      </h3>
      <p className="mt-3 flex-1 text-[13px] leading-[1.6] text-ink-warm">
        {body}
      </p>
      <div className="mt-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-forest-tint/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
        <TrendingUp className="size-3" strokeWidth={2.2} />
        {proof}
      </div>
    </article>
  );
}

function Step({
  n,
  title,
  body,
  when,
}: {
  n: string;
  title: string;
  body: string;
  when: string;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-border-default bg-card-warm p-5">
      <div className="font-mono text-[28px] font-medium leading-none text-forest-mid">
        {n}
      </div>
      <h3 className="mt-4 font-serif text-[17px] font-medium leading-tight text-ink">
        {title}
      </h3>
      <p className="mt-2 flex-1 text-[12.5px] leading-[1.55] text-ink-warm">
        {body}
      </p>
      <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
        <Clock className="size-2.5" strokeWidth={2} />
        {when}
      </span>
    </article>
  );
}

function RiskItem({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-fg text-card-warm">
        <Icon className="size-4" strokeWidth={2.2} />
      </div>
      <div>
        <div className="text-[13px] font-medium text-ink">{title}</div>
        <div className="mt-0.5 text-[11.5px] leading-[1.5] text-ink-warm">
          {body}
        </div>
      </div>
    </div>
  );
}

function Testimonial({
  outcome,
  outcomeSub,
  quote,
  name,
  role,
  company,
  avatar,
  highlight,
}: {
  outcome: string;
  outcomeSub: string;
  quote: string;
  name: string;
  role: string;
  company: string;
  avatar: string;
  highlight?: boolean;
}) {
  return (
    <article
      className={cn(
        "flex flex-col rounded-2xl border-2 p-6",
        highlight
          ? "border-forest-mid/60 bg-card-warm shadow-[0_22px_50px_-25px_rgba(31,58,46,0.4)]"
          : "border-border-default bg-card-warm",
      )}
    >
      <div
        className={cn(
          "rounded-lg px-3 py-2.5",
          highlight ? "bg-forest-tint/40" : "bg-surface/50",
        )}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-mid">
          Outcome
        </div>
        <div className="mt-0.5 font-serif text-[22px] font-medium leading-none text-ink">
          {outcome}
        </div>
        <div className="mt-1 text-[11.5px] leading-[1.5] text-ink-warm">
          {outcomeSub}
        </div>
      </div>

      <Quote
        className={cn(
          "mt-5 size-5",
          highlight ? "text-forest-mid" : "text-subtle",
        )}
        strokeWidth={1.6}
      />
      <p className="mt-2 flex-1 font-serif text-[15px] leading-[1.45] tracking-tight text-ink">
        “{quote}”
      </p>

      <div className="mt-5 flex items-center gap-2.5 border-t border-border-default pt-4">
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-full font-mono text-[11px] font-bold",
            highlight
              ? "bg-forest-mid text-card-warm"
              : "bg-forest-tint text-forest-mid",
          )}
        >
          {avatar}
        </div>
        <div>
          <div className="text-[12.5px] font-medium text-ink">{name}</div>
          <div className="text-[10.5px] text-subtle">{role}</div>
          <div
            className="font-mono text-[10px] text-subtle"
            dangerouslySetInnerHTML={{ __html: company }}
          />
        </div>
      </div>
    </article>
  );
}

function CompareRow({
  job,
  excel,
  qb,
  netsuite,
  fluxora,
  winner,
  last,
}: {
  job: string;
  excel: string;
  qb: string;
  netsuite: string;
  fluxora: string;
  winner?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-5 text-[12.5px]",
        !last && "border-b border-border-default",
      )}
    >
      <div className="px-4 py-3 font-medium text-ink">{job}</div>
      <Cell value={excel} />
      <Cell value={qb} />
      <Cell value={netsuite} />
      <Cell value={fluxora} fluxora winner={winner} />
    </div>
  );
}

function Cell({
  value,
  fluxora,
  winner,
}: {
  value: string;
  fluxora?: boolean;
  winner?: boolean;
}) {
  const isCheck = value.startsWith("✓");
  const isDash = value === "—";
  return (
    <div
      className={cn(
        "px-4 py-3 text-center font-mono text-[11.5px]",
        fluxora && "bg-forest-tint/30 font-medium text-forest-mid",
        winner && fluxora && "bg-forest-tint/50",
        !fluxora && isDash && "text-subtle",
        !fluxora && !isCheck && !isDash && "text-ink-warm",
      )}
    >
      {value}
    </div>
  );
}

function StackRow({
  label,
  price,
  detail,
  muted,
}: {
  label: string;
  price: string;
  detail?: string;
  muted?: boolean;
}) {
  return (
    <li className="flex items-baseline justify-between py-2">
      <div>
        <div
          className={cn(
            "text-[13px]",
            muted ? "text-subtle" : "text-ink-warm",
          )}
        >
          {label}
        </div>
        {detail ? (
          <div className="font-mono text-[10px] text-subtle">{detail}</div>
        ) : null}
      </div>
      <span
        className={cn(
          "font-mono text-[12.5px] tabular-nums",
          muted ? "text-success-fg" : "text-ink",
        )}
      >
        {price}
      </span>
    </li>
  );
}

function PriceCard({
  name,
  price,
  per,
  features,
  cta,
  recommended,
  forWho,
}: {
  name: string;
  price: string;
  per: string;
  features: string[];
  cta: string;
  recommended?: boolean;
  forWho: string;
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
          <Sparkles className="size-2.5" strokeWidth={2.4} />
          Most distributors land here
        </span>
      ) : null}
      <h3 className="font-serif text-[22px] font-medium text-ink">{name}</h3>
      <p className="mt-0.5 font-mono text-[10.5px] text-subtle">{forWho}</p>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-serif text-[36px] font-medium leading-none text-ink">
          {price}
        </span>
        {per ? <span className="text-[12px] text-subtle">{per}</span> : null}
      </div>
      <ul className="mt-5 flex-1 space-y-1.5 text-[13px] text-ink-warm">
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
        className="mt-6"
        asChild
      >
        <Link href="#">{cta}</Link>
      </Button>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group px-5 py-4 first:rounded-t-2xl last:rounded-b-2xl open:bg-surface/30">
      <summary className="flex cursor-pointer list-none items-start gap-3 text-[14px] font-medium text-ink [&::-webkit-details-marker]:hidden">
        <HelpCircle
          className="mt-0.5 size-3.5 shrink-0 text-forest-mid"
          strokeWidth={2}
        />
        <span className="flex-1">{q}</span>
        <ChevronDown
          className="mt-0.5 size-4 shrink-0 text-subtle transition-transform group-open:rotate-180"
          strokeWidth={2}
        />
      </summary>
      <p className="mt-3 pl-7 text-[13px] leading-[1.6] text-ink-warm">{a}</p>
    </details>
  );
}

function Trust({
  icon: Icon,
  label,
  sub,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-forest-tint"
        strokeWidth={1.8}
      />
      <div>
        <div className="text-[12px] font-medium text-card-warm">{label}</div>
        <div className="text-[10.5px] text-card-warm/60">{sub}</div>
      </div>
    </div>
  );
}
