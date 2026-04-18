import { InviteUserForm } from "../components/invite-user-form";
import { DetailPageHeader } from "@/components/detail-page-header";

export default function NewUserPage() {
  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        backHref="/users"
        backLabel="Users"
        title="Invite User"
        description="Send an invitation to add a new team member."
      />
      <InviteUserForm />
    </div>
  );
}
