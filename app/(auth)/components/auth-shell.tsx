"use client";

import Link from "next/link";
import {
  Building2,
  CheckCircle,
  Shield,
  ArrowRight,
} from "lucide-react";

import { cn } from "@/lib/utils";

// ── Brand ────────────────────────────────────────────────────────────────────

export function AuthBrand({ variant = "dark" }: { variant?: "dark" | "light" }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2 text-base font-bold tracking-tight transition-opacity hover:opacity-80",
        variant === "light" ? "text-white" : "text-[oklch(0.20_0.03_230)]"
      )}
    >
      <div
        className={cn(
          "flex size-7 items-center justify-center rounded-md text-[0.65rem] font-extrabold",
          variant === "light"
            ? "bg-white/15 text-white"
            : "bg-[oklch(0.35_0.10_230)] text-white"
        )}
      >
        PE
      </div>
      PrimeERP
    </Link>
  );
}

// ── Marketing Panel ──────────────────────────────────────────────────────────

type MarketingPanelProps = {
  headline: string;
  subtext?: string;
  features?: string[];
};

function MarketingPanel({ headline, subtext, features }: MarketingPanelProps) {
  const defaultFeatures = [
    "Inventory tracking across warehouses",
    "Order-to-invoice workflow",
    "Real-time financial visibility",
    "Role-based team access",
  ];

  const displayFeatures = features?.length ? features : defaultFeatures;

  return (
    <div
      className="relative flex h-full flex-col justify-between p-10 lg:p-12"
      style={{
        background: `
          radial-gradient(ellipse 80% 60% at 80% 20%, oklch(0.45 0.12 230 / 0.3) 0%, transparent 50%),
          radial-gradient(ellipse 60% 50% at 20% 80%, oklch(0.50 0.10 195 / 0.2) 0%, transparent 50%),
          linear-gradient(160deg, oklch(0.22 0.03 230) 0%, oklch(0.16 0.02 230) 100%)
        `,
      }}
    >
      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10">
        <AuthBrand variant="light" />

        <div className="mt-16">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-white lg:text-3xl">
            {headline}
          </h1>
          {subtext && (
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">
              {subtext}
            </p>
          )}
        </div>

        <div className="mt-10 space-y-3">
          {displayFeatures.map((feature, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10">
                <CheckCircle className="size-3 text-white/70" />
              </div>
              <span className="text-sm text-white/70">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-6 pt-8 text-xs text-white/40">
        <div className="flex items-center gap-1.5">
          <Shield className="size-3.5" />
          <span>SOC 2</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle className="size-3.5" />
          <span>99.9% Uptime</span>
        </div>
      </div>
    </div>
  );
}

// ── Split Shell (Form LEFT, Marketing RIGHT for sign-in) ────────────────────

type AuthSplitShellProps = {
  side?: React.ReactNode;
  children: React.ReactNode;
  topLabel?: string;
  topHref?: string;
  topAction?: string;
  formPosition?: "left" | "right";
  marketingHeadline?: string;
  marketingSubtext?: string;
  marketingFeatures?: string[];
};

export function AuthSplitShell({
  side,
  children,
  topLabel,
  topHref,
  topAction,
  formPosition = "left",
  marketingHeadline = "Run your business from one workspace.",
  marketingSubtext,
  marketingFeatures,
}: AuthSplitShellProps) {
  const marketingPanel = side || (
    <MarketingPanel
      headline={marketingHeadline}
      subtext={marketingSubtext}
      features={marketingFeatures}
    />
  );

  const formPanel = (
    <div className="flex flex-1 flex-col bg-white">
      {/* Top nav */}
      <nav className="flex h-14 shrink-0 items-center justify-between px-6 lg:px-10">
        <div className="lg:hidden">
          <AuthBrand variant="dark" />
        </div>
        <div className="hidden lg:block" />
        {topLabel && topHref && topAction && (
          <div className="text-sm text-[oklch(0.50_0.02_230)]">
            {topLabel}{" "}
            <Link
              href={topHref}
              className="font-medium text-[oklch(0.25_0.03_230)] underline underline-offset-2 transition-opacity hover:opacity-70"
            >
              {topAction}
            </Link>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main className="flex flex-1 items-center justify-center px-6 py-8 lg:px-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      {/* Footer */}
      <footer className="shrink-0 px-6 py-4 lg:px-10">
        <div className="flex items-center justify-center gap-6 text-xs text-[oklch(0.55_0.02_230)]">
          <Link href="/privacy" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">
            Terms
          </Link>
          <Link href="/support" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">
            Help
          </Link>
        </div>
      </footer>
    </div>
  );

  const sidePanel = (
    <div className="hidden w-[45%] min-w-[360px] max-w-[480px] lg:block">
      {marketingPanel}
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {formPosition === "left" ? (
        <>
          {formPanel}
          {sidePanel}
        </>
      ) : (
        <>
          {sidePanel}
          {formPanel}
        </>
      )}
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
    <div className="flex min-h-screen flex-col bg-white">
      <nav className="flex h-14 shrink-0 items-center justify-between px-6 lg:px-10">
        <AuthBrand variant="dark" />
        {topLabel && topHref && topAction && (
          <div className="text-sm text-[oklch(0.50_0.02_230)]">
            {topLabel}{" "}
            <Link
              href={topHref}
              className="font-medium text-[oklch(0.25_0.03_230)] underline underline-offset-2 transition-opacity hover:opacity-70"
            >
              {topAction}
            </Link>
          </div>
        )}
      </nav>

      <main className="flex flex-1 items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="shrink-0 px-6 py-4">
        <div className="flex items-center justify-center gap-6 text-xs text-[oklch(0.55_0.02_230)]">
          <Link href="/privacy" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">
            Terms
          </Link>
          <Link href="/support" className="transition-colors hover:text-[oklch(0.30_0.03_230)]">
            Help
          </Link>
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
    <div
      className="relative flex h-full flex-col justify-between p-10 lg:p-12"
      style={{
        background: `
          radial-gradient(ellipse 80% 60% at 80% 20%, oklch(0.45 0.12 230 / 0.3) 0%, transparent 50%),
          radial-gradient(ellipse 60% 50% at 20% 80%, oklch(0.50 0.10 195 / 0.2) 0%, transparent 50%),
          linear-gradient(160deg, oklch(0.22 0.03 230) 0%, oklch(0.16 0.02 230) 100%)
        `,
      }}
    >
      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10">
        <AuthBrand variant="light" />

        <div className="mt-12">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">
            Create workspace
          </p>
          <h1 className="mt-2 text-xl font-semibold text-white lg:text-2xl">
            Get started with PrimeERP
          </h1>
        </div>

        {/* Steps */}
        <div className="mt-8 space-y-1">
          {steps.map((step, i) => {
            const state =
              i < currentStep ? "done" : i === currentStep ? "active" : "upcoming";
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                  state === "active" && "bg-white/5"
                )}
              >
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    state === "done" && "bg-[oklch(0.65_0.15_165)] text-white",
                    state === "active" && "bg-white text-[oklch(0.20_0.03_230)]",
                    state === "upcoming" && "bg-white/10 text-white/40"
                  )}
                >
                  {state === "done" ? (
                    <CheckCircle className="size-3.5" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm transition-colors",
                    state === "active" ? "font-medium text-white" : "text-white/50"
                  )}
                >
                  {step.title}
                </span>
                {state === "active" && (
                  <ArrowRight className="ml-auto size-3.5 text-white/40" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-6 text-xs text-white/40">
        <div className="flex items-center gap-1.5">
          <Shield className="size-3.5" />
          <span>Secure</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle className="size-3.5" />
          <span>No credit card</span>
        </div>
      </div>
    </div>
  );
}
