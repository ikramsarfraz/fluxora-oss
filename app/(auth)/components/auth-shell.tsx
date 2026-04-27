import Link from "next/link";

import { cn } from "@/lib/utils";

// ── Brand ────────────────────────────────────────────────────────────────────

export function AuthBrand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 text-[0.95rem] font-bold tracking-tight"
      style={{ color: "var(--primary)" }}
    >
      <div
        className="flex size-[26px] items-center justify-center rounded-[6px] text-[0.65rem] font-extrabold text-white"
        style={{ background: "var(--primary)" }}
      >
        Fx
      </div>
      Fluxora
    </Link>
  );
}

// ── Centered shell (replaces split layout) ───────────────────────────────────

type AuthSplitShellProps = {
  /** Accepted but not rendered — kept for call-site compatibility. */
  side?: React.ReactNode;
  children: React.ReactNode;
  topLabel: string;
  topHref: string;
  topAction: string;
};

export function AuthSplitShell({
  children,
  topLabel,
  topHref,
  topAction,
}: AuthSplitShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <nav className="flex h-[56px] shrink-0 items-center justify-between border-b border-border px-8">
        <AuthBrand />
        <div className="text-[0.82rem] text-muted-foreground">
          {topLabel}{" "}
          <Link
            href={topHref}
            className="font-medium text-foreground underline underline-offset-[3px] transition-opacity hover:opacity-70"
          >
            {topAction} →
          </Link>
        </div>
      </nav>

      <main className="flex flex-1 items-center justify-center px-8 py-10">
        {children}
      </main>

      <footer className="shrink-0 border-t border-border px-8 py-5 text-center text-[0.75rem] text-muted-foreground">
        <a href="#" className="mx-2 transition-colors hover:text-foreground">Privacy</a>
        <a href="#" className="mx-2 transition-colors hover:text-foreground">Terms</a>
        © 2026 Fluxora, Inc.
      </footer>
    </div>
  );
}

// ── Standalone centered page (for forgot/reset/invite-success) ───────────────

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
      <nav className="flex h-[56px] shrink-0 items-center justify-between border-b border-border px-8">
        <AuthBrand />
        {topLabel && topHref && topAction ? (
          <div className="text-[0.82rem] text-muted-foreground">
            {topLabel}{" "}
            <Link
              href={topHref}
              className="font-medium text-foreground underline underline-offset-[3px] transition-opacity hover:opacity-70"
            >
              {topAction} →
            </Link>
          </div>
        ) : null}
      </nav>

      <main className="flex flex-1 items-center justify-center px-8 py-10">
        {children}
      </main>

      <footer className="shrink-0 border-t border-border px-8 py-5 text-center text-[0.75rem] text-muted-foreground">
        <a href="#" className="mx-2 transition-colors hover:text-foreground">Privacy</a>
        <a href="#" className="mx-2 transition-colors hover:text-foreground">Terms</a>
        © 2026 Fluxora, Inc.
      </footer>
    </div>
  );
}

// ── Legacy panel components (no longer rendered, kept for call-site compat) ──

type MarketingFeature = { title: string; description: string };

type AuthMarketingPanelProps = {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  features: MarketingFeature[];
  footerLabel?: string;
};

export function AuthMarketingPanel(_props: AuthMarketingPanelProps) {
  return null;
}

type AuthStep = { id: string; title: string; description: string };

type AuthStepperPanelProps = {
  currentStep: number;
  steps: AuthStep[];
};

export function AuthStepperPanel({ currentStep, steps }: AuthStepperPanelProps) {
  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, i) => {
        const state =
          i < currentStep ? "done" : i === currentStep ? "active" : "upcoming";
        return (
          <div key={step.id} className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[0.72rem] font-bold",
                state === "done" && "bg-[oklch(0.96_0.05_162)] text-[oklch(0.45_0.14_162)]",
                state === "active" && "text-white",
                state === "upcoming" && "bg-muted text-muted-foreground",
              )}
              style={state === "active" ? { background: "var(--primary)" } : undefined}
            >
              {state === "done" ? "✓" : i + 1}
            </div>
            <span
              className={cn(
                "text-[0.82rem]",
                state === "active" ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {step.title}
            </span>
          </div>
        );
      })}
    </div>
  );
}
