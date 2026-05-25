"use client";

import { Spinner } from "./Spinner";
import { ProgressBar } from "./ProgressBar";

export type StageStatus = "done" | "active" | "queued" | "error";

export interface Stage {
  id: string;
  name: React.ReactNode;
  status: StageStatus;
  detail?: string;
  subProgress?: number; // 0-100, shows sub-progress bar when active
}

interface StageListProps {
  stages: Stage[];
}

const CHECK = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const X = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export function StageList({ stages }: StageListProps) {
  return (
    <div>
      {stages.map((stage, i) => (
        <div
          key={stage.id}
          style={{
            display: "grid",
            gridTemplateColumns: "22px 1fr auto",
            alignItems: "center",
            gap: 10,
            padding: "7px 0",
            borderTop: i === 0 ? undefined : "1px dashed #e7e7ea",
          }}
        >
          {/* Status icon */}
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              background:
                stage.status === "done"
                  ? "var(--color-success-fg)"
                  : stage.status === "active"
                  ? "var(--color-forest-mid)"
                  : stage.status === "error"
                  ? "var(--color-danger-fg)"
                  : "var(--color-border-default)",
              color:
                stage.status === "queued" ? undefined : "var(--color-card)",
            }}
          >
            {stage.status === "done" && CHECK}
            {stage.status === "active" && (
              <Spinner size="sm" color="white" onDark />
            )}
            {stage.status === "error" && X}
          </div>

          {/* Name + optional sub-progress */}
          <div>
            <div
              style={{
                fontWeight: stage.status === "active" ? 600 : stage.status === "queued" ? 400 : 500,
                color:
                  stage.status === "queued"
                    ? "var(--color-muted)"
                    : stage.status === "active"
                    ? "var(--color-ink)"
                    : "var(--color-ink)",
                fontSize: 13,
              }}
            >
              {stage.name}
            </div>
            {stage.status === "active" && stage.subProgress !== undefined && (
              <div
                style={{
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 11.5,
                  color: "var(--color-subtle)",
                }}
              >
                <ProgressBar value={stage.subProgress} height={3} />
                <span
                  style={{
                    fontFamily: "var(--font-geist-mono, ui-monospace, monospace)",
                    fontSize: 11,
                    flexShrink: 0,
                  }}
                >
                  {Math.round(stage.subProgress)}%
                </span>
              </div>
            )}
          </div>

          {/* Detail */}
          <div
            style={{
              fontSize: 11.5,
              color: "var(--color-muted)",
              fontFamily: "var(--font-geist-mono, ui-monospace, monospace)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {stage.detail}
          </div>
        </div>
      ))}
    </div>
  );
}
