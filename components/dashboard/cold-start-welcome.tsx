"use client";

import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/utils";

type Step = {
  id: string;
  title: string;
  hint: string;
  href: string;
};

const DEFAULT_STEPS: Step[] = [
  {
    id: "customers",
    title: "Add your first customer",
    hint: "A name and an address. You can import a CSV later if you've got more than a few.",
    href: "/customers",
  },
  {
    id: "products",
    title: "Stock your catalog",
    hint: "Add a product or two so the next supplier bill has somewhere to land.",
    href: "/products",
  },
  {
    id: "bill",
    title: "Log your first supplier bill",
    hint: "Snap a photo or upload a PDF — we'll OCR it and pre-fill the line items.",
    href: "/supplier-invoices",
  },
  {
    id: "invoice",
    title: "Send your first invoice",
    hint: "Branded PDF with your subdomain. Stripe-ready when you turn it on.",
    href: "/sales-orders",
  },
];

export function ColdStartWelcome({
  workspaceName,
  ownerFirstName,
  steps = DEFAULT_STEPS,
}: {
  workspaceName: string;
  ownerFirstName?: string;
  steps?: Step[];
}) {
  const [dismissed, setDismissed] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  if (dismissed) return null;

  const doneCount = completed.size;
  const total = steps.length;
  const pct = (doneCount / total) * 100;

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      {/* Welcome banner */}
      <section
        className="relative overflow-hidden rounded-xl bg-forest p-6 text-card-warm shadow-[0_1px_2px_rgba(26,26,20,0.05),0_8px_24px_rgba(26,26,20,0.06)]"
        aria-label="Welcome"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 80% 10%, rgba(201,169,97,.10) 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 20% 90%, rgba(74,122,94,.25) 0%, transparent 60%)",
          }}
        />
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss welcome"
          className="absolute right-4 top-4 grid size-7 place-items-center rounded-full bg-card-warm/10 text-[14px] text-card-warm transition-colors hover:bg-card-warm/20"
        >
          ×
        </button>
        <div className="relative z-10 flex flex-col gap-2">
          <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-forest-tint">
            Day 1 · cold start
          </span>
          <h2 className="max-w-[640px] text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-card-warm">
            Welcome to {workspaceName}
            {ownerFirstName ? `, ${ownerFirstName}` : ""}.
          </h2>
          <p className="max-w-[560px] text-[14px] leading-[1.55] text-card-warm/70">
            Four small steps and your workspace is operational. Skip anything
            that doesn&apos;t apply — you can come back to this checklist from
            the sidebar whenever you want.
          </p>
        </div>
      </section>

      {/* Checklist */}
      <section className="rounded-lg border-[0.5px] border-border-soft bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
              Setup checklist
            </span>
            <span className="text-[14px] font-medium text-ink">
              {doneCount} of {total} done
            </span>
          </div>
          <div className="hidden flex-1 max-w-[280px] flex-col gap-1 sm:flex">
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: total }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 rounded-full transition-colors",
                    i < doneCount ? "bg-forest" : "bg-surface-deep",
                  )}
                />
              ))}
            </div>
            <span className="text-right font-mono text-[10.5px] text-subtle">
              {Math.round(pct)}%
            </span>
          </div>
        </div>
        <ul className="mt-5 flex flex-col gap-2">
          {steps.map((step) => {
            const isDone = completed.has(step.id);
            return (
              <li
                key={step.id}
                className={cn(
                  "flex items-center gap-3 rounded-md border-[0.5px] bg-card-warm px-4 py-3 transition-colors",
                  isDone ? "border-success-border" : "border-border-soft",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setCompleted((prev) => {
                      const next = new Set(prev);
                      if (next.has(step.id)) next.delete(step.id);
                      else next.add(step.id);
                      return next;
                    });
                  }}
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full transition-colors",
                    isDone
                      ? "bg-forest text-card-warm"
                      : "border-[0.5px] border-border-default bg-card text-subtle hover:border-forest hover:text-forest",
                  )}
                  aria-label={isDone ? "Mark as not done" : "Mark as done"}
                >
                  {isDone ? "✓" : ""}
                </button>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "text-[13.5px] font-medium",
                      isDone ? "text-subtle line-through" : "text-ink",
                    )}
                  >
                    {step.title}
                  </div>
                  <p className="text-[12px] leading-[1.45] text-subtle">{step.hint}</p>
                </div>
                <Link
                  href={step.href}
                  className="font-mono text-[11px] uppercase tracking-[0.08em] text-forest hover:underline"
                >
                  Open →
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Tip strip */}
      <div className="flex items-center gap-3 rounded-md border-[0.5px] border-border-soft bg-card-warm px-4 py-3 text-[12.5px] text-ink-warm">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-info-bg text-[11px] font-semibold text-info-fg">
          i
        </span>
        <span>
          <span className="font-medium text-ink">No fake data, no demo mode.</span>{" "}
          Every record you see is real — we&apos;d rather show &mdash; than make
          a number up.
        </span>
      </div>
    </div>
  );
}
