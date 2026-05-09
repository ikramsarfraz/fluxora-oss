import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/lib/auth";
import { getInviteCanonicalRedirectUrl } from "@/modules/core/workspace-settings/services/invitations";

import { InviteUserForm } from "../components/invite-user-form";

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const h = await headers();
  const canonical = await getInviteCanonicalRedirectUrl(token, h);
  if (canonical) {
    redirect(canonical);
  }

  const session = await auth.api.getSession({ headers: h });
  const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? null;

  return (
    <div className="main flex min-h-screen flex-col items-center justify-center">
      <Suspense>
        <InviteUserForm sessionEmail={sessionEmail} />
      </Suspense>
    </div>
  );
}
