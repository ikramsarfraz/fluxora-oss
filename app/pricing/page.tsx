import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildPublicSupportMailto } from "@/lib/public-contact";

const plans = [
  {
    name: "Starter",
    description: "For small teams beginning to run orders and inventory in one workspace.",
    features: ["3 portal users", "250 products and customers", "100 monthly orders"],
  },
  {
    name: "Growth",
    description: "For teams adding purchasing workflows, reporting, and higher volume.",
    features: ["10 portal users", "5,000 products and customers", "1,000 monthly orders"],
  },
  {
    name: "Enterprise",
    description: "For larger organizations that need unlimited core limits and platform support.",
    features: ["Unlimited core limits", "Purchasing and reporting", "Platform support"],
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-600">Fluxora pricing</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
              Plans for distribution teams
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Choose a plan in the app when you are ready to activate billing.
              Current prices are shown through Stripe Checkout.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="size-4" />
              Back home
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.name} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-blue-600">{plan.name}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {plan.description}
              </p>
              <div className="mt-6 space-y-3">
                {plan.features.map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-slate-700">
                    <Check className="size-4 text-emerald-600" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-11">
            <Link href="/signup">Create your tenant</Link>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <a href={buildPublicSupportMailto("Fluxora pricing question")}>Contact sales</a>
          </Button>
        </div>
      </div>
    </main>
  );
}
