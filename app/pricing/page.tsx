import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-600">Pricing</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
              Simple v1 pricing placeholder
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              This marketing route is intentionally lightweight. It keeps the root
              domain public while tenant subdomains stay focused on the ERP app.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="size-4" />
              Back home
            </Link>
          </Button>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Starter tenant</p>
          <p className="mt-2 text-4xl font-semibold text-slate-950">$0</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use this page as the public pricing placeholder until you introduce
            packaged plans or sales-led onboarding.
          </p>
          <div className="mt-6 space-y-3">
            {[
              "Root-domain marketing remains public",
              "Tenant sign-in and ERP routes stay isolated",
              "Central login and first-time signup stay available",
            ].map(item => (
              <div key={item} className="flex items-center gap-3 text-sm text-slate-700">
                <Check className="size-4 text-emerald-600" />
                {item}
              </div>
            ))}
          </div>
          <Button asChild className="mt-8 h-11">
            <Link href="/signup">Create your tenant</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
