"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Package, Scale } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatMoney, formatWeightLbs } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import { getInventoryStatusLabel } from "../utils/inventory-status";

import type { SalesOrderDetail } from "../services/orders";

import {
  formatFulfillmentTimestamp,
  getLineAllocationReconciliation,
  getLineAllFulfillmentRecords,
  getLineCaseWeights,
  getLineFulfillmentState,
  getLineFulfilledQuantity,
  getLineFulfilledWeight,
  getLineFulfillmentRecords,
  getLineRemainingQuantity,
  getLineShortQuantity,
  getLineTraceabilitySummary,
  hasLineFulfillments,
  isFulfillmentReversed,
} from "./order-fulfillment-utils";

type Line = SalesOrderDetail["lines"][number];

const UNIT_TYPE_LABELS: Record<string, string> = {
  catch_weight: "Catch weight",
  fixed_case: "Fixed case",
};

function formatPersistedSalesUnit(
  line: Pick<
    Line,
    | "salesUnit"
    | "salesUnitNameSnapshot"
    | "salesUnitAbbreviationSnapshot"
  >,
) {
  if (line.salesUnitAbbreviationSnapshot) return line.salesUnitAbbreviationSnapshot;
  if (line.salesUnitNameSnapshot) return line.salesUnitNameSnapshot;
  if (!line.salesUnit) return "No sales unit";
  return line.salesUnit.abbreviation || line.salesUnit.name;
}

const LINE_STATUS_META = {
  not_started: { label: "Not started", variant: "outline" as const },
  partial: { label: "Partial", variant: "secondary" as const },
  fulfilled: { label: "Fulfilled", variant: "default" as const },
  short_shipped: { label: "Short shipped", variant: "outline" as const },
};

const INVENTORY_STATUS_BADGE: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  in_stock: "outline",
  allocated: "secondary",
  picked: "secondary",
  packed: "secondary",
  shipped: "default",
  sold: "default",
  damaged: "destructive",
  expired: "destructive",
};

function getLinePricingUnitType(line: Line): "per_lb" | "per_case" {
  if (line.pricingUnitTypeSnapshot) return line.pricingUnitTypeSnapshot;
  return line.unitType === "fixed_case" ? "per_case" : "per_lb";
}

/**
 * Returns the price per pricing unit (per lb or per case) from the pricing
 * snapshot. Falls back to `pricePerLbOverride` for legacy rows that predate
 * the snapshot columns.
 */
function getLinePricePerUnit(line: Line): number {
  if (line.pricePerUnitSnapshot) {
    const parsed = parseFloat(line.pricePerUnitSnapshot);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (line.pricePerLbOverride) {
    const parsed = parseFloat(line.pricePerLbOverride);
    if (!Number.isFinite(parsed)) return NaN;
    if (getLinePricingUnitType(line) === "per_case") {
      const conv = parseFloat(
        line.pricingConversionSnapshot ?? line.conversionToBaseSnapshot ?? "",
      );
      return Number.isFinite(conv) && conv > 0 ? parsed * conv : parsed;
    }
    return parsed;
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

interface OrderLinesTableProps {
  lines: Line[];
}

export function OrderLinesTable({ lines }: OrderLinesTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const expandable = useMemo(
    () =>
      lines.filter(
        line =>
          line.unitType === "catch_weight" ||
          getLineCaseWeights(line).length > 0 ||
          hasLineFulfillments(line) ||
          (line.allocations?.length ?? 0) > 0,
      ),
    [lines],
  );

  const allExpanded =
    expandable.length > 0 && expanded.size === expandable.length;

  const subtotal = useMemo(() => {
    let total = 0;
    let hasPrice = false;
    for (const line of lines) {
      const lt = computeLineTotal(line);
      if (lt != null && lt > 0) {
        total += lt;
        hasPrice = true;
      }
    }
    return hasPrice ? total : null;
  }, [lines]);

  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">No line items yet.</p>;
  }

  const toggleRow = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allExpanded) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(expandable.map(l => l.id)));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {expandable.length > 0 && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleAll}
            className="h-7 text-xs"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Product</TableHead>
            <TableHead>Sales unit</TableHead>
            <TableHead className="text-right">Cases</TableHead>
            <TableHead className="text-right">Weight (lbs)</TableHead>
            <TableHead className="text-right">Price basis</TableHead>
            <TableHead className="text-right">Line total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map(line => {
            const fulfillments = getLineAllFulfillmentRecords(line);
            const caseWeights = getLineCaseWeights(line);
            const allocations = line.allocations ?? [];
            const canExpand =
              line.unitType === "catch_weight" ||
              fulfillments.length > 0 ||
              caseWeights.length > 0 ||
              allocations.length > 0;
            const isOpen = expanded.has(line.id);
            const price = getLinePricePerUnit(line);
            const pricingUnitType = getLinePricingUnitType(line);
            const total = computeLineTotal(line);
            const fulfilled = getLineFulfilledQuantity(line);
            const expected = line.expectedCases;
            const lineStatus = getLineFulfillmentState(line);
            const fulfilledClass =
              expected === 0
                ? "text-muted-foreground"
                : lineStatus === "fulfilled"
                  ? "text-success-fg dark:text-success-fg"
                  : lineStatus === "short_shipped"
                    ? "text-ink-warm dark:text-card-warm"
                    : fulfilled > 0
                    ? "text-warning-fg dark:text-warning-fg"
                    : "text-muted-foreground";

            return (
              <LineRowGroup
                key={line.id}
                line={line}
                price={price}
                pricingUnitType={pricingUnitType}
                total={total}
                caseWeights={caseWeights}
                fulfillments={fulfillments}
                allocations={allocations}
                canExpand={canExpand}
                isOpen={isOpen}
                fulfilledClass={fulfilledClass}
                onToggle={() => toggleRow(line.id)}
              />
            );
          })}
        </TableBody>
        {subtotal != null && (
          <tfoot>
            <tr className="border-t">
              <td />
              <td
                colSpan={5}
                className="px-2 py-2 text-right text-sm text-muted-foreground"
              >
                Subtotal
              </td>
              <td className="px-2 py-2 text-right text-sm font-semibold tabular-nums">
                {formatMoney(subtotal)}
              </td>
            </tr>
          </tfoot>
        )}
      </Table>
    </div>
  );
}

interface LineRowGroupProps {
  line: Line;
  price: number;
  pricingUnitType: "per_lb" | "per_case";
  total: number | null;
  caseWeights: number[];
  fulfillments: ReturnType<typeof getLineFulfillmentRecords>;
  allocations: NonNullable<Line["allocations"]>;
  canExpand: boolean;
  isOpen: boolean;
  fulfilledClass: string;
  onToggle: () => void;
}

function LineRowGroup({
  line,
  price,
  pricingUnitType,
  total,
  caseWeights,
  fulfillments,
  allocations,
  canExpand,
  isOpen,
  fulfilledClass,
  onToggle,
}: LineRowGroupProps) {
  return (
    <>
      <TableRow
        className={cn(canExpand && "cursor-pointer")}
        onClick={canExpand ? onToggle : undefined}
      >
        <TableCell className="w-8 align-middle">
          {canExpand ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={e => {
                e.stopPropagation();
                onToggle();
              }}
              aria-label={isOpen ? "Collapse line" : "Expand line"}
            >
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : null}
        </TableCell>
        <TableCell>
          {line.product ? (
            <Link
              href={`/products/${line.product.id}`}
              className="hover:underline"
              onClick={e => e.stopPropagation()}
            >
              <span className="font-mono text-xs text-muted-foreground">
                {line.product.sku}
              </span>{" "}
              <span>{line.product.name}</span>
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary" className="text-xs">
              {formatPersistedSalesUnit(line)}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {UNIT_TYPE_LABELS[line.unitType] ?? line.unitType}
            </Badge>
            <Badge
              variant={LINE_STATUS_META[getLineFulfillmentState(line)].variant}
              className="text-xs"
            >
              {LINE_STATUS_META[getLineFulfillmentState(line)].label}
            </Badge>
          </div>
        </TableCell>
        <TableCell className={cn("text-right tabular-nums", fulfilledClass)}>
          {getLineFulfilledQuantity(line)} / {line.expectedCases}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {getLineFulfilledWeight(line).toFixed(2)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {Number.isFinite(price) ? (
            // The snapshot abbreviation is the truth — per_lb lines store
            // "lb" (or whatever the base UOM is) and per_case lines store
            // "cs". Either way, render from the snapshot so the suffix
            // always matches the unit the price was recorded in.
            `${formatMoney(price)}/${formatPersistedSalesUnit(line)}`
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right tabular-nums font-medium">
          {total != null ? (
            formatMoney(total)
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
      {canExpand && isOpen && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell />
          <TableCell colSpan={6} className="py-4">
            <LineBreakdown
              line={line}
              caseWeights={caseWeights}
              fulfillments={fulfillments}
              allocations={allocations}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function LineBreakdown({
  line,
  caseWeights,
  fulfillments,
  allocations,
}: {
  line: Line;
  caseWeights: number[];
  fulfillments: ReturnType<typeof getLineFulfillmentRecords>;
  allocations: NonNullable<Line["allocations"]>;
}) {
  const totalCaseWeight = caseWeights.reduce((s, w) => s + w, 0);
  const totalAllocated = allocations.reduce(
    (s, a) => s + (parseFloat(a.allocatedWeightLbs) || 0),
    0,
  );
  const lineStatus = getLineFulfillmentState(line);
  const remainingQuantity = getLineRemainingQuantity(line);
  const shortQuantity = getLineShortQuantity(line);
  const statusMeta = LINE_STATUS_META[lineStatus];
  const reconciliation = getLineAllocationReconciliation(line);
  const traceability = getLineTraceabilitySummary(line);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {formatPersistedSalesUnit(line)}
          </Badge>
          <Badge variant={statusMeta.variant} className="text-xs">
            {statusMeta.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Fulfilled {getLineFulfilledQuantity(line)} / {line.expectedCases}
          </span>
          {lineStatus === "short_shipped" ? (
            <span className="text-xs text-muted-foreground">
              Shorted {shortQuantity}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Remaining {remainingQuantity}
            </span>
          )}
        </div>
        {lineStatus === "short_shipped" ? (
          <div className="mb-3 rounded-md border border-dashed bg-background px-3 py-2 text-xs text-muted-foreground">
            Closed short
            {line.shortShippedAt
              ? ` on ${formatFulfillmentTimestamp(line.shortShippedAt)}`
              : ""}
            {line.shortShippedBy?.fullName
              ? ` by ${line.shortShippedBy.fullName}`
              : ""}
            {line.shortShipNotes ? ` · ${line.shortShipNotes}` : ""}
          </div>
        ) : null}
        {!reconciliation.reconciled ? (
          <div className="mb-3 rounded-md border border-warning-border bg-warning-bg/60 px-3 py-2 text-xs text-warning-fg dark:border-amber-900/40 dark:bg-warning-fg/20 dark:text-warning-fg">
            {reconciliation.warnings.map(warning => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        ) : null}
        <div className="mb-3 rounded-md border bg-background px-3 py-2">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Lot traceability
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>
              Allocated lots {traceability.allocatedLots.length}
              {traceability.hasMultipleAllocatedLots ? " · multiple lots" : ""}
            </span>
            <span>
              Fulfilled lots {traceability.fulfilledLots.length}
              {traceability.hasMultipleFulfilledLots ? " · multiple lots" : ""}
            </span>
          </div>
          {traceability.allocatedLots.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {traceability.allocatedLots.map(lot => (
                <LotBadge
                  key={`allocated-${lot.id}`}
                  prefix="Allocated"
                  lotNumber={lot.lotNumber}
                  expirationDate={lot.expirationDate}
                />
              ))}
            </div>
          ) : null}
          {traceability.fulfilledLots.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {traceability.fulfilledLots.map(lot => (
                <LotBadge
                  key={`fulfilled-${lot.id}`}
                  prefix="Fulfilled"
                  lotNumber={lot.lotNumber}
                  expirationDate={lot.expirationDate}
                />
              ))}
            </div>
          ) : null}
          {traceability.warnings.length > 0 ? (
            <div className="mt-2 space-y-1 text-xs text-warning-fg dark:text-warning-fg">
              {traceability.warnings.map(warning => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Case-level breakdown
          </span>
          {caseWeights.length > 0 ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              Total {formatWeightLbs(totalCaseWeight)} lbs
            </span>
          ) : null}
        </div>
        {fulfillments.length > 0 ? (
          <ul className="divide-y rounded-md border bg-background">
            {fulfillments.map((fulfillment, index) => {
              const inventoryLabel =
                fulfillment.inventoryItem?.barcodeId ??
                (fulfillment.lot?.lotNumber
                  ? `Lot ${fulfillment.lot.lotNumber}`
                  : null);
              const lotLabel =
                fulfillment.lot?.lotNumber ??
                fulfillment.inventoryItem?.lot?.lotNumber ??
                null;

              return (
                <li
                  key={fulfillment.id}
                  className={cn(
                    "flex flex-col gap-2 px-3 py-2 text-sm",
                    isFulfillmentReversed(fulfillment) &&
                      "bg-muted/40 text-muted-foreground",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        Fulfillment {index + 1}
                        {isFulfillmentReversed(fulfillment) ? (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            Reversed
                          </Badge>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatFulfillmentTimestamp(fulfillment.fulfilledAt)}
                        {fulfillment.fulfilledBy?.fullName
                          ? ` · ${fulfillment.fulfilledBy.fullName}`
                          : ""}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium tabular-nums">
                        {fulfillment.quantityFulfilled} qty
                      </div>
                      <div className="text-xs tabular-nums text-muted-foreground">
                        {fulfillment.weightLbs
                          ? `${Number(fulfillment.weightLbs).toFixed(2)} lbs`
                          : "No weight captured"}
                      </div>
                    </div>
                  </div>

                  {isFulfillmentReversed(fulfillment) ? (
                    <div className="text-xs text-muted-foreground">
                      Reversed
                      {fulfillment.reversedAt
                        ? ` on ${formatFulfillmentTimestamp(fulfillment.reversedAt)}`
                        : ""}
                      {fulfillment.reversedBy?.fullName
                        ? ` by ${fulfillment.reversedBy.fullName}`
                        : ""}
                      {fulfillment.reversalReason
                        ? ` · ${fulfillment.reversalReason}`
                        : ""}
                    </div>
                  ) : null}

                  {(inventoryLabel || lotLabel || fulfillment.notes) && (
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {inventoryLabel ? (
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {inventoryLabel}
                        </Badge>
                      ) : null}
                      {fulfillment.inventoryItem?.status ? (
                        <Badge
                          variant={
                            INVENTORY_STATUS_BADGE[fulfillment.inventoryItem.status] ??
                            "outline"
                          }
                          className="text-[10px]"
                        >
                          {getInventoryStatusLabel(fulfillment.inventoryItem.status)}
                        </Badge>
                      ) : null}
                      {lotLabel && inventoryLabel !== `Lot ${lotLabel}` ? (
                        <Badge variant="outline" className="text-[10px] font-mono">
                          Lot {lotLabel}
                        </Badge>
                      ) : null}
                      {fulfillment.inventoryItem?.lot?.expirationDate ||
                      fulfillment.lot?.expirationDate ? (
                        <LotBadge
                          prefix="Exp"
                          lotNumber={lotLabel}
                          expirationDate={
                            fulfillment.inventoryItem?.lot?.expirationDate ??
                            fulfillment.lot?.expirationDate
                          }
                        />
                      ) : null}
                      {fulfillment.notes ? <span>{fulfillment.notes}</span> : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : caseWeights.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {caseWeights.map((w, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="font-mono text-xs tabular-nums"
              >
                {formatWeightLbs(w)} lbs
              </Badge>
            ))}
          </div>
        ) : line.unitType === "catch_weight" ? (
          <div className="rounded-md border border-dashed bg-background px-3 py-2 text-sm text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
              <Scale className="h-4 w-4 text-muted-foreground" />
              Catch-weight detail pending
            </div>
            Case-level weights will appear here once fulfillment captures the
            billed weights for each case.
          </div>
        ) : (
          <div className="rounded-md border border-dashed bg-background px-3 py-2 text-sm text-muted-foreground">
            {lineStatus === "short_shipped"
              ? "This line was closed short, so no additional case-level fulfillment was captured."
              : "No case-level breakdown has been captured for this line yet."}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Auto inventory allocations
            </span>
            {allocations.length > 0 && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {reconciliation.allocatedQuantity.toLocaleString()} qty · {formatWeightLbs(totalAllocated)} lbs
              </span>
            )}
          </div>
        </div>
        {allocations.length > 0 ? (
          <ul className="divide-y rounded-md border">
            {allocations.map(a => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs">
                    {a.inventoryItem?.barcodeId ?? "—"}
                  </span>
                  {a.inventoryItem?.status ? (
                    <Badge
                      variant={
                        INVENTORY_STATUS_BADGE[a.inventoryItem.status] ?? "outline"
                      }
                      className="text-[10px]"
                    >
                      {getInventoryStatusLabel(a.inventoryItem.status)}
                    </Badge>
                  ) : null}
                  {a.inventoryItem?.lot?.lotNumber ? (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Lot {a.inventoryItem.lot.lotNumber}
                    </Badge>
                  ) : null}
                  {a.inventoryItem?.lot?.expirationDate ? (
                    <LotBadge
                      prefix="Exp"
                      lotNumber={a.inventoryItem.lot.lotNumber}
                      expirationDate={a.inventoryItem.lot.expirationDate}
                    />
                  ) : null}
                </span>
                <span className="text-right tabular-nums">
                  {formatWeightLbs(a.allocatedWeightLbs)} lbs
                  {a.inventoryItem?.lot?.receiveDate ? (
                    <span className="block text-[11px] text-muted-foreground">
                      Rec {formatDisplayDate(a.inventoryItem.lot.receiveDate)}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed bg-background px-3 py-2 text-sm text-muted-foreground">
            No inventory allocated yet. Auto allocation details will appear here
            once stock is available for this line.
          </div>
        )}
      </div>
    </div>
  );
}

function LotBadge({
  prefix,
  lotNumber,
  expirationDate,
}: {
  prefix: string;
  lotNumber: string | null | undefined;
  expirationDate: string | Date | null | undefined;
}) {
  const status = getExpirationStatus(expirationDate);
  const label = lotNumber ? `${prefix} ${lotNumber}` : prefix;
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-mono",
        status === "expired" && "border-destructive/40 text-destructive",
        status === "warning" &&
          "border-amber-400/40 text-warning-fg dark:text-warning-fg",
      )}
    >
      {label}
      {expirationDate ? ` · ${formatDisplayDate(expirationDate)}` : ""}
    </Badge>
  );
}

function getExpirationStatus(
  expirationDate: string | Date | null | undefined,
): "ok" | "warning" | "expired" {
  if (!expirationDate) return "ok";
  const date = expirationDate instanceof Date ? expirationDate : new Date(expirationDate);
  if (Number.isNaN(date.getTime())) return "ok";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const exp = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (exp.getTime() < startOfToday.getTime()) return "expired";
  const warning = new Date(startOfToday);
  warning.setDate(warning.getDate() + 7);
  return exp.getTime() <= warning.getTime() ? "warning" : "ok";
}
