import { headers } from "next/headers";

import { auth } from "@/lib/auth";

import { PlatformInviteForm } from "./platform-invite-form";

export default async function PlatformInviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
      <PlatformInviteForm token={token} sessionEmail={sessionEmail} />
    </main>
  );
}
