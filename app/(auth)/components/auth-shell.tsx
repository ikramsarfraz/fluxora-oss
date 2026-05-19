"use client";

import Link from "next/link";
import { CheckCircle, Shield, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildPublicSupportMailto } from "@/lib/public-contact";
import { Logomark } from "@/components/brand/logomark";

// ── Brand ────────────────────────────────────────────────────────────────────

export function AuthBrand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 font-serif text-base font-medium tracking-[-0.01em] text-ink transition-opacity hover:opacity-80"
    >
      <Logomark size={28} />
      Fluxora
    </Link>
  );
}

// ── Marketing Panel ──────────────────────────────────────────────────────────

function MarketingPanel() {
  return (
    <div className="relative flex h-full flex-col justify-between bg-surface p-10 lg:p-12">
      <div className="relative z-10">
        <AuthBrand />
      </div>

      {/* Center content */}
      <div className="relative z-10 space-y-6">
        <h2 className="font-serif text-[28px] font-medium tracking-[-0.02em] leading-tight text-ink lg:text-[32px]">
          Distribution, simplified.
        </h2>
        <p className="max-w-xs text-sm leading-relaxed text-subtle">
          One platform for orders, inventory, invoicing, and payments.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2">
          {["Orders", "Inventory", "Invoicing", "Payments"].map((f) => (
            <span
              key={f}
              className="rounded-full bg-forest-tint px-3 py-1 text-xs font-medium text-forest"
            >
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom quote */}
      <div className="relative z-10">
        <blockquote className="border-l-2 border-forest-bright pl-4 font-serif text-sm italic text-ink-warm">
          &ldquo;Cut our order processing time in half.&rdquo;
        </blockquote>
        <p className="mt-2 pl-4 text-xs text-subtle">
          Metro Foods Distribution
        </p>
      </div>
    </div>
  );
}

// ── Stepper Panel (Light version for sign-up wizard) ─────────────────────────

type AuthStep = { id: string; title: string; description: string };

type AuthStepperPanelProps = {
  currentStep: number;
  steps: AuthStep[];
};

export function AuthStepperPanel({ currentStep, steps }: AuthStepperPanelProps) {
  return (
    <div className="relative flex h-full flex-col justify-between bg-surface p-10 lg:p-12">
      <div className="relative z-10">
        <AuthBrand />

        <div className="mt-12">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-subtle">
            Create workspace
          </p>
          <h1 className="mt-2 font-serif text-[24px] font-medium tracking-[-0.02em] leading-tight text-ink lg:text-[28px]">
            Get started with Fluxora
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
                  "flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors",
                  state === "active" && "bg-card"
                )}
              >
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                    state === "done" && "bg-forest text-card-warm",
                    state === "active" && "bg-forest text-card-warm",
                    state === "upcoming" && "border border-border-default bg-card text-muted"
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
                    state === "active"
                      ? "font-medium text-ink"
                      : state === "done"
                        ? "text-ink-warm"
                        : "text-subtle"
                  )}
                >
                  {step.title}
                </span>
                {state === "active" && (
                  <ArrowRight className="ml-auto size-3.5 text-subtle" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom badges */}
      <div className="relative z-10 flex items-center gap-6 text-xs text-subtle">
        <div className="flex items-center gap-1.5">
          <Shield className="size-3.5 text-forest" />
          <span>Secure</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle className="size-3.5 text-forest" />
          <span>No credit card</span>
        </div>
      </div>
    </div>
  );
}

// ── Split Shell (Form + Marketing panel) ─────────────────────────────────────

type AuthSplitShellProps = {
  side?: React.ReactNode;
  children: React.ReactNode;
  topLabel?: string;
  topHref?: string;
  topAction?: string;
  formPosition?: "left" | "right";
};

export function AuthSplitShell({
  side,
  children,
  topLabel,
  topHref,
  topAction,
  formPosition = "left",
}: AuthSplitShellProps) {
  const marketingPanel = side || <MarketingPanel />;

  const formPanel = (
    <div className="relative flex flex-1 flex-col bg-page">
      {/* Top nav */}
      <nav className="relative z-10 flex h-14 shrink-0 items-center justify-between px-6 lg:px-10">
        <div className="lg:hidden">
          <AuthBrand />
        </div>
        <div className="hidden lg:block" />
        {topLabel && topHref && topAction && (
          <div className="text-sm text-subtle">
            {topLabel}{" "}
            <Link
              href={topHref}
              className="font-medium text-forest transition-opacity hover:opacity-70"
            >
              {topAction}
            </Link>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-8 lg:px-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 shrink-0 px-6 py-4 lg:px-10">
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-subtle sm:gap-6">
          <Link href="/changelog" className="transition-colors hover:text-ink-warm">
            Changelog
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-ink-warm">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-ink-warm">
            Terms
          </Link>
          <a href={buildPublicSupportMailto("Fluxora support request")} className="transition-colors hover:text-ink-warm">
            Help
          </a>
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
    <div className="relative flex min-h-screen flex-col bg-page">
      <nav className="relative z-10 flex h-14 shrink-0 items-center justify-between px-6 lg:px-10">
        <AuthBrand />
        {topLabel && topHref && topAction && (
          <div className="text-sm text-subtle">
            {topLabel}{" "}
            <Link
              href={topHref}
              className="font-medium text-forest transition-opacity hover:opacity-70"
            >
              {topAction}
            </Link>
          </div>
        )}
      </nav>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="relative z-10 shrink-0 px-6 py-4">
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-subtle sm:gap-6">
          <Link href="/changelog" className="transition-colors hover:text-ink-warm">
            Changelog
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-ink-warm">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-ink-warm">
            Terms
          </Link>
          <a href={buildPublicSupportMailto("Fluxora support request")} className="transition-colors hover:text-ink-warm">
            Help
          </a>
        </div>
      </footer>
    </div>
  );
}
