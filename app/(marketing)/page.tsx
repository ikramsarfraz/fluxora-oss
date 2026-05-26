import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FluxoraMark } from "@/components/brand/fluxora-mark";
import { auth } from "@/lib/auth";
import { getCurrentRequestTenant } from "@/modules/core/tenants/services/tenants";
import { loadAuthenticatedDestinationSelectView } from "@/modules/shared/services/auth";

export default async function MarketingPage() {
  const requestTenant = await getCurrentRequestTenant();

  if (requestTenant.isRootHost) {
    const headerList = await headers();
    const session = await auth.api.getSession({ headers: headerList });

    if (session?.user?.id && session.session?.id) {
      const selection = await loadAuthenticatedDestinationSelectView({
        authUserId: session.user.id,
        sessionId: session.session.id,
        returnTo: null,
      });

      if (selection.view === "redirect") {
        redirect(selection.url);
      }
      if (selection.view === "choose") {
        redirect("/select-destination");
      }
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-page font-sans text-ink antialiased">
      <Ribbon />
      <Nav />
      <Hero />
      <Features />
      <WorkflowsStrip />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <SiteFooter />
    </div>
  );
}

/* ── Ribbon ──────────────────────────────────────────────────── */

function Ribbon() {
  return (
    <div className="bg-ink text-card-warm">
      <div className="mx-auto flex max-w-[1200px] items-center justify-center gap-2 px-6 py-2 font-mono text-[11px] tracking-[0.04em]">
        <span aria-hidden className="text-gold">✦</span>
        217 distributors run Tuesday morning on Fluxora ·{" "}
        <Link href="#testimonials" className="text-card-warm underline-offset-2 hover:underline">
          Read the case studies →
        </Link>
      </div>
    </div>
  );
}

/* ── Nav ─────────────────────────────────────────────────────── */

function Nav() {
  return (
    <nav className="sticky top-0 z-30 border-b-[0.5px] border-border-soft bg-page/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-6 px-6">
        <Link href="/" className="inline-flex items-center gap-[9px] text-[19px] font-semibold leading-none tracking-[-0.03em]">
          <FluxoraMark size={28} />
          <span className="relative">
            <span className="relative">Flu</span>xora
            <span
              aria-hidden
              className="pointer-events-none absolute bg-gold"
              style={{ left: 0, right: "65%", bottom: -3, height: 1.5 }}
            />
          </span>
        </Link>
        <div className="hidden items-center gap-6 text-[13px] text-ink-warm md:flex">
          {[
            ["Product", "#product"],
            ["Workflows", "#workflows"],
            ["Customers", "#testimonials"],
            ["Pricing", "#pricing"],
            ["FAQ", "#faq"],
          ].map(([label, href]) => (
            <Link
              key={label as string}
              href={href as string}
              className="border-b border-transparent pb-[2px] transition-colors hover:border-ink hover:text-ink"
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/signin"
            className="hidden rounded-md px-3.5 py-2 text-[13px] font-medium text-ink-warm transition-colors hover:bg-surface hover:text-ink sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-forest px-4 py-2.5 text-[13px] font-medium text-card-warm transition-colors hover:bg-forest-mid"
          >
            Start free
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ── Hero ────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 pb-16 pt-20 lg:pt-28">
      <Link
        href="#workflows"
        className="inline-flex items-center gap-2 rounded-full border-[0.5px] border-border-default bg-card-warm px-3 py-1 text-[12px] text-ink-warm transition-colors hover:border-ink"
      >
        <span className="rounded-sm bg-forest px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-card-warm">
          New
        </span>
        Catch-weight invoicing now ships standard
        <span aria-hidden className="text-subtle">→</span>
      </Link>

      <h1 className="mt-8 max-w-[920px] text-[48px] font-semibold leading-[1.02] tracking-[-0.035em] text-ink sm:text-[60px] lg:text-[72px]">
        Run every operation
        <br />
        from{" "}
        <span className="relative inline-block px-1">
          one
          <span
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left: "-2%",
              right: "-2%",
              top: "50%",
              height: 6,
              background: "var(--color-gold)",
              borderRadius: 2,
              transform: "rotate(-3deg)",
            }}
          />
        </span>{" "}
        <span style={{ color: "var(--color-forest)" }}>one workspace.</span>
      </h1>

      <p className="mt-6 max-w-[640px] text-[18px] leading-[1.55] text-subtle">
        Suppliers, lots, customers, sales orders, invoices, payments — the whole
        distribution day, scoped to your workspace. No more reconciling four
        systems against the same shipment.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-md bg-forest px-5 py-3 text-[14px] font-medium text-card-warm transition-colors hover:bg-forest-mid"
        >
          Start free workspace
        </Link>
        <Link
          href="#product"
          className="inline-flex items-center justify-center rounded-md border-[0.5px] border-border-default bg-card px-5 py-3 text-[14px] font-medium text-ink transition-colors hover:bg-card-warm"
        >
          See it in action
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-[12.5px] text-subtle">
        <span className="font-medium text-ink-warm">14-day free trial</span>
        <span aria-hidden className="text-muted">·</span>
        <span>No credit card</span>
        <span aria-hidden className="text-muted">·</span>
        <span>Onboarding in &lt; 30 min</span>
      </div>

      <ProductMock />

      <UsedByRow />
    </section>
  );
}

function ProductMock() {
  return (
    <div
      id="product"
      className="mt-14 overflow-hidden rounded-xl border-[0.5px] border-border-soft bg-card"
      style={{
        boxShadow:
          "0 12px 60px rgba(31,58,46,0.06), 0 1px 2px rgba(26,26,20,0.04)",
      }}
    >
      <div className="flex items-center gap-2 border-b-[0.5px] border-divider bg-card-warm px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          {["#FF6259", "#FFBE3D", "#27CA40"].map((c) => (
            <span key={c} className="size-2.5 rounded-full" style={{ background: c }} />
          ))}
        </div>
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-sm bg-page px-3 py-1 font-mono text-[12px] text-ink-warm">
          <span className="text-muted">⌾</span>
          <span>acme-foods.fluxora.app</span>
          <span className="text-muted">/dashboard</span>
        </div>
      </div>
      <div className="grid grid-cols-[200px_1fr] lg:grid-cols-[224px_1fr]">
        <aside className="flex flex-col gap-0.5 border-r-[0.5px] border-divider bg-surface p-3 text-[12.5px]">
          <div className="mb-2 flex items-center gap-2 rounded-md p-2">
            <span
              className="grid size-7 place-items-center rounded-sm font-sans text-[12px] font-semibold leading-none"
              style={{ background: "#F4E6C2", color: "#6B4A0E" }}
            >
              A
            </span>
            <span className="text-[13px] font-medium text-ink">ACME Foods</span>
          </div>
          <SidebarSection label="Operate">
            <SidebarItem active label="Dashboard" icon="◉" />
            <SidebarItem label="Inventory" icon="◫" badge="2,418" />
            <SidebarItem label="Sales orders" icon="◇" badge="47" />
            <SidebarItem label="Invoices" icon="◈" />
            <SidebarItem label="Payments" icon="◐" />
          </SidebarSection>
          <SidebarSection label="Catalog">
            <SidebarItem label="Customers" icon="◯" />
            <SidebarItem label="Suppliers" icon="◯" />
            <SidebarItem label="Products" icon="◯" />
          </SidebarSection>
        </aside>
        <div className="bg-page p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[20px] font-semibold leading-tight tracking-[-0.02em] text-ink">
                Dashboard
              </h3>
              <p className="text-[12.5px] text-subtle">
                ACME Foods · Tuesday, April 22, 2026
              </p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-md border-[0.5px] border-border-default bg-card px-3 py-1.5 text-[12px] text-ink">
                Today ▾
              </button>
              <button className="rounded-md bg-forest px-3 py-1.5 text-[12px] font-medium text-card-warm">
                New order
              </button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { l: "Open orders", v: "47", d: "↑ 8 vs last Tuesday", tone: "up" },
              { l: "Unpaid supplier", v: "$8,240", d: "↓ $1,120 since Friday", tone: "dn" },
              { l: "Lots expiring < 7d", v: "12", d: "Needs review", tone: "warn" },
              { l: "Today's invoiced", v: "$24,712.40", d: "↑ 12.4% vs Mon", tone: "up" },
            ].map((kpi) => (
              <div
                key={kpi.l}
                className="rounded-md border-[0.5px] border-border-soft bg-card px-3.5 py-3"
              >
                <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
                  {kpi.l}
                </div>
                <div className="mt-1.5 font-sans text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-ink">
                  {kpi.v}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-subtle">
                  <span
                    className={
                      kpi.tone === "up"
                        ? "text-success-fg"
                        : kpi.tone === "dn"
                          ? "text-success-fg"
                          : "text-warning-fg"
                    }
                  >
                    {kpi.tone === "warn" ? "●" : kpi.d.split(" ")[0]}
                  </span>
                  <span>{kpi.tone === "warn" ? kpi.d : kpi.d.split(" ").slice(1).join(" ")}</span>
                </div>
              </div>
            ))}
          </div>
          <table className="mt-4 w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="text-left font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle">
                <th className="border-b-[0.5px] border-border-soft px-2 py-2.5">Recent orders</th>
                <th className="border-b-[0.5px] border-border-soft px-2 py-2.5">Customer</th>
                <th className="border-b-[0.5px] border-border-soft px-2 py-2.5 text-right">Lot</th>
                <th className="border-b-[0.5px] border-border-soft px-2 py-2.5 text-right">Total</th>
                <th className="border-b-[0.5px] border-border-soft px-2 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Marin Provisions", "SO-4421", "Net 30 · West dock", "L-2614 · L-2618", "$3,240.80", "Picking", "warning"],
                ["Bay Foods Co.", "SO-4420", "Net 14 · East dock", "L-2609", "$1,512.00", "Fulfilled", "success"],
                ["Highland Provisions", "SO-4419", "Net 7 · West dock", "L-2611", "$4,892.50", "Processing", "info"],
                ["Coastal Distribution", "SO-4418", "Net 30 · West dock", "L-2604", "$960.40", "On hold", "danger"],
              ].map(([name, so, terms, lot, total, status, tone]) => (
                <tr key={so} className="border-b-[0.5px] border-divider">
                  <td className="px-2 py-2">
                    <div className="text-[13px] font-medium text-ink">{name}</div>
                    <div className="font-mono text-[11px] text-subtle">{so}</div>
                  </td>
                  <td className="px-2 py-2 text-subtle">{terms}</td>
                  <td className="px-2 py-2 text-right font-mono text-[11px] text-subtle">{lot}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{total}</td>
                  <td className="px-2 py-2 text-right">
                    <StatusPill tone={tone as PillTone}>{status}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5">
      <span className="px-2 pb-1 pt-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle">
        {label}
      </span>
      {children}
    </div>
  );
}

function SidebarItem({
  label,
  icon,
  badge,
  active,
}: {
  label: string;
  icon: string;
  badge?: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[12.5px] ${active ? "bg-forest-tint text-forest font-medium" : "text-ink-warm hover:bg-page"}`}
    >
      <span className="grid size-4 place-items-center text-[12px] text-subtle">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="rounded-sm bg-card px-1.5 py-0.5 font-mono text-[10px] text-subtle">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

type PillTone = "success" | "warning" | "danger" | "info";

function StatusPill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  const styles: Record<PillTone, string> = {
    success: "bg-success-bg border-success-border text-success-fg",
    warning: "bg-warning-bg border-warning-border text-warning-fg",
    danger: "bg-danger-bg border-danger-border text-danger-fg",
    info: "bg-info-bg border-info-border text-info-fg",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border-[0.5px] px-2 py-0.5 text-[10.5px] font-medium ${styles[tone]}`}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}

function UsedByRow() {
  return (
    <div className="mt-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 border-y-[0.5px] border-border-soft py-6">
      <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
        Trusted by
      </span>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        {[
          "Pacific Wharf",
          "Marin Provisions",
          "Bay Foods Co.",
          "Coastal Distribution",
          "Highland Provisions",
          "Tidewater Foods",
        ].map((name) => (
          <span
            key={name}
            className="font-sans text-[13.5px] font-semibold tracking-[-0.01em] text-ink-warm"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Features ────────────────────────────────────────────────── */

const FEATURES: Array<{
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  link: string;
  flip?: boolean;
  panel: React.ReactNode;
}> = [
  {
    eyebrow: "Lots, weights, expirations",
    title: "Catch-weight and expiry, finally as first-class citizens.",
    body: "Receive at supplier net weight, sell at picked weight, invoice the actual difference — without a spreadsheet shadow ledger. Every lot carries its expiration, allocation, and source bill all the way to the customer invoice.",
    bullets: [
      "FIFO lot allocation with manual override per order",
      "Catch-weight on receive, pick, and invoice — auto-reconciled",
      "Expiry alerts at 30 / 14 / 7 / 0 days, scoped per product class",
      "Hold & release lots; full traceback in two clicks",
    ],
    link: "Read the lot model →",
    panel: <LotsPanel />,
  },
  {
    eyebrow: "Orders & fulfillment",
    title: "Quote, pick, fulfill, invoice — same record, same workspace.",
    body: "A sales order isn't five handoffs across five systems. Open the order, pick lots against catch-weight, fulfill, and generate the invoice — all from one tenant-scoped record with audit trail and role-aware permissions.",
    bullets: [
      "Quote → order → fulfilled → invoiced, on one record",
      "Per-customer pricing tiers, contracted prices, and overrides",
      "Branded PDF invoice generation via React Email + R2 storage",
      "Roles: sales rep, picker, finance — each sees only their lanes",
    ],
    link: "See the order flow →",
    flip: true,
    panel: <FulfillmentPanel />,
  },
  {
    eyebrow: "Receiving & payables",
    title: "Bills, lots, and payments — reconciled the moment the truck closes.",
    body: "Receive against a PO, photo the BOL, and the supplier bill posts itself with the catch-weights captured. Payments draw down the bill, the bill ties to the lots, and the lots tie to the customer invoices that consumed them.",
    bullets: [
      "BOL / packing-slip OCR via PDF import (review & commit)",
      "Bill ↔ Payment ↔ Lot reconciliation, fully audited",
      "Outstanding supplier balance aging at 0 / 30 / 60 / 90",
      "Per-supplier contracts & pricing remembered across receives",
    ],
    link: "PDF import details →",
    panel: <ReceivingPanel />,
  },
  {
    eyebrow: "Invoices & payments",
    title: "Invoices that look like your business, sent the day you fulfill.",
    body: "Tenant subdomain on the email link, your logo on the PDF, your accent on the footer. Stripe and bank-transfer payments draw down the open balance with full audit. Aging reports without a single Excel pivot.",
    bullets: [
      "Branded invoice PDFs from a React Email template",
      "Stripe + ACH + Plaid bank feed, all on the same balance",
      "Per-customer aging at 0 / 30 / 60 / 90",
      "Auto-reminders, dunning, and partial payment reconciliation",
    ],
    link: "Invoicing details →",
    flip: true,
    panel: <InvoicesPanel />,
  },
];

function Features() {
  return (
    <section className="border-t-[0.5px] border-border-soft py-24" id="features">
      <div className="mx-auto max-w-[1200px] px-6">
        <SectionHead
          eyebrow="What you'll run"
          title="Built around the way distribution actually moves."
          body="Every workflow is lot-aware, role-aware, and tenant-scoped — so traceability isn't a feature you bolt on, it's the spine of the data model."
        />
        <div className="mt-14 flex flex-col gap-20">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center ${f.flip ? "lg:[&>*:first-child]:order-2" : ""}`}
            >
              <div className="flex flex-col gap-4">
                <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-forest">
                  {f.eyebrow}
                </span>
                <h2 className="max-w-[480px] text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
                  {f.title}
                </h2>
                <p className="max-w-[480px] text-[15px] leading-[1.55] text-subtle">
                  {f.body}
                </p>
                <ul className="mt-1 flex max-w-[480px] flex-col gap-2 text-[13.5px] leading-[1.5] text-ink-warm">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-forest" />
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  href="#"
                  className="mt-2 inline-flex w-fit items-center border-b border-forest-tint-deep pb-0.5 text-[13px] font-medium text-forest hover:border-forest"
                >
                  {f.link}
                </Link>
              </div>
              <div>{f.panel}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturePanelShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-xl border-[0.5px] border-border-soft bg-card"
      style={{ boxShadow: "0 0.5px 0 rgba(26,26,20,0.04), 0 1px 2px rgba(26,26,20,0.04)" }}
    >
      <div className="border-b-[0.5px] border-divider bg-card-warm px-5 py-3.5">
        <div className="text-[14px] font-medium text-ink">{title}</div>
        <div className="text-[12px] text-subtle">{sub}</div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function LotsPanel() {
  return (
    <FeaturePanelShell title="Lot 2614 — Atlantic Salmon, fresh" sub="Received Apr 18 · Expires Apr 25">
      <div className="flex flex-col gap-2">
        {[
          ["L-2614", "Atlantic salmon, fresh whole", "Whitewater Fisheries · BL-8821", "412.40 lb"],
          ["L-2614/A", "→ Marin Provisions (SO-4421)", "Picked Apr 22 · 187.20 lb", "187.20 lb"],
          ["L-2614/B", "→ Available", "In cooler · Expires in 3 days", "225.20 lb"],
        ].map(([id, name, meta, qty]) => (
          <div key={id} className="flex items-center gap-3 rounded-md border-[0.5px] border-border-soft bg-card-warm px-3 py-2.5">
            <span className="font-mono text-[11px] text-subtle">{id}</span>
            <div className="flex-1">
              <div className="text-[13px] font-medium text-ink">{name}</div>
              <div className="text-[11.5px] text-subtle">{meta}</div>
            </div>
            <span className="font-mono text-[12.5px] tabular-nums text-ink">{qty}</span>
          </div>
        ))}
        <div className="mt-2 flex items-center gap-2">
          <StatusPill tone="warning">Expires Apr 25</StatusPill>
          <StatusPill tone="info">Traced to BL-8821</StatusPill>
        </div>
      </div>
    </FeaturePanelShell>
  );
}

function FulfillmentPanel() {
  const bars: Array<{ name: string; v: string; pct: number; tone: "s" | "w" | "d" }> = [
    { name: "West dock", v: "5 / 7 picked", pct: 71, tone: "s" },
    { name: "East dock", v: "2 / 3 picked", pct: 66, tone: "s" },
    { name: "Cooler — fresh fish", v: "3 / 5 picked", pct: 60, tone: "w" },
    { name: "Cooler — expiring < 48h", v: "2 / 6 flagged", pct: 33, tone: "d" },
  ];
  const toneBg: Record<typeof bars[number]["tone"], string> = {
    s: "var(--color-forest)",
    w: "var(--color-warning-fg)",
    d: "var(--color-danger-fg)",
  };
  return (
    <FeaturePanelShell title="Fulfillment — today" sub="12 orders queued · 8.2 hr est">
      <div className="flex flex-col gap-3">
        {bars.map((b) => (
          <div key={b.name}>
            <div className="flex items-center justify-between text-[12px] text-ink-warm">
              <span className="font-medium text-ink">{b.name}</span>
              <span className={b.tone === "d" ? "text-danger-fg" : ""}>{b.v}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-deep">
              <div className="h-full rounded-full" style={{ width: `${b.pct}%`, background: toneBg[b.tone] }} />
            </div>
          </div>
        ))}
        <div className="mt-2 flex items-center justify-between border-t-[0.5px] border-divider pt-3">
          <div>
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
              Next pick
            </span>
            <div className="text-[13px] font-medium text-ink">
              Marin Provisions — SO-4421
            </div>
          </div>
          <StatusPill tone="info">Ready</StatusPill>
        </div>
      </div>
    </FeaturePanelShell>
  );
}

function ReceivingPanel() {
  return (
    <FeaturePanelShell title="Receiving — week of Apr 21" sub="14 bills · $42,840.20 in">
      <div className="grid grid-cols-2 gap-3">
        {[
          { l: "Bills received", v: "14", x: "3 from new suppliers" },
          { l: "Lots created", v: "38", x: "All traced to BOL" },
          { l: "Catch-weight delta", v: "+0.4%", x: "Reconciled" },
          { l: "Outstanding A/P", v: "$12,920", x: "30-day aging" },
        ].map((c) => (
          <div key={c.l} className="rounded-md border-[0.5px] border-border-soft bg-card-warm p-3">
            <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle">
              {c.l}
            </div>
            <div className="mt-1 font-sans text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink">
              {c.v}
            </div>
            <div className="mt-1 text-[11.5px] text-subtle">{c.x}</div>
          </div>
        ))}
      </div>
    </FeaturePanelShell>
  );
}

function InvoicesPanel() {
  return (
    <FeaturePanelShell title="Invoice INV-4421" sub="Marin Provisions · Net 30">
      <div className="flex flex-col gap-3 text-[12.5px]">
        {[
          ["Atlantic salmon, fresh", "187.20 lb · L-2614/A", "$1,872.00"],
          ["Halibut steak, frozen", "44.10 lb · L-2618", "$705.60"],
          ["Pacific cod, fresh", "82.00 lb · L-2612", "$663.20"],
        ].map(([name, meta, total]) => (
          <div key={String(name)} className="flex items-baseline justify-between gap-3 border-b-[0.5px] border-divider pb-2">
            <div>
              <div className="text-[13px] font-medium text-ink">{name}</div>
              <div className="font-mono text-[11px] text-subtle">{meta}</div>
            </div>
            <span className="font-mono text-[13px] tabular-nums text-ink">{total}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-1">
          <span className="text-subtle">Subtotal</span>
          <span className="font-mono tabular-nums">$3,240.80</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-forest-tint px-3 py-2 text-forest">
          <span className="font-medium">Balance due</span>
          <span className="font-mono text-[15px] font-semibold tabular-nums">$3,240.80</span>
        </div>
      </div>
    </FeaturePanelShell>
  );
}

/* ── Workflows strip (dark) ─────────────────────────────────── */

function WorkflowsStrip() {
  return (
    <section className="border-t-[0.5px] border-border-soft bg-ink text-card-warm">
      <div className="mx-auto max-w-[1200px] px-6 py-24">
        <SectionHead
          eyebrow="The Tuesday morning"
          title="Five workflows. One workspace. Before second coffee."
          body="Most operations teams stitch these together across QuickBooks, a spreadsheet, an email thread, and an order portal. Fluxora makes them one record."
          tone="dark"
        />
        <div className="mt-14 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          {[
            ["01", "Receive supplier bills", "Drop a BOL PDF, confirm the OCR, post the bill. Lots created automatically with catch-weight captured.", "~ 4 min / bill"],
            ["02", "Allocate & pick orders", "FIFO lot suggestions per order line, picker confirms net weight, fulfillment closes automatically.", "~ 90 sec / order"],
            ["03", "Generate invoices", "Branded PDF rendered from the fulfilled order, emailed via Resend, status tracked end-to-end.", "Instant · zero clicks"],
            ["04", "Reconcile payments", "Apply payments to invoices, reconcile against aging, surface 30/60/90 balances on the dashboard.", "~ 2 min / batch"],
            ["05", "Close the day", "Daily close report: fulfilled, invoiced, received, aged. One scroll. Print or pin to Slack.", "~ 45 sec"],
          ].map(([n, t, p, x]) => (
            <div
              key={n}
              className="rounded-lg border-[0.5px] border-card-warm/15 bg-card-warm/[0.04] p-5"
            >
              <div className="font-mono text-[20px] font-semibold text-forest-tint">{n}</div>
              <div className="mt-2 text-[15px] font-semibold leading-tight tracking-[-0.02em] text-card-warm">
                {t}
              </div>
              <p className="mt-2 text-[12.5px] leading-[1.5] text-card-warm/70">{p}</p>
              <div className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.08em] text-forest-tint">
                {x}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ────────────────────────────────────────────── */

function Testimonials() {
  const quotes: Array<{
    metric: string;
    quote: string;
    initials: string;
    name: string;
    role: string;
    featured?: boolean;
  }> = [
    {
      metric: "Closed 4 hr earlier daily",
      quote: "We deleted four shared spreadsheets the second week. The catch-weight reconciliation alone paid for the year.",
      initials: "MR",
      name: "Marisol Reyes",
      role: "Ops Director · Marin Provisions",
    },
    {
      metric: "$48k recovered in y/1",
      quote: "Our supplier bills used to drift against actual lots by a percent or two. Fluxora flagged it on day one — we recovered $48k in catch-weight discrepancies in year one.",
      initials: "JN",
      name: "Jasper Nakamura",
      role: "CFO · Pacific Wharf Distributors",
      featured: true,
    },
    {
      metric: "3 systems → 1",
      quote: "QuickBooks + a portal + two spreadsheets, replaced. The role-based sidebar means our drivers see what they need and nothing they don't.",
      initials: "DK",
      name: "Deepa Khanna",
      role: "Owner · Highland Provisions",
    },
  ];
  return (
    <section className="border-t-[0.5px] border-border-soft bg-surface py-24" id="testimonials">
      <div className="mx-auto max-w-[1200px] px-6">
        <SectionHead
          eyebrow="From the loading dock"
          title="Distributors who stopped reconciling."
          body="Customers across fresh fish, specialty produce, and wholesale beverage — all running the same data model."
        />
        <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {quotes.map((q) => (
            <figure
              key={q.name}
              className={
                q.featured
                  ? "rounded-xl bg-forest p-7 text-card-warm shadow-[0_8px_24px_rgba(31,58,46,0.18)]"
                  : "rounded-xl border-[0.5px] border-border-soft bg-card p-7"
              }
            >
              <div className={`font-mono text-[14px] ${q.featured ? "text-gold" : "text-warning-fg"}`}>★★★★★</div>
              <span
                className={`mt-3 inline-flex rounded-full px-2.5 py-0.5 font-sans text-[10.5px] font-medium ${q.featured ? "bg-card-warm/10 text-card-warm" : "bg-forest-tint text-forest"}`}
              >
                {q.metric}
              </span>
              <blockquote
                className={`mt-4 text-[15px] leading-[1.55] tracking-[-0.005em] ${q.featured ? "text-card-warm" : "text-ink"}`}
              >
                &ldquo;{q.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-2.5">
                <span
                  className={`grid size-9 place-items-center rounded-full font-sans text-[12px] font-semibold ${q.featured ? "bg-card-warm/15 text-card-warm border border-gold" : "bg-surface text-ink-warm"}`}
                >
                  {q.initials}
                </span>
                <span className={`flex flex-col leading-tight ${q.featured ? "text-card-warm" : "text-ink"}`}>
                  <span className="text-[13px] font-medium">{q.name}</span>
                  <span className={`text-[11.5px] ${q.featured ? "text-card-warm/60" : "text-subtle"}`}>
                    {q.role}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ─────────────────────────────────────────────────── */

function Pricing() {
  const plans: Array<{
    name: string;
    price: string;
    per: string;
    desc: string;
    features: string[];
    cta: string;
    href: string;
    featured?: boolean;
    tag?: string;
  }> = [
    {
      name: "Starter",
      price: "$149",
      per: "/ workspace / mo",
      desc: "For a single warehouse and up to 500 orders/mo. The whole platform — no feature gating.",
      features: [
        "Up to 500 sales orders / mo",
        "Up to 5 user roles",
        "Branded PDF invoices & statements",
        "Email support, 1 business day",
      ],
      cta: "Start free trial",
      href: "/signup",
    },
    {
      name: "Growth",
      price: "$349",
      per: "/ workspace / mo",
      desc: "For multi-warehouse operations doing real reconciliation across catch-weight, lots, and payments.",
      features: [
        "Up to 5,000 sales orders / mo",
        "Unlimited user roles & permissions",
        "PDF import (OCR) & bill reconciliation",
        "Custom invoice template & tenant subdomain",
        "Priority email + chat, 4 hr response",
      ],
      cta: "Start free trial",
      href: "/signup",
      featured: true,
      tag: "Most popular",
    },
    {
      name: "Scale",
      price: "Custom",
      per: "",
      desc: "For multi-tenant networks, brokers, and groups running shared lots across legal entities.",
      features: [
        "Unlimited orders & warehouses",
        "Multi-tenant grouping & consolidated reports",
        "SSO (SAML), audit log export, dedicated R2 bucket",
        "Solutions engineer & named CSM",
      ],
      cta: "Talk to sales",
      href: "mailto:sales@fluxora.app",
    },
  ];
  return (
    <section className="border-t-[0.5px] border-border-soft py-24" id="pricing">
      <div className="mx-auto max-w-[1200px] px-6">
        <SectionHead
          eyebrow="Pricing"
          title="Flat per workspace. No per-seat games."
          body="Every plan includes unlimited users, lots, products, and customers. Pricing scales on workflow volume, not your headcount."
        />
        <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col gap-5 rounded-xl border-[0.5px] bg-card p-7 ${p.featured ? "border-forest shadow-[0_8px_24px_rgba(26,26,20,0.06)]" : "border-border-soft"}`}
            >
              {p.tag ? (
                <span className="absolute -top-3 left-7 inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink">
                  {p.tag}
                </span>
              ) : null}
              <div>
                <div className="text-[14px] font-medium text-ink">{p.name}</div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-sans text-[36px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-ink">
                    {p.price}
                  </span>
                  {p.per ? (
                    <span className="text-[12px] text-subtle">{p.per}</span>
                  ) : null}
                </div>
              </div>
              <p className="text-[13.5px] leading-[1.55] text-subtle">{p.desc}</p>
              <ul className="flex flex-col gap-2 text-[13px] leading-[1.45] text-ink-warm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-0.5 grid size-4 place-items-center rounded-full bg-forest-tint text-[10px] text-forest">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={p.href}
                className={`mt-auto inline-flex items-center justify-center rounded-md px-4 py-2.5 text-[13.5px] font-medium transition-colors ${p.featured ? "bg-forest text-card-warm hover:bg-forest-mid" : "border-[0.5px] border-border-default bg-card text-ink hover:bg-card-warm"}`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center font-mono text-[11.5px] tracking-[0.04em] text-subtle">
          14-day free trial on Starter &amp; Growth · No card required · Cancel anytime
        </p>
      </div>
    </section>
  );
}

/* ── FAQ ─────────────────────────────────────────────────────── */

function FAQ() {
  const faqs = [
    {
      q: "How is Fluxora different from NetSuite or SAP?",
      a: "Those are general-purpose ERPs that need a six-month implementation and a consultant to handle catch-weight, lots, and food-specific traceability. Fluxora ships those as first-class concepts in the data model on day one — no plugins, no custom fields. The trade-off is we're not for every industry; we're for distribution.",
    },
    {
      q: "Does each tenant get their own subdomain?",
      a: "Yes. On Growth and Scale, every workspace gets your-name.fluxora.app with tenant-scoped data, branded login, and a customizable invoice template. Custom domains are available on Scale.",
    },
    {
      q: "Can I import my existing inventory and customers?",
      a: "CSV import for customers, suppliers, products, and opening lot balances is built in. For supplier bills going forward, the PDF import (OCR) handles BOL and packing-slip ingestion with a review step before commit.",
    },
    {
      q: "What about accounting — do I still need QuickBooks?",
      a: "For most customers, Fluxora replaces the day-to-day AR/AP work that previously lived in QuickBooks. We integrate with QBO and Xero for general ledger sync on the Growth and Scale plans.",
    },
    {
      q: "How does Fluxora handle catch-weight?",
      a: "Catch-weight is captured at three points — supplier receive, picker fulfillment, and customer invoice — and the deltas are surfaced on the daily close.",
    },
    {
      q: "What does onboarding actually look like?",
      a: "Day 1: spin up your workspace, invite your team, import customers + products. Day 2-3: receive your first bills, generate your first invoices. Day 4+: you're running.",
    },
  ];
  return (
    <section className="border-t-[0.5px] border-border-soft py-24" id="faq">
      <div className="mx-auto max-w-[860px] px-6">
        <SectionHead
          eyebrow="FAQ"
          title="Things distribution teams actually ask."
        />
        <div className="mt-12 overflow-hidden rounded-xl border-[0.5px] border-border-soft bg-card">
          {faqs.map((f, i) => (
            <details
              key={f.q}
              className="group border-b-[0.5px] border-divider last:border-b-0 [&_summary::-webkit-details-marker]:hidden"
              open={i === 0}
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-6 py-5 text-[15px] font-medium text-ink hover:bg-card-warm">
                <span>{f.q}</span>
                <span
                  aria-hidden
                  className="grid size-6 place-items-center rounded-full bg-surface text-[14px] text-subtle transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="px-6 pb-5 text-[14px] leading-[1.55] text-ink-warm">
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ───────────────────────────────────────────────── */

function FinalCTA() {
  return (
    <section className="bg-ink py-24 text-card-warm">
      <div className="mx-auto max-w-[860px] px-6 text-center">
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-forest-tint">
          Start your workspace
        </span>
        <h2 className="mx-auto mt-4 max-w-[680px] text-[44px] font-semibold leading-[1.0] tracking-[-0.035em] text-card-warm sm:text-[52px] lg:text-[60px]">
          Your{" "}
          <span style={{ color: "var(--color-forest-tint)" }}>Tuesday morning</span>
          <br />
          has been waiting.
        </h2>
        <p className="mx-auto mt-6 max-w-[520px] text-[15px] leading-[1.55] text-card-warm/70">
          14 days. No card. The whole platform unlocked. Sign up in 90 seconds
          and have your first invoice rendered before lunch.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-md bg-card-warm px-5 py-3 text-[14px] font-medium text-ink transition-colors hover:bg-card"
          >
            Start free workspace
          </Link>
          <Link
            href="mailto:sales@fluxora.app"
            className="inline-flex items-center justify-center rounded-md border-[0.5px] border-card-warm/30 px-5 py-3 text-[14px] font-medium text-card-warm transition-colors hover:bg-card-warm/10"
          >
            Book a 15-min walkthrough
          </Link>
        </div>
        <p className="mt-4 text-[12px] text-card-warm/55">
          No credit card · 14-day trial · Cancel anytime
        </p>
      </div>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────────── */

function SiteFooter() {
  return (
    <footer className="border-t-[0.5px] border-border-soft bg-page">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-6 py-16 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div className="flex max-w-[360px] flex-col gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-[9px] text-[19px] font-semibold leading-none tracking-[-0.03em] text-ink"
          >
            <FluxoraMark size={28} />
            Fluxora
          </Link>
          <p className="text-[13px] leading-[1.55] text-subtle">
            The multi-tenant operations platform for food and wholesale
            distribution teams. Cream canvas, forest ink, serious about lots.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {["SOC 2 Type II", "GDPR", "PCI DSS L1"].map((b) => (
              <span
                key={b}
                className="rounded-full border-[0.5px] border-border-default bg-card px-2.5 py-1 font-mono text-[10.5px] text-subtle"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
        {[
          {
            head: "Product",
            items: [
              ["Inventory & lots", "#features"],
              ["Sales orders", "#features"],
              ["Invoicing", "#features"],
              ["PDF import", "#features"],
              ["Roles & permissions", "#features"],
            ],
          },
          {
            head: "Company",
            items: [
              ["About", "/about"],
              ["Customers", "#testimonials"],
              ["Changelog", "/changelog"],
              ["Careers", "/careers"],
            ],
          },
          {
            head: "Resources",
            items: [
              ["Documentation", "/docs"],
              ["API reference", "/docs/api"],
              ["Onboarding guide", "/docs/onboarding"],
              ["Status", "https://status.fluxora.app"],
            ],
          },
          {
            head: "Sign in",
            items: [
              ["Find your workspace", "/signin"],
              ["Create a workspace", "/signup"],
              ["Contact sales", "mailto:sales@fluxora.app"],
            ],
          },
        ].map((col) => (
          <div key={col.head} className="flex flex-col gap-3">
            <h4 className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
              {col.head}
            </h4>
            <ul className="flex flex-col gap-2 text-[13px]">
              {col.items.map(([label, href]) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-ink-warm transition-colors hover:text-ink"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t-[0.5px] border-border-soft">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-6 py-6 text-[12px] text-subtle">
          <div className="font-mono text-[11px] tracking-[0.04em]">
            © {new Date().getFullYear()} Fluxora, Inc. · Built in Brooklyn
          </div>
          <div className="flex gap-[18px]">
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ink">
              Terms
            </Link>
            <Link href="/security" className="hover:text-ink">
              Security
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ── Bits ────────────────────────────────────────────────────── */

function SectionHead({
  eyebrow,
  title,
  body,
  tone = "light",
}: {
  eyebrow: string;
  title: string;
  body?: string;
  tone?: "light" | "dark";
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-sans text-[10.5px] font-semibold uppercase tracking-[0.12em] ${tone === "dark" ? "bg-card-warm/10 text-forest-tint" : "bg-card-warm text-subtle"}`}
      >
        <span className={`size-1.5 rounded-full ${tone === "dark" ? "bg-forest-tint" : "bg-forest"}`} />
        {eyebrow}
      </span>
      <h2
        className={`max-w-[760px] text-[36px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[42px] ${tone === "dark" ? "text-card-warm" : "text-ink"}`}
      >
        {title}
      </h2>
      {body ? (
        <p
          className={`max-w-[640px] text-[15px] leading-[1.55] ${tone === "dark" ? "text-card-warm/70" : "text-subtle"}`}
        >
          {body}
        </p>
      ) : null}
    </div>
  );
}
