import { ComingSoonCard } from "@/modules/core/workspace-settings/components/settings-hub/coming-soon-card";
import { SettingsPageHeader } from "@/modules/core/workspace-settings/components/settings-hub/settings-page-header";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { SettingsForbidden } from "@/modules/core/workspace-settings/components/settings-hub/settings-forbidden";

export default async function WebhooksSettingsPage() {
  const current = await getCurrentPortalUser();
  if (current.role !== "owner" && current.role !== "admin") {
    return <SettingsForbidden leafLabel="Webhooks" />;
  }

  return (
    <div>
      <SettingsPageHeader
        title="Webhooks"
        description="Outbound HTTP callbacks for invoice lifecycle, payment events, and inventory changes."
      />
      <ComingSoonCard description="Webhooks ship after the events catalog stabilizes. Email us if you need a specific event right now." />
    </div>
  );
}
