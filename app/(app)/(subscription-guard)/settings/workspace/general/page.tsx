import { TenantBrandingCard } from "@/modules/core/workspace-settings/components/tenant-admin/tenant-branding-card";
import { SettingsPageHeader } from "@/modules/core/workspace-settings/components/settings-hub/settings-page-header";

export default function GeneralSettingsPage() {
  return (
    <div>
      <SettingsPageHeader
        title="General"
        description="Workspace identity. Your logo appears in the sidebar and on customer-facing documents."
      />
      <TenantBrandingCard />
    </div>
  );
}
