"use client";

const c = {
  bg: "#f7f7f8",
  card: "#ffffff",
  border: "#e7e7ea",
  text: "#18181b",
  text2: "#52525b",
  text3: "#a1a1aa",
  green: "#16a34a",
  greenBg: "#f0fdf4",
  blue: "#2563eb",
  blueBg: "#eff6ff",
  purple: "#7c3aed",
  purpleBg: "#f5f3ff",
  dark: "#18181b",
};

type Phase = {
  key: string;
  badge: string;
  label: string;
  color: string;
  trackColor: string;
  features: string[];
};

const PHASES: Phase[] = [
  {
    key: "day1",
    badge: "Day 1",
    label: "First bill in",
    color: c.green,
    trackColor: c.green,
    features: [
      "Upload and parse supplier invoices (PDF or text)",
      "AI-assisted product name matching",
      "Lot creation on first receipt",
      "Inventory items tracked per lot",
    ],
  },
  {
    key: "5bills",
    badge: "5+ bills",
    label: "Auto-matching unlocks",
    color: c.blue,
    trackColor: c.blue,
    features: [
      "Auto-matching for repeat supplier products",
      "Supplier reliability score (price stability, accuracy, on-time)",
      "Supplier comparison view (price matrix per SKU)",
      "Variance baseline for catch-weight products",
    ],
  },
  {
    key: "30days",
    badge: "~30 days",
    label: "Price intelligence",
    color: c.purple,
    trackColor: c.purple,
    features: [
      "Price drift alerts (threshold vs 30d trailing avg)",
      "Landed cost trend charts",
      "Price chart across all suppliers per SKU",
      "Expiring lot markdown predictions (after 3+ markdowns)",
    ],
  },
  {
    key: "90days",
    badge: "~90 days",
    label: "Full analytics",
    color: c.dark,
    trackColor: c.dark,
    features: [
      "Seasonality-aware pricing recommendations",
      "Year-over-year supplier cost comparison",
      "SKU velocity trends by season",
      "Multi-quarter reliability scoring",
    ],
  },
];

function PhaseCard({
  phase,
  isActive,
  isLocked,
}: {
  phase: Phase;
  isActive: boolean;
  isLocked: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: isActive ? "#fff" : c.bg,
        border: `1px solid ${isActive ? phase.color : c.border}`,
        borderRadius: 14,
        padding: "20px 18px",
        boxShadow: isActive ? `0 0 0 2px ${phase.color}22` : undefined,
        opacity: isLocked ? 0.55 : 1,
        position: "relative",
      }}
    >
      {isActive && (
        <div
          style={{
            position: "absolute",
            top: -10,
            left: "50%",
            transform: "translateX(-50%)",
            background: phase.color,
            color: "#fff",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.06em",
            padding: "2px 10px",
            borderRadius: 4,
            whiteSpace: "nowrap",
          }}
        >
          YOU ARE HERE
        </div>
      )}

      {/* Badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "3px 10px",
          borderRadius: 20,
          background: isLocked ? "#f4f4f5" : `${phase.color}18`,
          color: isLocked ? c.text3 : phase.color,
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 8,
          fontFamily: "ui-monospace,monospace",
        }}
      >
        {phase.badge}
      </div>

      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: isLocked ? c.text3 : c.text,
          marginBottom: 14,
        }}
      >
        {phase.label}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {phase.features.map(feature => (
          <div
            key={feature}
            style={{
              display: "flex",
              gap: 7,
              fontSize: 12.5,
              color: isLocked ? c.text3 : c.text2,
              lineHeight: 1.45,
            }}
          >
            <span
              style={{
                color: isLocked ? c.text3 : phase.color,
                flexShrink: 0,
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {isLocked ? "○" : "✓"}
            </span>
            {feature}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function WhatsNextPage({
  billCount = 0,
  dayCount = 0,
}: {
  billCount?: number;
  dayCount?: number;
}) {
  // Determine current phase
  let activePhaseKey = "day1";
  if (billCount >= 5 && dayCount < 30) activePhaseKey = "5bills";
  else if (dayCount >= 30 && dayCount < 90) activePhaseKey = "30days";
  else if (dayCount >= 90) activePhaseKey = "90days";
  else if (billCount >= 5) activePhaseKey = "5bills";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 80px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: "-0.015em",
            margin: "0 0 6px",
          }}
        >
          What unlocks next?
        </h1>
        <p style={{ color: c.text2, fontSize: 14, margin: 0 }}>
          Features unlock automatically when you hit data thresholds — no setup required. Here's where you are and what's coming.
        </p>
      </div>

      {/* Current status strip */}
      <div
        style={{
          background: c.card,
          border: `1px solid ${c.border}`,
          borderRadius: 12,
          padding: "14px 20px",
          marginBottom: 32,
          display: "flex",
          gap: 32,
          fontSize: 13,
        }}
      >
        {[
          { label: "Bills recorded", value: billCount, unit: "" },
          { label: "Days of history", value: dayCount, unit: "d" },
        ].map(s => (
          <div key={s.label}>
            <span style={{ color: c.text3, marginRight: 6 }}>{s.label}</span>
            <span
              style={{
                fontFamily: "ui-monospace,monospace",
                fontWeight: 700,
                fontSize: 15,
                color: c.text,
              }}
            >
              {s.value}{s.unit}
            </span>
          </div>
        ))}
        <div style={{ marginLeft: "auto", fontSize: 12, color: c.text3, alignSelf: "center" }}>
          Updates automatically as you add invoices
        </div>
      </div>

      {/* Timeline track */}
      <div style={{ position: "relative", marginBottom: 24 }}>
        {/* Connector line */}
        <div
          style={{
            position: "absolute",
            top: 8,
            left: "12%",
            right: "12%",
            height: 3,
            background: `linear-gradient(to right, ${c.green} 0%, ${c.blue} 33%, ${c.purple} 66%, ${c.dark} 100%)`,
            borderRadius: 2,
            zIndex: 0,
          }}
        />

        {/* Phase dots */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            position: "relative",
            zIndex: 1,
            marginBottom: 20,
          }}
        >
          {PHASES.map(phase => {
            const isActive = phase.key === activePhaseKey;
            return (
              <div key={phase.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: phase.color,
                    border: isActive ? `3px solid ${phase.color}` : `2px solid ${phase.color}`,
                    boxShadow: isActive ? `0 0 0 4px ${phase.color}30` : undefined,
                    transition: "box-shadow .2s",
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Phase cards */}
        <div style={{ display: "flex", gap: 16 }}>
          {PHASES.map((phase, i) => {
            const phaseOrder = ["day1", "5bills", "30days", "90days"];
            const activeIdx = phaseOrder.indexOf(activePhaseKey);
            const isActive = phase.key === activePhaseKey;
            const isLocked = phaseOrder.indexOf(phase.key) > activeIdx;

            return (
              <PhaseCard
                key={phase.key}
                phase={phase}
                isActive={isActive}
                isLocked={isLocked}
              />
            );
          })}
        </div>
      </div>

      {/* Footer note */}
      <div
        style={{
          textAlign: "center",
          fontSize: 13,
          color: c.text3,
          marginTop: 24,
        }}
      >
        <span>
          No setup steps, no manual toggles. Just keep adding invoices. ·{" "}
          <a href="/inbox" style={{ color: c.blue, textDecoration: "none" }}>
            Back to inbox →
          </a>
        </span>
      </div>
    </div>
  );
}
