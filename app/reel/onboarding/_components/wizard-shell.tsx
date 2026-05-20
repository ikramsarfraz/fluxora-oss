"use client";

import { Check } from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { cn } from "@/lib/utils";

// Wizard chrome for the onboarding scenes. Step rail on the left + main card
// in the center. Pre-tenant: no app sidebar.

export type WizardStep = {
  key: string;
  label: string;
};

export function WizardShell({
  steps,
  currentIdx,
  children,
}: {
  steps: WizardStep[];
  currentIdx: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full bg-page">
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-border-default bg-card-warm/50 p-6">
        <div className="flex items-center gap-2">
          <Logomark size={24} />
          <span className="font-serif text-[16px] font-medium text-ink">
            Fluxora
          </span>
        </div>

        <div className="mt-8 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
          Set up your workspace
        </div>

        <ol className="mt-3 space-y-3">
          {steps.map((step, idx) => {
            const isDone = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            return (
              <li key={step.key} className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                    isDone
                      ? "border-success-fg bg-success-fg text-card-warm"
                      : isCurrent
                        ? "border-info-fg bg-info-fg text-card-warm"
                        : "border-border-default bg-card-warm text-subtle",
                  )}
                >
                  {isDone ? (
                    <Check className="size-3.5" strokeWidth={2.6} />
                  ) : (
                    idx + 1
                  )}
                </div>
                <div
                  className={cn(
                    "text-[12.5px]",
                    isCurrent
                      ? "font-medium text-ink"
                      : isDone
                        ? "text-ink-warm"
                        : "text-subtle",
                  )}
                >
                  {step.label}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-auto font-mono text-[10px] text-subtle">
          You can finish later.
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}

export const WIZARD_STEPS: WizardStep[] = [
  { key: "subdomain", label: "Pick your workspace" },
  { key: "invite", label: "Invite your team" },
  { key: "checklist", label: "First steps" },
];
