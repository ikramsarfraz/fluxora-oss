"use client";

import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/empty-state";

// ── Morning Inbox: no bills yet ───────────────────────────────────────────

export function InboxEmptyState() {
  const router = useRouter();
  return (
    <div style={{ padding: "40px 32px" }}>
      <EmptyState
        variant="neutral"
        icon="📬"
        title="Drop your first bill to get started"
        body="Your inbox will show expiring lots, price spikes, outstanding credits, and receiving sessions — once there's data to surface. Add a supplier invoice to begin."
        ctas={[
          {
            label: "Upload supplier invoice",
            kind: "primary",
            handler: () => router.push("/supplier-invoices/new"),
          },
        ]}
      />

      {/* Ghost placeholder cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          marginTop: 32,
          opacity: 0.35,
          pointerEvents: "none",
        }}
      >
        {[
          { emoji: "⏱", label: "Bills to review", hint: "Invoices awaiting your approval appear here" },
          { emoji: "📦", label: "Receiving now", hint: "Active receiving sessions show live progress" },
          { emoji: "🔔", label: "Price alerts", hint: "Spikes vs. your trailing 90d average fire here" },
        ].map(card => (
          <div
            key={card.label}
            style={{
              background: "var(--color-divider)",
              border: "1px dashed #d4d4d8",
              borderRadius: 12,
              padding: "20px 18px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>{card.emoji}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-subtle)", marginBottom: 4 }}>
              {card.label}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-muted)" }}>{card.hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SKU Intelligence: fewer than 3 receipts ───────────────────────────────

export function SkuIntelligenceEmptyState({
  purchaseCount,
  productName,
}: {
  purchaseCount: number;
  productName: string;
}) {
  return (
    <EmptyState
      variant="neutral"
      icon="📊"
      title="One data point isn't a trend"
      body={`${productName} has only ${purchaseCount} purchase${purchaseCount === 1 ? "" : "s"} recorded. Stats like 90-day average, price volatility, and best supplier unlock after more invoices arrive.`}
      unlockCondition={{
        current: purchaseCount,
        needed: 3,
        label: "invoices needed for first intelligence score",
      }}
    />
  );
}

// ── Receiving: first receipt for a SKU ───────────────────────────────────

export function ReceivingFirstReceiptBanner({ productName }: { productName: string }) {
  return (
    <div
      style={{
        background: "#eff6ff",
        border: "1px solid #bfdbfe",
        borderRadius: 10,
        padding: "12px 16px",
        marginBottom: 12,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        fontSize: 13,
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0 }}>🔵</span>
      <div>
        <div style={{ fontWeight: 600, color: "#1e40af", marginBottom: 2 }}>
          First receipt for {productName}
        </div>
        <div style={{ color: "#1d4ed8", lineHeight: 1.45 }}>
          We can&apos;t flag catch-weight variance yet — every weight you record becomes part of the baseline going forward.{" "}
          <span style={{ fontWeight: 500 }}>No SKU baseline yet · 1st observation.</span>
        </div>
      </div>
    </div>
  );
}

// ── Markdown decision: no priors ─────────────────────────────────────────

export function MarkdownColdStartBanner({
  priorCount,
  category,
}: {
  priorCount: number;
  category: string;
}) {
  return (
    <div
      style={{
        background: "var(--color-warning-bg)",
        border: "1px solid var(--color-warning-border)",
        borderRadius: 10,
        padding: "12px 16px",
        marginBottom: 16,
        fontSize: 13,
        color: "var(--color-warning-fg)",
        lineHeight: 1.5,
      }}
    >
      <strong>No prior markdowns to predict from.</strong> Recommendation badge hidden until we&apos;ve seen 3+ {category} markdowns.{" "}
      Options show ranges, not predictions. Currently have {priorCount} of 3 needed.
    </div>
  );
}

// ── Price alerts: fewer than 30 days of history ───────────────────────────

export function PriceAlertsEmptyState({ dayCount }: { dayCount: number }) {
  const router = useRouter();
  return (
    <EmptyState
      variant="cool"
      icon="📈"
      title={`Day ${dayCount} of 30`}
      body="Price drift alerts fire when a supplier's price moves more than your configured threshold vs. the trailing 30-day average. Keep adding invoices — alerts activate automatically at day 30."
      unlockCondition={{
        current: dayCount,
        needed: 30,
        label: "days of invoice history needed",
      }}
      ctas={[
        {
          label: "Adjust thresholds early",
          kind: "secondary",
          handler: () => router.push("/settings/workspace/general"),
        },
        {
          label: "Set up email digest",
          kind: "secondary",
          handler: () => router.push("/settings/workspace/general"),
        },
      ]}
    />
  );
}
