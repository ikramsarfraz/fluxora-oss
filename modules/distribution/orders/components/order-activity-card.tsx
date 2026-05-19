"use client";

import { useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { useSalesOrderActivity } from "@/modules/distribution/hooks/use-activity";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  ink: "var(--color-ink)",
  ink2: "var(--color-ink-warm)",
  muted: "var(--color-subtle)",
  surface: "var(--color-card)",
  line: "var(--color-border-default)",
  line2: "var(--color-divider)",
  accent: "var(--color-forest-mid)",
  good: "var(--color-success-fg)",
  warn: "var(--color-warning-fg)",
  info: "var(--color-info-fg)",
  radius: "10px",
} as const;

type ActivityScope = "order" | "line" | "allocation" | "invoice" | "payment" | "file" | "other";

const SCOPE_DOT: Record<ActivityScope, string> = {
  payment: C.good,
  invoice: C.accent,
  order: C.accent,
  allocation: C.warn,
  file: C.info,
  line: C.muted,
  other: C.line,
};

const PREVIEW_COUNT = 4;

export function OrderActivityCard({ orderId }: { orderId: string }) {
  const { data, isLoading, isError } = useSalesOrderActivity(orderId);
  const [showAll, setShowAll] = useState(false);

  const items = data ?? [];

  const visible = useMemo(
    () => (showAll ? items : items.slice(0, PREVIEW_COUNT)),
    [items, showAll],
  );

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.line}`,
        borderRadius: C.radius,
      }}
    >
      {/* Card header */}
      <div
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${C.line2}`,
        }}
      >
        <div
          style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "-0.005em", color: C.ink }}
        >
          Activity
        </div>
        {items.length > 0 && (
          <div style={{ fontSize: "12px", color: C.muted }}>
            {items.length} event{items.length === 1 ? "" : "s"}
          </div>
        )}
      </div>

      {/* Event list */}
      {isLoading ? (
        <div style={{ padding: "20px", fontSize: "13px", color: C.muted }}>
          Loading activity…
        </div>
      ) : isError ? (
        <div style={{ padding: "20px", fontSize: "13px", color: "var(--color-danger-fg)" }}>
          Failed to load activity.
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: "20px", fontSize: "13px", color: C.muted }}>
          No activity recorded yet.
        </div>
      ) : (
        <div style={{ padding: "6px 20px 8px" }}>
          {visible.map((item, i) => {
            const dotColor = SCOPE_DOT[item.scope as ActivityScope] ?? C.line;
            const date = new Date(item.at);
            const actorName =
              item.actor.name ??
              (item.actor.type === "system" ? "System" : (item.actor.email ?? "Unknown"));

            return (
              <div
                key={item.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "18px 1fr auto",
                  gap: "12px",
                  padding: "12px 0",
                  borderBottom:
                    i < visible.length - 1 ? `1px solid ${C.line2}` : undefined,
                  alignItems: "start",
                }}
              >
                {/* Dot */}
                <div style={{ paddingTop: "5px" }}>
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: dotColor,
                      marginLeft: "5px",
                    }}
                  />
                </div>

                {/* Text */}
                <div>
                  <div style={{ fontSize: "13px", color: C.ink2 }}>
                    <b style={{ color: C.ink, fontWeight: 500 }}>{item.summary}</b>
                  </div>
                  <div style={{ fontSize: "12px", color: C.muted, marginTop: "2px" }}>
                    {actorName}
                  </div>
                </div>

                {/* Time */}
                <div
                  style={{
                    fontSize: "12px",
                    color: C.muted,
                    whiteSpace: "nowrap",
                    paddingTop: "1px",
                  }}
                  title={formatDistanceToNow(date, { addSuffix: true })}
                >
                  {format(date, "h:mm a")}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          padding: "12px 20px",
          borderTop: `1px solid ${C.line2}`,
        }}
      >
        {!showAll && items.length > PREVIEW_COUNT ? (
          <Button
            type="button"
            onClick={() => setShowAll(true)}
            variant="link"
            className="h-auto p-0 text-[13px] font-medium text-primary"
          >
            View full audit log ({items.length - PREVIEW_COUNT} more)
          </Button>
        ) : items.length > PREVIEW_COUNT ? (
          <Button
            type="button"
            onClick={() => setShowAll(false)}
            variant="link"
            className="h-auto p-0 text-[13px] font-medium text-primary"
          >
            Show less
          </Button>
        ) : (
          <span style={{ fontSize: "13px", color: C.muted }}>Full audit log</span>
        )}
      </div>
    </div>
  );
}
