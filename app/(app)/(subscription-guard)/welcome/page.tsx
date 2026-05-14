import { WelcomePage } from "@/modules/distribution/onboarding/components/welcome-page";
import { getOnboardingStatus } from "@/modules/distribution/onboarding/actions";
import { redirect } from "next/navigation";

export default async function WelcomeRoutePage() {
  const status = await getOnboardingStatus();

  // Skip welcome if onboarding already done
  if (status.onboardingCompleted) {
    redirect("/inbox");
  }

  return <WelcomePage defaultName="" />;
}
