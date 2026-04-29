import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { eq } from "drizzle-orm";

import { user as authUser } from "@/db/auth-schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { formatAuthUserDisplayName } from "@/lib/user-display-name";
import {
  buildRootAppUrl,
  getRequestTenantHostContextFromHeaders,
} from "@/lib/tenant-host";
import { loadAuthenticatedDestinationSelectView } from "@/services/auth";
import { getCurrentRequestTenant } from "@/services/tenants";

import { OnboardingForm } from "./onboarding-form";

function sameRootAppPath(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    const pa = ua.pathname.replace(/\/$/, "") || "/";
    const pb = ub.pathname.replace(/\/$/, "") || "/";
    return ua.origin === ub.origin && pa === pb;
  } catch {
    return false;
  }
}

export default async function OnboardingPage() {
  const requestTenant = await getCurrentRequestTenant();

  if (!requestTenant.isRootHost) {
    redirect("/");
  }

  const headerList = await headers();
  const session = await auth.api.getSession({
    headers: headerList,
  });

  if (!session?.user?.id || !session.session?.id) {
    redirect("/login?callbackUrl=/onboarding");
  }

  const requestContext = getRequestTenantHostContextFromHeaders(headerList);

  const selection = await loadAuthenticatedDestinationSelectView({
    authUserId: session.user.id,
    sessionId: session.session.id,
    returnTo: null,
  });

  if (selection.view === "choose") {
    redirect("/select-destination");
  }

  const onboardingUrl = buildRootAppUrl({
    pathname: "/onboarding",
    context: requestContext,
  });

  if (
    selection.view === "redirect" &&
    !sameRootAppPath(selection.url, onboardingUrl)
  ) {
    redirect(selection.url);
  }

  const [identity] = await db
    .select({
      fullName: authUser.fullName,
      firstName: authUser.firstName,
      lastName: authUser.lastName,
      name: authUser.name,
      email: authUser.email,
    })
    .from(authUser)
    .where(eq(authUser.id, session.user.id))
    .limit(1);

  const defaultDisplayName = identity
    ? formatAuthUserDisplayName(identity)
    : formatAuthUserDisplayName({
        name: session.user.name,
        email: session.user.email ?? undefined,
      });

  return (
    <OnboardingForm
      defaultName={defaultDisplayName}
      defaultEmail={session.user.email ?? ""}
      protocol={requestTenant.protocol}
      hostname={requestTenant.hostname}
      rootDomain={requestTenant.rootDomain}
      port={requestTenant.port}
    />
  );
}
