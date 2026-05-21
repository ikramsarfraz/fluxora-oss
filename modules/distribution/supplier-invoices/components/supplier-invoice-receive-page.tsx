"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MobileReceiveFlow } from "./mobile-receive-flow";
import { toast } from "sonner";
import { ReceivingFirstReceiptBanner } from "@/modules/distribution/components/empty-states";
import { CheckCircle2, AlertTriangle, Package, ArrowLeft } from "lucide-react";

import { useSupplierInvoice, useCompleteSupplierInvoice } from "../hooks/use-supplier-invoices";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
import { PageError } from "@/components/page-error";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  bg: "var(--color-surface)",
  surface: "var(--color-card)",
  surfaceAlt: "var(--color-divider)",
  ink: "var(--color-ink)",
  ink2: "var(--color-subtle)",
  muted: "var(--color-subtle)",
  mutedSoft: "var(--color-muted)",
  line: "var(--color-border-default)",
  lineStrong: "var(--color-border-default)",
  good: "var(--color-success-fg)",
  goodBg: "oklch(97% 0.02 155)",
  goodBorder: "oklch(88% 0.07 155)",
  warn: "var(--color-warning-fg)",
  warnBg: "var(--color-warning-bg)",
  warnBorder: "var(--color-warning-border)",
  error: "var(--color-danger-fg)",
  errorBg: "var(--color-danger-bg)",
  errorBorder: "var(--color-danger-border)",
  accent: "var(--color-ink)",
  mono: "var(--font-mono)",
} as const;

// ── Types ──────────────────────────────────────────────────────────────────
type ReceiveState = {
  received: boolean;
  discrepancy: "none" | "short" | "damaged" | "over";
  note: string;
};

// ── Progress strip ────────────────────────────────────────────────────────
function ProgressStrip({
  confirmed,
  discrepancy,
  pending,
  total,
}: {
  confirmed: number;
  discrepancy: number;
  pending: number;
  total: number;
}) {
  if (total === 0) return null;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;

  return (
    <div
      style={{
        display: "flex",
        height: 8,
        borderRadius: 99,
        overflow: "hidden",
        background: C.line,
        marginBottom: 8,
      }}
    >
      {confirmed > 0 && (
        <div
          style={{
            width: pct(confirmed),
            background: C.good,
            transition: "width 0.3s",
          }}
        />
      )}
      {discrepancy > 0 && (
        <div
          style={{
            width: pct(discrepancy),
            background: C.warn,
            transition: "width 0.3s",
          }}
        />
      )}
      {pending > 0 && (
        <div
          style={{
            width: pct(pending),
            background: C.line,
            transition: "width 0.3s",
          }}
        />
      )}
    </div>
  );
}

// ── Receive card ──────────────────────────────────────────────────────────
function ReceiveCard({
  line,
  state,
  onChange,
}: {
  line: {
    id: string;
    productName: string;
    sku?: string;
    quantityCases: number;
    weightLbs: string;
    unitPrice: string;
    unitType: "catch_weight" | "fixed_case";
  };
  state: ReceiveState;
  onChange: (state: ReceiveState) => void;
}) {
  const lineTotal =
    line.unitType === "catch_weight"
      ? Number(line.weightLbs) * Number(line.unitPrice)
      : line.quantityCases * Number(line.unitPrice);

  const borderColor = state.received
    ? state.discrepancy !== "none"
      ? C.warnBorder
      : C.goodBorder
    : C.line;
  const bgColor = state.received
    ? state.discrepancy !== "none"
      ? C.warnBg
      : C.goodBg
    : C.surface;

  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        background: bgColor,
        overflow: "hidden",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "36px 1fr auto auto auto",
          gap: 12,
          padding: "12px 16px",
          alignItems: "center",
        }}
      >
        {/* Status indicator */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          {state.received ? (
            state.discrepancy !== "none" ? (
              <AlertTriangle style={{ width: 20, height: 20, color: C.warn }} />
            ) : (
              <CheckCircle2 style={{ width: 20, height: 20, color: C.good }} />
            )
          ) : (
            <Package style={{ width: 20, height: 20, color: C.mutedSoft }} />
          )}
        </div>

        {/* Product info */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{line.productName}</div>
          {line.sku && (
            <div style={{ fontSize: 11, color: C.mutedSoft, fontFamily: C.mono, marginTop: 1 }}>
              {line.sku}
            </div>
          )}
        </div>

        {/* Cases */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: C.mutedSoft, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Cases</div>
          <div style={{ fontSize: 15, fontWeight: 600, fontFamily: C.mono, color: C.ink }}>{line.quantityCases}</div>
        </div>

        {/* Weight / unit */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: C.mutedSoft, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {line.unitType === "catch_weight" ? "Weight" : "Unit price"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, fontFamily: C.mono, color: C.ink }}>
            {line.unitType === "catch_weight"
              ? `${Number(line.weightLbs).toFixed(1)} lb`
              : formatMoney(Number(line.unitPrice))}
          </div>
        </div>

        {/* Total */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: C.mutedSoft, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total</div>
          <div style={{ fontSize: 15, fontWeight: 600, fontFamily: C.mono, color: C.ink }}>{formatMoney(lineTotal)}</div>
        </div>
      </div>

      {/* Action row */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "10px 16px",
          borderTop: `1px solid ${borderColor}`,
          background: state.received ? "transparent" : C.surfaceAlt,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {!state.received ? (
          <>
            <button
              type="button"
              onClick={() => onChange({ ...state, received: true, discrepancy: "none" })}
              style={{
                padding: "6px 14px",
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                background: C.ink,
                color: "var(--color-card)",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Confirm received
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...state, received: true, discrepancy: "short" })}
              style={{
                padding: "6px 14px",
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 500,
                background: "transparent",
                color: C.warn,
                border: `1px solid ${C.warnBorder}`,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Short / missing
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...state, received: true, discrepancy: "damaged" })}
              style={{
                padding: "6px 14px",
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 500,
                background: "transparent",
                color: C.error,
                border: `1px solid ${C.errorBorder}`,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Damaged
            </button>
          </>
        ) : (
          <>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: state.discrepancy !== "none" ? C.warn : C.good,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {state.discrepancy === "none"
                ? "Confirmed"
                : state.discrepancy === "short"
                  ? "Short / missing"
                  : state.discrepancy === "damaged"
                    ? "Damaged"
                    : "Over-received"}
            </span>
            {state.discrepancy !== "none" && (
              <input
                type="text"
                value={state.note}
                onChange={e => onChange({ ...state, note: e.target.value })}
                placeholder="Add note (qty received, reason)…"
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: "5px 10px",
                  fontSize: 12,
                  border: `1px solid ${C.line}`,
                  borderRadius: 6,
                  background: C.surface,
                  color: C.ink,
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
            )}
            <button
              type="button"
              onClick={() => onChange({ received: false, discrepancy: "none", note: "" })}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 500,
                background: "transparent",
                color: C.mutedSoft,
                border: `1px solid ${C.line}`,
                cursor: "pointer",
                fontFamily: "inherit",
                marginLeft: "auto",
              }}
            >
              Undo
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function SupplierInvoiceReceivePage({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const { data: invoice, isLoading, error } = useSupplierInvoice(invoiceId);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  if (isMobile) return <MobileReceiveFlow invoiceId={invoiceId} />;
  const completeMutation = useCompleteSupplierInvoice();

  const [lineStates, setLineStates] = useState<Record<string, ReceiveState>>({});

  if (isLoading) return <DetailPageSkeleton includeTable />;
  if (error || !invoice) {
    return <PageError message={error ? (error as Error).message : "Bill not found."} />;
  }

  const lines = invoice.lines.map(line => ({
    id: line.id,
    productName: line.product?.name ?? "Unknown product",
    sku: line.product?.sku ?? undefined,
    quantityCases: line.quantityCases ?? 0,
    weightLbs: String(line.weightLbs ?? "0"),
    unitPrice: String(line.unitPrice ?? "0"),
    unitType: line.unitType,
  }));

  const total = lines.length;
  const confirmedCount = Object.values(lineStates).filter(
    s => s.received && s.discrepancy === "none",
  ).length;
  const discrepancyCount = Object.values(lineStates).filter(
    s => s.received && s.discrepancy !== "none",
  ).length;
  const pendingCount = total - confirmedCount - discrepancyCount;
  const allActioned = pendingCount === 0;
  const hasDiscrepancies = discrepancyCount > 0;

  function setLineState(lineId: string, state: ReceiveState) {
    setLineStates(prev => ({ ...prev, [lineId]: state }));
  }

  async function handleComplete() {
    try {
      await completeMutation.mutateAsync({
        id: invoiceId,
        lineOverrides: lines.map(line => ({
          lineId: line.id,
          lotNumberOverride: null,
          expirationDateOverride: null,
        })),
      });
      toast.success("Bill received. Lots and inventory created.");
      router.push(`/supplier-invoices/${invoiceId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not complete receipt.");
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => router.push(`/supplier-invoices/${invoiceId}`)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: C.muted,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontFamily: "inherit",
            marginBottom: 16,
          }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          Back to bill
        </button>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.ink, margin: 0, fontFamily: C.mono }}>
            Receive: {invoice.invoiceNumber}
          </h1>
          <span style={{ fontSize: 14, color: C.muted }}>
            {invoice.supplier?.name} · {formatDisplayDate(invoice.receiveDate)}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
            {confirmedCount + discrepancyCount} / {total} lines actioned
          </span>
          <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
            <span style={{ color: C.good, fontWeight: 600 }}>{confirmedCount} confirmed</span>
            {discrepancyCount > 0 && (
              <span style={{ color: C.warn, fontWeight: 600 }}>{discrepancyCount} discrepancy</span>
            )}
            {pendingCount > 0 && (
              <span style={{ color: C.mutedSoft }}>{pendingCount} pending</span>
            )}
          </div>
        </div>
        <ProgressStrip
          confirmed={confirmedCount}
          discrepancy={discrepancyCount}
          pending={pendingCount}
          total={total}
        />
      </div>

      {/* Discrepancy banner */}
      {hasDiscrepancies && (
        <div
          style={{
            padding: "10px 16px",
            background: C.warnBg,
            border: `1px solid ${C.warnBorder}`,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
            color: C.warn,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 500,
          }}
        >
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
          {discrepancyCount} line{discrepancyCount !== 1 ? "s" : ""} with discrepancies — add notes before completing.
        </div>
      )}

      {/* First receipt banner — shown when this is the supplier's first invoice */}
      {invoice.status === "receiving" && total > 0 && (
        <ReceivingFirstReceiptBanner productName={lines[0]?.productName ?? "these products"} />
      )}

      {/* Line cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {lines.map(line => (
          <ReceiveCard
            key={line.id}
            line={line}
            state={lineStates[line.id] ?? { received: false, discrepancy: "none", note: "" }}
            onChange={state => setLineState(line.id, state)}
          />
        ))}
      </div>

      {/* Footer action */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: C.surface,
          borderTop: `1px solid ${C.line}`,
          padding: "14px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          zIndex: 10,
        }}
      >
        <div style={{ fontSize: 13, color: C.muted }}>
          {!allActioned
            ? `${pendingCount} line${pendingCount !== 1 ? "s" : ""} still pending`
            : hasDiscrepancies
              ? "Discrepancies noted — review before completing."
              : "All lines confirmed"}
        </div>
        <button
          type="button"
          onClick={handleComplete}
          disabled={completeMutation.isPending || (!allActioned && !hasDiscrepancies)}
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            background: allActioned ? C.ink : C.lineStrong,
            color: allActioned ? "var(--color-card)" : C.mutedSoft,
            border: "none",
            cursor: allActioned && !completeMutation.isPending ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            transition: "background 0.15s",
          }}
        >
          {completeMutation.isPending ? "Processing…" : "Complete receipt"}
        </button>
      </div>
    </div>
  );
}
