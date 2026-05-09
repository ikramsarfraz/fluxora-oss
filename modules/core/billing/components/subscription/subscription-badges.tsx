import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatSubscriptionPlanLabel,
  formatSubscriptionStatusLabel,
  subscriptionPlanBadgeVariant,
  subscriptionStatusBadgeVariant,
} from "@/lib/subscription-display";
import type {
  TenantSubscriptionPlan,
  TenantSubscriptionStatus,
} from "@/lib/tenant-subscription";

export function SubscriptionPlanBadge(props: {
  plan: TenantSubscriptionPlan;
  className?: string;
}) {
  return (
    <Badge variant={subscriptionPlanBadgeVariant(props.plan)} className={props.className}>
      {formatSubscriptionPlanLabel(props.plan)}
    </Badge>
  );
}

export function SubscriptionStatusBadge(props: {
  status: TenantSubscriptionStatus;
  className?: string;
}) {
  return (
    <Badge
      variant={subscriptionStatusBadgeVariant(props.status)}
      className={cn("font-medium", props.className)}
    >
      {formatSubscriptionStatusLabel(props.status)}
    </Badge>
  );
}
