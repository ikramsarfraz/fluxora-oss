"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { FluxoraMark } from "@/components/brand/fluxora-mark";
import { captureClientEvent } from "@/lib/posthog-client";
import { cn } from "@/lib/utils";

import { completeOnboarding } from "../actions";

// ── Types ────────────────────────────────────────────────────────────────

type BusinessCategory = "meat_poultry" | "seafood" | "produce" | "bakery_dry";
type BillSource = "paper_scanned" | "supplier_emails" | "accounting_tool" | "mix";
type TeamSize = "1-5" | "6-15" | "16-50" | "50+";

const CATEGORIES: Array<{
  id: BusinessCategory;
  letter: string;
  label: string;
  hint: string;
  bg: string;
  fg: string;
}> = [
  {
    id: "meat_poultry",
    letter: "M",
    label: "Meat & poultry",
    hint: "Variable weight, USDA grade tracking, catch-weight invoicing.",
    bg: "#EDD4C9",
    fg: "#8B3415",
  },
  {
    id: "seafood",
    letter: "S",
    label: "Seafood",
    hint: "Variable weight, COA required, 28°F target storage.",
    bg: "#DCE5DD",
    fg: "#1F3A2E",
  },
  {
    id: "produce",
    letter: "P",
    label: "Produce",
    hint: "By case or weight, country-of-origin tracking.",
    bg: "#E0E8D5",
    fg: "#4A6B2F",
  },
  {
    id: "bakery_dry",
    letter: "B",
    label: "Bakery / dry",
    hint: "Fixed cases, ambient storage, expiry windows.",
    bg: "#F4E6C2",
    fg: "#6B4A0E",
  },
];

const BILL_SOURCES: Array<{ id: BillSource; mark: string; label: string; hint: string }> = [
  {
    id: "paper_scanned",
    mark: "▦",
    label: "Paper / scanned PDFs",
    hint: "Photos and PDFs from your supplier. We OCR them.",
  },
  {
    id: "supplier_emails",
    mark: "✉",
    label: "Supplier emails",
    hint: "Forward your supplier billing inbox — we parse attachments.",
  },
  {
    id: "accounting_tool",
    mark: "⛁",
    label: "Accounting tool",
    hint: "QuickBooks, Xero, or similar — bills already in a system.",
  },
  {
    id: "mix",
    mark: "≣",
    label: "Mix of all",
    hint: "Bills arrive across channels. We handle all of the above.",
  },
];

const TEAM_SIZES: TeamSize[] = ["1-5", "6-15", "16-50", "50+"];

// ── Main component ───────────────────────────────────────────────────────

export function WelcomePage({ defaultName = "" }: { defaultName?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [businessName, setBusinessName] = useState(defaultName);
  const [location, setLocation] = useState("");
  const [teamSize, setTeamSize] = useState<TeamSize | null>(null);
  const [category, setCategory] = useState<BusinessCategory | null>(null);
  const [billSource, setBillSource] = useState<BillSource | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    captureClientEvent("welcome.started");
  }, []);

  function canAdvance() {
    if (step === 1) return businessName.trim().length > 0 && teamSize !== null;
    if (step === 2) return category !== null;
    return billSource !== null;
  }

  async function handleFinish() {
    if (!category) return;
    setIsSubmitting(true);
    try {
      await completeOnboarding({
        businessName: businessName.trim() || "My Business",
        businessCategory: category,
        billSource: billSource ?? "mix",
      });
      router.push("/inbox");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNext() {
    captureClientEvent("welcome.step_completed", { step });
    if (step < 3) setStep((s) => (s + 1) as 1 | 2 | 3);
    else handleFinish();
  }

  const progressPct = (step / 3) * 100;
  const finalStep = step === 3;
  const categoryChoice = category ? CATEGORIES.find((c) => c.id === category) : null;
  const billChoice = billSource ? BILL_SOURCES.find((b) => b.id === billSource) : null;

  return (
    <div className="min-h-screen bg-page px-6 py-12 text-ink">
      <div className="mx-auto flex max-w-[1040px] flex-col gap-8">
        {/* topbar */}
        <header className="flex items-center justify-between">
          <div className="inline-flex items-center gap-[9px] font-sans text-[19px] font-semibold leading-none tracking-[-0.03em] text-ink">
            <FluxoraMark size={28} />
            Fluxora
          </div>
          <div className="font-mono text-[11px] tracking-[0.04em] text-subtle">
            Step {step} of 3 · {Math.round(progressPct)}%
          </div>
        </header>

        {/* progress bar */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-deep">
          <div
            className="h-full rounded-full bg-forest transition-[width] duration-[240ms] ease-[cubic-bezier(.2,0,0,1)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_1fr]">
          {/* wizard */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
                Workspace setup
              </span>
              <h1 className="text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
                Three quick questions.
              </h1>
              <p className="text-[14.5px] leading-[1.55] text-subtle">
                We&apos;ll use these to seed your catalog defaults. You can
                change everything later from settings.
              </p>
            </div>

            {/* Step 1 — Business basics */}
            <StepCard
              n={1}
              title="Business basics"
              status={step === 1 ? "active" : "done"}
              summary={
                step !== 1
                  ? `${businessName} · ${location || "—"} · ${teamSize ?? "—"}`
                  : undefined
              }
              onEdit={() => setStep(1)}
            >
              <div className="flex flex-col gap-3">
                <Field label="Business name">
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Marin Provisions"
                    autoFocus
                    className="w-full rounded-md border-[0.5px] border-border-default bg-card px-3 py-[11px] font-sans text-[14px] text-ink outline-none transition-colors placeholder:text-muted focus:border-forest focus:shadow-[0_0_0_3px_rgba(31,58,46,0.18)]"
                  />
                </Field>
                <Field label="City, state">
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Sausalito, CA"
                    className="w-full rounded-md border-[0.5px] border-border-default bg-card px-3 py-[11px] font-sans text-[14px] text-ink outline-none transition-colors placeholder:text-muted focus:border-forest focus:shadow-[0_0_0_3px_rgba(31,58,46,0.18)]"
                  />
                </Field>
                <Field label="Team size">
                  <div className="grid grid-cols-4 gap-2">
                    {TEAM_SIZES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setTeamSize(size)}
                        className={cn(
                          "rounded-md border-[0.5px] bg-card px-3 py-2.5 font-mono text-[12.5px] text-ink transition-colors hover:bg-card-warm",
                          teamSize === size
                            ? "border-forest bg-forest-tint text-forest"
                            : "border-border-default",
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </StepCard>

            {/* Step 2 — Category */}
            <StepCard
              n={2}
              title="What you sell"
              status={step === 2 ? "active" : step > 2 ? "done" : "pending"}
              summary={categoryChoice && step !== 2 ? categoryChoice.label : undefined}
              onEdit={() => setStep(2)}
            >
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {CATEGORIES.map((cat) => {
                  const isActive = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={cn(
                        "flex items-start gap-3 rounded-md border-[0.5px] bg-card px-4 py-3 text-left transition-colors hover:bg-card-warm",
                        isActive ? "border-forest bg-forest-tint/40" : "border-border-default",
                      )}
                    >
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-md font-sans text-[16px] font-semibold leading-none"
                        style={{ background: cat.bg, color: cat.fg }}
                      >
                        {cat.letter}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium text-ink">
                            {cat.label}
                          </span>
                          {isActive && (
                            <span className="grid size-4 place-items-center rounded-full bg-forest text-[10px] text-card-warm">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[12px] leading-[1.45] text-subtle">
                          {cat.hint}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </StepCard>

            {/* Step 3 — Bill source */}
            <StepCard
              n={3}
              title="Where bills come from"
              status={step === 3 ? "active" : "pending"}
              summary={billChoice && step !== 3 ? billChoice.label : undefined}
              onEdit={() => setStep(3)}
            >
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {BILL_SOURCES.map((src) => {
                  const isActive = billSource === src.id;
                  return (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => setBillSource(src.id)}
                      className={cn(
                        "flex items-start gap-3 rounded-md border-[0.5px] bg-card px-4 py-3 text-left transition-colors hover:bg-card-warm",
                        isActive ? "border-forest bg-forest-tint/40" : "border-border-default",
                      )}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface text-[16px] text-subtle">
                        {src.mark}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium text-ink">
                            {src.label}
                          </span>
                          {isActive && (
                            <span className="grid size-4 place-items-center rounded-full bg-forest text-[10px] text-card-warm">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[12px] leading-[1.45] text-subtle">
                          {src.hint}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </StepCard>

            {/* Actions */}
            <div className="mt-3 flex items-center gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                  className="rounded-md border-[0.5px] border-border-default bg-card px-4 py-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-card-warm"
                >
                  ← Back
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                disabled={!canAdvance() || isSubmitting}
                aria-disabled={!canAdvance() || isSubmitting}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[14px] font-medium transition-colors",
                  canAdvance() && !isSubmitting
                    ? "bg-forest text-card-warm hover:bg-forest-mid"
                    : "cursor-not-allowed bg-surface text-muted",
                )}
              >
                {isSubmitting
                  ? "Finishing setup…"
                  : finalStep
                    ? "Finish setup"
                    : "Continue"}
                <span aria-hidden>→</span>
              </button>
            </div>
          </section>

          {/* right rail */}
          <aside className="relative hidden overflow-hidden rounded-xl bg-forest p-8 text-card-warm lg:flex lg:flex-col lg:gap-8">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 60% 40% at 80% 10%, rgba(201,169,97,.10) 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 20% 90%, rgba(74,122,94,.25) 0%, transparent 60%)",
              }}
            />
            <div className="relative z-10 flex flex-col gap-2">
              <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-forest-tint">
                On day 1, you&apos;ll have
              </span>
              <h2 className="text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] text-card-warm">
                A workspace ready for your first lot, order, and invoice.
              </h2>
            </div>

            <ul className="relative z-10 flex flex-col gap-2.5">
              {[
                "A catalog seeded with category defaults",
                "Branded invoice PDF with your subdomain",
                "Bill inbox tuned for the source you picked",
                "Role-scoped permissions for picker / dispatcher / finance",
              ].map((row) => (
                <li
                  key={row}
                  className="flex items-start gap-2.5 text-[13px] leading-[1.5] text-card-warm/85"
                >
                  <span className="mt-0.5 grid size-4 place-items-center rounded-full bg-forest-tint text-[10px] font-semibold text-forest">
                    ✓
                  </span>
                  {row}
                </li>
              ))}
            </ul>

            <div className="relative z-10 mt-auto flex flex-col gap-2 border-t-[0.5px] border-card-warm/15 pt-5">
              <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-forest-tint">
                Unlocks over the next 30 days
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "PDF import",
                  "FIFO lots",
                  "Catch-weight",
                  "Stripe payments",
                  "Plaid bank feed",
                ].map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border-[0.5px] border-card-warm/15 bg-card-warm/[0.06] px-2.5 py-1 font-mono text-[10.5px] text-card-warm/80"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function StepCard({
  n,
  title,
  status,
  summary,
  onEdit,
  children,
}: {
  n: number;
  title: string;
  status: "done" | "active" | "pending";
  summary?: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  const isActive = status === "active";
  const isDone = status === "done";

  return (
    <div
      className={cn(
        "rounded-lg border-[0.5px] bg-card transition-colors",
        isActive ? "border-forest shadow-[0_1px_2px_rgba(26,26,20,0.05),0_8px_24px_rgba(26,26,20,0.06)]" : "border-border-soft",
        !isActive && "bg-card-warm",
      )}
    >
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "grid size-6 place-items-center rounded-full font-mono text-[11px] font-semibold",
              isDone
                ? "bg-forest text-card-warm"
                : isActive
                  ? "bg-forest text-card-warm"
                  : "border-[0.5px] border-border-default bg-card text-subtle",
            )}
          >
            {isDone ? "✓" : n}
          </span>
          <span
            className={cn(
              "text-[15px] font-medium",
              isActive ? "text-ink" : isDone ? "text-ink-warm" : "text-subtle",
            )}
          >
            {title}
          </span>
        </div>
        {summary && !isActive ? (
          <div className="flex items-center gap-3 text-[12.5px] text-subtle">
            <span className="hidden sm:inline">{summary}</span>
            <button
              type="button"
              onClick={onEdit}
              className="font-mono text-[11px] uppercase tracking-[0.08em] text-forest hover:underline"
            >
              Edit
            </button>
          </div>
        ) : null}
      </div>
      {isActive ? (
        <div className="border-t-[0.5px] border-divider px-5 py-5">{children}</div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium leading-none tracking-[-0.005em] text-ink">
        {label}
      </span>
      {children}
    </label>
  );
}
