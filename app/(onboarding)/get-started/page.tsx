import { WelcomePage } from "@/modules/distribution/onboarding/components/welcome-page";
import { getOnboardingStatus } from "@/modules/distribution/onboarding/actions";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { redirect } from "next/navigation";

export default async function GetStartedRoutePage() {
  const [status, currentUser] = await Promise.all([
    getOnboardingStatus(),
    getCurrentPortalUser(),
  ]);

  if (status.onboardingCompleted) {
    redirect("/inbox");
  }

  // Only the workspace owner sees this form — it overwrites
  // tenant.name + businessCategory. Non-owners reaching this URL
  // directly are bounced into the app; the subscription-guard layout
  // uses the same role check so it won't loop them back here.
  if (currentUser.role !== "owner") {
    redirect("/inbox");
  }

  return <WelcomePage defaultName="" />;
}
