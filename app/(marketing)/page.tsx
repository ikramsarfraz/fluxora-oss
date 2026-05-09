import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { Navbar } from "./components/navbar";
import { Hero } from "./components/hero";
import { LogoStrip } from "./components/logo-strip";
import { Stats } from "./components/stats";
import { Features } from "./components/features";
import { HowItWorks } from "./components/how-it-works";
import { Testimonials } from "./components/testimonials";
import { Pricing } from "./components/pricing";
import { CTA } from "./components/cta";
import { Footer } from "./components/footer";
import { loadAuthenticatedDestinationSelectView } from "@/modules/shared/services/auth";
import { getCurrentRequestTenant } from "@/modules/core/tenants/services/tenants";

export default async function MarketingPage() {
  const requestTenant = await getCurrentRequestTenant();

  if (requestTenant.isRootHost) {
    const headerList = await headers();
    const session = await auth.api.getSession({ headers: headerList });

    if (session?.user?.id && session.session?.id) {
      const selection = await loadAuthenticatedDestinationSelectView({
        authUserId: session.user.id,
        sessionId: session.session.id,
        returnTo: null,
      });

      if (selection.view === "redirect") {
        redirect(selection.url);
      }
      if (selection.view === "choose") {
        redirect("/select-destination");
      }
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[oklch(0.15_0.01_230)] antialiased">
      <Navbar />
      <Hero />
      <LogoStrip />
      <Stats />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}
