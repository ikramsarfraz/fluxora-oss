"use client";

import type { SalesOrderDetail } from "../services/orders";

type Line = SalesOrderDetail["lines"][number];
type FulfillmentRecord = NonNullable<Line["fulfillments"]>[number];

export function isFulfillmentReversed(
  fulfillment: Pick<FulfillmentRecord, "reversedAt">,
): boolean {
  return Boolean(fulfillment.reversedAt);
}

export type LineFulfillmentState =
  | "not_started"
  | "partial"
  | "fulfilled"
  | "short_shipped";

export type OrderFulfillmentState =
  | "not_started"
  | "partial"
  | "fulfilled"
  | "short_shipped";

export interface OrderFulfillmentSummary {
  status: OrderFulfillmentState;
  expectedQuantity: number;
  fulfilledQuantity: number;
  remainingQuantity: number;
  shortShippedLines: number;
}

export interface LineAllocationReconciliation {
  allocatedQuantity: number;
  allocatedWeightLbs: number;
  fulfilledQuantity: number;
  remainingOpenQuantity: number;
  overAllocatedQuantity: number;
  overAllocated: boolean;
  staleOnClosedLine: boolean;
  reconciled: boolean;
  warnings: string[];
}

export interface LineLotSummary {
  id: string;
  lotNumber: string;
  receiveDate: Date | null;
  expirationDate: Date | null;
  quantity: number;
  weightLbs: number;
  inventoryItemCount: number;
  status: "ok" | "warning" | "expired";
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = value ? parseFloat(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAllocationCases(
  allocation:
    | {
        inventoryItem?: {
          cases?: number | null;
        } | null;
      }
    | null
    | undefined,
) {
  return Math.max(1, allocation?.inventoryItem?.cases ?? 1);
}

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLotStatus(expirationDate: Date | null): "ok" | "warning" | "expired" {
  if (!expirationDate) return "ok";
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const expirationStart = new Date(
    expirationDate.getFullYear(),
    expirationDate.getMonth(),
    expirationDate.getDate(),
  );

  if (expirationStart.getTime() < startOfToday.getTime()) {
    return "expired";
  }

  const warningThreshold = new Date(startOfToday);
  warningThreshold.setDate(warningThreshold.getDate() + 7);

  if (expirationStart.getTime() <= warningThreshold.getTime()) {
    return "warning";
  }

  return "ok";
}

export function parseLegacyCaseWeights(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(value => {
        const weight = typeof value === "string" ? parseFloat(value) : Number(value);
        return Number.isFinite(weight) ? weight : null;
      })
      .filter((value): value is number => value != null && value > 0);
  } catch {
    return [];
  }
}

export function getLineAllFulfillmentRecords(line: Line): FulfillmentRecord[] {
  return [...(line.fulfillments ?? [])].sort(
    (a, b) =>
      new Date(a.fulfilledAt).getTime() - new Date(b.fulfilledAt).getTime(),
  );
}

export function getLineFulfillmentRecords(line: Line): FulfillmentRecord[] {
  return getLineAllFulfillmentRecords(line).filter(
    fulfillment => !isFulfillmentReversed(fulfillment),
  );
}

export function hasLineFulfillments(line: Line): boolean {
  return getLineAllFulfillmentRecords(line).length > 0;
}

export function getLineFulfilledQuantity(line: Line): number {
  const fulfillments = getLineFulfillmentRecords(line);
  if (fulfillments.length === 0) return line.fulfilledCases;
  return fulfillments.reduce(
    (sum, fulfillment) => sum + fulfillment.quantityFulfilled,
    0,
  );
}

export function getLineFulfilledWeight(line: Line): number {
  const fulfillments = getLineFulfillmentRecords(line);
  if (fulfillments.length === 0) return toNumber(line.totalBilledWeightLbs);

  const hasRecordedWeight = fulfillments.some(
    fulfillment => fulfillment.weightLbs != null,
  );
  if (!hasRecordedWeight) return toNumber(line.totalBilledWeightLbs);

  return fulfillments.reduce(
    (sum, fulfillment) => sum + toNumber(fulfillment.weightLbs),
    0,
  );
}

export function getLineLatestFulfillmentAt(line: Line): Date | null {
  const fulfillments = getLineAllFulfillmentRecords(line);
  if (fulfillments.length === 0) {
    return line.fulfilledCases > 0 ? line.updatedAt : null;
  }

  let latestAt: Date | null = null;

  for (const fulfillment of fulfillments) {
    const candidateDates = [fulfillment.fulfilledAt, fulfillment.reversedAt].filter(
      (value): value is Date => Boolean(value),
    );

    for (const value of candidateDates) {
      const candidate = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(candidate.getTime())) continue;
      if (!latestAt || candidate > latestAt) {
        latestAt = candidate;
      }
    }
  }

  return latestAt;
}

export function getLineCaseWeights(line: Line): number[] {
  const fulfillments = getLineFulfillmentRecords(line);
  const weights = fulfillments
    .map(fulfillment => toNumber(fulfillment.weightLbs))
    .filter(weight => weight > 0);

  if (weights.length > 0) return weights;
  return parseLegacyCaseWeights(line.caseWeightsLbs);
}

export function getLineFulfillmentCount(line: Line): number {
  return getLineFulfillmentRecords(line).length;
}

export function getLineAllocatedLots(line: Line): LineLotSummary[] {
  const groups = new Map<string, LineLotSummary>();

  for (const allocation of line.allocations ?? []) {
    const inventoryItem = allocation.inventoryItem;
    const lot = inventoryItem?.lot;
    if (!lot) continue;

    const existing = groups.get(lot.id);
    const nextWeight =
      parseFloat(allocation.allocatedWeightLbs ?? "0") ||
      parseFloat(inventoryItem?.exactWeightLbs ?? "0") ||
      0;
    const nextQuantity = getAllocationCases(allocation);

    if (existing) {
      existing.quantity += nextQuantity;
      existing.weightLbs += nextWeight;
      existing.inventoryItemCount += 1;
    } else {
      const expirationDate = parseDate(lot.expirationDate);
      groups.set(lot.id, {
        id: lot.id,
        lotNumber: lot.lotNumber,
        receiveDate: parseDate(lot.receiveDate),
        expirationDate,
        quantity: nextQuantity,
        weightLbs: nextWeight,
        inventoryItemCount: 1,
        status: getLotStatus(expirationDate),
      });
    }
  }

  return [...groups.values()].sort((a, b) =>
    a.lotNumber.localeCompare(b.lotNumber),
  );
}

export function getLineFulfilledLots(line: Line): LineLotSummary[] {
  const groups = new Map<string, LineLotSummary>();

  for (const fulfillment of getLineFulfillmentRecords(line)) {
    const lot =
      fulfillment.inventoryItem?.lot ??
      fulfillment.lot ??
      null;
    if (!lot) continue;

    const existing = groups.get(lot.id);
    const nextWeight = toNumber(fulfillment.weightLbs);

    if (existing) {
      existing.quantity += fulfillment.quantityFulfilled;
      existing.weightLbs += nextWeight;
      existing.inventoryItemCount += fulfillment.inventoryItem ? 1 : 0;
    } else {
      const expirationDate = parseDate(lot.expirationDate);
      groups.set(lot.id, {
        id: lot.id,
        lotNumber: lot.lotNumber,
        receiveDate: parseDate(lot.receiveDate),
        expirationDate,
        quantity: fulfillment.quantityFulfilled,
        weightLbs: nextWeight,
        inventoryItemCount: fulfillment.inventoryItem ? 1 : 0,
        status: getLotStatus(expirationDate),
      });
    }
  }

  return [...groups.values()].sort((a, b) =>
    a.lotNumber.localeCompare(b.lotNumber),
  );
}

export function getLineTraceabilitySummary(line: Line) {
  const allocatedLots = getLineAllocatedLots(line);
  const fulfilledLots = getLineFulfilledLots(line);
  const warnings = [...allocatedLots, ...fulfilledLots]
    .filter((lot, index, all) => all.findIndex(candidate => candidate.id === lot.id) === index)
    .filter(lot => lot.status !== "ok")
    .map(lot =>
      lot.status === "expired"
        ? `Lot ${lot.lotNumber} is expired.`
        : `Lot ${lot.lotNumber} expires soon.`,
    );

  return {
    allocatedLots,
    fulfilledLots,
    hasMultipleAllocatedLots: allocatedLots.length > 1,
    hasMultipleFulfilledLots: fulfilledLots.length > 1,
    warnings,
  };
}

export function getLineAllocationReconciliation(
  line: Line,
): LineAllocationReconciliation {
  const allocations = line.allocations ?? [];
  const allocatedQuantity = allocations.reduce(
    (sum, allocation) => sum + getAllocationCases(allocation),
    0,
  );
  const allocatedWeightLbs = allocations.reduce(
    (sum, allocation) => sum + toNumber(allocation.allocatedWeightLbs),
    0,
  );
  const fulfilledQuantity = getLineFulfilledQuantity(line);
  const remainingOpenQuantity = getLineRemainingQuantity(line);
  const overAllocatedQuantity = Math.max(
    0,
    allocatedQuantity - remainingOpenQuantity,
  );
  const overAllocated = overAllocatedQuantity > 0;
  const staleOnClosedLine = remainingOpenQuantity === 0 && allocatedQuantity > 0;
  const warnings: string[] = [];

  if (staleOnClosedLine && getLineFulfillmentState(line) === "short_shipped") {
    warnings.push("Allocations still exist on a short-shipped line.");
  } else if (staleOnClosedLine) {
    warnings.push("Allocations still exist on a closed line.");
  }

  if (overAllocated && remainingOpenQuantity > 0) {
    warnings.push("Allocated inventory exceeds remaining demand.");
  }

  const reconciled = warnings.length === 0;

  return {
    allocatedQuantity,
    allocatedWeightLbs,
    fulfilledQuantity,
    remainingOpenQuantity,
    overAllocatedQuantity,
    overAllocated,
    staleOnClosedLine,
    reconciled,
    warnings,
  };
}

export function getLineRemainingQuantity(line: Line): number {
  if (line.shortShippedAt) return 0;
  return Math.max(0, line.expectedCases - getLineFulfilledQuantity(line));
}

export function getLineShortQuantity(line: Line): number {
  if (!line.shortShippedAt) return 0;
  return Math.max(0, line.expectedCases - getLineFulfilledQuantity(line));
}

export function getLineFulfillmentState(line: Line): LineFulfillmentState {
  if (line.shortShippedAt) return "short_shipped";

  const fulfilled = getLineFulfilledQuantity(line);
  if (fulfilled >= line.expectedCases) return "fulfilled";
  if (fulfilled > 0) return "partial";
  return "not_started";
}

export function getOrderFulfillmentSummary(
  lines: Line[],
): OrderFulfillmentSummary {
  let expectedQuantity = 0;
  let fulfilledQuantity = 0;
  let remainingQuantity = 0;
  let shortShippedLines = 0;

  for (const line of lines) {
    expectedQuantity += line.expectedCases;
    fulfilledQuantity += getLineFulfilledQuantity(line);
    remainingQuantity += getLineRemainingQuantity(line);
    if (getLineFulfillmentState(line) === "short_shipped") {
      shortShippedLines += 1;
    }
  }

  const hasActivity = fulfilledQuantity > 0 || shortShippedLines > 0;
  const allClosed = lines.length > 0 && remainingQuantity === 0;

  let status: OrderFulfillmentState = "not_started";
  if (allClosed) {
    status = shortShippedLines > 0 ? "short_shipped" : "fulfilled";
  } else if (hasActivity) {
    status = "partial";
  }

  return {
    status,
    expectedQuantity,
    fulfilledQuantity,
    remainingQuantity,
    shortShippedLines,
  };
}

export function getLineProgressPct(line: Line): number {
  const expected = line.expectedCases;
  const fulfilled = getLineFulfilledQuantity(line);
  if (expected <= 0) return 0;
  return Math.min(100, Math.round((fulfilled / expected) * 100));
}

export function formatFulfillmentTimestamp(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
