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

export default function MarketingPage() {
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
