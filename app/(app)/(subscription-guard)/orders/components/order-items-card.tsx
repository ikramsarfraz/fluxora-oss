"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  useGenerateInvoiceForSalesOrder,
  useRecordSalesOrderFulfillment,
  useMarkSalesOrderLineShortShipped,
} from "@/hooks/use-orders";

import type { SalesOrderDetail } from "@/services/orders";
import type { OrderActionAvailability } from "./order-action-rules";
import {
  getLineFulfillmentState,
  getLineFulfilledQuantity,
  getLineFulfilledWeight,
  getLineFulfillmentRecords,
  getLineRemainingQuantity,
} from "./order-fulfillment-utils";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  ink: "#0c0a09",
  ink2: "#44403c",
  muted: "#78716c",
  surface: "#ffffff",
  line: "#e7e5e4",
  line2: "#f5f5f4",
  good: "oklch(58% 0.13 155)",
  warn: "oklch(70% 0.13 70)",
  info: "oklch(60% 0.15 240)",
  infoSoft: "oklch(96% 0.03 240)",
  radius: "10px",
  radiusSm: "6px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

type Line = SalesOrderDetail["lines"][number];

// ── Pricing helpers (mirror order-lines-table.tsx logic) ───────────────────
function getLinePricingUnitType(line: Line): "per_lb" | "per_case" {
  if (line.pricingUnitTypeSnapshot) return line.pricingUnitTypeSnapshot;
  return line.unitType === "fixed_case" ? "per_case" : "per_lb";
}

function getLinePricePerUnit(line: Line): number {
  if (line.pricePerUnitSnapshot) {
    const p = parseFloat(line.pricePerUnitSnapshot);
    if (Number.isFinite(p)) return p;
  }
  if (line.pricePerLbOverride) {
    const p = parseFloat(line.pricePerLbOverride);
    if (!Number.isFinite(p)) return NaN;
    if (getLinePricingUnitType(line) === "per_case") {
      const conv = parseFloat(
        line.pricingConversionSnapshot ?? line.conversionToBaseSnapshot ?? "",
      );
      return Number.isFinite(conv) && conv > 0 ? p * conv : p;
    }
    return p;
  }
  return NaN;
}

function computeLineTotal(line: Line): number | null {
  const price = getLinePricePerUnit(line);
  if (!Number.isFinite(price)) return null;
  if (getLinePricingUnitType(line) === "per_case") {
    const cases = getLineFulfilledQuantity(line) || line.expectedCases;
    if (!Number.isFinite(cases) || cases <= 0) return null;
    return price * cases;
  }
  const weight = getLineFulfilledWeight(line);
  if (!Number.isFinite(weight)) return null;
  return price * weight;
}

function formatUnit(line: Line): string {
  if (line.salesUnitAbbreviationSnapshot) return line.salesUnitAbbreviationSnapshot;
  if (line.salesUnitNameSnapshot) return line.salesUnitNameSnapshot;
  if (!line.salesUnit) return "cs";
  return line.salesUnit.abbreviation || line.salesUnit.name;
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface OrderItemsCardProps {
  order: SalesOrderDetail;
  actionState: OrderActionAvailability;
  fulfillDrawerOpen: boolean;
  onOpenFulfillDrawer: () => void;
  onCloseFulfillDrawer: () => void;
}

export function OrderItemsCard({
  order,
  actionState,
  fulfillDrawerOpen,
  onCloseFulfillDrawer,
}: OrderItemsCardProps) {
  const lines = order.lines ?? [];
  const invoices = order.invoices ?? [];
  const hasInvoice = invoices.length > 0;

  // ── Totals ─────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    if (hasInvoice) {
      let subtotal = 0;
      let fuelSurcharge = 0;
      let total = 0;
      let amountPaid = 0;
      let balanceDue = 0;
      for (const inv of invoices) {
        subtotal += parseFloat(inv.subtotal ?? "0") || 0;
        fuelSurcharge += parseFloat(inv.fuelSurchargeAmount ?? "0") || 0;
        total += parseFloat(inv.totalAmount ?? "0") || 0;
        amountPaid += parseFloat(inv.amountPaid ?? "0") || 0;
        balanceDue += parseFloat(inv.balanceDue ?? "0") || 0;
      }
      return { mode: "actual" as const, subtotal, fuelSurcharge, total, amountPaid, balanceDue };
    } else {
      let subtotal = 0;
      for (const line of lines) {
        const lt = computeLineTotal(line);
        if (lt != null && lt > 0) subtotal += lt;
      }
      const customerSurcharge =
        order.customer?.fuelSurchargeAmount
          ? parseFloat(order.customer.fuelSurchargeAmount) || 0
          : 0;
      const fuelSurcharge = order.addFuelSurcharge ? customerSurcharge : 0;
      return { mode: "estimate" as const, subtotal, fuelSurcharge, total: subtotal + fuelSurcharge };
    }
  }, [hasInvoice, invoices, lines, order]);

  // ── Card header summary ────────────────────────────────────────────────
  const totalCases = lines.reduce((s, l) => s + l.expectedCases, 0);
  const totalWeight = lines.reduce((s, l) => s + getLineFulfilledWeight(l), 0);
  const headerParts: string[] = [
    `${lines.length} product${lines.length === 1 ? "" : "s"}`,
    `${totalCases} case${totalCases === 1 ? "" : "s"}`,
  ];
  if (totalWeight > 0)
    headerParts.push(
      `${totalWeight.toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs`,
    );

  // Sorted payments for totals display
  const allPayments = useMemo(
    () =>
      invoices
        .flatMap(inv => inv.payments ?? [])
        .sort(
          (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime(),
        ),
    [invoices],
  );

  const awaitingFulfillment = actionState.canStartFulfillment || actionState.canFulfill;

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
        <div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "-0.005em",
              color: C.ink,
            }}
          >
            Items
          </div>
          <div style={{ fontSize: "12px", color: C.muted }}>{headerParts.join(" · ")}</div>
        </div>
      </div>

      {/* Line rows */}
      <div>
        {lines.map(line => (
          <LineRow
            key={line.id}
            line={line}
            awaitingFulfillment={awaitingFulfillment && !hasInvoice}
          />
        ))}
      </div>

      {/* Inline fulfillment drawer */}
      {fulfillDrawerOpen && (
        <InlineFulfillDrawer
          order={order}
          actionState={actionState}
          onClose={onCloseFulfillDrawer}
        />
      )}

      {/* Totals block */}
      <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.line}` }}>
        <TotalsRow label="Subtotal" value={formatMoney(totals.subtotal)} />
        {totals.fuelSurcharge > 0 && (
          <TotalsRow
            label={`Fuel surcharge${totals.mode === "estimate" ? " (estimate)" : ""}`}
            value={formatMoney(totals.fuelSurcharge)}
          />
        )}
        <TotalsRow
          label={totals.mode === "estimate" ? "Estimated total" : "Total"}
          value={formatMoney(totals.total)}
          grand
        />
        {totals.mode === "estimate" && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "4px 0",
              fontSize: "13px",
              color: C.muted,
              fontStyle: "italic",
            }}
          >
            <span>Invoice generated on fulfillment</span>
          </div>
        )}
        {totals.mode === "actual" &&
          allPayments.map((p, i) => (
            <div
              key={p.id ?? i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "4px 0",
                fontSize: "13px",
                color: C.good,
              }}
            >
              <span>
                Paid ·{" "}
                {p.paymentMethod === "ach"
                  ? "ACH"
                  : p.paymentMethod === "check"
                    ? "Check"
                    : p.paymentMethod === "credit_card"
                      ? "Card"
                      : p.paymentMethod === "zelle"
                        ? "Zelle"
                        : (p.paymentMethod?.replaceAll("_", " ") ?? "Payment")}{" "}
                · {formatDisplayDate(p.paymentDate)}
              </span>
              <span style={{ fontFamily: C.mono, fontFeatureSettings: "'tnum' 1" }}>
                −{formatMoney(parseFloat(p.amount))}
              </span>
            </div>
          ))}
        {totals.mode === "actual" && (
          <TotalsRow
            label="Balance due"
            value={formatMoney(totals.balanceDue)}
            grand
            valueColor={totals.balanceDue <= 0 ? C.good : C.warn}
          />
        )}
      </div>
    </div>
  );
}

// ── TotalsRow ──────────────────────────────────────────────────────────────

function TotalsRow({
  label,
  value,
  grand,
  valueColor,
}: {
  label: string;
  value: string;
  grand?: boolean;
  valueColor?: string;
}) {
  if (grand) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "10px 0 4px",
          marginTop: "6px",
          borderTop: `1px solid ${C.line2}`,
          fontSize: "16px",
          fontWeight: 600,
          color: valueColor ?? C.ink,
        }}
      >
        <span style={{ color: C.ink }}>{label}</span>
        <span style={{ fontFamily: C.mono, fontFeatureSettings: "'tnum' 1", color: valueColor ?? C.ink }}>
          {value}
        </span>
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "4px 0",
        fontSize: "13px",
        color: C.ink2,
      }}
    >
      <span>{label}</span>
      <span style={{ fontFamily: C.mono, fontFeatureSettings: "'tnum' 1" }}>{value}</span>
    </div>
  );
}

// ── LineRow ────────────────────────────────────────────────────────────────

function LineRow({
  line,
  awaitingFulfillment,
}: {
  line: Line;
  awaitingFulfillment: boolean;
}) {
  const price = getLinePricePerUnit(line);
  const pricingUnit = getLinePricingUnitType(line);
  const total = computeLineTotal(line);
  const unit = formatUnit(line);
  const fulfillState = getLineFulfillmentState(line);
  const fulfillments = getLineFulfillmentRecords(line);
  const firstFulfillment = fulfillments?.[0];
  const suggestedLot = line.allocations?.[0]?.inventoryItem?.lot?.lotNumber;
  const lotExpiry =
    firstFulfillment?.lot?.expirationDate ??
    line.allocations?.[0]?.inventoryItem?.lot?.expirationDate;

  const showToFulfillTag = awaitingFulfillment && fulfillState === "not_started";
  const hasDetail = firstFulfillment != null || suggestedLot != null;

  return (
    <div>
      {/* Product row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto auto",
          gap: "18px",
          alignItems: "center",
          padding: "14px 20px",
          borderBottom: hasDetail ? `1px solid ${C.line2}` : undefined,
        }}
      >
        {/* Product info */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background:
                "repeating-linear-gradient(135deg, #f5f5f4 0 6px, #ebeae8 6px 12px)",
              border: `1px solid ${C.line}`,
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 500,
                fontSize: "14px",
                color: C.ink,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                flexWrap: "wrap",
              }}
            >
              {line.product ? (
                <Link
                  href={`/products/${line.product.id}`}
                  style={{ color: C.ink, textDecoration: "none" }}
                >
                  {line.product.name}
                </Link>
              ) : (
                "—"
              )}
              {showToFulfillTag && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 7px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 500,
                    background: C.infoSoft,
                    color: C.info,
                  }}
                >
                  to fulfill
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: C.muted,
                fontFamily: C.mono,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {line.product?.sku ?? ""}
              {line.unitType === "fixed_case" ? " · Fixed case" : " · Catch weight"}
              {awaitingFulfillment && suggestedLot ? ` · suggest lot ${suggestedLot}` : ""}
            </div>
          </div>
        </div>

        {/* Qty */}
        <div
          style={{
            fontSize: "13px",
            color: C.ink2,
            textAlign: "right",
            minWidth: "80px",
          }}
        >
          <b
            style={{
              color: C.ink,
              fontWeight: 500,
              fontFamily: C.mono,
              fontFeatureSettings: "'tnum' 1",
            }}
          >
            {line.expectedCases}
          </b>{" "}
          {unit}
        </div>

        {/* Unit price */}
        <div
          style={{
            fontSize: "13px",
            color: C.muted,
            textAlign: "right",
            minWidth: "90px",
            fontFamily: C.mono,
            fontFeatureSettings: "'tnum' 1",
          }}
        >
          {Number.isFinite(price)
            ? pricingUnit === "per_lb"
              ? `${formatMoney(price)}/lb`
              : `${formatMoney(price)}/${unit}`
            : "—"}
        </div>

        {/* Line total */}
        <div
          style={{
            fontSize: "14px",
            fontWeight: 500,
            textAlign: "right",
            minWidth: "90px",
            fontFamily: C.mono,
            fontFeatureSettings: "'tnum' 1",
            color: C.ink,
          }}
        >
          {total != null ? formatMoney(total) : "—"}
        </div>
      </div>

      {/* Lot & fulfillment detail <details> */}
      {hasDetail && <LotDisclosure line={line} firstFulfillment={firstFulfillment} lotExpiry={lotExpiry} />}
    </div>
  );
}

// ── LotDisclosure ──────────────────────────────────────────────────────────

type FulfillmentRecord = NonNullable<ReturnType<typeof getLineFulfillmentRecords>>[number];

function LotDisclosure({
  line,
  firstFulfillment,
  lotExpiry,
}: {
  line: Line;
  firstFulfillment: FulfillmentRecord | undefined;
  lotExpiry: string | Date | null | undefined;
}) {
  return (
    <details style={{ borderBottom: `1px solid ${C.line2}` }}>
      <summary
        style={{
          listStyle: "none",
          WebkitAppearance: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12px",
          color: C.muted,
          padding: "10px 20px",
          userSelect: "none",
        }}
      >
        <ChevronIcon />
        Lot &amp; fulfillment detail
      </summary>
      <div style={{ padding: "0 20px 16px", fontSize: "13px", color: C.ink2 }}>
        {(firstFulfillment?.lot?.lotNumber ??
          line.allocations?.[0]?.inventoryItem?.lot?.lotNumber) && (
          <DisclosureRow borderBottom>
            <span>Lot</span>
            <span>
              <span
                style={{
                  display: "inline-flex",
                  padding: "2px 7px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: 500,
                  background: C.line2,
                  color: C.ink2,
                  fontFamily: C.mono,
                }}
              >
                {firstFulfillment?.lot?.lotNumber ??
                  line.allocations?.[0]?.inventoryItem?.lot?.lotNumber}
              </span>
              {lotExpiry && (
                <span style={{ color: C.warn, marginLeft: "8px" }}>
                  expires {formatDisplayDate(lotExpiry)}
                </span>
              )}
            </span>
          </DisclosureRow>
        )}
        {firstFulfillment && (
          <DisclosureRow borderBottom={!!firstFulfillment.fulfilledBy?.fullName}>
            <span>Fulfilled</span>
            <span style={{ fontFamily: C.mono, fontFeatureSettings: "'tnum' 1" }}>
              {firstFulfillment.quantityFulfilled} cases
              {firstFulfillment.weightLbs
                ? ` · ${Number(firstFulfillment.weightLbs).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs`
                : ""}
              {firstFulfillment.fulfilledAt
                ? ` · ${formatDisplayDate(firstFulfillment.fulfilledAt)}`
                : ""}
            </span>
          </DisclosureRow>
        )}
        {firstFulfillment?.fulfilledBy?.fullName && (
          <DisclosureRow>
            <span>Recorded by</span>
            <span>{firstFulfillment.fulfilledBy.fullName}</span>
          </DisclosureRow>
        )}
      </div>
    </details>
  );
}

function DisclosureRow({
  children,
  borderBottom,
}: {
  children: React.ReactNode;
  borderBottom?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        borderBottom: borderBottom ? `1px dashed ${C.line2}` : undefined,
      }}
    >
      {children}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      style={{ flexShrink: 0 }}
    >
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

// ── InlineFulfillDrawer ────────────────────────────────────────────────────

interface InlineFulfillDrawerProps {
  order: SalesOrderDetail;
  actionState: OrderActionAvailability;
  onClose: () => void;
}

function InlineFulfillDrawer({ order, actionState, onClose }: InlineFulfillDrawerProps) {
  const lines = order.lines ?? [];
  const openLines = useMemo(
    () => lines.filter(l => getLineRemainingQuantity(l) > 0),
    [lines],
  );

  const createFulfillment = useRecordSalesOrderFulfillment();
  const markShortShipped = useMarkSalesOrderLineShortShipped();
  const generateInvoice = useGenerateInvoiceForSalesOrder();

  const [selectedLineId, setSelectedLineId] = useState(openLines[0]?.id ?? "");
  const selectedLine = useMemo(
    () => openLines.find(l => l.id === selectedLineId),
    [openLines, selectedLineId],
  );
  const remaining = selectedLine ? getLineRemainingQuantity(selectedLine) : 0;

  const [casesValue, setCasesValue] = useState(String(remaining || ""));
  const [weightValue, setWeightValue] = useState("");
  const [printPackingSlip, setPrintPackingSlip] = useState(false);
  const [generateInvoiceOnSave, setGenerateInvoiceOnSave] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const prevLineRef = useRef(selectedLineId);
  useEffect(() => {
    if (prevLineRef.current !== selectedLineId) {
      prevLineRef.current = selectedLineId;
      setCasesValue(String(remaining));
      setWeightValue("");
    }
  }, [selectedLineId, remaining]);

  const lotOptions = useMemo(() => {
    if (!selectedLine) return [];
    return (selectedLine.allocations ?? [])
      .filter(a => a.inventoryItem?.lot?.lotNumber)
      .map(a => ({
        id: a.inventoryItem!.lot!.lotNumber!,
        lotNumber: a.inventoryItem!.lot!.lotNumber!,
        cases: a.inventoryItem?.cases ?? 1,
        expirationDate: a.inventoryItem?.lot?.expirationDate,
      }));
  }, [selectedLine]);

  const [selectedLotId, setSelectedLotId] = useState(lotOptions[0]?.id ?? "");
  useEffect(() => {
    setSelectedLotId(lotOptions[0]?.id ?? "");
  }, [lotOptions]);

  const isCatchWeight = selectedLine?.unitType === "catch_weight";
  const isSubmitting = createFulfillment.isPending || markShortShipped.isPending;

  async function handleSubmit(isPartial: boolean) {
    setSubmitError(null);
    const qty = isPartial ? parseInt(casesValue, 10) : remaining;
    if (!Number.isInteger(qty) || qty <= 0) {
      setSubmitError("Enter a valid cases count.");
      return;
    }
    if (qty > remaining) {
      setSubmitError(`Cannot exceed ${remaining} remaining cases.`);
      return;
    }
    if (isCatchWeight && !weightValue) {
      setSubmitError("Weight is required for catch-weight products.");
      return;
    }

    try {
      await createFulfillment.mutateAsync({
        salesOrderId: order.id,
        salesOrderLineId: selectedLineId,
        quantityFulfilled: qty,
        weightLbs: weightValue || undefined,
      });
      toast.success("Fulfillment recorded.");

      if (generateInvoiceOnSave) {
        try {
          const invoice = await generateInvoice.mutateAsync({ salesOrderId: order.id });
          toast.success(`Invoice ${invoice?.invoiceNumber ?? ""} generated.`);
        } catch {
          // Order may not be ready to invoice yet; ignore silently
        }
      }

      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not record fulfillment.";
      setSubmitError(msg);
      toast.error(msg);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: `1px solid ${C.line}`,
    borderRadius: C.radiusSm,
    background: C.surface,
    fontSize: "14px",
    fontFamily: C.mono,
    color: C.ink,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 600,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: "6px",
    display: "block",
  };

  if (openLines.length === 0) {
    return (
      <div
        style={{
          borderTop: `1px solid ${C.line}`,
          background: C.line2,
          padding: "18px 20px",
          fontSize: "13px",
          color: C.muted,
        }}
      >
        All lines on this order are already closed.
      </div>
    );
  }

  return (
    <div style={{ borderTop: `1px solid ${C.line}`, background: C.line2 }}>
      {/* Drawer header */}
      <div
        style={{
          padding: "18px 20px 6px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: C.ink }}>
            Record fulfillment
          </div>
          <div style={{ fontSize: "12px", color: C.muted, marginTop: "2px" }}>
            Capture cases, catch-weight, and lot. Saves to inventory and advances the order.
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "5px 9px",
            fontSize: "12px",
            borderRadius: C.radiusSm,
            border: `1px solid ${C.line}`,
            background: C.surface,
            color: C.ink,
            cursor: "pointer",
            fontFamily: "inherit",
            flexShrink: 0,
          }}
        >
          Cancel
        </button>
      </div>

      {/* Line selector — only shown for multi-line orders */}
      {openLines.length > 1 && (
        <div style={{ padding: "6px 20px 0" }}>
          <label style={{ display: "block" }}>
            <span style={labelStyle}>Line</span>
            <select
              value={selectedLineId}
              onChange={e => setSelectedLineId(e.target.value)}
              style={{ ...inputStyle, fontFamily: "inherit" }}
            >
              {openLines.map(l => (
                <option key={l.id} value={l.id}>
                  {l.product?.name ?? "Line"} — {getLineRemainingQuantity(l)} remaining
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* Three-column fields */}
      <div
        style={{
          padding: "14px 20px 18px",
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr 1.4fr",
          gap: "14px",
        }}
      >
        {/* Cases */}
        <label style={{ display: "block" }}>
          <span style={labelStyle}>Cases</span>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <input
              type="number"
              min="1"
              max={remaining}
              step="1"
              value={casesValue}
              onChange={e => setCasesValue(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: 0 }}
            />
            <span style={{ fontSize: "12px", color: C.muted, flexShrink: 0 }}>
              / {remaining}
            </span>
          </div>
        </label>

        {/* Weight */}
        <label style={{ display: "block" }}>
          <span style={labelStyle}>Weight (lbs)</span>
          <input
            type="number"
            min="0"
            step="0.0001"
            placeholder={isCatchWeight ? "required" : "optional"}
            value={weightValue}
            onChange={e => setWeightValue(e.target.value)}
            style={inputStyle}
          />
        </label>

        {/* Lot */}
        <label style={{ display: "block" }}>
          <span style={labelStyle}>Lot</span>
          {lotOptions.length > 0 ? (
            <select
              value={selectedLotId}
              onChange={e => setSelectedLotId(e.target.value)}
              style={inputStyle}
            >
              {lotOptions.map(l => (
                <option key={l.id} value={l.id}>
                  {l.lotNumber} · {l.cases} cs
                  {l.expirationDate
                    ? ` · exp ${formatDisplayDate(l.expirationDate)}`
                    : ""}
                </option>
              ))}
            </select>
          ) : (
            <div
              style={{
                ...inputStyle,
                fontFamily: "inherit",
                color: C.muted,
                cursor: "default",
              }}
            >
              Auto-allocated
            </div>
          )}
        </label>
      </div>

      {/* Error */}
      {submitError && (
        <div
          style={{
            padding: "0 20px 8px",
            fontSize: "12px",
            color: "oklch(55% 0.22 25)",
          }}
        >
          {submitError}
        </div>
      )}

      {/* Checkboxes + action buttons */}
      <div
        style={{
          padding: "0 20px 18px",
          display: "flex",
          gap: "10px",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "14px",
            fontSize: "12px",
            color: C.muted,
            flexWrap: "wrap",
          }}
        >
          <label
            style={{ display: "flex", gap: "6px", alignItems: "center", cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={printPackingSlip}
              onChange={e => setPrintPackingSlip(e.target.checked)}
            />
            Print packing slip
          </label>
          <label
            style={{ display: "flex", gap: "6px", alignItems: "center", cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={generateInvoiceOnSave}
              onChange={e => setGenerateInvoiceOnSave(e.target.checked)}
            />
            Generate invoice on save
          </label>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            disabled={isSubmitting || !actionState.canFulfill}
            onClick={() => void handleSubmit(true)}
            style={{
              fontSize: "12px",
              padding: "6px 12px",
              borderRadius: C.radiusSm,
              border: `1px solid ${C.line}`,
              background: C.surface,
              color: C.ink,
              cursor: isSubmitting || !actionState.canFulfill ? "not-allowed" : "pointer",
              opacity: isSubmitting || !actionState.canFulfill ? 0.5 : 1,
              fontFamily: "inherit",
              fontWeight: 500,
            }}
          >
            Save as partial
          </button>
          <button
            type="button"
            disabled={isSubmitting || !actionState.canFulfill}
            onClick={() => void handleSubmit(false)}
            style={{
              fontSize: "12px",
              padding: "6px 14px",
              borderRadius: C.radiusSm,
              border: `1px solid ${C.ink}`,
              background: C.ink,
              color: C.surface,
              cursor: isSubmitting || !actionState.canFulfill ? "not-allowed" : "pointer",
              opacity: isSubmitting || !actionState.canFulfill ? 0.5 : 1,
              fontFamily: "inherit",
              fontWeight: 500,
            }}
          >
            {isSubmitting ? "Saving…" : "Confirm & fulfill"}
          </button>
        </div>
      </div>
    </div>
  );
}
