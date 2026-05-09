import { PageHeader } from "@/components/page-header";
import { TenantBrandingCard } from "@/modules/core/workspace-settings/components/tenant-admin/tenant-branding-card";
import { requireAdminPortalUser } from "@/modules/shared/services/portal-users";

export default async function TenantBrandingPage() {
  await requireAdminPortalUser();

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Branding"
        description="Manage the logo shown across your tenant workspace and customer-facing documents."
      />
      <TenantBrandingCard />
    </section>
  );
}
