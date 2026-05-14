import { RolesPermissionsCard } from "@/modules/core/workspace-settings/components/tenant-admin/roles-permissions-card";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { SettingsPageHeader } from "@/modules/core/workspace-settings/components/settings-hub/settings-page-header";
import { SettingsForbidden } from "@/modules/core/workspace-settings/components/settings-hub/settings-forbidden";

export default async function RolesSettingsPage() {
  const current = await getCurrentPortalUser();
  if (current.role !== "owner" && current.role !== "admin") {
    return <SettingsForbidden leafLabel="Roles & Permissions" />;
  }

  return (
    <div>
      <SettingsPageHeader
        title="Roles & Permissions"
        description="What each role can do. Highlighted row is your current role."
      />
      <RolesPermissionsCard highlightRole={current.role} />
    </div>
  );
}
