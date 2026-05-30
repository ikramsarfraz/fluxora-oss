import { CreditCard, Download } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BillingCheckoutFeedback } from "@/modules/core/billing/components/account/billing-checkout-feedback";
import { BillingSubscriptionRefreshHint } from "@/modules/core/billing/components/account/billing-subscription-refresh-hint";
import { auth } from "@/lib/auth";
import {
  formatTenantPaymentMethodExpiryLine,
  formatTenantPaymentMethodSummary,
} from "@/lib/subscription-display";
import { formatUsageLimit } from "@/lib/subscription-usage-metrics";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { getCurrentTenantPlanUsage } from "@/modules/core/billing/services/subscription-usage";
import {
  getTenantDefaultPaymentMethod,
  getTenantSubscriptionSummary,
} from "@/modules/core/billing/stripe-tenant-billing";
import { getUserByAuthUserId } from "@/modules/shared/services/portal-users";
import { listActivePaidPlansForBillingPage } from "@/modules/core/billing/stripe-catalog/services/stripe-catalog";
import type { TenantSubscriptionPlan } from "@/lib/tenant-subscription";

import { ManageInStripeButton } from "./manage-in-stripe-button";
import { PlansAvailable } from "./plans-available";
import { ScheduledChangeBanner } from "./scheduled-change-banner";

const PLAN_LABEL: Record<TenantSubscriptionPlan, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
};

const PLAN_ORDER: TenantSubscriptionPlan[] = [
  "starter",
  "growth",
  "enterprise",
];

function periodLabel(now = new Date()): string {
  return now.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function periodRange(now = new Date()): string {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return `${start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} – ${end.toLocaleDateString("en-US", { day: "numeric" })}`;
}

function formatShortDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMicrosUsd(micros: number): string {
  // Always show a dollar value; sub-cent rounding is acceptable for a
  // usage panel that aggregates many small calls.
  const dollars = Math.max(0, micros) / 1_000_000;
  return `$${dollars.toFixed(2)}`;
}

function nextCalendarMonthStart(now = new Date()): Date {
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

export default async function SettingsBillingPlanAndUsagePage(props: {
  searchParams: Promise<{ session_id?: string; success?: string; canceled?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/sign-in");

  const portalUser = await getUserByAuthUserId(session.user.id);
  if (!portalUser) {
    return (
      <div className="flex max-w-lg flex-col gap-4 p-8">
        <h1 className="font-serif text-[26px] font-medium tracking-[-0.02em] text-ink">
          Billing
        </h1>
        <p className="text-[13px] leading-[1.55] text-subtle">
          No portal profile is linked to this sign-in yet. Ask an administrator
          to invite you or complete onboarding before managing billing.
        </p>
        <Link
          href="/settings/account/profile"
          className="inline-flex w-fit items-center gap-2 rounded-md border-[0.5px] border-border-default bg-card px-[14px] py-[7px] text-[13px] font-medium text-ink-warm transition-colors hover:bg-surface"
        >
          Back to account
        </Link>
      </div>
    );
  }

  const tenant = await getCurrentTenant();
  const params = await props.searchParams;

  const checkoutFeedback = (() => {
    const c = params.canceled;
    if (c === "1" || c === "true") return { kind: "canceled" as const };
    const sessionId = params.session_id ?? null;
    const s = params.success;
    if (s === "1" || s === "true" || sessionId)
      return { kind: "success" as const, sessionId };
    return null;
  })();
  const hadCanceledCheckout =
    params.canceled === "1" || params.canceled === "true";
  const bootstrapFromCheckoutSuccess =
    !hadCanceledCheckout &&
    (params.success === "1" ||
      params.success === "true" ||
      !!(params.session_id && params.session_id.trim()));

  const [catalogPlans, defaultPaymentMethod, usage, subscriptionSummary] =
    await Promise.all([
      listActivePaidPlansForBillingPage(),
      getTenantDefaultPaymentMethod(tenant.id),
      getCurrentTenantPlanUsage(),
      getTenantSubscriptionSummary(tenant.id),
    ]);
  const currentInterval = subscriptionSummary.currentInterval;
  const pendingChange = subscriptionSummary.pendingChange;

  const canManageBilling =
    portalUser.role === "admin" || portalUser.role === "owner";
  const hasStripeCustomer = Boolean(tenant.stripeCustomerId?.trim());
  const isComped = tenant.subscriptionStatus === "comped";
  const isPastDue = tenant.subscriptionStatus === "past_due";

  const period = periodLabel();
  const range = periodRange();

  const amountDueLabel = isComped ? "$0.00" : "$0.00"; // Stripe upcoming invoice not wired yet
  const amountDueSub = isComped
    ? "No charge this period"
    : tenant.subscriptionPlan === "free"
      ? "Free plan — no recurring charge"
      : "Estimate — confirm in Stripe";
  const nextInvoiceLabel = formatShortDate(tenant.currentPeriodEndsAt);
  const nextInvoiceSub =
    tenant.subscriptionStatus === "canceled" || isComped
      ? "No scheduled renewal"
      : "Approximate";

  const usageRows: Array<{
    label: string;
    meta: string;
    value: number;
    limit: number;
    storage?: boolean;
  }> = [
    {
      label: "Portal users",
      meta: `Members with access to ${tenant.slug} workspace`,
      value: usage.portalUsers.current,
      limit: usage.portalUsers.limit,
    },
    {
      label: "Products",
      meta: "SKUs in catalog · incl. archived",
      value: usage.products.current,
      limit: usage.products.limit,
    },
    {
      label: "Customers",
      meta: "Customer accounts with at least one order",
      value: usage.customers.current,
      limit: usage.customers.limit,
    },
    {
      label: "Monthly orders",
      meta: `Sales orders created ${range}`,
      value: usage.monthlyOrders.current,
      limit: usage.monthlyOrders.limit,
    },
  ];

  const sortedPlans = [...catalogPlans].sort(
    (a, b) =>
      PLAN_ORDER.indexOf(a.planKey as TenantSubscriptionPlan) -
      PLAN_ORDER.indexOf(b.planKey as TenantSubscriptionPlan),
  );

  return (
    <div className="flex flex-1 flex-col gap-8 pb-12">
      {/* Hero */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
            Billing · {period}
          </div>
          <h1 className="mt-[6px] font-serif text-[30px] font-medium leading-[1.1] tracking-[-0.02em] text-ink">
            Statement of usage
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-md border-[0.5px] border-border-default bg-card px-[14px] py-[7px] text-[13px] font-medium leading-none text-ink-warm opacity-60"
            title="PDF export coming soon"
          >
            <Download size={13} strokeWidth={1.5} />
            Download PDF
          </button>
          <ManageInStripeButton
            canManage={canManageBilling}
            hasStripeCustomer={hasStripeCustomer}
          />
        </div>
      </div>

      {checkoutFeedback ? (
        <BillingCheckoutFeedback
          kind={checkoutFeedback.kind}
          sessionId={
            checkoutFeedback.kind === "success"
              ? checkoutFeedback.sessionId
              : null
          }
        />
      ) : null}
      <BillingSubscriptionRefreshHint
        snapshotPlan={tenant.subscriptionPlan}
        snapshotStatus={tenant.subscriptionStatus}
        bootstrapFromCheckoutSuccess={bootstrapFromCheckoutSuccess}
      />

      {pendingChange ? (
        <ScheduledChangeBanner
          planLabel={PLAN_LABEL[pendingChange.plan]}
          intervalLabel={
            pendingChange.interval === "year"
              ? "annual"
              : pendingChange.interval === "month"
                ? "monthly"
                : null
          }
          dateLabel={formatShortDate(pendingChange.effectiveAt)}
          canManage={canManageBilling}
        />
      ) : null}

      {/* Definition strip */}
      <div className="grid grid-cols-2 divide-y-[0.5px] divide-divider border-y-[0.5px] border-border-default sm:grid-cols-3 sm:divide-y-0 sm:divide-x-[0.5px] lg:grid-cols-5">
        <StripCell
          label="Plan"
          value={PLAN_LABEL[tenant.subscriptionPlan]}
          sub={
            isComped
              ? "Comped"
              : isPastDue
                ? "Past due"
                : tenant.subscriptionStatus === "trialing"
                  ? "Trial"
                  : tenant.subscriptionStatus === "canceled"
                    ? "Canceled"
                    : "Active"
          }
        />
        <StripCell label="Period" value={period} sub={range} />
        <StripCell
          label="Amount due"
          value={amountDueLabel}
          sub={amountDueSub}
          numeric
        />
        <StripCell
          label="Next invoice"
          value={nextInvoiceLabel}
          sub={nextInvoiceSub}
        />
        <StripCell
          label="Workspace"
          value={tenant.name}
          sub={
            tenant.stripeCustomerId
              ? `${tenant.slug} · ${tenant.stripeCustomerId}`
              : tenant.slug
          }
        />
      </div>

      {/* Two-column body */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left column */}
        <div className="flex flex-col gap-6">
          {/* Resource usage */}
          <section>
            <div className="mb-[10px] flex items-baseline justify-between">
              <h2 className="font-serif text-[18px] font-medium leading-[1.2] tracking-[-0.01em] text-ink">
                Resource usage
              </h2>
              <span className="text-[11px] leading-[1.4] text-subtle">
                {isComped
                  ? "All limits suspended under comped plan."
                  : `Current period · ${range}`}
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border-[0.5px] border-border-soft bg-card">
              <div className="grid grid-cols-[1fr_auto] gap-x-4 bg-surface px-[22px] py-[10px]">
                <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                  Resource
                </div>
                <div className="text-right text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                  This period
                </div>
              </div>
              {usageRows.map((row, i) => (
                <div
                  key={row.label}
                  className={
                    "grid grid-cols-[1fr_auto] items-baseline gap-x-4 px-[22px] py-[18px]" +
                    (i > 0 ? " border-t-[0.5px] border-divider" : "")
                  }
                >
                  <div>
                    <div className="text-[13px] text-ink-warm">{row.label}</div>
                    <div className="mt-[4px] text-[11px] leading-[1.4] text-subtle">
                      {row.meta}
                    </div>
                  </div>
                  <div className="flex items-baseline gap-3 text-right">
                    <div className="font-serif text-[22px] font-medium leading-none tracking-[-0.015em] text-ink tabular-nums">
                      {row.value.toLocaleString()}
                      <span className="ml-[6px] font-sans text-[11px] font-normal tracking-normal text-muted">
                        / {formatUsageLimit(row.limit).toLowerCase()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* AI usage (#235) — sits right under Resource usage because
              the dollar shape doesn't fit the count-based table above,
              but it conceptually belongs to the same "this period"
              block. The Resource-usage card stays pure counts to keep
              its column layout tidy. */}
          <AiUsageCard
            currentMicros={usage.aiSpend.currentMicros}
            limitMicros={usage.aiSpend.limitMicros}
            isComped={isComped}
          />

          {/* Plans available */}
          <PlansAvailable
            plans={sortedPlans}
            currentPlan={tenant.subscriptionPlan}
            currentInterval={currentInterval}
            canManage={canManageBilling}
          />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Payment method */}
          <div className="rounded-lg border-[0.5px] border-border-soft bg-card px-[22px] py-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="font-serif text-[16px] font-medium text-ink">
                Payment method
              </h3>
              {defaultPaymentMethod ? (
                <span className="inline-flex items-center gap-[6px] rounded-full border-[0.5px] border-success-border bg-success-bg px-[9px] py-[4px] text-[11px] font-medium leading-none text-success-fg">
                  <span
                    aria-hidden
                    className="inline-block size-[5px] rounded-full bg-current"
                  />
                  On file
                </span>
              ) : (
                <span className="inline-flex items-center gap-[6px] rounded-full border-[0.5px] border-warning-border bg-warning-bg px-[9px] py-[4px] text-[11px] font-medium leading-none text-warning-fg">
                  <span
                    aria-hidden
                    className="inline-block size-[5px] rounded-full bg-current"
                  />
                  None on file
                </span>
              )}
            </div>
            {defaultPaymentMethod ? (
              <div className="space-y-1 text-[13px] leading-[1.55] text-ink-warm">
                <p>{formatTenantPaymentMethodSummary(defaultPaymentMethod)}</p>
                <p className="font-mono text-[12px] text-subtle">
                  {formatTenantPaymentMethodExpiryLine(defaultPaymentMethod)}
                </p>
              </div>
            ) : (
              <p className="mb-[14px] text-[12px] leading-[1.5] text-subtle">
                {isComped
                  ? "No charge will be attempted while your Enterprise plan is comped. Adding a card now keeps service uninterrupted if billing resumes."
                  : "Add a card during checkout to subscribe to a paid plan."}
              </p>
            )}
            {!defaultPaymentMethod && canManageBilling && hasStripeCustomer ? (
              <ManageInStripeButton
                canManage={canManageBilling}
                hasStripeCustomer={hasStripeCustomer}
                variant="secondary"
                className="mt-[14px] text-[12px]"
              />
            ) : null}
            {!defaultPaymentMethod && !hasStripeCustomer && canManageBilling ? (
              <div className="mt-[14px] inline-flex items-center gap-2 text-[12px] text-subtle">
                <CreditCard size={12} strokeWidth={1.5} aria-hidden />
                Available after first checkout.
              </div>
            ) : null}
          </div>

          {/* Billing history — empty until Stripe invoices are wired */}
          <div className="rounded-lg border-[0.5px] border-border-soft bg-card px-[22px] py-5">
            <div className="mb-3 font-serif text-[16px] font-medium text-ink">
              Billing history
            </div>
            <p className="text-[12px] leading-[1.5] text-subtle">
              {hasStripeCustomer
                ? "Past invoices are available in the Stripe Customer Portal."
                : "Recent invoices appear here after your first checkout."}
            </p>
            {hasStripeCustomer && canManageBilling ? (
              <ManageInStripeButton
                canManage={canManageBilling}
                hasStripeCustomer={hasStripeCustomer}
                variant="secondary"
                className="mt-[14px] text-[12px]"
              />
            ) : null}
          </div>

          <p className="px-1 text-[11px] leading-[1.5] text-subtle">
            Questions about your bill?{" "}
            <a
              href="mailto:billing@fluxora.app"
              className="border-b-[0.5px] border-forest text-forest"
            >
              Email billing@fluxora →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function AiUsageCard({
  currentMicros,
  limitMicros,
  isComped,
}: {
  currentMicros: number;
  limitMicros: number;
  isComped: boolean;
}) {
  // Mirror the server-side decideAiSpendStatus thresholds so the panel's
  // colored bands tell the same story as the action-layer gate. The
  // constants are intentionally redeclared here as plain numbers because
  // pulling the helper into this RSC page tree would just import a
  // server-only file we'd need to add `import "server-only"` guards
  // around — the warn/block points rarely change and a single-source
  // refactor can come later if they do.
  const WARN_RATIO = 0.8;
  const BLOCK_RATIO = 1.0;
  const isUnlimited = !Number.isFinite(limitMicros) || limitMicros <= 0;
  const ratio = isUnlimited
    ? null
    : Math.min(2, Math.max(0, currentMicros / limitMicros));
  const band: "ok" | "warn" | "blocked" = isUnlimited
    ? "ok"
    : ratio == null
      ? "ok"
      : ratio >= BLOCK_RATIO
        ? "blocked"
        : ratio >= WARN_RATIO
          ? "warn"
          : "ok";
  const fillPct = ratio == null ? 0 : Math.min(100, ratio * 100);
  const resetAt = nextCalendarMonthStart();

  return (
    <section>
      <div className="mb-[10px] flex items-baseline justify-between">
        <h2 className="font-serif text-[18px] font-medium leading-[1.2] tracking-[-0.01em] text-ink">
          AI usage
        </h2>
        <span className="text-[11px] leading-[1.4] text-subtle">
          {isComped
            ? "Unlimited under comped plan."
            : `Resets ${formatShortDate(resetAt)}`}
        </span>
      </div>
      <div className="rounded-lg border-[0.5px] border-border-soft bg-card px-[22px] py-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="font-serif text-[28px] font-medium leading-none tracking-[-0.015em] text-ink tabular-nums">
              {formatMicrosUsd(currentMicros)}
            </div>
            <div className="mt-[6px] text-[11px] leading-[1.4] text-subtle">
              {isUnlimited
                ? "No monthly cap on this plan."
                : `of ${formatMicrosUsd(limitMicros)} this month`}
            </div>
          </div>
          {band !== "ok" && !isUnlimited ? (
            <span
              className={
                "inline-flex items-center gap-[6px] rounded-full px-[9px] py-[4px] text-[11px] font-medium leading-none " +
                (band === "blocked"
                  ? "border-[0.5px] border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-[0.5px] border-warning-border bg-warning-bg text-warning-fg")
              }
            >
              <span
                aria-hidden
                className="inline-block size-[5px] rounded-full bg-current"
              />
              {band === "blocked" ? "Limit reached" : "Approaching limit"}
            </span>
          ) : null}
        </div>
        {!isUnlimited ? (
          <div
            className="mt-[14px] h-[6px] w-full overflow-hidden rounded-full bg-surface"
            role="progressbar"
            aria-valuenow={Math.round(fillPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="AI usage this month"
          >
            <div
              className={
                "h-full rounded-full transition-[width] " +
                (band === "blocked"
                  ? "bg-destructive"
                  : band === "warn"
                    ? "bg-warning-fg"
                    : "bg-forest")
              }
              style={{ width: `${fillPct}%` }}
            />
          </div>
        ) : null}
        <p className="mt-[14px] text-[12px] leading-[1.5] text-subtle">
          {band === "blocked"
            ? "New supplier-invoice and expense-receipt parses are paused until the cap resets. Existing drafts and manual entry are unaffected."
            : band === "warn"
              ? "You're past 80% of this month's AI budget. New parses still go through; the cap kicks in at 100%."
              : "Each supplier-invoice and expense-receipt scan draws from this monthly budget."}
        </p>
      </div>
    </section>
  );
}

function StripCell({
  label,
  value,
  sub,
  numeric,
}: {
  label: string;
  value: string;
  sub: string;
  numeric?: boolean;
}) {
  return (
    <div className="px-4 py-[18px] sm:px-[22px]">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
        {label}
      </div>
      <div
        className={
          numeric
            ? "font-serif text-[22px] font-medium leading-none tracking-[-0.015em] text-ink tabular-nums"
            : "text-[14px] font-medium text-ink tabular-nums"
        }
      >
        {value}
      </div>
      <div className="mt-[6px] text-[11px] leading-[1.4] text-subtle">{sub}</div>
    </div>
  );
}
