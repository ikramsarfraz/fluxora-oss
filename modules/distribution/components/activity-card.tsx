"use client";

import { useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import type { ActivityTimelineItem } from "@/modules/distribution/services/audit";

// Compact activity card shared by the order-detail and supplier-invoice
// detail surfaces — preview the most recent N events with an expand-to-
// full toggle. Each domain page wraps its own hook (e.g. useSalesOrderActivity
// or useSupplierInvoiceActivity) and passes the result down here.

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

type ActivityScope = ActivityTimelineItem["scope"];

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

export interface ActivityCardProps {
  items: ActivityTimelineItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function ActivityCard({ items, isLoading, isError }: ActivityCardProps) {
  const [showAll, setShowAll] = useState(false);
  const list = items ?? [];

  const visible = useMemo(
    () => (showAll ? list : list.slice(0, PREVIEW_COUNT)),
    [list, showAll],
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
        {list.length > 0 && (
          <div style={{ fontSize: "12px", color: C.muted }}>
            {list.length} event{list.length === 1 ? "" : "s"}
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
      ) : list.length === 0 ? (
        <div style={{ padding: "20px", fontSize: "13px", color: C.muted }}>
          No activity recorded yet.
        </div>
      ) : (
        <div style={{ padding: "6px 20px 8px" }}>
          {visible.map((item, i) => {
            const dotColor = SCOPE_DOT[item.scope] ?? C.line;
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
        {!showAll && list.length > PREVIEW_COUNT ? (
          <Button
            type="button"
            onClick={() => setShowAll(true)}
            variant="link"
            className="h-auto p-0 text-[13px] font-medium text-primary"
          >
            View full audit log ({list.length - PREVIEW_COUNT} more)
          </Button>
        ) : list.length > PREVIEW_COUNT ? (
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
