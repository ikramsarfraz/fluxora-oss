"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, Zap, Rocket, Crown, Sparkles, ArrowRight, Loader2 } from "lucide-react";

import { startTenantAdminStripeCheckoutAction } from "@/actions/stripe-billing";
import { TenantBillingCheckoutButtons } from "@/components/account/tenant-billing-checkout-buttons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(unitAmountCents / 100);
  } catch {
    return `${(unitAmountCents / 100).toFixed(0)} ${currency.toUpperCase()}`;
  }
}

function formatCadence(interval: string | null, count: number | null): string {
  if (!interval) {
    return "";
  }
  const raw = interval.toLowerCase();
  const n = count ?? 1;
  
  if (n === 1) {
    if (raw === "month") return "/month";
    if (raw === "year") return "/year";
    if (raw === "week") return "/week";
    if (raw === "day") return "/day";
    return `/${interval}`;
  }
  
  const plural =
    raw === "month" ? "months" : raw === "year" ? "years" : raw === "week" ? "weeks" : raw === "day" ? "days" : `${interval}s`;
  return `/${n} ${plural}`;
}

const PLAN_ICONS: Record<string, React.ElementType> = {
  starter: Zap,
  growth: Rocket,
  enterprise: Crown,
};

const PLAN_COLORS: Record<string, { border: string; bg: string; badge: string }> = {
  starter: {
    border: "border-border hover:border-primary/30",
    bg: "bg-card",
    badge: "bg-primary/10 text-primary",
  },
  growth: {
    border: "border-primary/50 hover:border-primary ring-2 ring-primary/10",
    bg: "bg-gradient-to-b from-primary/5 to-transparent",
    badge: "bg-primary text-primary-foreground",
  },
  enterprise: {
    border: "border-border hover:border-primary/30",
    bg: "bg-card",
    badge: "bg-secondary text-secondary-foreground",
  },
};

// Feature lists for each plan (placeholder - replace with actual features from metadata if available)
const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    "Up to 5 team members",
    "100 products",
    "50 customers",
    "100 orders/month",
    "Email support",
  ],
  growth: [
    "Up to 25 team members",
    "500 products",
    "250 customers",
    "500 orders/month",
    "Priority support",
    "API access",
  ],
  enterprise: [
    "Unlimited team members",
    "Unlimited products",
    "Unlimited customers",
    "Unlimited orders",
    "24/7 phone support",
    "Custom integrations",
    "Dedicated account manager",
  ],
};

function PlanCard({
  plan,
  isCurrent,
  isPopular,
  canManageBilling,
  pending,
  onSelect,
}: {
  plan: BillingCatalogPlanRow;
  isCurrent: boolean;
  isPopular: boolean;
  canManageBilling: boolean;
  pending: boolean;
  onSelect: () => void;
}) {
  const Icon = PLAN_ICONS[plan.planKey] || Sparkles;
  const colors = PLAN_COLORS[plan.planKey] || PLAN_COLORS.starter;
  const features = PLAN_FEATURES[plan.planKey] || [];

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border-2 p-6 transition-all",
        colors.border,
        colors.bg,
        isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      {/* Popular Badge */}
      {isPopular && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className={cn("px-3 py-1", colors.badge)}>Most Popular</Badge>
        </div>
      )}

      {/* Current Badge */}
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge variant="default" className="px-3 py-1">Current Plan</Badge>
        </div>
      )}

      {/* Plan Header */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", isPopular ? "bg-primary/10" : "bg-muted")}>
            <Icon className={cn("h-5 w-5", isPopular ? "text-primary" : "text-muted-foreground")} />
          </div>
          <div>
            <h3 className="text-lg font-semibold capitalize">{plan.planKey}</h3>
            {plan.productDescription?.trim() && (
              <p className="text-xs text-muted-foreground line-clamp-1">{plan.productDescription.trim()}</p>
            )}
          </div>
        </div>

        {/* Pricing */}
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tracking-tight">
            {formatMoney(plan.currency, plan.unitAmountCents)}
          </span>
          <span className="text-sm text-muted-foreground">
            {formatCadence(plan.recurringInterval, plan.recurringIntervalCount)}
          </span>
        </div>
      </div>

      {/* Features List */}
      <ul className="mb-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <div className="mt-auto">
        {canManageBilling ? (
          <Button
            type="button"
            variant={isCurrent ? "outline" : isPopular ? "default" : "outline"}
            className={cn("w-full", isPopular && !isCurrent && "bg-primary hover:bg-primary/90")}
            size="lg"
            disabled={pending || isCurrent}
            onClick={onSelect}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting...
              </>
            ) : isCurrent ? (
              "Current plan"
            ) : (
              <>
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Contact an admin to change plans
          </p>
        )}
      </div>
    </div>
  );
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
          <AlertTitle>No plans available</AlertTitle>
          <AlertDescription>
            Subscription plans will appear here once the Stripe catalog is synced.
            Platform administrators can sync Products and Prices from the admin dashboard.
          </AlertDescription>
        </Alert>
        {props.canManageBilling && (
          <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
            <p className="text-sm text-muted-foreground">
              Use fallback checkout buttons while catalog sync is pending:
            </p>
            <TenantBillingCheckoutButtons />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plan Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {props.catalogPlans.map((plan) => {
          const isCurrent = props.currentPlan !== "free" && props.currentPlan === plan.planKey;
          const isPopular = plan.planKey === "growth";

          return (
            <PlanCard
              key={plan.planKey}
              plan={plan}
              isCurrent={isCurrent}
              isPopular={isPopular}
              canManageBilling={props.canManageBilling}
              pending={pending}
              onSelect={() => launch(plan.planKey)}
            />
          );
        })}
      </div>

      {/* Footer Note */}
      {props.canManageBilling && props.catalogPlans.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Secure checkout powered by Stripe. Cancel or change plans anytime.
        </p>
      )}
    </div>
  );
}
