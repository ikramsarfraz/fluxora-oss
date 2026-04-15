import { InviteUserForm } from "../components/invite-user-form";

export default function NewUserPage() {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="add-user-heading">
        <InviteUserForm />
      </section>
    </div>
  );
}
