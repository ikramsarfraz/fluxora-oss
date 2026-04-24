import { PageHeader } from "@/components/page-header";
import { RolesPermissionsCard } from "@/components/tenant-admin/roles-permissions-card";
import { requireAdminPortalUser } from "@/services/portal-users";

export default async function TenantRolesPage() {
  const currentUser = await requireAdminPortalUser();

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Roles & Permissions"
        description="Reference descriptions and the fixed permission matrix for your tenant team roles."
      />
      <RolesPermissionsCard highlightRole={currentUser.role} />
    </section>
  );
}
