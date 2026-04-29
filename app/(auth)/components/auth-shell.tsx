"use client";

import Link from "next/link";
import {
  Building2,
  CheckCircle,
  Shield,
  Zap,
  BarChart3,
  Users,
  Package,
  Receipt,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";

// ── Brand ────────────────────────────────────────────────────────────────────

export function AuthBrand({ variant = "dark" }: { variant?: "dark" | "light" }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2.5 text-base font-bold tracking-tight transition-opacity hover:opacity-80",
        variant === "light" ? "text-white" : "text-foreground"
      )}
    >
      <div
        className={cn(
          "flex size-8 items-center justify-center rounded-lg text-xs font-extrabold",
          variant === "light"
            ? "bg-white/20 text-white"
            : "bg-primary text-primary-foreground"
        )}
      >
        PE
      </div>
      PrimeERP
    </Link>
  );
}

// ── Marketing Feature Item ───────────────────────────────────────────────────

type MarketingFeature = {
  icon: React.ReactNode;
  title: string;
  description: string;
};

function FeatureItem({ icon, title, description }: MarketingFeature) {
  return (
    <div className="flex gap-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-sm leading-relaxed text-white/70">{description}</p>
      </div>
    </div>
  );
}

// ── Marketing Panel (Left Side) ──────────────────────────────────────────────

type AuthMarketingPanelProps = {
  eyebrow?: string;
  title: React.ReactNode;
  description: string;
  features: Array<{ icon?: React.ReactNode; title: string; description: string }>;
  footerLabel?: string;
  testimonial?: {
    quote: string;
    author: string;
    role: string;
    company: string;
  };
};

export function AuthMarketingPanel({
  eyebrow,
  title,
  description,
  features,
  footerLabel,
  testimonial,
}: AuthMarketingPanelProps) {
  const defaultFeatures: MarketingFeature[] = [
    {
      icon: <Package className="size-5" />,
      title: "Complete Inventory Control",
      description: "Track products, lots, and stock levels across multiple warehouses in real-time.",
    },
    {
      icon: <Receipt className="size-5" />,
      title: "Streamlined Order Processing",
      description: "From sales orders to invoicing - manage your entire sales workflow in one place.",
    },
    {
      icon: <BarChart3 className="size-5" />,
      title: "Financial Visibility",
      description: "Monitor payments, expenses, and supplier invoices with detailed reporting.",
    },
    {
      icon: <Users className="size-5" />,
      title: "Team Collaboration",
      description: "Role-based permissions ensure everyone has the right access to do their job.",
    },
  ];

  const displayFeatures = features.length > 0
    ? features.map((f, i) => ({
        icon: f.icon || defaultFeatures[i % defaultFeatures.length].icon,
        title: f.title,
        description: f.description,
      }))
    : defaultFeatures;

  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 lg:p-12">
      {/* Decorative elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 -top-20 size-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 size-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10">
        <AuthBrand variant="light" />

        <div className="mt-12 space-y-4">
          {eyebrow && (
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/80">
              <Zap className="size-3" />
              {eyebrow}
            </div>
          )}
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white lg:text-4xl">
            {title}
          </h1>
          <p className="max-w-md text-base leading-relaxed text-white/70">
            {description}
          </p>
        </div>

        <div className="mt-10 space-y-6">
          {displayFeatures.slice(0, 4).map((feature, i) => (
            <FeatureItem key={i} {...feature} />
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-10 space-y-6">
        {testimonial && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <p className="text-sm italic leading-relaxed text-white/80">
              &ldquo;{testimonial.quote}&rdquo;
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
                {testimonial.author.split(" ").map(n => n[0]).join("")}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{testimonial.author}</p>
                <p className="text-xs text-white/60">
                  {testimonial.role}, {testimonial.company}
                </p>
              </div>
            </div>
          </div>
        )}

        {footerLabel && (
          <p className="text-xs text-white/50">{footerLabel}</p>
        )}

        {/* Trust badges */}
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <Shield className="size-3.5" />
            <span>SOC 2 Compliant</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <CheckCircle className="size-3.5" />
            <span>99.9% Uptime</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <TrendingUp className="size-3.5" />
            <span>500+ Teams</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Split Shell (dub.co style) ───────────────────────────────────────────────

type AuthSplitShellProps = {
  side?: React.ReactNode;
  children: React.ReactNode;
  topLabel?: string;
  topHref?: string;
  topAction?: string;
};

export function AuthSplitShell({
  side,
  children,
  topLabel,
  topHref,
  topAction,
}: AuthSplitShellProps) {
  // Default marketing panel if none provided
  const defaultSide = (
    <AuthMarketingPanel
      eyebrow="All-in-one ERP platform"
      title={
        <>
          Run your business.
          <br />
          <span className="text-primary">All in one place.</span>
        </>
      }
      description="PrimeERP helps distribution and wholesale teams manage inventory, sales, purchasing, and finances from a single tenant-isolated platform."
      features={[]}
      testimonial={{
        quote: "PrimeERP transformed how we manage our distribution business. What used to take hours now takes minutes.",
        author: "Sarah Chen",
        role: "Operations Director",
        company: "Metro Foods Inc.",
      }}
      footerLabel="Trusted by modern distribution, wholesale, and operations teams."
    />
  );

  return (
    <div className="flex min-h-screen">
      {/* Left: Marketing Panel */}
      <div className="hidden w-[45%] min-w-[400px] max-w-[560px] lg:block">
        {side || defaultSide}
      </div>

      {/* Right: Form Side */}
      <div className="flex flex-1 flex-col bg-background">
        {/* Top nav */}
        <nav className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6 lg:px-10">
          <div className="lg:hidden">
            <AuthBrand variant="dark" />
          </div>
          <div className="hidden lg:block" />
          {topLabel && topHref && topAction && (
            <div className="text-sm text-muted-foreground">
              {topLabel}{" "}
              <Link
                href={topHref}
                className="font-medium text-foreground underline underline-offset-2 transition-opacity hover:opacity-70"
              >
                {topAction}
              </Link>
            </div>
          )}
        </nav>

        {/* Main content */}
        <main className="flex flex-1 items-center justify-center px-6 py-10 lg:px-10">
          <div className="w-full max-w-md">{children}</div>
        </main>

        {/* Footer */}
        <footer className="shrink-0 border-t border-border px-6 py-4 lg:px-10">
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="transition-colors hover:text-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="transition-colors hover:text-foreground">
                Terms
              </Link>
              <Link href="/support" className="transition-colors hover:text-foreground">
                Support
              </Link>
            </div>
            <p>&copy; {new Date().getFullYear()} PrimeERP. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ── Centered Shell (for forgot/reset/invite-success) ─────────────────────────

export function AuthCenteredShell({
  topLabel,
  topHref,
  topAction,
  children,
}: {
  topLabel?: string;
  topHref?: string;
  topAction?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <nav className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6 lg:px-10">
        <AuthBrand variant="dark" />
        {topLabel && topHref && topAction ? (
          <div className="text-sm text-muted-foreground">
            {topLabel}{" "}
            <Link
              href={topHref}
              className="font-medium text-foreground underline underline-offset-2 transition-opacity hover:opacity-70"
            >
              {topAction}
            </Link>
          </div>
        ) : null}
      </nav>

      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="shrink-0 border-t border-border px-6 py-4">
        <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
            <Link href="/support" className="transition-colors hover:text-foreground">
              Support
            </Link>
          </div>
          <p>&copy; {new Date().getFullYear()} PrimeERP. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// ── Stepper Panel (for multi-step signup) ────────────────────────────────────

type AuthStep = { id: string; title: string; description: string };

type AuthStepperPanelProps = {
  currentStep: number;
  steps: AuthStep[];
};

export function AuthStepperPanel({ currentStep, steps }: AuthStepperPanelProps) {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 lg:p-12">
      {/* Decorative elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 -top-20 size-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 size-80 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative z-10">
        <AuthBrand variant="light" />

        <div className="mt-12 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/80">
            <Building2 className="size-3" />
            Create your workspace
          </div>
          <h1 className="text-2xl font-bold text-white lg:text-3xl">
            Get started with PrimeERP
          </h1>
          <p className="text-sm leading-relaxed text-white/70">
            Set up your tenant workspace in just a few steps.
          </p>
        </div>

        {/* Steps */}
        <div className="mt-10 space-y-1">
          {steps.map((step, i) => {
            const state =
              i < currentStep ? "done" : i === currentStep ? "active" : "upcoming";
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-4 rounded-lg p-3 transition-colors",
                  state === "active" && "bg-white/5"
                )}
              >
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                    state === "done" && "bg-emerald-500/20 text-emerald-400",
                    state === "active" && "bg-primary text-primary-foreground",
                    state === "upcoming" && "bg-white/10 text-white/40"
                  )}
                >
                  {state === "done" ? (
                    <CheckCircle className="size-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                <div className="flex-1 pt-0.5">
                  <p
                    className={cn(
                      "text-sm font-medium transition-colors",
                      state === "active" ? "text-white" : "text-white/60"
                    )}
                  >
                    {step.title}
                  </p>
                  {state === "active" && (
                    <p className="mt-1 text-xs leading-relaxed text-white/50">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 space-y-4">
        {/* Trust badges */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <Shield className="size-3.5" />
            <span>Secure by default</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <CheckCircle className="size-3.5" />
            <span>No credit card required</span>
          </div>
        </div>
      </div>
    </div>
  );
}
