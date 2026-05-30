"use client";

import { Check, ExternalLink } from "lucide-react";
import { useState } from "react";

import type { BillingCatalogPlanRow } from "@/modules/core/billing/stripe-catalog/services/stripe-catalog";
import type { StripeBillingInterval } from "@/lib/stripe/checkout-plan-schema";
import type { TenantSubscriptionPlan } from "@/lib/tenant-subscription";
import { SUBSCRIPTION_PLAN_CAPABILITY_MATRIX } from "@/lib/subscription-plan-capabilities";
import { classifyPlanChange } from "@/lib/stripe/plan-change";
import { cn } from "@/lib/utils";

import { PlanSwitchButton } from "./plan-switch-button";

const PLAN_LABEL: Record<TenantSubscriptionPlan, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
};

function formatLimit(n: number): string {
  return Number.isFinite(n) ? new Intl.NumberFormat().format(n) : "Unlimited";
}

/**
 * Build the plan's feature bullets from the enforced capability matrix
 * (`lib/subscription-plan-capabilities.ts`) so the marketing copy can never
 * drift from what the server actually allows. Earlier hardcoded strings
 * advertised limits and features (500/5,000 orders, API access, SSO, SLA) that
 * did not match enforcement.
 */
function planBullets(planKey: TenantSubscriptionPlan): string[] {
  const entry = SUBSCRIPTION_PLAN_CAPABILITY_MATRIX[planKey];
  if (!entry) return [];
  const { limits, features } = entry;
  const bullets: string[] = [];

  bullets.push(
    Number.isFinite(limits.maxPortalUsers)
      ? `Up to ${formatLimit(limits.maxPortalUsers)} users`
      : "Unlimited users",
  );
  // Products and customers share the same ceiling across every tier.
  bullets.push(
    Number.isFinite(limits.maxProducts)
      ? `${formatLimit(limits.maxProducts)} products & customers`
      : "Unlimited products & customers",
  );
  bullets.push(
    Number.isFinite(limits.maxMonthlyOrders)
      ? `${formatLimit(limits.maxMonthlyOrders)} orders / mo`
      : "Unlimited orders / mo",
  );
  if (features.purchasing) {
    bullets.push("Purchasing & supplier invoices");
  } else if (features.sales_orders) {
    bullets.push("Sales orders & inventory");
  }
  if (features.reports) {
    bullets.push("Reports & aging");
  }
  if (features.sso) {
    bullets.push("Single sign-on (SAML + OIDC)");
  }
  bullets.push(
    features.platform_support
      ? "Priority platform support"
      : "Support tickets",
  );
  return bullets;
}

function formatPriceParts(
  currency: string,
  unitAmountCents: number | null,
): { currency: string | null; amount: string } {
  if (unitAmountCents == null) return { currency: null, amount: "Custom" };
  try {
    const symbol = (0)
      .toLocaleString(undefined, {
        style: "currency",
        currency: currency.toUpperCase(),
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
      .replace(/[\d.,\s]/g, "");
    const amount = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 0,
    }).format(unitAmountCents / 100);
    return { currency: symbol || "$", amount };
  } catch {
    return { currency: "$", amount: String(Math.round(unitAmountCents / 100)) };
  }
}

function formatMoney(currency: string, unitAmountCents: number): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(unitAmountCents / 100);
  } catch {
    return `$${Math.round(unitAmountCents / 100)}`;
  }
}

function formatCadence(
  interval: string | null,
  count: number | null,
): string {
  if (!interval) return "per month";
  const raw = interval.toLowerCase();
  const n = count ?? 1;
  if (n === 1) {
    if (raw === "month") return "per month";
    if (raw === "year") return "per year";
    if (raw === "week") return "per week";
    return `per ${interval}`;
  }
  return `per ${n} ${interval}s`;
}

export function PlansAvailable({
  plans,
  currentPlan,
  currentInterval,
  canManage,
}: {
  plans: BillingCatalogPlanRow[];
  currentPlan: TenantSubscriptionPlan;
  /** Cadence of the tenant's live subscription, or null when none. */
  currentInterval: StripeBillingInterval | null;
  canManage: boolean;
}) {
  const hasAnnual = plans.some((p) => p.annual != null);
  // Default to annual when it's offered — it's the cheaper, recommended cadence.
  const [interval, setInterval] = useState<StripeBillingInterval>(
    hasAnnual ? "year" : "month",
  );

  return (
    <section>
      <div className="mb-[10px] flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-serif text-[18px] font-medium leading-[1.2] tracking-[-0.01em] text-ink">
          Plans available
        </h2>
        {plans.length === 0 ? (
          <span className="text-[11px] text-subtle">Catalog sync pending.</span>
        ) : hasAnnual ? (
          <IntervalToggle interval={interval} onChange={setInterval} />
        ) : null}
      </div>

      {plans.length === 0 ? (
        <div className="rounded-lg border-[0.5px] border-dashed border-border-default bg-card-warm px-5 py-4 text-[13px] leading-[1.55] text-subtle">
          Subscription plans appear here once the Stripe catalog has synced.
          Reach out to support if this doesn&rsquo;t resolve.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border-[0.5px] border-border-soft bg-card">
          <div className="grid grid-cols-1 divide-y-[0.5px] divide-divider sm:grid-cols-3 sm:divide-x-[0.5px] sm:divide-y-0">
            {plans.map((plan) => (
              <PlanColumn
                key={plan.planKey}
                plan={plan}
                interval={interval}
                currentPlan={currentPlan}
                isCurrentPlan={plan.planKey === currentPlan}
                currentInterval={currentInterval}
                canManage={canManage}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function IntervalToggle({
  interval,
  onChange,
}: {
  interval: StripeBillingInterval;
  onChange: (next: StripeBillingInterval) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Billing interval"
      className="inline-flex items-center gap-1 rounded-md border-[0.5px] border-border-default bg-surface p-[3px]"
    >
      <button
        type="button"
        role="tab"
        aria-selected={interval === "month"}
        onClick={() => onChange("month")}
        className={cn(
          "rounded-[5px] px-3 py-[5px] text-[12px] font-medium leading-none transition-colors",
          interval === "month"
            ? "bg-card text-ink shadow-sm"
            : "text-subtle hover:text-ink-warm",
        )}
      >
        Monthly
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={interval === "year"}
        onClick={() => onChange("year")}
        className={cn(
          "inline-flex items-center gap-[6px] rounded-[5px] px-3 py-[5px] text-[12px] font-medium leading-none transition-colors",
          interval === "year"
            ? "bg-card text-ink shadow-sm"
            : "text-subtle hover:text-ink-warm",
        )}
      >
        Annual
        <span className="rounded-full bg-success-bg px-[6px] py-[2px] text-[10px] font-medium leading-none text-success-fg">
          2 months free
        </span>
      </button>
    </div>
  );
}

function PlanColumn({
  plan,
  interval,
  currentPlan,
  isCurrentPlan,
  currentInterval,
  canManage,
}: {
  plan: BillingCatalogPlanRow;
  interval: StripeBillingInterval;
  currentPlan: TenantSubscriptionPlan;
  isCurrentPlan: boolean;
  currentInterval: StripeBillingInterval | null;
  canManage: boolean;
}) {
  // Annual pricing only when this tier actually has a synced annual price.
  const showAnnual = interval === "year" && plan.annual != null;
  const priceCents = showAnnual
    ? plan.annual!.unitAmountCents
    : plan.unitAmountCents;
  const priceCurrency = showAnnual ? plan.annual!.currency : plan.currency;
  const priceInterval = showAnnual
    ? plan.annual!.recurringInterval
    : plan.recurringInterval;
  const priceIntervalCount = showAnnual
    ? plan.annual!.recurringIntervalCount
    : plan.recurringIntervalCount;

  const { currency: symbol, amount } = formatPriceParts(priceCurrency, priceCents);

  // Annual savings vs. 12× the monthly price (i.e. "2 months free").
  const annualSavingsCents =
    showAnnual &&
    plan.unitAmountCents != null &&
    plan.annual!.unitAmountCents != null
      ? plan.unitAmountCents * 12 - plan.annual!.unitAmountCents
      : null;

  const bullets = planBullets(plan.planKey as TenantSubscriptionPlan);

  const isContactOnly = plan.planKey === "enterprise" && priceCents == null;

  // The cadence this card would check out with.
  const effectiveInterval: StripeBillingInterval = showAnnual ? "year" : "month";
  // Truly the active subscription: same plan AND same cadence (or cadence
  // unknown, in which case we don't claim it's a switch).
  const isExactCurrent =
    isCurrentPlan &&
    (currentInterval == null || effectiveInterval === currentInterval);
  // Same plan, different cadence (e.g. monthly → annual) — an allowed switch.
  const isIntervalSwitch =
    isCurrentPlan &&
    currentInterval != null &&
    effectiveInterval !== currentInterval;

  // Downgrades (lower tier, or same-tier annual → monthly) are applied at
  // period end rather than immediately — label them so it isn't a surprise.
  const isScheduledDowngrade =
    !isExactCurrent &&
    !isContactOnly &&
    classifyPlanChange(
      { currentPlan, currentInterval },
      { plan: plan.planKey, interval: effectiveInterval },
    ) === "scheduled";

  const ctaLabel = isExactCurrent
    ? "Active plan"
    : isScheduledDowngrade
      ? "Schedule downgrade"
      : isIntervalSwitch
        ? `Switch to ${effectiveInterval === "year" ? "annual" : "monthly"} billing`
        : `Switch to ${plan.productName || PLAN_LABEL[plan.planKey as TenantSubscriptionPlan]}`;

  return (
    <div
      data-current={isCurrentPlan ? "true" : undefined}
      className={
        "flex flex-col px-[22px] py-5" + (isCurrentPlan ? " bg-card-warm" : "")
      }
    >
      <div className="mb-[14px] flex items-start justify-between">
        <div className="font-serif text-[17px] font-medium tracking-[-0.005em] text-ink">
          {plan.productName ||
            PLAN_LABEL[plan.planKey as TenantSubscriptionPlan]}
        </div>
        {isCurrentPlan ? (
          <span className="inline-flex items-center gap-[6px] rounded-full border-[0.5px] border-success-border bg-success-bg px-[9px] py-[3px] text-[10px] font-medium leading-none text-success-fg">
            <span
              aria-hidden
              className="inline-block size-[5px] rounded-full bg-current"
            />
            Current
          </span>
        ) : null}
      </div>
      <div className="flex items-baseline gap-1">
        {symbol ? (
          <span className="font-serif text-[14px] text-subtle">{symbol}</span>
        ) : null}
        <span className="font-serif text-[36px] font-medium leading-none tracking-[-0.02em] text-ink tabular-nums">
          {amount}
        </span>
      </div>
      <div className="mt-[6px] text-[11px] text-subtle">
        {priceCents == null
          ? "annual contract"
          : formatCadence(priceInterval, priceIntervalCount)}
      </div>
      {annualSavingsCents != null && annualSavingsCents > 0 ? (
        <div className="mt-[6px] text-[11px] font-medium text-success-fg">
          Save {formatMoney(priceCurrency, annualSavingsCents)} a year vs monthly
        </div>
      ) : null}

      <ul className="mt-4 flex flex-col gap-2">
        {bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2 text-[13px] leading-[1.5] text-ink-warm"
          >
            <Check
              size={12}
              strokeWidth={1.5}
              className="mt-[3px] shrink-0 text-forest"
              aria-hidden
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {canManage ? (
        isContactOnly ? (
          <a
            href="mailto:sales@fluxora.app?subject=Fluxora%20enterprise%20plan%20inquiry"
            className="mt-[18px] inline-flex w-full items-center justify-center gap-2 rounded-md border-[0.5px] border-border-default bg-card px-3 py-[7px] text-[12px] font-medium leading-none text-ink-warm transition-colors hover:bg-surface"
          >
            <ExternalLink size={12} strokeWidth={1.5} />
            Contact sales
          </a>
        ) : (
          <div className="mt-auto">
            <PlanSwitchButton
              plan={plan.planKey}
              interval={effectiveInterval}
              label={ctaLabel}
              disabled={isExactCurrent}
            />
            {isScheduledDowngrade ? (
              <p className="mt-2 text-center text-[11px] text-subtle">
                Takes effect at the end of your current period.
              </p>
            ) : null}
          </div>
        )
      ) : (
        <p className="mt-[18px] text-center text-[11px] text-subtle">
          Owners and admins can change plans.
        </p>
      )}
    </div>
  );
}
