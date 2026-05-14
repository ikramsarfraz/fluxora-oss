import { ComingSoonCard } from "@/modules/core/workspace-settings/components/settings-hub/coming-soon-card";
import { SettingsPageHeader } from "@/modules/core/workspace-settings/components/settings-hub/settings-page-header";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { SettingsForbidden } from "@/modules/core/workspace-settings/components/settings-hub/settings-forbidden";

export default async function PlanAndUsageSettingsPage() {
  const current = await getCurrentPortalUser();
  if (current.role !== "owner" && current.role !== "admin") {
    return <SettingsForbidden leafLabel="Plan & usage" />;
  }

  return (
    <div>
      <SettingsPageHeader
        title="Plan & usage"
        description="Current plan, usage limits, invoices, and payment method."
      />
      <ComingSoonCard description="Self-service plan management ships once we've wired the Stripe customer portal into the hub. Until then, contact support to change plans." />
    </div>
  );
}
