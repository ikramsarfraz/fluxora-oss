"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "../actions";
import { captureClientEvent } from "@/lib/posthog-client";

// ── Design tokens ─────────────────────────────────────────────────────────
const c = {
  bg: "#f7f7f8",
  card: "#ffffff",
  border: "#e7e7ea",
  borderStrong: "#d4d4d8",
  text: "#18181b",
  text2: "#52525b",
  text3: "#a1a1aa",
  green: "#16a34a",
  greenBg: "#f0fdf4",
  greenBorder: "#bbf7d0",
  accent: "#18181b",
  purple: "#7c3aed",
  purpleBg: "#f5f3ff",
  blue: "#2563eb",
  blueBg: "#eff6ff",
};

type BusinessCategory = "meat_poultry" | "seafood" | "produce" | "bakery_dry";
type BillSource = "paper_scanned" | "supplier_emails" | "accounting_tool" | "mix";

const CATEGORIES: Array<{
  id: BusinessCategory;
  emoji: string;
  label: string;
  hint: string;
  bg: string;
}> = [
  { id: "meat_poultry", emoji: "🥩", label: "Meat & poultry", hint: "Variable weight, catch-weight, USDA grade tracking", bg: "#fecaca" },
  { id: "seafood", emoji: "🦞", label: "Seafood", hint: "Variable weight, COA required, 28°F target", bg: "#bfdbfe" },
  { id: "produce", emoji: "🥦", label: "Produce", hint: "By case or weight, country-of-origin tracking", bg: "#bbf7d0" },
  { id: "bakery_dry", emoji: "🥖", label: "Bakery / dry", hint: "Fixed cases, ambient storage, expiry windows", bg: "#fef3c7" },
];

const BILL_SOURCES: Array<{ id: BillSource; emoji: string; label: string }> = [
  { id: "paper_scanned", emoji: "📄", label: "Paper / scanned PDFs" },
  { id: "supplier_emails", emoji: "📧", label: "Supplier emails" },
  { id: "accounting_tool", emoji: "🔗", label: "Accounting tool" },
  { id: "mix", emoji: "🔀", label: "Mix of all" },
];

// ── Step indicator ────────────────────────────────────────────────────────

function StepNum({ n, status }: { n: number; status: "done" | "active" | "pending" }) {
  const styles = {
    done: { bg: c.green, color: "#fff" },
    active: { bg: c.accent, color: "#fff" },
    pending: { bg: c.border, color: c.text3 },
  }[status];

  return (
    <div
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: styles.bg,
        color: styles.color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {status === "done" ? "✓" : n}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function WelcomePage({ defaultName = "" }: { defaultName?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState(defaultName);

  useEffect(() => {
    captureClientEvent("welcome.started");
  }, []);
  const [location, setLocation] = useState("");
  const [employeeRange, setEmployeeRange] = useState("");
  const [category, setCategory] = useState<BusinessCategory | null>(null);
  const [billSource, setBillSource] = useState<BillSource | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleFinish() {
    if (!category) return;
    setIsSubmitting(true);
    try {
      await completeOnboarding({
        businessName: businessName || "My Business",
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
    if (step < 3) setStep(s => s + 1);
    else handleFinish();
  }

  function canAdvance() {
    if (step === 1) return businessName.trim().length > 0;
    if (step === 2) return category !== null;
    return true;
  }

  const progressPct = (step / 3) * 100;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: c.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
      }}
    >
      <div
        style={{
          background: c.card,
          border: `1px solid ${c.border}`,
          borderRadius: 16,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          width: "100%",
          maxWidth: 960,
          minHeight: 560,
        }}
      >
        {/* Left: form */}
        <div style={{ padding: "36px 40px", display: "flex", flexDirection: "column" }}>
          {/* Brand + step counter */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 28,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: c.accent,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                P
              </div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Acme Distribution</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: c.text2,
              }}
            >
              <span>Step {step} of 3</span>
              <div
                style={{
                  width: 80,
                  height: 4,
                  background: "#f4f4f5",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progressPct}%`,
                    height: "100%",
                    background: c.accent,
                    borderRadius: 2,
                    transition: "width .3s",
                  }}
                />
              </div>
            </div>
          </div>

          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              margin: "0 0 8px",
            }}
          >
            {step === 1 ? "Welcome. Let's get started." : step === 2 ? "What do you sell?" : "How do bills reach you?"}
          </h1>
          <p style={{ color: c.text2, fontSize: 14, marginBottom: 28, maxWidth: 420 }}>
            {step === 1 && "Tell us about your business. We'll set sensible defaults from day one."}
            {step === 2 && "Pick your primary category. You can add more later — this sets defaults for units, temperature, and grade tracking."}
            {step === 3 && "Optional — helps us tune the import pipeline. You can skip this."}
          </p>

          {/* Step 1: Business basics */}
          {step >= 1 && (
            <div style={{ marginBottom: 22 }}>
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  margin: "0 0 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: step === 1 ? c.text : c.text2,
                }}
              >
                <StepNum n={1} status={step > 1 ? "done" : "active"} />
                Business basics
              </h3>
              {step === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    type="text"
                    placeholder="Business name"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    style={{
                      padding: "9px 12px",
                      border: `1px solid ${c.borderStrong}`,
                      borderRadius: 8,
                      fontSize: 13.5,
                      fontFamily: "inherit",
                      width: "100%",
                      background: "#fff",
                    }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
                    <input
                      type="text"
                      placeholder="City, State"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      style={{
                        padding: "9px 12px",
                        border: `1px solid ${c.borderStrong}`,
                        borderRadius: 8,
                        fontSize: 13.5,
                        fontFamily: "inherit",
                        background: "#fff",
                      }}
                    />
                    <select
                      value={employeeRange}
                      onChange={e => setEmployeeRange(e.target.value)}
                      style={{
                        padding: "9px 12px",
                        border: `1px solid ${c.borderStrong}`,
                        borderRadius: 8,
                        fontSize: 13.5,
                        fontFamily: "inherit",
                        background: "#fff",
                      }}
                    >
                      <option value="">Team size</option>
                      <option value="1-5">1–5 people</option>
                      <option value="6-15">6–15 people</option>
                      <option value="16-50">16–50 people</option>
                      <option value="50+">50+ people</option>
                    </select>
                  </div>
                </div>
              )}
              {step > 1 && (
                <div style={{ fontSize: 13, color: c.text2 }}>
                  {businessName || "Your business"} · {location || "—"}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Category */}
          {step >= 2 && (
            <div style={{ marginBottom: 22 }}>
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  margin: "0 0 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: step === 2 ? c.text : c.text2,
                }}
              >
                <StepNum n={2} status={step > 2 ? "done" : step === 2 ? "active" : "pending"} />
                What do you sell?
              </h3>
              {step === 2 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      style={{
                        padding: "10px 12px",
                        border: `1px solid ${category === cat.id ? c.accent : c.border}`,
                        borderRadius: 8,
                        background: category === cat.id ? "#fafafa" : "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        textAlign: "left",
                        boxShadow:
                          category === cat.id ? "0 0 0 2px rgba(24,24,27,0.06)" : undefined,
                        transition: "all .12s",
                      }}
                    >
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          background: cat.bg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        {cat.emoji}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{cat.label}</div>
                        <div style={{ fontSize: 11, color: c.text3, marginTop: 1 }}>{cat.hint}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {step > 2 && category && (
                <div style={{ fontSize: 13, color: c.text2 }}>
                  {CATEGORIES.find(c => c.id === category)?.label}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Bill source */}
          {step >= 3 && (
            <div style={{ marginBottom: 22 }}>
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  margin: "0 0 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: c.text,
                }}
              >
                <StepNum n={3} status="active" />
                How do bills reach you?
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {BILL_SOURCES.map(src => (
                  <button
                    key={src.id}
                    onClick={() => setBillSource(src.id)}
                    style={{
                      padding: "10px 12px",
                      border: `1px solid ${billSource === src.id ? c.accent : c.border}`,
                      borderRadius: 8,
                      background: billSource === src.id ? "#fafafa" : "#fff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      textAlign: "left",
                      fontSize: 13,
                      fontWeight: 500,
                      transition: "all .12s",
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{src.emoji}</span>
                    {src.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div />
            <div style={{ display: "flex", gap: 8 }}>
              {step > 1 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  style={{
                    padding: "8px 14px",
                    border: `1px solid ${c.borderStrong}`,
                    borderRadius: 7,
                    fontSize: 13,
                    fontWeight: 500,
                    background: "#fff",
                    color: c.text,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={!canAdvance() || isSubmitting}
                style={{
                  padding: "8px 18px",
                  border: `1px solid ${canAdvance() ? c.accent : c.border}`,
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 600,
                  background: canAdvance() ? c.accent : "#f4f4f5",
                  color: canAdvance() ? "#fff" : c.text3,
                  cursor: canAdvance() && !isSubmitting ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                }}
              >
                {step === 3 ? (isSubmitting ? "Setting up…" : "Finish setup →") : "Continue →"}
              </button>
            </div>
          </div>
        </div>

        {/* Right: preview panel */}
        <div
          style={{
            background: "linear-gradient(135deg, #6d28d9 0%, #7c3aed 50%, #8b5cf6 100%)",
            padding: "40px 36px",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.55)",
                marginBottom: 10,
              }}
            >
              What you'll get on day 1
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                lineHeight: 1.3,
                marginBottom: 20,
              }}
            >
              A working bill-entry system before you finish your coffee.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                "PDF parsing with AI-assisted product matching",
                "Catalog seeded from your first bill",
                "Lot tracking from day one",
              ].map(item => (
                <div key={item} style={{ display: "flex", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                  <span style={{ color: "#4ade80", flexShrink: 0 }}>✓</span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 32 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.55)",
                marginBottom: 10,
              }}
            >
              What unlocks over time
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { badge: "5+", color: "#3b82f6", label: "Auto-matching & reliability scores" },
                { badge: "~30d", color: "#8b5cf6", label: "Price drift alerts & trends" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 30,
                      padding: "1px 6px",
                      borderRadius: 4,
                      fontSize: 10.5,
                      fontWeight: 700,
                      background: item.color,
                      color: "#fff",
                      flexShrink: 0,
                    }}
                  >
                    {item.badge}
                  </span>
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "auto" }}>
            <div
              style={{
                background: "rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 12.5,
                color: "rgba(255,255,255,0.8)",
                lineHeight: 1.5,
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              No fake data, no demo mode. If we can't compute something yet, we'll say so — and tell you how many more invoices it needs.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
