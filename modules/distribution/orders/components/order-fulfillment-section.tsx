"use client";

import Link from "next/link";
import { type ComponentType, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Package,
  PackagePlus,
  RotateCcw,
  Scale,
} from "lucide-react";

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
import { formatDisplayDate } from "@/lib/utils/date";

import type { SalesOrderDetail } from "../services/orders";
import { useCurrentPortalUser } from "@/hooks/use-current-portal-user";

import { getOrderActionAvailability } from "./order-action-rules";
import {
  formatFulfillmentTimestamp,
  getLineAllocationReconciliation,
  getLineFulfillmentState,
  getLineFulfilledQuantity,
  getLineFulfilledWeight,
  getLineFulfillmentCount,
  getLineLatestFulfillmentAt,
  getLineProgressPct,
  getLineRemainingQuantity,
  getOrderFulfillmentSummary,
} from "./order-fulfillment-utils";
import { OrderFulfillmentEntryDialog } from "./order-fulfillment-entry-dialog";
import { OrderFulfillmentReversalDialog } from "./order-fulfillment-reversal-dialog";

type Line = SalesOrderDetail["lines"][number];

type FulfillmentStatus = "not_started" | "partial" | "fulfilled" | "short_shipped";

interface FulfillmentStats {
  status: FulfillmentStatus;
  expectedCases: number;
  fulfilledCases: number;
  remainingCases: number;
  casesPct: number;
  weightLbs: number;
  fulfillmentCount: number;
  catchWeightCount: number;
  shortShippedLines: number;
  allocationCount: number;
  allocatedWeightLbs: number;
  unreconciledLines: number;
  lastActivityAt: Date | null;
}

function computeStats(lines: Line[]): FulfillmentStats {
  const summary = getOrderFulfillmentSummary(lines);
  let weightLbs = 0;
  let fulfillmentCount = 0;
  let catchWeightCount = 0;
  let shortShippedLines = 0;
  let allocationCount = 0;
  let allocatedWeightLbs = 0;
  let unreconciledLines = 0;
  let lastActivity: number | null = null;

  for (const line of lines) {
    const reconciliation = getLineAllocationReconciliation(line);
    weightLbs += getLineFulfilledWeight(line);
    fulfillmentCount += getLineFulfillmentCount(line);
    if (line.unitType === "catch_weight") {
      catchWeightCount += getLineFulfillmentCount(line);
    }
    if (getLineFulfillmentState(line) === "short_shipped") {
      shortShippedLines += 1;
    }
    const allocs = line.allocations ?? [];
    allocationCount += allocs.length;
    if (!reconciliation.reconciled) {
      unreconciledLines += 1;
    }
    for (const a of allocs) {
      allocatedWeightLbs += parseFloat(a.allocatedWeightLbs ?? "0") || 0;
      const t = a.createdAt ? new Date(a.createdAt).getTime() : NaN;
      if (Number.isFinite(t)) {
        lastActivity = lastActivity == null ? t : Math.max(lastActivity, t);
      }
    }
    const latestFulfillmentAt = getLineLatestFulfillmentAt(line)?.getTime() ?? NaN;
    if (Number.isFinite(latestFulfillmentAt)) {
      lastActivity =
        lastActivity == null
          ? latestFulfillmentAt
          : Math.max(lastActivity, latestFulfillmentAt);
    }
    const shortShippedAt = line.shortShippedAt?.getTime() ?? NaN;
    if (Number.isFinite(shortShippedAt)) {
      lastActivity =
        lastActivity == null
          ? shortShippedAt
          : Math.max(lastActivity, shortShippedAt);
    }
  }

  const casesPct =
    summary.expectedQuantity > 0
      ? Math.min(
          100,
          Math.round((summary.fulfilledQuantity / summary.expectedQuantity) * 100),
        )
      : 0;

  return {
    status: summary.status,
    expectedCases: summary.expectedQuantity,
    fulfilledCases: summary.fulfilledQuantity,
    remainingCases: summary.remainingQuantity,
    casesPct,
    weightLbs,
    fulfillmentCount,
    catchWeightCount,
    shortShippedLines,
    allocationCount,
    allocatedWeightLbs,
    unreconciledLines,
    lastActivityAt: lastActivity != null ? new Date(lastActivity) : null,
  };
}

const STATUS_META: Record<
  FulfillmentStatus,
  {
    label: string;
    icon: ComponentType<{ className?: string }>;
    badge: "default" | "secondary" | "outline";
    className?: string;
  }
> = {
  not_started: {
    label: "Not started",
    icon: CircleDashed,
    badge: "outline",
  },
  partial: {
    label: "Partial",
    icon: CircleDot,
    badge: "secondary",
  },
  fulfilled: {
    label: "Complete",
    icon: CheckCircle2,
    badge: "default",
  },
  short_shipped: {
    label: "Short shipped",
    icon: CircleDot,
    badge: "outline",
  },
};

function ProgressBar({
  value,
  tone = "neutral",
}: {
  value: number;
  tone?: "neutral" | "partial" | "complete";
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const barClass =
    tone === "complete"
      ? "bg-emerald-500"
      : tone === "partial"
        ? "bg-amber-500"
        : "bg-muted-foreground/40";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all", barClass)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function tone(status: FulfillmentStatus): "neutral" | "partial" | "complete" {
  if (status === "fulfilled") return "complete";
  if (status === "partial") return "partial";
  return "neutral";
}

interface OrderFulfillmentSectionProps {
  order: SalesOrderDetail;
}

export function OrderFulfillmentSection({
  order,
}: OrderFulfillmentSectionProps) {
  const [entryOpen, setEntryOpen] = useState(false);
  const [selectedFulfillmentId, setSelectedFulfillmentId] = useState<string | null>(
    null,
  );
  const { data: currentUser } = useCurrentPortalUser();
  const actionState = useMemo(
    () => getOrderActionAvailability(order, currentUser?.role),
    [order, currentUser?.role],
  );
  const lines = order.lines ?? [];
  const stats = useMemo(() => computeStats(lines), [lines]);
  const meta = STATUS_META[stats.status];
  const Icon = meta.icon;
  const updatedBy = order.updatedBy?.fullName ?? null;
  const canRecordFulfillment = actionState.canFulfill;
  const recordFulfillmentReason = actionState.fulfillReason;
  const canReverseFulfillment = actionState.canReverseFulfillment;
  const reverseFulfillmentReason = actionState.reverseFulfillmentReason;
  const fulfillmentEntries = useMemo(
    () =>
      [...(order.fulfillments ?? [])].sort(
        (a, b) =>
          new Date(b.reversedAt ?? b.fulfilledAt).getTime() -
          new Date(a.reversedAt ?? a.fulfilledAt).getTime(),
      ),
    [order.fulfillments],
  );
  const selectedFulfillment = useMemo(
    () =>
      fulfillmentEntries.find(fulfillment => fulfillment.id === selectedFulfillmentId),
    [fulfillmentEntries, selectedFulfillmentId],
  );
  const selectedFulfillmentProductLabel = useMemo(() => {
    if (!selectedFulfillment) return "Line item";
    const line = lines.find(
      candidate => candidate.id === selectedFulfillment.salesOrderLineId,
    );
    return line?.product
      ? `${line.product.sku} · ${line.product.name}`
      : "Line item";
  }, [lines, selectedFulfillment]);

  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add line items to begin fulfillment.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed bg-background px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Fulfillment entry</span>
          <span className="text-xs text-muted-foreground">
            Capture fulfilled quantity, billed catch-weight, and optional lot or
            box linkage without leaving the order.
          </span>
        </div>
        <Button
          type="button"
          onClick={() => setEntryOpen(true)}
          disabled={!canRecordFulfillment}
          title={
            !canRecordFulfillment ? (recordFulfillmentReason ?? undefined) : undefined
          }
        >
          <PackagePlus className="h-4 w-4" />
          Record fulfillment
        </Button>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              stats.status === "fulfilled" &&
                "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
              stats.status === "partial" &&
                "bg-amber-500/15 text-amber-600 dark:text-amber-400",
              stats.status === "short_shipped" &&
                "bg-slate-500/15 text-slate-700 dark:text-slate-300",
              stats.status === "not_started" &&
                "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{meta.label}</span>
              <Badge variant={meta.badge} className="text-xs">
                {stats.fulfilledCases} / {stats.expectedCases} cases
              </Badge>
              {stats.shortShippedLines > 0 ? (
                <Badge variant="outline" className="text-xs">
                  {stats.shortShippedLines} short shipped
                </Badge>
              ) : null}
              {stats.unreconciledLines > 0 ? (
                <Badge variant="outline" className="text-xs">
                  {stats.unreconciledLines} allocation warning
                  {stats.unreconciledLines === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
            <span className="text-xs text-muted-foreground">
              {stats.lastActivityAt ? (
                <>
                  Last activity {formatDisplayDate(stats.lastActivityAt)}
                  {updatedBy && <> · by {updatedBy}</>}
                </>
              ) : (
                "No fulfillment activity yet."
              )}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 sm:w-auto sm:min-w-[30rem]">
          <SummaryStat label="Expected" value={`${stats.expectedCases}`} />
          <SummaryStat
            label="Fulfilled"
            value={`${stats.fulfilledCases} / ${stats.expectedCases}`}
          />
          <SummaryStat label="Remaining" value={`${stats.remainingCases}`} />
          <SummaryStat
            label="Weight captured"
            value={`${stats.weightLbs.toFixed(2)} lbs`}
          />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="font-medium uppercase tracking-wide text-muted-foreground">
            Overall progress
          </span>
          <span className="tabular-nums text-muted-foreground">
            {stats.casesPct}%
          </span>
        </div>
        <ProgressBar value={stats.casesPct} tone={tone(stats.status)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <FulfillmentSnapshotCard
          icon={CircleDot}
          title="Fulfillment records"
          value={String(stats.fulfillmentCount)}
          detail={
            stats.fulfillmentCount > 0
              ? "Captured fulfillment rows"
              : "No fulfillment rows yet"
          }
        />
        <FulfillmentSnapshotCard
          icon={Scale}
          title="Catch-weight captures"
          value={String(stats.catchWeightCount)}
          detail={
            stats.catchWeightCount > 0
              ? `${stats.weightLbs.toFixed(2)} lbs recorded`
              : "No catch-weight rows recorded"
          }
        />
        <FulfillmentSnapshotCard
          icon={Package}
          title="Allocation linkage"
          value={String(stats.allocationCount)}
          detail={
            stats.allocationCount > 0
              ? `${stats.allocatedWeightLbs.toFixed(2)} lbs allocated`
              : "No inventory linked yet"
          }
        />
        <FulfillmentSnapshotCard
          icon={CircleDashed}
          title="Remaining quantity"
          value={String(stats.remainingCases)}
          detail={
            stats.remainingCases > 0
              ? "Still open to fulfill"
              : stats.shortShippedLines > 0
                ? "Closed with short shipment"
                : "All line quantities closed"
          }
        />
        <FulfillmentSnapshotCard
          icon={CircleDashed}
          title="Allocation sync"
          value={String(stats.unreconciledLines)}
          detail={
            stats.unreconciledLines > 0
              ? "Lines need allocation review"
              : "Allocations match current demand"
          }
        />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Per-line breakdown
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="w-[22%]">Progress</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Cases</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="text-right">Weight (lbs)</TableHead>
              <TableHead className="text-right">Rows</TableHead>
              <TableHead className="text-right">Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map(line => {
              const lineStatus = getLineFulfillmentState(line);
              const linePct = getLineProgressPct(line);
              const lineWeight = getLineFulfilledWeight(line);
              const records = getLineFulfillmentCount(line);
              const reconciliation = getLineAllocationReconciliation(line);
              const lastFulfilledAt = getLineLatestFulfillmentAt(line);
              const shortShippedAt = line.shortShippedAt
                ? new Date(line.shortShippedAt)
                : null;
              const lastActivityAt =
                shortShippedAt &&
                (!lastFulfilledAt || shortShippedAt > lastFulfilledAt)
                  ? shortShippedAt
                  : lastFulfilledAt;
              const remaining = getLineRemainingQuantity(line);
              return (
                <TableRow key={line.id}>
                  <TableCell>
                    {line.product ? (
                      <Link
                        href={`/products/${line.product.id}`}
                        className="hover:underline"
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
                    <div className="flex flex-col gap-1">
                      <ProgressBar value={linePct} tone={tone(lineStatus)} />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {linePct}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        lineStatus === "fulfilled"
                          ? "default"
                          : lineStatus === "partial"
                            ? "secondary"
                            : "outline"
                      }
                      className="text-xs capitalize"
                    >
                      {lineStatus.replaceAll("_", " ")}
                    </Badge>
                    {!reconciliation.reconciled ? (
                      <div className="mt-1 text-[11px] text-amber-600">
                        {reconciliation.warnings[0]}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      lineStatus === "fulfilled" &&
                        "text-emerald-600 dark:text-emerald-400",
                      lineStatus === "partial" &&
                        "text-amber-600 dark:text-amber-400",
                      lineStatus === "short_shipped" &&
                        "text-slate-700 dark:text-slate-300",
                      lineStatus === "not_started" && "text-muted-foreground",
                    )}
                  >
                    {getLineFulfilledQuantity(line)} / {line.expectedCases}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {remaining}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {lineWeight.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {records > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Package className="h-3 w-3 text-muted-foreground" />
                        {records}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {lastActivityAt ? (
                      formatFulfillmentTimestamp(lastActivityAt)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fulfillment entries
          </h3>
          {!canReverseFulfillment ? (
            <span className="text-xs text-muted-foreground">
              {reverseFulfillmentReason ??
                "Reverse actions are locked after invoicing."}
            </span>
          ) : null}
        </div>
        {fulfillmentEntries.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Line</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead>Lot traceability</TableHead>
                <TableHead className="text-right">Notes / reason</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fulfillmentEntries.map(fulfillment => {
                const line = lines.find(
                  candidate => candidate.id === fulfillment.salesOrderLineId,
                );
                const productLabel = line?.product
                  ? `${line.product.sku} · ${line.product.name}`
                  : "Line item";
                const isReversed = Boolean(fulfillment.reversedAt);
                const reversalAt = fulfillment.reversedAt
                  ? formatFulfillmentTimestamp(fulfillment.reversedAt)
                  : null;
                const lotNumber =
                  fulfillment.inventoryItem?.lot?.lotNumber ??
                  fulfillment.lot?.lotNumber ??
                  null;
                const expirationDate =
                  fulfillment.inventoryItem?.lot?.expirationDate ??
                  fulfillment.lot?.expirationDate ??
                  null;

                return (
                  <TableRow key={fulfillment.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{productLabel}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatFulfillmentTimestamp(fulfillment.fulfilledAt)}
                          {fulfillment.fulfilledBy?.fullName
                            ? ` · ${fulfillment.fulfilledBy.fullName}`
                            : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isReversed ? "outline" : "secondary"}>
                        {isReversed ? "Reversed" : "Recorded"}
                      </Badge>
                      {isReversed ? (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {reversalAt}
                          {fulfillment.reversedBy?.fullName
                            ? ` · ${fulfillment.reversedBy.fullName}`
                            : ""}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fulfillment.quantityFulfilled}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fulfillment.weightLbs
                        ? Number(fulfillment.weightLbs).toFixed(2)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {lotNumber ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-mono">
                            Lot {lotNumber}
                          </Badge>
                          {expirationDate ? (
                            <LotExpiryBadge expirationDate={expirationDate} />
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No lot linked</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {isReversed && fulfillment.reversalReason
                        ? fulfillment.reversalReason
                        : fulfillment.notes || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isReversed ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedFulfillmentId(fulfillment.id)}
                          disabled={!canReverseFulfillment}
                          title={
                            !canReverseFulfillment
                              ? (reverseFulfillmentReason ?? undefined)
                              : undefined
                          }
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reverse
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-md border border-dashed bg-background px-3 py-2 text-sm text-muted-foreground">
            No fulfillment entries recorded yet.
          </div>
        )}
      </div>

      <OrderFulfillmentEntryDialog
        open={entryOpen}
        onOpenChange={setEntryOpen}
        order={order}
      />
      <OrderFulfillmentReversalDialog
        open={!!selectedFulfillment}
        onOpenChange={open => {
          if (!open) setSelectedFulfillmentId(null);
        }}
        orderId={order.id}
        fulfillment={
          selectedFulfillment
            ? {
                id: selectedFulfillment.id,
                quantityFulfilled: selectedFulfillment.quantityFulfilled,
                weightLbs: selectedFulfillment.weightLbs,
                fulfilledAt: selectedFulfillment.fulfilledAt,
                notes: selectedFulfillment.notes,
                reversedAt: selectedFulfillment.reversedAt,
                productLabel: selectedFulfillmentProductLabel,
                fulfilledBy: selectedFulfillment.fulfilledBy,
              }
            : null
        }
      />
    </div>
  );
}

function LotExpiryBadge({
  expirationDate,
}: {
  expirationDate: string | Date;
}) {
  const date = expirationDate instanceof Date ? expirationDate : new Date(expirationDate);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const exp = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const warning = new Date(startOfToday);
  warning.setDate(warning.getDate() + 7);

  const tone =
    exp.getTime() < startOfToday.getTime()
      ? "expired"
      : exp.getTime() <= warning.getTime()
        ? "warning"
        : "ok";

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px]",
        tone === "expired" && "border-destructive/40 text-destructive",
        tone === "warning" &&
          "border-amber-400/40 text-amber-700 dark:text-amber-300",
      )}
    >
      Exp {formatDisplayDate(date)}
    </Badge>
  );
}

function FulfillmentSnapshotCard({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}
