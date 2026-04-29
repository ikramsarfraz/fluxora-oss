import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
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

  return (
    <OnboardingForm
      defaultName={session.user.name ?? ""}
      defaultEmail={session.user.email ?? ""}
      protocol={requestTenant.protocol}
      hostname={requestTenant.hostname}
      rootDomain={requestTenant.rootDomain}
      port={requestTenant.port}
    />
  );
}
