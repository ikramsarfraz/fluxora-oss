"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, CreditCard, Sparkles, Users, Package, Building2, ShoppingCart, Zap, Crown, Rocket } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  formatSubscriptionPlanLabel,
  formatSubscriptionStatusLabel,
  formatSubscriptionCurrentPeriodLine,
  formatSubscriptionTrialLine,
} from "@/lib/subscription-display";
import {
  formatUsageLimit,
  getUsagePercent,
  getUsageState,
  type SubscriptionUsageMetric,
  type SubscriptionUsageState,
} from "@/lib/subscription-usage-metrics";
import type { TenantSubscriptionPlan, TenantSubscriptionStatus } from "@/lib/tenant-subscription";
import type { TenantPlanUsage } from "@/services/subscription-usage";
import type { BillingBannerState } from "@/lib/billing-utils";

// ============================================================================
// Status Badge with Colored Variants
// ============================================================================

const STATUS_STYLES: Record<TenantSubscriptionStatus, { bg: string; text: string; dot: string }> = {
  active: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  trialing: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  past_due: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  canceled: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  comped: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", dot: "bg-purple-500" },
};

export function BillingStatusBadge({ status }: { status: TenantSubscriptionStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", style.bg, style.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {formatSubscriptionStatusLabel(status)}
    </span>
  );
}

// ============================================================================
// Plan Overview Card (Hero Section)
// ============================================================================

export function PlanOverviewCard({
  subscriptionPlan,
  subscriptionStatus,
  trialEndsAt,
  currentPeriodEndsAt,
  canManageBilling,
  stripeCustomerId,
  onManageBilling,
  onUpgrade,
}: {
  subscriptionPlan: TenantSubscriptionPlan;
  subscriptionStatus: TenantSubscriptionStatus;
  trialEndsAt: Date | string | null | undefined;
  currentPeriodEndsAt: Date | string | null | undefined;
  canManageBilling: boolean;
  stripeCustomerId: string | null;
  onManageBilling?: () => void;
  onUpgrade?: () => void;
}) {
  const planLabel = formatSubscriptionPlanLabel(subscriptionPlan);
  const isFreePlan = subscriptionPlan === "free";
  const hasStripeCustomer = !!stripeCustomerId?.trim();
  
  const billingPeriodText = (() => {
    if (subscriptionStatus === "trialing") {
      return formatSubscriptionTrialLine(subscriptionStatus, trialEndsAt);
    }
    const periodEnd = formatSubscriptionCurrentPeriodLine(currentPeriodEndsAt);
    if (periodEnd && periodEnd !== "—") {
      return `Renews ${periodEnd}`;
    }
    return null;
  })();

  const PlanIcon = subscriptionPlan === "enterprise" ? Crown : subscriptionPlan === "growth" ? Rocket : subscriptionPlan === "starter" ? Zap : Sparkles;

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
      <CardHeader className="relative">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <PlanIcon className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl">{planLabel} Plan</CardTitle>
                <BillingStatusBadge status={subscriptionStatus} />
              </div>
              {billingPeriodText && (
                <CardDescription className="text-sm">{billingPeriodText}</CardDescription>
              )}
            </div>
          </div>
          {canManageBilling && (
            <div className="flex flex-wrap gap-2">
              {hasStripeCustomer && onManageBilling && (
                <Button variant="outline" size="sm" onClick={onManageBilling}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Manage billing
                </Button>
              )}
              {(isFreePlan || subscriptionStatus === "canceled") && onUpgrade && (
                <Button size="sm" onClick={onUpgrade}>
                  Upgrade plan
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}

// ============================================================================
// Usage Row with Progress Bar
// ============================================================================

const USAGE_STATE_STYLES: Record<SubscriptionUsageState, { progress: string; text: string }> = {
  normal: { progress: "bg-primary", text: "text-muted-foreground" },
  warning: { progress: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  at_limit: { progress: "bg-red-500", text: "text-red-600 dark:text-red-400" },
};

const USAGE_ICONS: Record<string, React.ElementType> = {
  "Portal users": Users,
  "Products": Package,
  "Customers": Building2,
  "Monthly orders": ShoppingCart,
};

export function UsageRow({
  label,
  metric,
  showUpgradeCta = false,
}: {
  label: string;
  metric: SubscriptionUsageMetric;
  showUpgradeCta?: boolean;
}) {
  const state = getUsageState(metric);
  const percent = getUsagePercent(metric);
  const styles = USAGE_STATE_STYLES[state];
  const showUpgradeLink = showUpgradeCta && state !== "normal";
  const Icon = USAGE_ICONS[label] || Package;

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-card p-4 transition-colors hover:border-border">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className={cn("text-xs tabular-nums", styles.text)}>
              {metric.current} / {formatUsageLimit(metric.limit)}
            </p>
          </div>
        </div>
        {state !== "normal" && (
          <Badge 
            variant={state === "at_limit" ? "destructive" : "outline"}
            className={state === "warning" ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400" : ""}
          >
            {state === "at_limit" ? "At limit" : "Near limit"}
          </Badge>
        )}
      </div>
      {percent !== null && (
        <Progress
          value={Math.min(percent, 100)}
          className="h-1.5"
          indicatorClassName={styles.progress}
        />
      )}
      {showUpgradeLink && (
        <Link
          href="/account/billing#billing-plans"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Upgrade to increase limit
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

// ============================================================================
// Usage Card (Grid of Usage Rows)
// ============================================================================

export function UsageCard({
  usage,
  showUpgradeCta = false,
}: {
  usage: TenantPlanUsage;
  showUpgradeCta?: boolean;
}) {
  const anyNearLimit = [usage.portalUsers, usage.products, usage.customers, usage.monthlyOrders].some(
    (m) => getUsageState(m) !== "normal"
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Plan Usage</CardTitle>
            <CardDescription>
              Current usage for the {formatSubscriptionPlanLabel(usage.currentPlan)} plan
            </CardDescription>
          </div>
          {anyNearLimit && showUpgradeCta && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/account/billing#billing-plans">
                <Sparkles className="mr-2 h-4 w-4" />
                Upgrade
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          <UsageRow label="Portal users" metric={usage.portalUsers} showUpgradeCta={showUpgradeCta} />
          <UsageRow label="Products" metric={usage.products} showUpgradeCta={showUpgradeCta} />
          <UsageRow label="Customers" metric={usage.customers} showUpgradeCta={showUpgradeCta} />
          <UsageRow label="Monthly orders" metric={usage.monthlyOrders} showUpgradeCta={showUpgradeCta} />
        </div>
      </CardContent>
      {anyNearLimit && showUpgradeCta && (
        <CardFooter className="border-t bg-muted/30 px-6 py-3">
          <p className="text-xs text-muted-foreground">
            <AlertTriangle className="mr-1.5 inline-block h-3.5 w-3.5 text-amber-500" />
            {"You're approaching your plan limits. Upgrade to avoid interruptions."}
          </p>
        </CardFooter>
      )}
    </Card>
  );
}

// ============================================================================
// Billing State Banner
// ============================================================================

const BANNER_CONFIG: Record<BillingBannerState, {
  title: string;
  description: string;
  variant: "warning" | "destructive" | "info" | "default";
  cta?: { label: string; href?: string };
}> = {
  past_due: {
    title: "Payment failed",
    description: "Your payment method was declined. Please update it to avoid service interruption.",
    variant: "warning",
    cta: { label: "Update payment method" },
  },
  canceled: {
    title: "Subscription canceled",
    description: "Your subscription has been canceled. Resubscribe to restore access to all features.",
    variant: "destructive",
    cta: { label: "Resume subscription", href: "#billing-plans" },
  },
  expired: {
    title: "Subscription expired",
    description: "Your subscription or trial period has ended. Choose a plan to continue using the platform.",
    variant: "destructive",
    cta: { label: "Choose a plan", href: "#billing-plans" },
  },
  trialing_soon: {
    title: "Trial ending soon",
    description: "Your trial period is ending soon. Upgrade now to ensure uninterrupted access.",
    variant: "info",
    cta: { label: "Upgrade now", href: "#billing-plans" },
  },
  no_subscription: {
    title: "Choose a plan to get started",
    description: "Select a subscription plan that fits your needs and unlock all features.",
    variant: "default",
    cta: { label: "View plans", href: "#billing-plans" },
  },
};

const BANNER_STYLES: Record<"warning" | "destructive" | "info" | "default", { bg: string; border: string; icon: string }> = {
  warning: { bg: "bg-amber-500/10", border: "border-amber-500/30", icon: "text-amber-500" },
  destructive: { bg: "bg-red-500/10", border: "border-red-500/30", icon: "text-red-500" },
  info: { bg: "bg-blue-500/10", border: "border-blue-500/30", icon: "text-blue-500" },
  default: { bg: "bg-primary/5", border: "border-primary/20", icon: "text-primary" },
};

export function BillingStateBanner({
  state,
  canManageBilling,
  onAction,
}: {
  state: BillingBannerState;
  canManageBilling: boolean;
  onAction?: () => void;
}) {
  const config = BANNER_CONFIG[state];
  const styles = BANNER_STYLES[config.variant];
  const Icon = config.variant === "default" ? Sparkles : AlertTriangle;

  return (
    <div className={cn("flex items-start gap-4 rounded-lg border p-4", styles.bg, styles.border)}>
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", styles.bg)}>
        <Icon className={cn("h-5 w-5", styles.icon)} />
      </div>
      <div className="flex-1 space-y-1">
        <h3 className="font-medium text-foreground">{config.title}</h3>
        <p className="text-sm text-muted-foreground">{config.description}</p>
        {!canManageBilling && (
          <p className="text-xs text-muted-foreground">Contact an admin to manage billing settings.</p>
        )}
      </div>
      {canManageBilling && config.cta && (
        config.cta.href ? (
          <Button size="sm" asChild>
            <Link href={config.cta.href}>{config.cta.label}</Link>
          </Button>
        ) : (
          <Button size="sm" onClick={onAction}>{config.cta.label}</Button>
        )
      )}
    </div>
  );
}

// Re-export for convenience (type only, function is in lib/billing-utils.ts)
export type { BillingBannerState } from "@/lib/billing-utils";

// ============================================================================
// Plan Feature List (for Plan Cards)
// ============================================================================

const PLAN_FEATURES: Record<TenantSubscriptionPlan, string[]> = {
  free: ["1 portal user", "10 products", "5 customers", "10 orders/month"],
  starter: ["5 portal users", "100 products", "50 customers", "100 orders/month", "Email support"],
  growth: ["25 portal users", "500 products", "250 customers", "500 orders/month", "Priority support", "API access"],
  enterprise: ["Unlimited users", "Unlimited products", "Unlimited customers", "Unlimited orders", "24/7 support", "Custom integrations", "Dedicated account manager"],
};

export function PlanFeatureList({ plan }: { plan: TenantSubscriptionPlan }) {
  const features = PLAN_FEATURES[plan];
  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {features.map((feature) => (
        <li key={feature} className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}
