"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, CreditCard, Sparkles, Users, Package, Building2, ShoppingCart, Zap, Crown, Rocket, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import type { TenantPlanUsage } from "@/modules/core/billing/services/subscription-usage";
import type { BillingBannerState } from "@/lib/billing-utils";

// ============================================================================
// Status Badge with Colored Variants
// ============================================================================

const STATUS_STYLES: Record<TenantSubscriptionStatus, { bg: string; text: string; dot: string }> = {
  active: { bg: "bg-success-fg/10", text: "text-success-fg dark:text-success-fg", dot: "bg-success-fg" },
  trialing: { bg: "bg-forest/10", text: "text-forest dark:text-forest", dot: "bg-forest" },
  past_due: { bg: "bg-warning-fg/10", text: "text-warning-fg dark:text-warning-fg", dot: "bg-warning-fg" },
  canceled: { bg: "bg-danger-fg/10", text: "text-danger-fg dark:text-danger-fg", dot: "bg-danger-fg" },
  comped: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", dot: "bg-purple-500" },
};

export function BillingStatusBadge({ status }: { status: TenantSubscriptionStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
      style.bg, 
      style.text
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", style.dot)} />
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

  // Gradient colors per plan for visual identity
  const planGradient = subscriptionPlan === "enterprise" 
    ? "from-amber-500/10 via-amber-500/5 to-transparent" 
    : subscriptionPlan === "growth" 
      ? "from-primary/10 via-primary/5 to-transparent" 
      : subscriptionPlan === "starter"
        ? "from-blue-500/10 via-blue-500/5 to-transparent"
        : "from-muted/50 via-transparent to-transparent";

  const iconBg = subscriptionPlan === "enterprise"
    ? "bg-warning-fg/10"
    : subscriptionPlan === "growth"
      ? "bg-primary/10"
      : subscriptionPlan === "starter"
        ? "bg-forest/10"
        : "bg-muted";

  const iconColor = subscriptionPlan === "enterprise"
    ? "text-warning-fg dark:text-warning-fg"
    : subscriptionPlan === "growth"
      ? "text-primary"
      : subscriptionPlan === "starter"
        ? "text-forest dark:text-forest"
        : "text-muted-foreground";

  return (
    <Card className="relative overflow-hidden shadow-sm transition-shadow hover:shadow-md">
      {/* Gradient background */}
      <div className={cn("absolute inset-0 bg-gradient-to-br", planGradient)} />
      
      {/* Subtle top border accent */}
      <div className={cn(
        "absolute inset-x-0 top-0 h-0.5",
        subscriptionPlan === "enterprise" ? "bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" :
        subscriptionPlan === "growth" ? "bg-gradient-to-r from-transparent via-primary/50 to-transparent" :
        subscriptionPlan === "starter" ? "bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" :
        "bg-gradient-to-r from-transparent via-border to-transparent"
      )} />

      <CardHeader className="relative pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform hover:scale-105",
              iconBg
            )}>
              <PlanIcon className={cn("h-6 w-6", iconColor)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <CardTitle className="text-xl font-medium tracking-tight">{planLabel} Plan</CardTitle>
                <BillingStatusBadge status={subscriptionStatus} />
              </div>
              {billingPeriodText && (
                <CardDescription className="text-sm text-muted-foreground">{billingPeriodText}</CardDescription>
              )}
            </div>
          </div>
          {canManageBilling && (
            <div className="flex flex-wrap gap-2">
              {hasStripeCustomer && onManageBilling && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onManageBilling}
                  className="transition-all hover:bg-muted/80 active:scale-[0.98]"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Manage billing
                </Button>
              )}
              {(isFreePlan || subscriptionStatus === "canceled") && onUpgrade && (
                <Button 
                  size="sm" 
                  onClick={onUpgrade}
                  className="transition-all active:scale-[0.98]"
                >
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
// Usage Row with Progress Bar + Tooltip
// ============================================================================

const USAGE_STATE_STYLES: Record<SubscriptionUsageState, { 
  progress: string; 
  text: string;
  glow?: string;
  badge: string;
}> = {
  normal: { 
    progress: "bg-primary", 
    text: "text-muted-foreground",
    badge: "",
  },
  warning: { 
    progress: "bg-warning-fg", 
    text: "text-warning-fg dark:text-warning-fg",
    glow: "shadow-[0_0_8px_rgba(245,158,11,0.3)]",
    badge: "border-amber-500/50 bg-warning-fg/10 text-warning-fg dark:text-warning-fg",
  },
  at_limit: { 
    progress: "bg-danger-fg", 
    text: "text-danger-fg dark:text-danger-fg",
    glow: "shadow-[0_0_8px_rgba(239,68,68,0.3)]",
    badge: "bg-danger-fg/10 text-danger-fg dark:text-danger-fg border-red-500/50",
  },
};

const USAGE_ICONS: Record<string, React.ElementType> = {
  "Portal users": Users,
  "Products": Package,
  "Customers": Building2,
  "Monthly orders": ShoppingCart,
};

const USAGE_LABELS: Record<string, string> = {
  "Portal users": "portal users",
  "Products": "products",
  "Customers": "customers",
  "Monthly orders": "orders this month",
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
  const labelLower = USAGE_LABELS[label] || label.toLowerCase();
  
  const tooltipText = `${metric.current} / ${formatUsageLimit(metric.limit)} ${labelLower} used`;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "group space-y-3 rounded-lg border bg-card p-4 transition-all duration-200",
            state === "normal" 
              ? "border-border/50 hover:border-border hover:bg-muted/30" 
              : state === "warning"
                ? "border-amber-500/30 hover:border-amber-500/50 bg-warning-fg/[0.02]"
                : "border-red-500/30 hover:border-red-500/50 bg-danger-fg/[0.02]"
          )}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                  state === "normal" ? "bg-muted group-hover:bg-muted/80" :
                  state === "warning" ? "bg-warning-fg/10" : "bg-danger-fg/10"
                )}>
                  <Icon className={cn(
                    "h-4 w-4 transition-colors",
                    state === "normal" ? "text-muted-foreground" :
                    state === "warning" ? "text-warning-fg dark:text-warning-fg" : "text-danger-fg dark:text-danger-fg"
                  )} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <div className="flex items-center gap-2">
                    <p className={cn("text-xs tabular-nums", styles.text)}>
                      {metric.current} / {formatUsageLimit(metric.limit)}
                    </p>
                    {percent !== null && (
                      <span className={cn(
                        "text-xs font-medium tabular-nums",
                        state === "normal" ? "text-muted-foreground/70" :
                        state === "warning" ? "text-warning-fg/80 dark:text-warning-fg/80" : 
                        "text-danger-fg/80 dark:text-danger-fg/80"
                      )}>
                        ({Math.round(percent)}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {state !== "normal" && (
                <Badge 
                  variant="outline"
                  className={cn("text-xs transition-colors", styles.badge)}
                >
                  {state === "at_limit" ? "At limit" : "Near limit"}
                </Badge>
              )}
            </div>
            {percent !== null && (
              <div className={cn("relative", styles.glow && state !== "normal" && styles.glow)}>
                <Progress
                  value={Math.min(percent, 100)}
                  className="h-1.5"
                  indicatorClassName={cn(styles.progress, "transition-all duration-700 ease-out")}
                />
              </div>
            )}
            {showUpgradeLink && (
              <Link
                href="/account/billing#billing-plans"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
              >
                Upgrade to increase limit
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
  const metrics = [usage.portalUsers, usage.products, usage.customers, usage.monthlyOrders];
  const nearLimitCount = metrics.filter((m) => getUsageState(m) === "warning").length;
  const atLimitCount = metrics.filter((m) => getUsageState(m) === "at_limit").length;
  const anyIssue = nearLimitCount > 0 || atLimitCount > 0;

  return (
    <Card className="transition-shadow hover:shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg">Plan Usage</CardTitle>
            <CardDescription>
              Current usage for the {formatSubscriptionPlanLabel(usage.currentPlan)} plan
            </CardDescription>
          </div>
          {anyIssue && showUpgradeCta && (
            <Button 
              variant="outline" 
              size="sm" 
              asChild
              className="transition-all hover:bg-muted/80 active:scale-[0.98]"
            >
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
      {anyIssue && showUpgradeCta && (
        <CardFooter className="border-t bg-muted/30 px-6 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning-fg" />
            <p className="text-xs text-muted-foreground">
              {atLimitCount > 0 
                ? `You've reached ${atLimitCount} plan limit${atLimitCount > 1 ? "s" : ""}. Upgrade to avoid service interruptions.`
                : `You're approaching ${nearLimitCount} plan limit${nearLimitCount > 1 ? "s" : ""}. Consider upgrading soon.`
              }
            </p>
          </div>
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
  icon: React.ElementType;
  cta?: { label: string; href?: string };
}> = {
  past_due: {
    title: "Payment requires attention",
    description: "Your payment method was declined. Please update it to continue using all features.",
    variant: "warning",
    icon: CreditCard,
    cta: { label: "Update payment" },
  },
  canceled: {
    title: "Subscription canceled",
    description: "Your subscription has been canceled. Resubscribe to restore access to all features.",
    variant: "destructive",
    icon: AlertTriangle,
    cta: { label: "Choose a plan", href: "#billing-plans" },
  },
  expired: {
    title: "Subscription expired",
    description: "Your subscription or trial period has ended. Choose a plan to continue using the platform.",
    variant: "destructive",
    icon: AlertTriangle,
    cta: { label: "Choose a plan", href: "#billing-plans" },
  },
  trialing_soon: {
    title: "Trial ending soon",
    description: "Your trial period is ending soon. Upgrade now to ensure uninterrupted access to all features.",
    variant: "info",
    icon: Info,
    cta: { label: "Upgrade now", href: "#billing-plans" },
  },
  no_subscription: {
    title: "Choose a plan to unlock all features",
    description: "Select a subscription plan that fits your needs and get started today.",
    variant: "default",
    icon: Sparkles,
    cta: { label: "View plans", href: "#billing-plans" },
  },
};

const BANNER_STYLES: Record<"warning" | "destructive" | "info" | "default", { 
  bg: string; 
  border: string; 
  iconBg: string;
  icon: string;
}> = {
  warning: { 
    bg: "bg-warning-fg/5", 
    border: "border-amber-500/30", 
    iconBg: "bg-warning-fg/10",
    icon: "text-warning-fg" 
  },
  destructive: { 
    bg: "bg-danger-fg/5", 
    border: "border-red-500/30", 
    iconBg: "bg-danger-fg/10",
    icon: "text-danger-fg" 
  },
  info: { 
    bg: "bg-forest/5", 
    border: "border-blue-500/30", 
    iconBg: "bg-forest/10",
    icon: "text-forest" 
  },
  default: { 
    bg: "bg-primary/5", 
    border: "border-primary/20", 
    iconBg: "bg-primary/10",
    icon: "text-primary" 
  },
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
  const Icon = config.icon;

  return (
    <div className={cn(
      "flex items-start gap-4 rounded-lg border p-4 transition-colors",
      styles.bg, 
      styles.border
    )}>
      <div className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
        styles.iconBg
      )}>
        <Icon className={cn("h-5 w-5", styles.icon)} />
      </div>
      <div className="flex-1 space-y-1">
        <h3 className="font-medium text-foreground">{config.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{config.description}</p>
        {!canManageBilling && (
          <p className="text-xs text-muted-foreground pt-1">Contact an admin to manage billing settings.</p>
        )}
      </div>
      {canManageBilling && config.cta && (
        config.cta.href ? (
          <Button 
            size="sm" 
            asChild
            className="transition-all active:scale-[0.98]"
          >
            <Link href={config.cta.href}>
              {config.cta.label}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button 
            size="sm" 
            onClick={onAction}
            className="transition-all active:scale-[0.98]"
          >
            {config.cta.label}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
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
    <ul className="space-y-2.5 text-sm text-muted-foreground">
      {features.map((feature) => (
        <li key={feature} className="flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}
