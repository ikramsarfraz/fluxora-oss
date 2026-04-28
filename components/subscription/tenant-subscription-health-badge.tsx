import { Badge } from "@/components/ui/badge";
import type { TenantSubscriptionHealth } from "@/lib/tenant-subscription-health";
import { formatTenantSubscriptionHealthLabel } from "@/lib/tenant-subscription-health";

/** Platform-admin and internal labels for persisted tenant subscription snapshots. */
export function TenantSubscriptionHealthBadge(props: {
  health: TenantSubscriptionHealth;
}) {
  const variant =
    props.health === "past_due" ||
    props.health === "canceled" ||
    props.health === "expired"
      ? "destructive"
      : "secondary";
  return (
    <Badge variant={variant} className="font-normal">
      {formatTenantSubscriptionHealthLabel(props.health)}
    </Badge>
  );
}
