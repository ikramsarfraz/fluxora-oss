import { Suspense } from "react";
import { InviteUserForm } from "../components/invite-user-form";

export default function InviteAcceptPage() {
  return (
    <div className="main min-h-screen flex flex-col items-center justify-center">
      <Suspense>
        <InviteUserForm />
      </Suspense>
    </div>
  );
}
