import { InviteUserForm } from "../components/invite-user-form";
import { DetailPageHeader } from "@/components/detail-page-header";

export default function NewUserPage() {
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
