"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { startTenantAdminStripeCheckoutAction } from "@/actions/stripe-billing";
import { TenantBillingCheckoutButtons } from "@/components/account/tenant-billing-checkout-buttons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { BillingCatalogPlanRow } from "@/services/stripe-catalog";
import type { TenantSubscriptionPlan } from "@/lib/tenant-subscription";
import type { StripeCheckoutPlan } from "@/services/stripe-tenant-billing";

function formatMoney(currency: string, unitAmountCents: number | null): string {
  if (unitAmountCents == null) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(unitAmountCents / 100);
  } catch {
    return `${(unitAmountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatCadence(interval: string | null, count: number | null): string {
  if (!interval) {
    return "—";
  }
  const raw = interval.toLowerCase();
  const unit =
    raw === "month"
      ? "month"
      : raw === "year"
        ? "year"
        : raw === "week"
          ? "week"
          : raw === "day"
            ? "day"
            : interval;
  const n = count ?? 1;
  if (n === 1) {
    if (unit === "month") {
      return "Monthly";
    }
    if (unit === "year") {
      return "Yearly";
    }
    if (unit === "week") {
      return "Weekly";
    }
    if (unit === "day") {
      return "Daily";
    }
    return `Every ${interval}`;
  }
  const plural =
    unit === "month"
      ? "months"
      : unit === "year"
        ? "years"
        : unit === "week"
          ? "weeks"
          : unit === "day"
            ? "days"
            : `${interval}s`;
  return `Every ${n} ${plural}`;
}

export function TenantBillingCatalogSection(props: {
  catalogPlans: BillingCatalogPlanRow[];
  currentPlan: TenantSubscriptionPlan;
  canManageBilling: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function launch(plan: StripeCheckoutPlan) {
    startTransition(async () => {
      try {
        const { url } = await startTenantAdminStripeCheckoutAction(plan);
        window.location.href = url;
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not start Stripe Checkout.",
        );
      }
    });
  }

  if (props.catalogPlans.length === 0) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTitle>No Stripe catalog in the database yet</AlertTitle>
          <AlertDescription>
            A platform admin can sync Products and Prices from Stripe (platform host: Admin →
            Subscriptions → Sync Stripe catalog). Until then, Checkout can fall back to the{" "}
            <span className="font-medium text-foreground">STRIPE_PRICE_*</span> environment
            variables—see the documentation.
          </AlertDescription>
        </Alert>
        {props.canManageBilling ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Use the fallback buttons below to open Stripe-hosted Checkout while env price IDs are
              set.
            </p>
            <TenantBillingCheckoutButtons />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            When the catalog or env price IDs are configured, workspace owners or admins will be able
            to open Checkout from this page.
          </p>
        )}
      </div>
    );
  }

  const isChoosingFirstPlan = props.currentPlan === "free";

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {props.catalogPlans.map(plan => {
        const isCurrent =
          props.currentPlan !== "free" &&
          props.currentPlan === plan.planKey;
        const ariaLabel = pending
          ? "Starting Checkout"
          : isCurrent
            ? `Current workspace plan (${plan.planKey})`
            : `${isChoosingFirstPlan ? "Choose plan" : "Change plan"}: ${plan.planKey}`;

        return (
          <div
            key={plan.planKey}
            className="flex flex-col rounded-xl border border-border bg-muted/40 p-4 shadow-sm sm:min-h-[220px]"
          >
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {plan.planKey}
              </p>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                {plan.productName}
              </h3>
            </div>
            {plan.productDescription?.trim() ? (
              <p className="text-muted-foreground mt-2 line-clamp-4 text-sm leading-relaxed">
                {plan.productDescription.trim()}
              </p>
            ) : (
              <p className="text-muted-foreground mt-2 text-sm">—</p>
            )}
            <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  {formatMoney(plan.currency, plan.unitAmountCents)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Cadence</dt>
                <dd className="font-medium text-foreground">
                  {formatCadence(plan.recurringInterval, plan.recurringIntervalCount)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Currency</dt>
                <dd className="font-mono text-xs uppercase text-foreground">{plan.currency}</dd>
              </div>
            </dl>
            <div className="mt-auto pt-4">
              {props.canManageBilling ? (
                <Button
                  type="button"
                  variant={isCurrent ? "secondary" : "default"}
                  className="w-full"
                  size="sm"
                  disabled={pending || isCurrent}
                  onClick={() => launch(plan.planKey)}
                  aria-busy={pending}
                  aria-label={ariaLabel}
                >
                  {pending
                    ? "Redirecting…"
                    : isCurrent
                      ? "Current plan"
                      : isChoosingFirstPlan
                        ? "Choose plan"
                        : "Change plan"}
                </Button>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Owners and admins can subscribe or switch plans via Stripe Checkout.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
