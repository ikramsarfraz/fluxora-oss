import { ComingSoonCard } from "@/modules/core/workspace-settings/components/settings-hub/coming-soon-card";
import { SettingsPageHeader } from "@/modules/core/workspace-settings/components/settings-hub/settings-page-header";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { SettingsForbidden } from "@/modules/core/workspace-settings/components/settings-hub/settings-forbidden";

export default async function ApiKeysSettingsPage() {
  const current = await getCurrentPortalUser();
  if (current.role !== "owner" && current.role !== "admin") {
    return <SettingsForbidden leafLabel="API keys" />;
  }

  return (
    <div>
      <SettingsPageHeader
        title="API keys"
        description="Personal and service tokens for programmatic access to this workspace."
      />
      <ComingSoonCard description="API key management ships once we've nailed scoping. Reach out if you need a key in the meantime." />
    </div>
  );
}
