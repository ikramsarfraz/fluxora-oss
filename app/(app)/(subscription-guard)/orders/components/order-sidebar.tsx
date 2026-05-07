"use client";

import { useMemo } from "react";
import Link from "next/link";

import { formatDisplayDate } from "@/lib/utils/date";

import type { SalesOrderDetail } from "@/services/orders";
import type { OrderActionAvailability } from "./order-action-rules";
import { getLineFulfilledQuantity, getLineFulfilledWeight, getLineRemainingQuantity } from "./order-fulfillment-utils";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  ink: "#0c0a09",
  ink2: "#44403c",
  muted: "#78716c",
  surface: "#ffffff",
  line: "#e7e5e4",
  line2: "#f5f5f4",
  accent: "oklch(48% 0.16 265)",
  accentSoft: "oklch(96% 0.02 265)",
  good: "oklch(58% 0.13 155)",
  info: "oklch(60% 0.15 240)",
  infoSoft: "oklch(96% 0.03 240)",
  radius: "10px",
  radiusSm: "6px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

interface OrderSidebarProps {
  order: SalesOrderDetail;
  actionState: OrderActionAvailability;
  fulfillDrawerOpen: boolean;
  onOpenFulfillDrawer: () => void;
}

export function OrderSidebar({
  order,
  actionState,
  onOpenFulfillDrawer,
}: OrderSidebarProps) {
  const customer = order.customer;
  const lines = order.lines ?? [];
  const invoices = order.invoices ?? [];

  // Fulfillment progress
  const totalExpected = lines.reduce((s, l) => s + l.expectedCases, 0);
  const totalFulfilled = useMemo(
    () => lines.reduce((s, l) => s + getLineFulfilledQuantity(l), 0),
    [lines],
  );
  const totalWeight = useMemo(
    () => lines.reduce((s, l) => s + getLineFulfilledWeight(l), 0),
    [lines],
  );
  const shortShippedCount = lines.filter(l => l.shortShippedAt != null).length;
  const progress = totalExpected > 0 ? Math.round((totalFulfilled / totalExpected) * 100) : 0;

  // Suggested lot (for next step card)
  const suggestedLot = useMemo(() => {
    const openLine = lines.find(l => getLineRemainingQuantity(l) > 0);
    return openLine?.allocations?.[0]?.inventoryItem?.lot ?? null;
  }, [lines]);

  // Lane summary
  const laneText = invoices.length
    ? `${invoices.length} invoice${invoices.length === 1 ? "" : "s"} · closed`
    : actionState.readyToInvoice
      ? "Ready to invoice"
      : order.status === "fulfilled"
        ? "Closed"
        : order.status === "confirmed"
          ? "Ready for warehouse"
          : "Awaiting confirmation";

  // First fulfillment date (for fulfilled card)
  const firstFulfillDate = useMemo(() => {
    for (const line of lines) {
      const f = (line.fulfillments ?? [])[0];
      if (f?.fulfilledAt) return f.fulfilledAt;
    }
    return null;
  }, [lines]);

  const showNextStep = actionState.canStartFulfillment || actionState.canFulfill;

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        position: "sticky",
        top: "76px",
      }}
    >
      {/* Customer card */}
      <SideCard>
        <SideLabel>Customer</SideLabel>
        <dl style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "8px 10px", fontSize: "13px" }}>
          <dt style={{ color: C.muted }}>Name</dt>
          <dd style={{ margin: 0, color: C.ink, fontWeight: 500 }}>
            {customer ? (
              <Link
                href={`/customers/${customer.id}`}
                style={{ color: C.accent, textDecoration: "none" }}
              >
                {customer.name}
              </Link>
            ) : (
              <span style={{ color: C.muted }}>—</span>
            )}
          </dd>

          {customer?.phoneNumber && (
            <>
              <dt style={{ color: C.muted }}>Phone</dt>
              <dd style={{ margin: 0, color: C.ink, fontWeight: 500, fontFamily: C.mono }}>
                {customer.phoneNumber}
              </dd>
            </>
          )}

          <dt style={{ color: C.muted }}>Fuel</dt>
          <dd style={{ margin: 0, color: C.ink, fontWeight: 500 }}>
            {order.addFuelSurcharge ? "Surcharge applied" : "No surcharge"}
          </dd>
        </dl>
      </SideCard>

      {/* Schedule card */}
      <SideCard>
        <SideLabel>Schedule</SideLabel>
        <dl style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "8px 10px", fontSize: "13px" }}>
          <dt style={{ color: C.muted }}>Order date</dt>
          <dd style={{ margin: 0, color: C.ink, fontWeight: 500 }}>
            {order.orderDate ? formatDisplayDate(order.orderDate) : "—"}
          </dd>

          <dt style={{ color: C.muted }}>Due date</dt>
          <dd style={{ margin: 0, color: C.ink, fontWeight: 500 }}>
            {order.dueDate ? formatDisplayDate(order.dueDate) : "—"}
          </dd>

          <dt style={{ color: C.muted }}>Lane</dt>
          <dd style={{ margin: 0, color: C.ink, fontWeight: 500 }}>{laneText}</dd>
        </dl>
      </SideCard>

      {/* Fulfillment or Next Step card */}
      {showNextStep ? (
        /* ── Next step card (awaiting fulfillment) ── */
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.info}`,
            borderRadius: C.radius,
            padding: "16px 18px",
            boxShadow: `0 0 0 3px ${C.infoSoft}`,
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: C.info,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            Next step
          </div>

          <div
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: C.ink,
              marginBottom: "10px",
            }}
          >
            Fulfill from inventory
          </div>

          {/* Progress bar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
            <div
              style={{
                height: "6px",
                borderRadius: "100px",
                background: C.line2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: C.info,
                  borderRadius: "100px",
                  width: `${progress}%`,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                color: C.muted,
              }}
            >
              <span>
                <b style={{ color: C.ink }}>{totalFulfilled}</b> of {totalExpected} cases captured
              </span>
              <span>{progress}%</span>
            </div>
          </div>

          {/* CTA button */}
          <button
            type="button"
            onClick={onOpenFulfillDrawer}
            style={{
              width: "100%",
              padding: "9px 14px",
              borderRadius: C.radiusSm,
              border: `1px solid ${C.ink}`,
              background: C.ink,
              color: C.surface,
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Record fulfillment
          </button>

          {/* Suggested lot */}
          {suggestedLot && (
            <div
              style={{
                fontSize: "12px",
                color: C.muted,
                marginTop: "10px",
                paddingTop: "10px",
                borderTop: `1px solid ${C.line2}`,
              }}
            >
              Suggested lot{" "}
              <span style={{ fontFamily: C.mono, color: C.ink2 }}>
                {suggestedLot.lotNumber}
              </span>
              {suggestedLot.expirationDate && (
                <> · expires {formatDisplayDate(suggestedLot.expirationDate)}</>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── Fulfillment progress card (fulfilled / invoiced) ── */
        <SideCard>
          <SideLabel>Fulfillment</SideLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                height: "6px",
                borderRadius: "100px",
                background: C.line2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: C.good,
                  borderRadius: "100px",
                  width: `${progress}%`,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                color: C.muted,
              }}
            >
              <span>
                <b style={{ color: C.ink }}>{totalFulfilled}</b> of {totalExpected} cases
              </span>
              <span>{progress}%</span>
            </div>
          </div>

          {(firstFulfillDate || totalWeight > 0 || shortShippedCount > 0) && (
            <div
              style={{
                fontSize: "12px",
                color: C.muted,
                marginTop: "10px",
                paddingTop: "10px",
                borderTop: `1px solid ${C.line2}`,
              }}
            >
              {firstFulfillDate && <>Fulfilled {formatDisplayDate(firstFulfillDate)}</>}
              {totalWeight > 0 && (
                <>{firstFulfillDate ? " · " : ""}{totalWeight.toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs captured</>
              )}
              {shortShippedCount > 0 && <> · {shortShippedCount} short-shipped</>}
              {!firstFulfillDate && totalWeight === 0 && shortShippedCount === 0 && "No fulfillment recorded"}
            </div>
          )}
        </SideCard>
      )}
    </aside>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SideCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.line}`,
        borderRadius: C.radius,
        padding: "16px 18px",
      }}
    >
      {children}
    </div>
  );
}

function SideLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "12px",
        fontWeight: 600,
        color: C.muted,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        marginBottom: "12px",
      }}
    >
      {children}
    </div>
  );
}
