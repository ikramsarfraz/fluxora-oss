import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccountPortalProfile } from "@/app/(app)/account/account-portal-profile";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { getUserByAuthUserId } from "@/services/portal-users";

export default async function AccountPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const portalUser = await getUserByAuthUserId(session.user.id);

  if (!portalUser) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-muted-foreground text-sm">
          No portal profile is linked to this sign-in yet. Ask an administrator
          to invite you or complete onboarding.
        </p>
        <Button variant="outline" className="w-fit" asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return <AccountPortalProfile user={portalUser} />;
}
