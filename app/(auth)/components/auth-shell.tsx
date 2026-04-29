"use client";

import Link from "next/link";
import { Package, CheckCircle, Shield, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Marketing color tokens (matching marketing page) ─────────────────────────
// Light backgrounds with soft blue/teal radial gradients
const lightPanelBg = `
  radial-gradient(ellipse 100% 80% at 50% -20%, oklch(0.92 0.04 230 / 0.6) 0%, transparent 60%),
  radial-gradient(ellipse 80% 50% at 100% 0%, oklch(0.90 0.06 195 / 0.4) 0%, transparent 50%),
  radial-gradient(ellipse 60% 40% at 0% 30%, oklch(0.94 0.03 230 / 0.3) 0%, transparent 50%),
  linear-gradient(180deg, oklch(0.985 0.005 230) 0%, white 100%)
`;

const gridPattern = `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg stroke='%23cbd5e1' stroke-width='0.5'%3E%3Cpath d='M0 0h40v40H0z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`;

// Text gradient (navy to teal)
const gradientTextStyle = {
  background: "linear-gradient(135deg, oklch(0.50 0.14 230) 0%, oklch(0.55 0.15 195) 100%)",
  WebkitBackgroundClip: "text" as const,
  WebkitTextFillColor: "transparent" as const,
  backgroundClip: "text" as const,
};

// Primary button background
const primaryBtnBg = "oklch(0.35 0.10 230)";

// ── Brand ────────────────────────────────────────────────────────────────────

export function AuthBrand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 text-base font-bold tracking-tight text-[oklch(0.20_0.03_230)] transition-opacity hover:opacity-80"
    >
      <div
        className="flex size-7 items-center justify-center rounded-lg text-white"
        style={{ background: "linear-gradient(135deg, oklch(0.50 0.14 230), oklch(0.55 0.15 195))" }}
      >
        <Package className="size-3.5" />
      </div>
      Fluxora
    </Link>
  );
}

// ── Marketing Panel (Light, airy - matches marketing hero) ───────────────────

function MarketingPanel() {
  return (
    <div
      className="relative flex h-full flex-col justify-between p-10 lg:p-12"
      style={{ background: lightPanelBg }}
    >
      {/* Grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ backgroundImage: gridPattern }}
      />

      <div className="relative z-10">
        <AuthBrand />
      </div>

      {/* Center content */}
      <div className="relative z-10 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight text-[oklch(0.20_0.03_230)] lg:text-3xl">
          Distribution,{" "}
          <span style={gradientTextStyle}>simplified.</span>
        </h2>
        <p className="max-w-xs text-sm leading-relaxed text-[oklch(0.45_0.02_230)]">
          One platform for orders, inventory, invoicing, and payments.
        </p>
        
        {/* Feature pills */}
        <div className="flex flex-wrap gap-2">
          {["Orders", "Inventory", "Invoicing", "Payments"].map((f) => (
            <span
              key={f}
              className="rounded-full bg-[oklch(0.94_0.03_230)] px-3 py-1 text-xs font-medium text-[oklch(0.45_0.02_230)]"
            >
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom quote */}
      <div className="relative z-10">
        <blockquote className="border-l-2 border-[oklch(0.55_0.15_195)] pl-4 text-sm italic text-[oklch(0.45_0.02_230)]">
          &ldquo;Cut our order processing time in half.&rdquo;
        </blockquote>
        <p className="mt-2 pl-4 text-xs text-[oklch(0.55_0.02_230)]">
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
    <div
      className="relative flex h-full flex-col justify-between p-10 lg:p-12"
      style={{ background: lightPanelBg }}
    >
      {/* Grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ backgroundImage: gridPattern }}
      />

      <div className="relative z-10">
        <AuthBrand />

        <div className="mt-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-[oklch(0.55_0.15_195)]">
            Create workspace
          </p>
          <h1 className="mt-2 text-xl font-bold text-[oklch(0.20_0.03_230)] lg:text-2xl">
            Get started with{" "}
            <span style={gradientTextStyle}>Fluxora</span>
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
                  state === "active" && "bg-white shadow-sm"
                )}
              >
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    state === "done" && "bg-[oklch(0.55_0.15_195)] text-white",
                    state === "active" && "text-white",
                    state === "upcoming" && "border border-[oklch(0.88_0.02_230)] bg-white text-[oklch(0.55_0.02_230)]"
                  )}
                  style={state === "active" ? { background: primaryBtnBg } : undefined}
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
                      ? "font-medium text-[oklch(0.20_0.03_230)]"
                      : state === "done"
                        ? "text-[oklch(0.45_0.02_230)]"
                        : "text-[oklch(0.55_0.02_230)]"
                  )}
                >
                  {step.title}
                </span>
                {state === "active" && (
                  <ArrowRight className="ml-auto size-3.5 text-[oklch(0.55_0.02_230)]" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom badges */}
      <div className="relative z-10 flex items-center gap-6 text-xs text-[oklch(0.55_0.02_230)]">
        <div className="flex items-center gap-1.5">
          <Shield className="size-3.5 text-[oklch(0.55_0.15_195)]" />
          <span>Secure</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle className="size-3.5 text-[oklch(0.55_0.15_195)]" />
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
    <div className="relative flex flex-1 flex-col bg-[oklch(0.99_0.003_230)]">
      {/* Grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{ backgroundImage: gridPattern }}
      />

      {/* Top nav */}
      <nav className="relative z-10 flex h-14 shrink-0 items-center justify-between px-6 lg:px-10">
        <div className="lg:hidden">
          <AuthBrand />
        </div>
        <div className="hidden lg:block" />
        {topLabel && topHref && topAction && (
          <div className="text-sm text-[oklch(0.55_0.02_230)]">
            {topLabel}{" "}
            <Link
              href={topHref}
              className="font-medium text-[oklch(0.55_0.15_195)] transition-opacity hover:opacity-70"
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
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-[oklch(0.55_0.02_230)] sm:gap-6">
          <Link href="/changelog" className="transition-colors hover:text-[oklch(0.35_0.05_230)]">
            Changelog
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-[oklch(0.35_0.05_230)]">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-[oklch(0.35_0.05_230)]">
            Terms
          </Link>
          <Link href="/support" className="transition-colors hover:text-[oklch(0.35_0.05_230)]">
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
    <div className="relative flex min-h-screen flex-col bg-[oklch(0.99_0.003_230)]">
      {/* Grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{ backgroundImage: gridPattern }}
      />

      <nav className="relative z-10 flex h-14 shrink-0 items-center justify-between px-6 lg:px-10">
        <AuthBrand />
        {topLabel && topHref && topAction && (
          <div className="text-sm text-[oklch(0.55_0.02_230)]">
            {topLabel}{" "}
            <Link
              href={topHref}
              className="font-medium text-[oklch(0.55_0.15_195)] transition-opacity hover:opacity-70"
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
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-[oklch(0.55_0.02_230)] sm:gap-6">
          <Link href="/changelog" className="transition-colors hover:text-[oklch(0.35_0.05_230)]">
            Changelog
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-[oklch(0.35_0.05_230)]">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-[oklch(0.35_0.05_230)]">
            Terms
          </Link>
          <Link href="/support" className="transition-colors hover:text-[oklch(0.35_0.05_230)]">
            Help
          </Link>
        </div>
      </footer>
    </div>
  );
}
