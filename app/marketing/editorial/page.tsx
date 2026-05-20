import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  Landmark,
  Quote,
  Receipt,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { MarketingFooter, MarketingNav } from "../_components/nav";
import { ReelEmbed } from "../_components/reel-embed";

export const metadata: Metadata = {
  title: "Fluxora — the ops platform for distributors",
  description:
    "The ops platform for the team running 3 a.m. trucks and 9 a.m. invoices. Sales orders, inventory, invoices, payments — all in one calm place.",
};

export default function EditorialLanding() {
  return (
    <div className="min-h-screen bg-page">
      <MarketingNav variant="editorial" variantLabel="editorial" />

      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% 20%, color-mix(in oklch, var(--color-forest-tint) 50%, transparent) 0%, transparent 70%)",
          }}
        />

        <div className="mx-auto max-w-6xl px-6 pt-16 pb-12 md:pt-24 md:pb-16">
          <p className="text-center font-mono text-[10.5px] uppercase tracking-[0.22em] text-forest-mid">
            Issue n°01 · Distribution, modern
          </p>
          <h1 className="mx-auto mt-7 max-w-[920px] text-center font-serif text-[48px] font-medium leading-[1.04] tracking-tight text-ink md:text-[72px]">
            The ops platform for the team running
            <br />
            <span className="text-forest-mid italic">
              3 a.m. trucks and 9 a.m. invoices.
            </span>
          </h1>
          <p className="mx-auto mt-7 max-w-[640px] text-center text-[16px] leading-[1.6] text-ink-warm md:text-[18px]">
            Sales orders, inventory, branded invoices, payments, AI invoice
            import — every part of running a distribution business, in one
            quiet, fast place.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="#">
                Start a free workspace
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Link
              href="/reel"
              className="text-[13px] text-ink-warm underline-offset-4 hover:text-ink hover:underline"
            >
              Or watch the product run end-to-end →
            </Link>
          </div>
          <p className="mt-3 text-center font-mono text-[10.5px] text-subtle">
            14 days free · no card · no calls
          </p>
        </div>

        {/* Big inline reel */}
        <div className="mx-auto max-w-5xl px-6 pb-16">
          <ReelEmbed slug="invoice-import" caption="The PDF invoice import flow, autoplaying" />
        </div>

        {/* Logo bar */}
        <div className="border-y border-border-default/60 bg-surface/40 py-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 text-[11px] font-medium text-subtle">
            <span className="font-mono uppercase tracking-[0.18em] text-subtle">
              Trusted by operators at
            </span>
            <div className="hidden gap-8 md:flex">
              <LogoText name="Pacific Wharf" />
              <LogoText name="Marin Provisions" />
              <LogoText name="Bay Foods Co" />
              <LogoText name="Coastal Distributors" />
              <LogoText name="Highland Provisions" />
            </div>
          </div>
        </div>
      </section>

      {/* ============================ QUOTE ============================ */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <Quote
          className="mx-auto size-7 text-forest-mid/60"
          strokeWidth={1.6}
        />
        <p className="mt-5 text-center font-serif text-[26px] leading-[1.3] tracking-tight text-ink md:text-[32px]">
          “We replaced QuickBooks, three spreadsheets, and a shared inbox.
          The crew stopped calling me after 6 p.m. — that&apos;s the
          metric I cared about.”
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

      {/* ============================ EVERYDAY ============================ */}
      <section id="product" className="border-t border-border-default/50 bg-surface/20">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeader
            eyebrow="The everyday"
            title="The four things you do every day."
            sub="Not a feature list — the flow that runs Tuesday morning."
          />

          <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-2">
            <EverydayBlock
              icon={ShoppingCart}
              kicker="Sales orders"
              title="Take the order. Pull the stock. Done."
              body="Search the customer, watch FIFO pull lots oldest-first, lock in tier pricing — margin live the whole way."
              slug="sales-order-fifo"
            />
            <EverydayBlock
              icon={Receipt}
              kicker="Invoices"
              title="Beautiful PDFs. In your brand. By email."
              body="One click and the invoice composes itself with your letterhead, attaches, and lands in your customer's inbox."
              slug="invoice-pdf"
            />
            <EverydayBlock
              icon={Wallet}
              kicker="Payments"
              title="Money in. Matched to invoices."
              body="Drop one payment, watch Fluxora apply it FIFO across open invoices and clear the aging buckets in real time."
              slug="payments"
            />
            <EverydayBlock
              icon={Boxes}
              kicker="Inventory"
              title="Every lot. Every move. Every dollar."
              body="Track lots from receipt to ship. Expiry warnings before they bite. Spoilage adjustments audit-trailed."
              slug="inventory-lots"
            />
          </div>
        </div>
      </section>

      {/* ============================ UNIQUE ============================ */}
      <section className="border-t border-border-default/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeader
            eyebrow="The unique parts"
            title="The reasons people actually switch."
            sub="Two things every other ERP we evaluated couldn't do."
          />

          <div className="mt-12 space-y-16">
            <UniqueBlock
              flip={false}
              kicker="AI invoice import"
              title="Drop a supplier PDF. We do the typing."
              body="Drag in a supplier invoice. Fluxora reads every line, matches each item to your catalog, learns the aliases, and posts the bill against the right lots. Drop the next one and it already knows."
              points={[
                "Reads PDFs at >94% accuracy",
                "Learns supplier line aliases forever",
                "Posts to AP + receives into inventory",
              ]}
              slug="invoice-import"
            />
            <UniqueBlock
              flip
              kicker="FIFO inventory"
              title="Lots that explain themselves."
              body="Every receipt grows a lot. Every order draws it down, oldest-first. Expiry warnings two days before they bite. A movement ledger for every gram in and out — auditors love it."
              points={[
                "FIFO allocation on every order",
                "Expiry-aware filters and alerts",
                "Audit-trailed movement ledger",
              ]}
              slug="inventory-lots"
            />
          </div>
        </div>
      </section>

      {/* ============================ MORE ============================ */}
      <section className="border-t border-border-default/50 bg-surface/20">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeader
            eyebrow="Everything else"
            title="The parts that make a real team."
          />

          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            <SmallCard
              icon={LayoutDashboard}
              title="Dashboard KPIs"
              body="Revenue, margin, aging, top wins — every morning, on load."
              slug="dashboard-kpis"
            />
            <SmallCard
              icon={Landmark}
              title="Bank linking"
              body="Plaid pulls daily and auto-matches every transaction."
              slug="plaid-link"
            />
            <SmallCard
              icon={Users}
              title="Roles &amp; permissions"
              body="The warehouse sees what they need. The CFO sees the P&L."
              slug="roles-permissions"
            />
            <SmallCard
              icon={FileText}
              title="Customer bulk import"
              body="Drop your spreadsheet. Eighteen customers in five seconds."
              slug="customer-bulk-import"
            />
            <SmallCard
              icon={Wallet}
              title="Expenses"
              body="Drop a receipt. AI tags it. P&L hits same day."
              slug="expenses"
            />
            <SmallCard
              icon={Boxes}
              title="Onboarding"
              body="From zero to your first workspace in under two minutes."
              slug="onboarding"
            />
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/reel"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-forest-mid hover:text-forest"
            >
              See every feature
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================ PRICING ============================ */}
      <section id="pricing" className="border-t border-border-default/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeader
            eyebrow="Pricing"
            title="Plain plans. No seat tax."
            sub="Pay annually, save 20%. Cancel anytime."
          />

          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            <PriceCard
              name="Starter"
              price="$29"
              per="per month"
              features={[
                "1 workspace",
                "Up to 100 SKUs",
                "Up to 2 users",
                "Email support",
              ]}
              cta="Try Starter"
            />
            <PriceCard
              name="Growth"
              price="$99"
              per="per month"
              recommended
              features={[
                "Up to 5,000 SKUs",
                "Up to 10 users",
                "FIFO inventory + lots",
                "Plaid bank linking",
                "Priority support",
              ]}
              cta="Choose Growth"
            />
            <PriceCard
              name="Enterprise"
              price="Talk to us"
              per=""
              features={[
                "Unlimited SKUs &amp; users",
                "AI invoice import",
                "Custom roles &amp; SSO",
                "Audit log retention",
                "Named CSM",
              ]}
              cta="Contact sales"
            />
          </div>
        </div>
      </section>

      {/* ============================ FINAL CTA ============================ */}
      <section className="border-t border-border-default/50 bg-surface/30">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="font-serif text-[40px] font-medium leading-[1.1] tracking-tight text-ink md:text-[52px]">
            One quiet platform.
            <br />
            <span className="text-forest-mid">For the rest of your career.</span>
          </h2>
          <div className="mt-8">
            <Button size="lg" asChild>
              <Link href="#">
                Start a free workspace
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <p className="mt-3 font-mono text-[10.5px] text-subtle">
              14 days free · no card · no calls
            </p>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

// ---------- atoms ----------

function SectionHeader({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <header className="mx-auto max-w-2xl text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-mid">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-ink md:text-[44px]">
        {title}
      </h2>
      {sub ? (
        <p className="mt-4 text-[14.5px] leading-[1.6] text-ink-warm">{sub}</p>
      ) : null}
    </header>
  );
}

function LogoText({ name }: { name: string }) {
  return (
    <span className="font-serif text-[14px] tracking-tight text-ink-warm">
      {name}
    </span>
  );
}

function EverydayBlock({
  icon: Icon,
  kicker,
  title,
  body,
  slug,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  kicker: string;
  title: string;
  body: string;
  slug: string;
}) {
  return (
    <article>
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-forest-mid">
        <Icon className="size-3" strokeWidth={2.2} />
        {kicker}
      </div>
      <h3 className="mt-3 font-serif text-[24px] font-medium leading-[1.18] tracking-tight text-ink md:text-[28px]">
        {title}
      </h3>
      <p className="mt-3 text-[14px] leading-[1.65] text-ink-warm">{body}</p>
      <div className="mt-6">
        <ReelEmbed slug={slug} aspect="video" />
      </div>
    </article>
  );
}

function UniqueBlock({
  flip,
  kicker,
  title,
  body,
  points,
  slug,
}: {
  flip: boolean;
  kicker: string;
  title: string;
  body: string;
  points: string[];
  slug: string;
}) {
  return (
    <article
      className={`grid grid-cols-1 items-center gap-10 md:grid-cols-2 ${flip ? "md:[&>*:first-child]:order-2" : ""}`}
    >
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-mid">
          {kicker}
        </p>
        <h3 className="mt-3 font-serif text-[32px] font-medium leading-[1.1] tracking-tight text-ink md:text-[40px]">
          {title}
        </h3>
        <p className="mt-4 text-[15px] leading-[1.65] text-ink-warm">{body}</p>
        <ul className="mt-6 space-y-2">
          {points.map((p) => (
            <li
              key={p}
              className="flex items-center gap-2 text-[13.5px] text-ink"
            >
              <CheckCircle2
                className="size-3.5 text-forest-mid"
                strokeWidth={2}
              />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <ReelEmbed slug={slug} aspect="video" />
    </article>
  );
}

function SmallCard({
  icon: Icon,
  title,
  body,
  slug,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
  slug: string;
}) {
  return (
    <Link
      href={`/reel/${slug}`}
      target="_blank"
      className="group flex flex-col rounded-2xl border border-border-default bg-card-warm p-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(31,58,46,0.35)]"
    >
      <div className="flex size-10 items-center justify-center rounded-xl bg-forest-tint text-forest-mid">
        <Icon className="size-5" strokeWidth={1.8} />
      </div>
      <h3
        className="mt-4 font-serif text-[18px] font-medium leading-tight text-ink"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      <p
        className="mt-2 flex-1 text-[12.5px] leading-[1.55] text-subtle"
        dangerouslySetInnerHTML={{ __html: body }}
      />
      <span className="mt-3 inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-forest-mid">
        Watch demo
        <ArrowRight
          className="size-2.5 transition-transform group-hover:translate-x-0.5"
          strokeWidth={2.4}
        />
      </span>
    </Link>
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
      className={`flex h-full flex-col rounded-2xl border-2 bg-card-warm p-6 ${recommended ? "border-forest-mid shadow-[0_22px_50px_-25px_rgba(31,58,46,0.45)]" : "border-border-default"}`}
    >
      {recommended ? (
        <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-forest-mid px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-card-warm">
          Most popular
        </span>
      ) : null}
      <h3 className="font-serif text-[22px] font-medium text-ink">{name}</h3>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-serif text-[36px] font-medium leading-none text-ink">
          {price}
        </span>
        {per ? <span className="text-[12px] text-subtle">{per}</span> : null}
      </div>
      <ul className="mt-5 flex-1 space-y-2 text-[13px] text-ink-warm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-1.5">
            <CheckCircle2
              className="mt-0.5 size-3.5 shrink-0 text-forest-mid"
              strokeWidth={2}
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
