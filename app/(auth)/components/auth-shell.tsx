import Link from "next/link";
import { Building2, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

type AuthSplitShellProps = {
  side: React.ReactNode;
  children: React.ReactNode;
  topLabel: string;
  topHref: string;
  topAction: string;
};

export function AuthSplitShell({
  side,
  children,
  topLabel,
  topHref,
  topAction,
}: AuthSplitShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_34%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_42%,_#ffffff_100%)] px-4 py-6 md:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col rounded-[32px] border border-white/70 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur md:min-h-[calc(100vh-4rem)]">
        <header className="flex items-center justify-between gap-4 px-6 py-5 md:px-8">
          <AuthBrand />
          <div className="text-sm text-slate-500">
            {topLabel}{" "}
            <Link
              href={topHref}
              className="font-semibold text-blue-600 transition hover:text-blue-700"
            >
              {topAction}
            </Link>
          </div>
        </header>
        <div className="grid flex-1 gap-8 px-6 pb-6 md:px-8 md:pb-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch lg:gap-12">
          <aside className="hidden rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.94),_rgba(239,246,255,0.96))] p-8 lg:flex lg:min-h-[720px] lg:flex-col">
            {side}
          </aside>
          <main className="flex min-h-[640px] items-center justify-center py-4 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export function AuthBrand() {
  return (
    <div className="flex items-center gap-2 text-slate-900">
      <div className="flex size-8 items-center justify-center rounded-full bg-blue-600/10 text-blue-600">
        <Building2 className="size-4" />
      </div>
      <span className="text-lg font-semibold tracking-tight">PrimeERP</span>
    </div>
  );
}

type MarketingFeature = {
  title: string;
  description: string;
};

type AuthMarketingPanelProps = {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  features: MarketingFeature[];
  footerLabel?: string;
};

export function AuthMarketingPanel({
  eyebrow,
  title,
  description,
  features,
  footerLabel = "Built for modern finance, sales, and warehouse teams.",
}: AuthMarketingPanelProps) {
  return (
    <>
      <div className="space-y-6">
        <div className="inline-flex w-fit items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 ring-1 ring-blue-100">
          {eyebrow}
        </div>
        <div className="max-w-xl space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
            {title}
          </h1>
          <p className="max-w-lg text-base leading-7 text-slate-600">
            {description}
          </p>
        </div>
        <div className="grid gap-3 pt-2">
          {features.map(feature => (
            <div
              key={feature.title}
              className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/80 px-4 py-4 shadow-sm"
            >
              <div className="mt-0.5 flex size-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <ShieldCheck className="size-4" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-slate-900">{feature.title}</p>
                <p className="text-sm leading-6 text-slate-600">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-auto space-y-5 pt-10">
        <div className="relative overflow-hidden rounded-[28px] border border-blue-100 bg-white px-6 py-6 shadow-[0_18px_40px_rgba(59,130,246,0.12)]">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-24 rounded-full bg-blue-100/60 blur-3xl" />
          <div className="relative space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Overview</p>
                <p className="text-2xl font-semibold text-slate-950">$128,590</p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                <Sparkles className="size-3.5" />
                +12.5%
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Orders", value: "1,248" },
                { label: "Invoices", value: "532" },
                { label: "Customers", value: "218" },
              ].map(stat => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-slate-100 bg-slate-50/90 p-3"
                >
                  <p className="text-xs text-slate-500">{stat.label}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/90 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Recent activity</span>
                <span className="font-medium text-slate-800">Live</span>
              </div>
              {[
                "Invoice generated",
                "Payment recorded",
                "Order fulfilled",
              ].map(item => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm text-slate-600"
                >
                  <span>{item}</span>
                  <CheckCircle2 className="size-4 text-emerald-500" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-500">{footerLabel}</p>
      </div>
    </>
  );
}

type AuthStep = {
  id: string;
  title: string;
  description: string;
};

type AuthStepperPanelProps = {
  currentStep: number;
  steps: AuthStep[];
};

export function AuthStepperPanel({
  currentStep,
  steps,
}: AuthStepperPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-500">Create your account</p>
        <ul className="space-y-4">
          {steps.map((step, index) => {
            const state =
              index < currentStep
                ? "complete"
                : index === currentStep
                  ? "current"
                  : "upcoming";

            return (
              <li key={step.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border text-sm font-semibold",
                      state === "complete" &&
                        "border-emerald-200 bg-emerald-50 text-emerald-600",
                      state === "current" &&
                        "border-blue-600 bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)]",
                      state === "upcoming" &&
                        "border-slate-200 bg-white text-slate-400",
                    )}
                  >
                    {state === "complete" ? <CheckCircle2 className="size-4" /> : index + 1}
                  </div>
                  {index < steps.length - 1 ? (
                    <div className="mt-2 h-10 w-px bg-slate-200" />
                  ) : null}
                </div>
                <div className="space-y-1 pt-0.5">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      state === "current" && "text-blue-700",
                      state === "complete" && "text-slate-900",
                      state === "upcoming" && "text-slate-400",
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="max-w-xs text-sm leading-6 text-slate-500">
                    {step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mt-auto rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Your data is secure</p>
        <p className="mt-1 leading-6">
          We use tenant-isolated access control and encrypted sessions to keep
          your ERP data protected.
        </p>
      </div>
    </div>
  );
}
