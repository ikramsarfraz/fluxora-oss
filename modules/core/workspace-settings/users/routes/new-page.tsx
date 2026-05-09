import { InviteUserForm } from "@/modules/core/workspace-settings/users/components/invite-user-form";
import { DetailPageHeader } from "@/components/detail-page-header";
import { requireAdminPortalUser } from "@/modules/core/shared/services/portal-users";

export default async function WorkspaceUsersNewPage() {
  await requireAdminPortalUser();

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title="Invite User"
        description="We will email them a link to set their password and activate their account."
      />
      <InviteUserForm />
    </div>
  );
}
