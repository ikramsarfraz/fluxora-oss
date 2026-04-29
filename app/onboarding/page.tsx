import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getAccessibleDestinationsForAuthUser } from "@/services/auth";
import { getCurrentRequestTenant } from "@/services/tenants";

import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const requestTenant = await getCurrentRequestTenant();

  if (!requestTenant.isRootHost) {
    redirect("/");
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/onboarding");
  }

  const destinations = await getAccessibleDestinationsForAuthUser(session.user.id);
  if (destinations.length === 1) {
    redirect(destinations[0].targetUrl);
  }
  if (destinations.length > 1) {
    redirect("/select-destination");
  }

  return (
    <OnboardingForm
      defaultName={session.user.name}
      defaultEmail={session.user.email}
      protocol={requestTenant.protocol}
      rootDomain={requestTenant.rootDomain}
      port={requestTenant.port}
    />
  );
}
