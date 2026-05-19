"use client";

import { Spinner } from "./Spinner";

export type PostingStepStatus = "done" | "active" | "queued" | "error";

export interface PostingStep {
  id: string;
  label: string;
  detail?: string;
  status: PostingStepStatus;
}

interface BillPostingPanelProps {
  title?: string;
  subtitle?: string;
  steps: PostingStep[];
  warningText?: string;
}

const CHECK = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export function BillPostingPanel({
  title = "Posting bill",
  subtitle,
  steps,
  warningText = "Don't close this tab until the last step completes.",
}: BillPostingPanelProps) {
  return (
    <div
      style={{
        background: "var(--color-card)",
        border: "1px solid #e7e7ea",
        borderRadius: 12,
        padding: "18px 20px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
      }}
    >
      {/* Head */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div
          style={{
            width: 36, height: 36,
            borderRadius: 10,
            background: "var(--color-ink)",
            color: "var(--color-card)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: "var(--color-subtle)", marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {steps.map(step => (
          <div
            key={step.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "7px 10px",
              borderRadius: 7,
              fontSize: 12.5,
              background: step.status === "active" ? "#eff6ff" : "transparent",
              color: step.status === "active" ? "var(--color-forest-mid)" : step.status === "queued" ? "var(--color-muted)" : "var(--color-subtle)",
              fontWeight: step.status === "active" ? 600 : 400,
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 18, height: 18,
                borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                background:
                  step.status === "done" ? "var(--color-success-fg)" :
                  step.status === "active" ? "var(--color-forest-mid)" :
                  step.status === "error" ? "#dc2626" :
                  "var(--color-border-default)",
                color: step.status === "queued" ? undefined : "var(--color-card)",
              }}
            >
              {step.status === "done" && CHECK}
              {step.status === "active" && <Spinner size="sm" color="white" onDark />}
              {step.status === "error" && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              )}
            </div>

            <span style={{ flex: 1 }}>{step.label}</span>

            {step.detail && (
              <span
                style={{
                  fontSize: 11,
                  color: step.status === "active" ? "var(--color-forest-mid)" : "var(--color-muted)",
                  fontFamily: "var(--font-geist-mono, ui-monospace, monospace)",
                }}
              >
                {step.detail}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Warning */}
      <div
        style={{
          fontSize: 11.5,
          color: "var(--color-subtle)",
          paddingTop: 4,
          borderTop: "1px dashed #e7e7ea",
        }}
      >
        {warningText}
      </div>
    </div>
  );
}
