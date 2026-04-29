"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Check,
  Zap,
  Rocket,
  Crown,
  Sparkles,
  ArrowRight,
  Loader2,
  Users,
  Package,
  UserCheck,
  ShoppingCart,
  Mail,
} from "lucide-react";

import { startTenantAdminStripeCheckoutAction } from "@/actions/stripe-billing";
import { TenantBillingCheckoutButtons } from "@/components/account/tenant-billing-checkout-buttons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BillingCatalogPlanRow } from "@/services/stripe-catalog";
import type { TenantSubscriptionPlan } from "@/lib/tenant-subscription";
import type { StripeCheckoutPlan } from "@/services/stripe-tenant-billing";
import { buildPublicSupportMailto } from "@/lib/public-contact";

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatMoney(currency: string, unitAmountCents: number | null): string {
  if (unitAmountCents == null) {
    return "Custom";
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
  if (!interval) return "";
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
    raw === "month"
      ? "months"
      : raw === "year"
        ? "years"
        : raw === "week"
          ? "weeks"
          : raw === "day"
            ? "days"
            : `${interval}s`;
  return `/${n} ${plural}`;
}

// ============================================================================
// Plan Configuration
// ============================================================================

const PLAN_ORDER: TenantSubscriptionPlan[] = ["starter", "growth", "enterprise"];

const PLAN_ICONS: Record<string, React.ElementType> = {
  starter: Zap,
  growth: Rocket,
  enterprise: Crown,
};

const PLAN_CONFIG: Record<
  string,
  {
    description: string;
    iconBg: string;
    iconColor: string;
    cardBorder: string;
    cardHoverBorder: string;
    badgeBg: string;
    badgeText: string;
    checkBg: string;
    checkColor: string;
  }
> = {
  starter: {
    description: "Perfect for small teams getting started",
    iconBg: "bg-sky-100 dark:bg-sky-900/30",
    iconColor: "text-sky-600 dark:text-sky-400",
    cardBorder: "border-border",
    cardHoverBorder: "hover:border-sky-300 dark:hover:border-sky-700",
    badgeBg: "bg-sky-100 dark:bg-sky-900/30",
    badgeText: "text-sky-700 dark:text-sky-300",
    checkBg: "bg-sky-100 dark:bg-sky-900/30",
    checkColor: "text-sky-600 dark:text-sky-400",
  },
  growth: {
    description: "For growing businesses that need more",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    cardBorder: "border-primary/40",
    cardHoverBorder: "hover:border-primary",
    badgeBg: "bg-primary",
    badgeText: "text-primary-foreground",
    checkBg: "bg-primary/10",
    checkColor: "text-primary",
  },
  enterprise: {
    description: "Advanced features for large organizations",
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
    cardBorder: "border-border",
    cardHoverBorder: "hover:border-amber-300 dark:hover:border-amber-700",
    badgeBg: "bg-amber-100 dark:bg-amber-900/30",
    badgeText: "text-amber-700 dark:text-amber-300",
    checkBg: "bg-amber-100 dark:bg-amber-900/30",
    checkColor: "text-amber-600 dark:text-amber-400",
  },
};

// Usage limits per plan
const PLAN_LIMITS: Record<
  string,
  { portalUsers: string; products: string; customers: string; monthlyOrders: string }
> = {
  starter: {
    portalUsers: "3",
    products: "250",
    customers: "250",
    monthlyOrders: "100",
  },
  growth: {
    portalUsers: "10",
    products: "5,000",
    customers: "5,000",
    monthlyOrders: "1,000",
  },
  enterprise: {
    portalUsers: "Unlimited",
    products: "Unlimited",
    customers: "Unlimited",
    monthlyOrders: "Unlimited",
  },
};

// Feature lists per plan
const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    "Sales orders and inventory",
    "Dashboard and usage visibility",
    "Support tickets",
  ],
  growth: [
    "Everything in Starter",
    "Purchasing and supplier invoices",
    "Reports and aging views",
  ],
  enterprise: [
    "Everything in Growth",
    "Unlimited core limits",
    "Platform support",
  ],
};

// ============================================================================
// Usage Limit Row
// ============================================================================

function UsageLimitRow({
  icon: Icon,
  label,
  value,
  isUnlimited,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  isUnlimited?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <span
        className={cn(
          "font-medium",
          isUnlimited ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ============================================================================
// Plan Card Component
// ============================================================================

function PlanCard({
  plan,
  currentPlan,
  isPopular,
  canManageBilling,
  pending,
  onSelect,
}: {
  plan: BillingCatalogPlanRow;
  currentPlan: TenantSubscriptionPlan;
  isPopular: boolean;
  canManageBilling: boolean;
  pending: boolean;
  onSelect: () => void;
}) {
  const Icon = PLAN_ICONS[plan.planKey] || Sparkles;
  const config = PLAN_CONFIG[plan.planKey] || PLAN_CONFIG.starter;
  const limits = PLAN_LIMITS[plan.planKey] || PLAN_LIMITS.starter;
  const features = PLAN_FEATURES[plan.planKey] || [];

  const isCurrent = currentPlan === plan.planKey;
  const isEnterprise = plan.planKey === "enterprise";
  const hasNoPrice = plan.unitAmountCents == null;

  // Determine CTA state
  const planTier = PLAN_ORDER.indexOf(plan.planKey as TenantSubscriptionPlan);
  const currentTier = PLAN_ORDER.indexOf(currentPlan);
  const isUpgrade = planTier > currentTier;
  const isDowngrade = planTier < currentTier && currentPlan !== "free";

  // CTA label logic
  function getCtaLabel() {
    if (isCurrent) return "Current Plan";
    if (isEnterprise && hasNoPrice) return "Contact Us";
    if (isUpgrade) return "Upgrade";
    if (isDowngrade) return "Switch Plan";
    return "Get Started";
  }

  // CTA disabled logic
  const isCtaDisabled = isCurrent || pending;

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl border-2 bg-card p-6 transition-all duration-200",
        config.cardBorder,
        !isCurrent && config.cardHoverBorder,
        // Current plan highlight
        isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        // Popular plan subtle shadow
        isPopular && !isCurrent && "shadow-md"
      )}
    >
      {/* Popular Badge */}
      {isPopular && !isCurrent && (
        <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
          <Badge className={cn("px-3 py-1 text-xs font-medium shadow-sm", config.badgeBg, config.badgeText)}>
            Most Popular
          </Badge>
        </div>
      )}

      {/* Current Plan Badge */}
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
          <Badge variant="secondary" className="px-3 py-1 text-xs font-medium shadow-sm">
            Current Plan
          </Badge>
        </div>
      )}

      {/* Plan Header */}
      <div className="mb-5 space-y-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105",
              config.iconBg
            )}
          >
            <Icon className={cn("h-5 w-5", config.iconColor)} />
          </div>
          <div>
            <h3 className="text-lg font-semibold capitalize">{plan.planKey}</h3>
            <p className="text-xs text-muted-foreground">
              {plan.productDescription?.trim() || config.description}
            </p>
          </div>
        </div>

        {/* Pricing */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tracking-tight">
            {formatMoney(plan.currency, plan.unitAmountCents)}
          </span>
          {!hasNoPrice && (
            <span className="text-sm text-muted-foreground">
              {formatCadence(plan.recurringInterval, plan.recurringIntervalCount)}
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="mb-5 h-px bg-border" />

      {/* Usage Limits */}
      <div className="mb-5 space-y-2.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Usage Limits
        </p>
        <div className="space-y-2">
          <UsageLimitRow
            icon={Users}
            label="Portal users"
            value={limits.portalUsers}
            isUnlimited={limits.portalUsers === "Unlimited"}
          />
          <UsageLimitRow
            icon={Package}
            label="Products"
            value={limits.products}
            isUnlimited={limits.products === "Unlimited"}
          />
          <UsageLimitRow
            icon={UserCheck}
            label="Customers"
            value={limits.customers}
            isUnlimited={limits.customers === "Unlimited"}
          />
          <UsageLimitRow
            icon={ShoppingCart}
            label="Monthly orders"
            value={limits.monthlyOrders}
            isUnlimited={limits.monthlyOrders === "Unlimited"}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="mb-5 h-px bg-border" />

      {/* Features */}
      <div className="mb-6 flex-1">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Features
        </p>
        <ul className="space-y-2.5">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm">
              <div
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                  config.checkBg
                )}
              >
                <Check className={cn("h-2.5 w-2.5", config.checkColor)} />
              </div>
              <span className="text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA Button */}
      <div className="mt-auto">
        {canManageBilling ? (
          isEnterprise && hasNoPrice ? (
            // Enterprise "Contact Us" button
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 transition-all duration-200 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-900/20 dark:hover:text-amber-300"
              size="lg"
              asChild
            >
              <a href={buildPublicSupportMailto("Fluxora enterprise plan inquiry")}>
                <Mail className="h-4 w-4" />
                Contact Us
              </a>
            </Button>
          ) : (
            <Button
              type="button"
              variant={isCurrent ? "outline" : isPopular ? "default" : "outline"}
              className={cn(
                "w-full transition-all duration-200 active:scale-[0.98]",
                isPopular && !isCurrent && "shadow-sm",
                isCurrent && "cursor-not-allowed opacity-60"
              )}
              size="lg"
              disabled={isCtaDisabled}
              onClick={onSelect}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  {getCtaLabel()}
                  {!isCurrent && (
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  )}
                </>
              )}
            </Button>
          )
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Contact an admin to change plans
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Catalog Section
// ============================================================================

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
          e instanceof Error ? e.message : "Could not start Stripe Checkout."
        );
      }
    });
  }

  // Empty state
  if (props.catalogPlans.length === 0) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTitle>No plans available</AlertTitle>
          <AlertDescription>
            Subscription plans will appear here once the Stripe catalog is
            synced. Platform administrators can sync Products and Prices from
            the admin dashboard.
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
          const isPopular = plan.planKey === "growth";

          return (
            <PlanCard
              key={plan.planKey}
              plan={plan}
              currentPlan={props.currentPlan}
              isPopular={isPopular}
              canManageBilling={props.canManageBilling}
              pending={pending}
              onSelect={() => launch(plan.planKey)}
            />
          );
        })}
      </div>

      {/* Footer */}
      {props.canManageBilling && props.catalogPlans.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Secure checkout powered by Stripe. Cancel or change plans anytime.
        </p>
      )}
    </div>
  );
}
