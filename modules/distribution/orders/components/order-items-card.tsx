"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney, formatWeightLbs } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  useGenerateInvoiceForSalesOrder,
  useRecordSalesOrderFulfillment,
  useMarkSalesOrderLineShortShipped,
} from "../hooks/use-orders";
import { OrderFulfillmentReversalDialog } from "./order-fulfillment-reversal-dialog";

import type { SalesOrderDetail } from "../services/orders";
import type { OrderActionAvailability } from "./order-action-rules";
import {
  formatFulfillmentTimestamp,
  getLineAllFulfillmentRecords,
  getLineFulfillmentState,
  getLineFulfilledQuantity,
  getLineFulfilledWeight,
  getLineFulfillmentRecords,
  getLineRemainingQuantity,
} from "./order-fulfillment-utils";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  ink: "var(--color-ink)",
  ink2: "var(--color-ink-warm)",
  muted: "var(--color-subtle)",
  surface: "var(--color-card)",
  line: "var(--color-border-default)",
  line2: "var(--color-divider)",
  good: "var(--color-success-fg)",
  warn: "var(--color-warning-fg)",
  info: "var(--color-info-fg)",
  infoSoft: "var(--color-info-bg)",
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
  // per_lb / catch-weight. Priority order matches the new-order
  // estimate (useLinesSubtotal) so the detail page agrees with the
  // pre-confirm preview the user just looked at:
  //   1. Real fulfilled weight, once a fulfillment record exists.
  //   2. Sum of allocated inventory items' exactWeightLbs — the
  //      weights captured at receiving time, available as soon as the
  //      order is allocated even before fulfillment.
  //   3. expectedCases × conversionToBaseSnapshot — the product's
  //      stated avg-case-weight, used only as a last-resort estimate
  //      when no real numbers are around.
  const weight = getLineFulfilledWeight(line);
  if (Number.isFinite(weight) && weight > 0) {
    return price * weight;
  }
  const allocations = line.allocations ?? [];
  const allocatedCases = allocations.reduce(
    (sum, a) => sum + Math.max(0, a.inventoryItem?.cases ?? 0),
    0,
  );
  const allocationCovers =
    line.expectedCases > 0 && allocatedCases >= line.expectedCases;
  if (allocationCovers) {
    const allocatedWeight = allocations.reduce(
      (sum, a) => sum + (parseFloat(a.inventoryItem?.exactWeightLbs ?? "0") || 0),
      0,
    );
    if (allocatedWeight > 0) {
      return price * allocatedWeight;
    }
  }
  const conversion = parseFloat(line.conversionToBaseSnapshot ?? "");
  if (Number.isFinite(conversion) && conversion > 0 && line.expectedCases > 0) {
    return price * conversion * line.expectedCases;
  }
  return null;
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
    headerParts.push(`${formatWeightLbs(totalWeight)} lbs`);

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
            orderId={order.id}
            awaitingFulfillment={awaitingFulfillment && !hasInvoice}
            canReverseFulfillment={actionState.canReverseFulfillment}
            reverseFulfillmentReason={actionState.reverseFulfillmentReason}
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
  orderId,
  awaitingFulfillment,
  canReverseFulfillment,
  reverseFulfillmentReason,
}: {
  line: Line;
  orderId: string;
  awaitingFulfillment: boolean;
  canReverseFulfillment: boolean;
  reverseFulfillmentReason: string | null;
}) {
  const price = getLinePricePerUnit(line);
  const pricingUnit = getLinePricingUnitType(line);
  const total = computeLineTotal(line);
  const unit = formatUnit(line);
  const fulfillState = getLineFulfillmentState(line);
  const allFulfillments = getLineAllFulfillmentRecords(line);
  const suggestedLot = line.allocations?.[0]?.inventoryItem?.lot?.lotNumber;

  const showToFulfillTag = awaitingFulfillment && fulfillState === "not_started";
  const hasDetail = allFulfillments.length > 0 || suggestedLot != null;

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
      {hasDetail && (
        <LotDisclosure
          line={line}
          orderId={orderId}
          canReverseFulfillment={canReverseFulfillment}
          reverseFulfillmentReason={reverseFulfillmentReason}
        />
      )}
    </div>
  );
}

// ── LotDisclosure ──────────────────────────────────────────────────────────

type FulfillmentRecord = NonNullable<ReturnType<typeof getLineAllFulfillmentRecords>>[number];

function LotDisclosure({
  line,
  orderId,
  canReverseFulfillment,
  reverseFulfillmentReason,
}: {
  line: Line;
  orderId: string;
  canReverseFulfillment: boolean;
  reverseFulfillmentReason: string | null;
}) {
  const allFulfillments = getLineAllFulfillmentRecords(line);
  const [reversalTarget, setReversalTarget] = useState<FulfillmentRecord | null>(
    null,
  );
  // Default-open the disclosure when the line has at least one active
  // (non-reversed) fulfillment. Without this the Reverse action was
  // tucked behind a collapsed `Lot & fulfillment detail · N entries`
  // toggle — the audit log was easy to overlook entirely.
  const hasActiveFulfillment = allFulfillments.some(f => !f.reversedAt);

  // Allocated-but-not-yet-fulfilled lots — shown as a hint above the
  // fulfillment list so the warehouse user can see what's reserved.
  const allocatedLot =
    line.allocations?.[0]?.inventoryItem?.lot ?? null;
  const allocatedLotExpiry = allocatedLot?.expirationDate ?? null;
  const productLabel = line.product
    ? `${line.product.sku} · ${line.product.name}`
    : "Line item";

  return (
    <>
      <details
        open={hasActiveFulfillment || undefined}
        style={{ borderBottom: `1px solid ${C.line2}` }}
      >
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
          {allFulfillments.length > 1 ? ` · ${allFulfillments.length} entries` : null}
        </summary>
        <div style={{ padding: "0 20px 16px", fontSize: "13px", color: C.ink2 }}>
          {allFulfillments.length === 0 && allocatedLot && (
            <DisclosureRow>
              <span>Allocated lot</span>
              <span>
                <LotPill lotNumber={allocatedLot.lotNumber} />
                {allocatedLotExpiry && (
                  <span style={{ color: C.warn, marginLeft: "8px" }}>
                    expires {formatDisplayDate(allocatedLotExpiry)}
                  </span>
                )}
              </span>
            </DisclosureRow>
          )}
          {allFulfillments.map((fulfillment, index) => {
            const lot = fulfillment.lot ?? fulfillment.inventoryItem?.lot ?? null;
            const isReversed = !!fulfillment.reversedAt;
            const isLast = index === allFulfillments.length - 1;

            return (
              <div
                key={fulfillment.id}
                style={{
                  borderBottom: isLast ? undefined : `1px dashed ${C.line2}`,
                  paddingBottom: isLast ? 0 : "8px",
                  marginBottom: isLast ? 0 : "8px",
                  opacity: isReversed ? 0.6 : 1,
                }}
              >
                <DisclosureRow>
                  <span>
                    {isReversed ? "Reversed" : "Fulfilled"}
                    {lot ? (
                      <>
                        {" · "}
                        <LotPill lotNumber={lot.lotNumber} />
                      </>
                    ) : null}
                  </span>
                  <span style={{ fontFamily: C.mono, fontFeatureSettings: "'tnum' 1" }}>
                    {fulfillment.quantityFulfilled.toLocaleString()} cases
                    {fulfillment.weightLbs
                      ? ` · ${formatWeightLbs(fulfillment.weightLbs)} lbs`
                      : ""}
                    {" · "}
                    {formatFulfillmentTimestamp(fulfillment.fulfilledAt)}
                  </span>
                </DisclosureRow>
                {(fulfillment.fulfilledBy?.fullName || !isReversed) && (
                  <DisclosureRow>
                    <span style={{ fontSize: "12px", color: C.muted }}>
                      {isReversed && fulfillment.reversedBy?.fullName
                        ? `Reversed by ${fulfillment.reversedBy.fullName}`
                        : fulfillment.fulfilledBy?.fullName
                          ? `Recorded by ${fulfillment.fulfilledBy.fullName}`
                          : ""}
                    </span>
                    {!isReversed ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => setReversalTarget(fulfillment)}
                        disabled={!canReverseFulfillment}
                        title={
                          !canReverseFulfillment
                            ? (reverseFulfillmentReason ?? undefined)
                            : "Reverse this fulfillment"
                        }
                        className="h-7 border-border-default bg-card px-2.5 text-xs text-ink-warm shadow-none hover:bg-divider hover:text-ink disabled:opacity-50"
                      >
                        Reverse fulfillment
                      </Button>
                    ) : null}
                  </DisclosureRow>
                )}
              </div>
            );
          })}
        </div>
      </details>

      <OrderFulfillmentReversalDialog
        open={!!reversalTarget}
        onOpenChange={open => {
          if (!open) setReversalTarget(null);
        }}
        orderId={orderId}
        fulfillment={
          reversalTarget
            ? {
                id: reversalTarget.id,
                quantityFulfilled: reversalTarget.quantityFulfilled,
                weightLbs: reversalTarget.weightLbs,
                fulfilledAt: reversalTarget.fulfilledAt,
                notes: reversalTarget.notes,
                reversedAt: reversalTarget.reversedAt,
                productLabel,
                fulfilledBy: reversalTarget.fulfilledBy,
              }
            : null
        }
      />
    </>
  );
}

function LotPill({ lotNumber }: { lotNumber: string }) {
  return (
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
      {lotNumber}
    </span>
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
  const [generateInvoiceOnSave, setGenerateInvoiceOnSave] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // The invoice-on-save toggle only makes sense when this fulfillment
  // will close every remaining line on the order — otherwise
  // `generateInvoiceForSalesOrder` rejects and the user is left wondering
  // why no invoice appeared. We surface the option only on the last
  // open line, when the user is filling its full remaining quantity.
  const otherOpenLineCount = openLines.filter(l => l.id !== selectedLineId).length;
  const fillingFullRemaining =
    !!casesValue &&
    Number.isInteger(parseInt(casesValue, 10)) &&
    parseInt(casesValue, 10) === remaining;
  const canGenerateInvoiceOnSave = otherOpenLineCount === 0 && fillingFullRemaining;
  useEffect(() => {
    if (!canGenerateInvoiceOnSave && generateInvoiceOnSave) {
      setGenerateInvoiceOnSave(false);
    }
  }, [canGenerateInvoiceOnSave, generateInvoiceOnSave]);

  const prevLineRef = useRef(selectedLineId);
  useEffect(() => {
    if (prevLineRef.current !== selectedLineId) {
      prevLineRef.current = selectedLineId;
      setCasesValue(String(remaining));
      setWeightValue("");
    }
  }, [selectedLineId, remaining]);

  // One row per distinct allocated lot. We keep each underlying
  // inventory item separately so the dropdown can show case + weight
  // totals scaled to whatever the user just typed in the cases input
  // (proportional take from each item if a partial case is pulled).
  const lotOptions = useMemo(() => {
    if (!selectedLine) return [];
    const map = new Map<
      string,
      {
        id: string;
        lotNumber: string;
        items: Array<{ cases: number; weightLbs: number }>;
        receiveDate: string | Date | null | undefined;
        expirationDate: string | Date | null | undefined;
      }
    >();
    for (const allocation of selectedLine.allocations ?? []) {
      const lot = allocation.inventoryItem?.lot;
      if (!lot?.id) continue;
      const cases = allocation.inventoryItem?.cases ?? 1;
      const weight =
        parseFloat(allocation.inventoryItem?.exactWeightLbs ?? "0") || 0;
      const existing = map.get(lot.id);
      if (existing) {
        existing.items.push({ cases, weightLbs: weight });
      } else {
        map.set(lot.id, {
          id: lot.id,
          lotNumber: lot.lotNumber,
          items: [{ cases, weightLbs: weight }],
          receiveDate: lot.receiveDate ?? null,
          expirationDate: lot.expirationDate ?? null,
        });
      }
    }
    return [...map.values()];
  }, [selectedLine]);

  function lotTotalCases(items: Array<{ cases: number }>) {
    return items.reduce((sum, item) => sum + Math.max(0, item.cases), 0);
  }

  function lotWeightForCases(
    items: Array<{ cases: number; weightLbs: number }>,
    requestedCases: number,
  ) {
    let remaining = requestedCases;
    let total = 0;
    for (const item of items) {
      if (remaining <= 0) break;
      if (item.cases <= 0 || item.weightLbs <= 0) continue;
      const taken = Math.min(item.cases, remaining);
      total += (taken / item.cases) * item.weightLbs;
      remaining -= taken;
    }
    return total;
  }

  const [selectedLotId, setSelectedLotId] = useState("");
  const effectiveSelectedLotId = lotOptions.some(lot => lot.id === selectedLotId)
    ? selectedLotId
    : (lotOptions[0]?.id ?? "");

  const isCatchWeight = selectedLine?.unitType === "catch_weight";
  // True when the sales unit is itself a weight (lb/pound) — i.e. the
  // customer is buying pounds directly, not cases that get weighed.
  // For weight-priced lines the fulfilled lbs is the user's source of
  // truth (actual scale weight at packing time). For case-priced
  // catch-weight lines, the cases' exactWeightLbs recorded at receiving
  // ARE the source of truth — letting the warehouse user retype them
  // here would just create drift between inventory and shipment.
  const isWeightSalesUnit = (() => {
    if (!selectedLine) return false;
    const tokens = [
      selectedLine.salesUnitAbbreviationSnapshot,
      selectedLine.salesUnitNameSnapshot,
      selectedLine.salesUnit?.abbreviation,
      selectedLine.salesUnit?.name,
    ];
    return tokens.some(t => {
      const v = (t ?? "").trim().toLowerCase();
      return v === "lb" || v === "lbs" || v === "pound" || v === "pounds";
    });
  })();
  // Catch-weight + case unit → weight is locked to the picked items'
  // recorded weights. Catch-weight + lb unit → weight is editable.
  const weightInputLocked = isCatchWeight && !isWeightSalesUnit;
  const isSubmitting = createFulfillment.isPending || markShortShipped.isPending;

  // Auto-populate the weight field from the picked lot's recorded
  // inventory items. The exact case weights were captured when the
  // supplier bill was received, so 95% of fulfillment runs match those
  // numbers exactly — no need to make the warehouse user re-type them.
  // We only set the value when the field is empty or still equal to
  // whatever we last auto-filled; once the user types their own number
  // we stop clobbering it.
  const lastAutoFilledWeightRef = useRef<string>("");
  useEffect(() => {
    if (!isCatchWeight) return;
    if (!selectedLine) return;
    const qty = parseInt(casesValue, 10);
    if (!Number.isInteger(qty) || qty <= 0) return;

    const items = (selectedLine.allocations ?? [])
      .filter(allocation =>
        effectiveSelectedLotId
          ? allocation.inventoryItem?.lotId === effectiveSelectedLotId
          : true,
      )
      .map(allocation => allocation.inventoryItem)
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    let remainingCases = qty;
    let totalWeight = 0;
    for (const item of items) {
      if (remainingCases <= 0) break;
      const itemCases = item.cases ?? 1;
      const itemWeight = parseFloat(item.exactWeightLbs ?? "0") || 0;
      if (itemCases <= 0 || itemWeight <= 0) continue;
      const taken = Math.min(itemCases, remainingCases);
      totalWeight += (taken / itemCases) * itemWeight;
      remainingCases -= taken;
    }

    if (totalWeight <= 0) return;
    const formatted = totalWeight.toFixed(4);
    setWeightValue(prev => {
      // When the input is locked (catch-weight + case unit), the
      // recorded case weights are the source of truth — always sync.
      // Otherwise only auto-fill when the field is empty or still
      // matching the last auto-fill, so a user-typed value stays.
      if (weightInputLocked) {
        lastAutoFilledWeightRef.current = formatted;
        return formatted;
      }
      if (prev !== "" && prev !== lastAutoFilledWeightRef.current) return prev;
      lastAutoFilledWeightRef.current = formatted;
      return formatted;
    });
  }, [
    isCatchWeight,
    weightInputLocked,
    selectedLine,
    effectiveSelectedLotId,
    casesValue,
  ]);

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
        // Honor the warehouse user's lot pick. When no lot is selected
        // (single allocation, or auto-allocated), the service falls
        // through to FIFO across the line's allocated inventory.
        lotId: effectiveSelectedLotId || undefined,
      });
      toast.success("Fulfillment recorded.");

      // Only attempted when the UI confirmed this is the closing
      // fulfillment for the order — see canGenerateInvoiceOnSave above.
      // Errors here are surfaced (not swallowed) so the user knows the
      // invoice didn't generate.
      if (generateInvoiceOnSave && canGenerateInvoiceOnSave) {
        try {
          const invoice = await generateInvoice.mutateAsync({
            salesOrderId: order.id,
          });
          toast.success(`Invoice ${invoice?.invoiceNumber ?? ""} generated.`);
        } catch (err) {
          const msg =
            err instanceof Error
              ? err.message
              : "Could not generate invoice.";
          toast.error(`Fulfillment saved, but invoice did not generate: ${msg}`);
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
        <Button
          type="button"
          onClick={onClose}
          variant="outline"
          size="xs"
          className="shrink-0 border-border-default bg-card text-xs text-ink shadow-none hover:bg-divider"
        >
          Cancel
        </Button>
      </div>

      {/* Line selector — only shown for multi-line orders */}
      {openLines.length > 1 && (
        <div style={{ padding: "6px 20px 0" }}>
          <label style={{ display: "block" }}>
            <span style={labelStyle}>Line</span>
            <Select
              value={selectedLineId}
              onValueChange={setSelectedLineId}
            >
              <SelectTrigger className="border-border-default bg-card text-sm shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {openLines.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.product?.name ?? "Line"} - {getLineRemainingQuantity(l)} remaining
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Input
              type="number"
              min="1"
              max={remaining}
              step="1"
              value={casesValue}
              onChange={e => setCasesValue(e.target.value)}
              className="min-w-0 flex-1 border-border-default bg-card font-mono text-sm text-ink shadow-none"
            />
            <span style={{ fontSize: "12px", color: C.muted, flexShrink: 0 }}>
              / {remaining}
            </span>
          </div>
        </label>

        {/* Weight */}
        <label style={{ display: "block" }}>
          <span style={labelStyle}>Weight (lbs)</span>
          <Input
            type="number"
            min="0"
            step="0.0001"
            placeholder={
              weightInputLocked
                ? "from picked lot"
                : isCatchWeight
                  ? "required"
                  : "optional"
            }
            value={weightValue}
            onChange={e => setWeightValue(e.target.value)}
            readOnly={weightInputLocked}
            aria-readonly={weightInputLocked}
            title={
              weightInputLocked
                ? "Weight is the sum of the picked lot's recorded case weights. Edit the case count or pick a different lot to change it."
                : undefined
            }
            className={
              weightInputLocked
                ? "cursor-not-allowed border-border-default bg-divider font-mono text-sm text-ink shadow-none"
                : "border-border-default bg-card font-mono text-sm text-ink shadow-none"
            }
          />
          {weightInputLocked ? (
            <span
              style={{
                display: "block",
                marginTop: "4px",
                fontSize: "11px",
                color: C.muted,
              }}
            >
              From recorded case weights. Change the case count to adjust.
            </span>
          ) : null}
        </label>

        {/* Lot */}
        <label style={{ display: "block" }}>
          <span style={labelStyle}>Lot</span>
          {lotOptions.length > 0 ? (
            <Select
              value={effectiveSelectedLotId}
              onValueChange={setSelectedLotId}
            >
              <SelectTrigger className="border-border-default bg-card font-mono text-sm text-ink shadow-none">
                {(() => {
                  // Render the trigger ourselves so the collapsed view
                  // is a clean, left-aligned lot number instead of the
                  // option's multi-line content.
                  const selected = lotOptions.find(
                    l => l.id === effectiveSelectedLotId,
                  );
                  return (
                    <span
                      style={{
                        flex: 1,
                        textAlign: "left",
                        color: selected ? C.ink : C.muted,
                      }}
                    >
                      {selected ? selected.lotNumber : "Select lot…"}
                    </span>
                  );
                })()}
              </SelectTrigger>
              <SelectContent>
                {lotOptions.map(l => {
                  // Mirror the customer picker pattern: lot number on
                  // top, receiving details on a muted second line. The
                  // displayed cases + weight reflect what the user
                  // would actually pull from this lot for the current
                  // `casesValue` (capped by what the lot has), so the
                  // picker stays honest as the cases input changes.
                  const totalCases = lotTotalCases(l.items);
                  const requestedCases = (() => {
                    const n = parseInt(casesValue, 10);
                    return Number.isInteger(n) && n > 0 ? n : 0;
                  })();
                  const displayCases =
                    requestedCases > 0
                      ? Math.min(requestedCases, totalCases)
                      : totalCases;
                  const displayWeight = lotWeightForCases(l.items, displayCases);

                  const detailParts: string[] = [];
                  detailParts.push(
                    `${displayCases.toLocaleString()}${
                      requestedCases > 0 && displayCases < totalCases
                        ? ` of ${totalCases.toLocaleString()}`
                        : ""
                    } ${displayCases === 1 ? "case" : "cases"}`,
                  );
                  if (displayWeight > 0) {
                    detailParts.push(`${displayWeight.toFixed(2)} lb`);
                  }
                  if (l.receiveDate) {
                    detailParts.push(
                      `received ${formatDisplayDate(l.receiveDate)}`,
                    );
                  }
                  if (l.expirationDate) {
                    detailParts.push(`exp ${formatDisplayDate(l.expirationDate)}`);
                  }
                  return (
                    <SelectItem key={l.id} value={l.id}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "1px",
                          minWidth: 0,
                          textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: C.mono,
                            fontWeight: 500,
                            textAlign: "left",
                          }}
                        >
                          {l.lotNumber}
                        </span>
                        <span style={{ fontSize: "11px", color: C.muted }}>
                          {detailParts.join(" · ")}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
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
            color: "var(--color-danger-fg)",
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
          {canGenerateInvoiceOnSave ? (
            <label
              style={{ display: "flex", gap: "6px", alignItems: "center", cursor: "pointer" }}
            >
              <Checkbox
                checked={generateInvoiceOnSave}
                onCheckedChange={checked =>
                  setGenerateInvoiceOnSave(checked === true)
                }
              />
              Generate invoice on save
            </label>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          {/* "Save partial" only renders when the user has actually reduced
              the cases count below the line's remaining — otherwise both
              buttons submitted the same payload and the partial label
              was misleading. */}
          {fillingFullRemaining ? null : (
            <Button
              type="button"
              disabled={isSubmitting || !actionState.canFulfill}
              onClick={() => void handleSubmit(true)}
              variant="outline"
              size="sm"
              className="border-border-default bg-card text-xs text-ink shadow-none hover:bg-divider disabled:opacity-50"
            >
              Save {casesValue || 0} of {remaining}
            </Button>
          )}
          <Button
            type="button"
            disabled={isSubmitting || !actionState.canFulfill}
            onClick={() => void handleSubmit(false)}
            size="sm"
            className="border-forest-mid bg-forest-mid text-xs text-card-warm hover:bg-forest disabled:opacity-50"
          >
            {isSubmitting
              ? "Saving…"
              : fillingFullRemaining
                ? `Fulfill all ${remaining}`
                : `Fulfill all ${remaining} (skip partial)`}
          </Button>
        </div>
      </div>
    </div>
  );
}
