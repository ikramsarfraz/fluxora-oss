import { PageHeader } from "@/components/page-header";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";

import { SupportForm } from "../support-form";

export default async function NewSupportTicketPage() {
  const [currentUser, tenant] = await Promise.all([
    getCurrentPortalUser(),
    getCurrentTenant(),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="New support ticket"
        description="Report an issue, ask a question, or share workflow feedback with the platform team."
      />
      <SupportForm
        defaults={{
          name: currentUser.fullName,
          email: currentUser.email,
          tenantName: tenant.name,
        }}
      />
    </section>
  );
}
