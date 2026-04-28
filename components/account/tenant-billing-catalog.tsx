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

const PLAN_STYLES: Record<string, { 
  iconBg: string; 
  iconColor: string; 
  border: string;
  hoverBorder: string;
  accent: string;
}> = {
  starter: {
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-600 dark:text-blue-400",
    border: "border-border",
    hoverBorder: "hover:border-blue-500/30",
    accent: "from-blue-500/5",
  },
  growth: {
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    border: "border-primary/30",
    hoverBorder: "hover:border-primary/50",
    accent: "from-primary/5",
  },
  enterprise: {
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
    border: "border-border",
    hoverBorder: "hover:border-amber-500/30",
    accent: "from-amber-500/5",
  },
};

// Feature lists for each plan
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
  const styles = PLAN_STYLES[plan.planKey] || PLAN_STYLES.starter;
  const features = PLAN_FEATURES[plan.planKey] || [];

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl border-2 p-6 transition-all duration-200",
        styles.border,
        styles.hoverBorder,
        "bg-card",
        // Popular plan gets extra visual treatment
        isPopular && !isCurrent && "ring-1 ring-primary/20 shadow-sm",
        // Current plan indication
        isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      {/* Subtle gradient on hover */}
      <div className={cn(
        "absolute inset-0 rounded-xl bg-gradient-to-b to-transparent opacity-0 transition-opacity group-hover:opacity-100",
        styles.accent
      )} />

      {/* Popular Badge */}
      {isPopular && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary px-3 py-1 text-primary-foreground shadow-sm">
            Most Popular
          </Badge>
        </div>
      )}

      {/* Current Badge */}
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge variant="secondary" className="px-3 py-1 shadow-sm">
            Current Plan
          </Badge>
        </div>
      )}

      {/* Plan Header */}
      <div className="relative mb-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
            styles.iconBg
          )}>
            <Icon className={cn("h-5 w-5", styles.iconColor)} />
          </div>
          <div>
            <h3 className="text-lg font-semibold capitalize tracking-tight">{plan.planKey}</h3>
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

      {/* Divider */}
      <div className="relative mb-6 h-px bg-border" />

      {/* Features List */}
      <ul className="relative mb-6 flex-1 space-y-3">
        {features.map((feature, idx) => (
          <li 
            key={feature} 
            className="flex items-start gap-2.5 text-sm"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
              isPopular ? "bg-primary/10" : "bg-muted"
            )}>
              <Check className={cn(
                "h-2.5 w-2.5",
                isPopular ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <div className="relative mt-auto">
        {canManageBilling ? (
          <Button
            type="button"
            variant={isCurrent ? "outline" : isPopular ? "default" : "outline"}
            className={cn(
              "w-full transition-all active:scale-[0.98]",
              isPopular && !isCurrent && "bg-primary shadow-sm hover:bg-primary/90"
            )}
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
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
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
