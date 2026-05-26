import Link from "next/link";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSubscriptionPlanLabel } from "@/lib/subscription-display";
import type {
  SubscriptionFeatureKey,
} from "@/lib/subscription-plan-capabilities";
import type { TenantSubscriptionPlan } from "@/lib/tenant-subscription";

type PlanFeatureGateProps = {
  enabled: boolean;
  featureKey: SubscriptionFeatureKey;
  currentPlan: TenantSubscriptionPlan;
  children: ReactNode;
  requiredPlan?: TenantSubscriptionPlan;
};

const FEATURE_LABEL: Record<SubscriptionFeatureKey, string> = {
  sales_orders: "Sales orders",
  purchasing: "Purchasing",
  inventory: "Inventory",
  dashboard: "Dashboard",
  support_tickets: "Support tickets",
  reports: "Reports",
  platform_support: "Platform support",
};

export function PlanFeatureGate({
  enabled,
  featureKey,
  currentPlan,
  children,
  requiredPlan,
}: PlanFeatureGateProps) {
  if (enabled) {
    return <>{children}</>;
  }

  const featureName = FEATURE_LABEL[featureKey];
  const currentPlanLabel = formatSubscriptionPlanLabel(currentPlan);
  const requiredPlanLabel = requiredPlan
    ? formatSubscriptionPlanLabel(requiredPlan)
    : "a higher plan";
  const requirementMessage = requiredPlan
    ? `This feature requires ${requiredPlanLabel} or higher.`
    : "This feature requires a higher plan.";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-4" />
          {featureName} is not included in this plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Your current plan: {currentPlanLabel}
          </p>
          <p className="text-sm text-muted-foreground">{requirementMessage}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild>
            <Link href="/settings/billing/plan-and-usage#billing-plans">Upgrade plan</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
