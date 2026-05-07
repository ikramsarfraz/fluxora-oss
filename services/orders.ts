import crypto from "node:crypto";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  customerProductPrices,
  customers,
  files,
  inventoryItems,
  products,
  productUnits,
  salesOrderAttachments,
  salesOrderLineAllocations,
  salesOrderFulfillments,
  salesOrderLines,
  salesOrders,
} from "@/db/schema";
import { getPlanLimit } from "@/lib/subscription-plan-capabilities";
import {
  createPlanLimitReachedError,
  logSubscriptionEnforcementBlock,
} from "@/lib/subscription-enforcement";
import { countCurrentMonthSalesOrdersForTenant } from "@/services/subscription-usage";
import {
  buildSalesOrderObjectKey,
  deleteFile,
  downloadFile,
  uploadFile,
} from "@/lib/uploads/r2";
import {
  markInventoryItemsAllocated,
  markInventoryItemsShipped,
  restoreInventoryItemsToStock,
} from "./inventory-state";
import { getCurrentPortalUser } from "./portal-users";
import { getCurrentTenant } from "./tenants";
import { requirePermission } from "@/lib/auth/permissions";
import {
  buildTextSearchCondition,
  createPaginatedResult,
  getPaginationOffset,
  normalizePaginatedQuery,
  resolveOrderBy,
  type PaginatedQueryInput,
} from "@/lib/pagination";

/** Short human-readable suffix. Prefix (if any) is applied downstream per-customer. */
function makeOrderNumber(id: string) {
  return `SO-${id.slice(0, 8).toUpperCase()}`;
}

function isLineClosed(line: {
  expectedCases: number;
  fulfilledCases: number;
  shortShippedAt: Date | null;
}) {
  return line.shortShippedAt != null || line.fulfilledCases >= line.expectedCases;
}

function getInventoryItemCases(
  inventoryItem:
    | {
        cases?: number | null;
      }
    | null
    | undefined,
) {
  return Math.max(1, inventoryItem?.cases ?? 1);
}

function toSortableTime(value: Date | string | null | undefined) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function compareInventoryByOldestLot(
  a: {
    barcodeId: string;
    createdAt: Date;
    lot: {
      lotNumber: string;
      receiveDate: string;
      createdAt: Date;
    } | null;
  },
  b: {
    barcodeId: string;
    createdAt: Date;
    lot: {
      lotNumber: string;
      receiveDate: string;
      createdAt: Date;
    } | null;
  },
) {
  const receiveDateDelta =
    toSortableTime(a.lot?.receiveDate) - toSortableTime(b.lot?.receiveDate);
  if (receiveDateDelta !== 0) return receiveDateDelta;

  const lotCreatedDelta =
    toSortableTime(a.lot?.createdAt) - toSortableTime(b.lot?.createdAt);
  if (lotCreatedDelta !== 0) return lotCreatedDelta;

  const lotNumberDelta = (a.lot?.lotNumber ?? "").localeCompare(
    b.lot?.lotNumber ?? "",
  );
  if (lotNumberDelta !== 0) return lotNumberDelta;

  const itemCreatedDelta = toSortableTime(a.createdAt) - toSortableTime(b.createdAt);
  if (itemCreatedDelta !== 0) return itemCreatedDelta;

  return a.barcodeId.localeCompare(b.barcodeId);
}

function toFixedCostAmount(value: number) {
  return value.toFixed(4);
}

function calculateFulfillmentCostSnapshot(input: {
  costPerUnitSnapshot: string;
  costUnitTypeSnapshot: "catch_weight" | "fixed_case";
  quantityFulfilled: number;
  weightLbs: number | null;
}) {
  const costPerUnit = Number(input.costPerUnitSnapshot ?? "0");
  if (!Number.isFinite(costPerUnit) || costPerUnit < 0) {
    throw new Error("Invalid inventory cost snapshot on the selected fulfillment.");
  }

  if (input.costUnitTypeSnapshot === "catch_weight" && input.weightLbs == null) {
    throw new Error(
      "Catch-weight fulfillment requires billed weight so outbound cost can be captured accurately.",
    );
  }

  const costAmount =
    input.costUnitTypeSnapshot === "fixed_case"
      ? input.quantityFulfilled * costPerUnit
      : (input.weightLbs ?? 0) * costPerUnit;

  return {
    costPerUnitSnapshot: input.costPerUnitSnapshot,
    costUnitTypeSnapshot: input.costUnitTypeSnapshot,
    costAmountSnapshot: toFixedCostAmount(costAmount),
  };
}

function getAllocationWeightForFulfillmentLink(fulfillment: {
  weightLbs?: string | null;
  inventoryItem?: {
    exactWeightLbs?: string | null;
  } | null;
}) {
  const fulfillmentWeight = parseFloat(fulfillment.weightLbs ?? "");
  if (Number.isFinite(fulfillmentWeight) && fulfillmentWeight >= 0) {
    return fulfillmentWeight.toFixed(4);
  }

  const inventoryWeight = parseFloat(fulfillment.inventoryItem?.exactWeightLbs ?? "");
  if (Number.isFinite(inventoryWeight) && inventoryWeight >= 0) {
    return inventoryWeight.toFixed(4);
  }

  return "0.0000";
}

function distributeFulfillmentWeight(
  totalWeightLbs: number | null,
  selections: Array<{
    quantityFulfilled: number;
    allocatedWeightLbs: number;
  }>,
) {
  if (totalWeightLbs == null) return selections.map(() => null);
  if (selections.length === 1) return [totalWeightLbs];

  const basis = selections.map(selection =>
    selection.allocatedWeightLbs > 0
      ? selection.allocatedWeightLbs
      : selection.quantityFulfilled,
  );
  const totalBasis = basis.reduce((sum, value) => sum + value, 0);
  if (totalBasis <= 0) return selections.map(() => null);

  const weights: Array<number | null> = [];
  let assignedWeight = 0;

  for (let index = 0; index < selections.length; index += 1) {
    if (index === selections.length - 1) {
      weights.push(Number((totalWeightLbs - assignedWeight).toFixed(4)));
      break;
    }

    const nextWeight = Number(((totalWeightLbs * basis[index]) / totalBasis).toFixed(4));
    weights.push(nextWeight);
    assignedWeight += nextWeight;
  }

  return weights;
}

function getLotLifecycleStatus(
  expirationDate: string | Date | null | undefined,
): "ok" | "warning" | "expired" {
  if (!expirationDate) return "ok";
  const date = expirationDate instanceof Date ? expirationDate : new Date(expirationDate);
  if (Number.isNaN(date.getTime())) return "ok";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiration = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (expiration.getTime() < startOfToday.getTime()) {
    return "expired";
  }

  const warningThreshold = new Date(startOfToday);
  warningThreshold.setDate(warningThreshold.getDate() + 7);
  return expiration.getTime() <= warningThreshold.getTime() ? "warning" : "ok";
}

function isLotExpired(expirationDate: string | Date | null | undefined) {
  return getLotLifecycleStatus(expirationDate) === "expired";
}

async function validateSalesOrderLineSelections(input: {
  tenantId: string;
  customerId: string;
  lines: Array<{
    productId: string;
    salesUnitId: string;
    pricePerLbOverride?: string | null | undefined;
  }>;
}) {
  const productIds = [...new Set(input.lines.map(line => line.productId))];
  const salesUnitIds = [...new Set(input.lines.map(line => line.salesUnitId))];

  const validProducts = await db.query.products.findMany({
    where: and(
      inArray(products.id, productIds),
      eq(products.tenantId, input.tenantId),
    ),
    columns: {
      id: true,
      sku: true,
      name: true,
      defaultPricePerLb: true,
      baseUnitId: true,
    },
  });

  const invalidProductIds = productIds.filter(
    productId => !validProducts.some(product => product.id === productId),
  );
  if (invalidProductIds.length > 0) {
    throw new Error("One or more products are invalid.");
  }

  const validSalesUnits = await db.query.productUnits.findMany({
    where: and(
      inArray(productUnits.productId, productIds),
      inArray(productUnits.unitId, salesUnitIds),
      eq(productUnits.purpose, "sales"),
    ),
    columns: {
      productId: true,
      unitId: true,
      isDefault: true,
      conversionToBase: true,
    },
    with: {
      unit: {
        columns: {
          id: true,
          name: true,
          abbreviation: true,
        },
      },
    },
  });

  for (const line of input.lines) {
    const matchingSalesUnit = validSalesUnits.find(
      unit =>
        unit.productId === line.productId && unit.unitId === line.salesUnitId,
    );
    if (!matchingSalesUnit) {
      throw new Error("One or more sales units are invalid for the selected product.");
    }
  }

  return { validProducts, validSalesUnits };
}

async function assertSalesOrderLinesCanAutoAllocateInventory(input: {
  tenantId: string;
  lines: Array<{
    productId: string;
    expectedCases: number;
  }>;
  validProducts: ValidSalesOrderProduct[];
  includeSalesOrderLineIds?: string[];
}) {
  const productIds = [...new Set(input.lines.map(line => line.productId))];
  if (productIds.length === 0) return;

  const includedLineIds = new Set(input.includeSalesOrderLineIds ?? []);
  const inventory = await db.query.inventoryItems.findMany({
    where: inArray(inventoryItems.productId, productIds),
    with: {
      lot: {
        columns: {
          tenantId: true,
          lotNumber: true,
          receiveDate: true,
          expirationDate: true,
          createdAt: true,
        },
      },
      allocations: {
        columns: {
          salesOrderLineId: true,
        },
      },
    },
  });

  const candidatesByProduct = new Map<string, typeof inventory>();
  for (const item of inventory) {
    if (item.lot?.tenantId !== input.tenantId) continue;
    if (isLotExpired(item.lot.expirationDate)) continue;

    const allocations = item.allocations ?? [];
    const isOpenStock = item.status === "in_stock" && allocations.length === 0;
    const isIncludedReservation =
      item.status === "allocated" &&
      allocations.some(allocation =>
        includedLineIds.has(allocation.salesOrderLineId),
      );

    if (!isOpenStock && !isIncludedReservation) continue;

    const existing = candidatesByProduct.get(item.productId) ?? [];
    existing.push(item);
    candidatesByProduct.set(item.productId, existing);
  }

  for (const candidates of candidatesByProduct.values()) {
    candidates.sort(compareInventoryByOldestLot);
  }

  const selectedInventoryItemIds = new Set<string>();

  for (const line of input.lines) {
    const requiredQuantity = Math.trunc(line.expectedCases);
    if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) {
      throw new Error("Sales order line quantities must be positive whole numbers.");
    }

    const candidates = candidatesByProduct.get(line.productId) ?? [];
    let remainingQuantity = requiredQuantity;
    const selectedForLine: string[] = [];

    for (const item of candidates) {
      if (selectedInventoryItemIds.has(item.id)) continue;

      const itemQuantity = getInventoryItemCases(item);
      if (itemQuantity > remainingQuantity) continue;

      selectedForLine.push(item.id);
      remainingQuantity -= itemQuantity;

      if (remainingQuantity === 0) break;
    }

    if (remainingQuantity > 0) {
      const allocatableQuantity = candidates
        .filter(item => !selectedInventoryItemIds.has(item.id))
        .reduce((sum, item) => sum + getInventoryItemCases(item), 0);

      if (allocatableQuantity < requiredQuantity) {
        const product = input.validProducts.find(
          candidate => candidate.id === line.productId,
        );
        const productLabel = product
          ? `${product.sku} · ${product.name}`
          : "this product";
        const matchedQuantity = requiredQuantity - remainingQuantity;
        throw new Error(
          `Not enough allocatable inventory for ${productLabel}. Requested ${requiredQuantity} case${requiredQuantity === 1 ? "" : "s"}, but only ${matchedQuantity + allocatableQuantity} case${(matchedQuantity + allocatableQuantity) === 1 ? "" : "s"} are available.`,
        );
      }
    }

    for (const inventoryItemId of selectedForLine) {
      selectedInventoryItemIds.add(inventoryItemId);
    }
  }
}

type ValidSalesOrderProduct = Awaited<
  ReturnType<typeof validateSalesOrderLineSelections>
>["validProducts"][number];

type ValidSalesOrderUnit = Awaited<
  ReturnType<typeof validateSalesOrderLineSelections>
>["validSalesUnits"][number];

type PricingUnitType = "per_lb" | "per_case";

type SalesOrderLineSnapshot = {
  salesUnitId: string;
  conversionToBaseSnapshot: string | null;
  baseUnitIdSnapshot: string | null;
  salesUnitNameSnapshot: string | null;
  salesUnitAbbreviationSnapshot: string | null;
  pricingUnitTypeSnapshot: PricingUnitType;
  pricePerUnitSnapshot: string | null;
  pricingConversionSnapshot: string | null;
};

type ExistingSnapshotLine = {
  productId: string;
  salesUnitId: string | null;
  unitType: "catch_weight" | "fixed_case";
  pricePerLbOverride: string | null;
  conversionToBaseSnapshot: string | null;
  baseUnitIdSnapshot: string | null;
  salesUnitNameSnapshot: string | null;
  salesUnitAbbreviationSnapshot: string | null;
  pricingUnitTypeSnapshot: PricingUnitType | null;
  pricePerUnitSnapshot: string | null;
  pricingConversionSnapshot: string | null;
};

/** Returns the effective $/lb price for a line (input override → contract → product default). */
async function resolveLinePricePerLb(input: {
  customerId: string;
  productId: string;
  providedOverride: string | null | undefined;
  validProducts: ValidSalesOrderProduct[];
}): Promise<string | null> {
  const override = input.providedOverride?.toString().trim();
  if (override) return override;

  const contractPrice = await db.query.customerProductPrices.findFirst({
    where: and(
      eq(customerProductPrices.customerId, input.customerId),
      eq(customerProductPrices.productId, input.productId),
    ),
  });
  if (contractPrice) return contractPrice.pricePerLb;

  const product = input.validProducts.find(p => p.id === input.productId);
  return product?.defaultPricePerLb ?? null;
}

function computePricingSnapshot(
  unitType: "catch_weight" | "fixed_case",
  resolvedPricePerLb: string | null,
  conversionToBase: string,
): {
  pricingUnitTypeSnapshot: PricingUnitType;
  pricePerUnitSnapshot: string | null;
  pricingConversionSnapshot: string | null;
} {
  const pricingUnitType: PricingUnitType =
    unitType === "fixed_case" ? "per_case" : "per_lb";

  if (resolvedPricePerLb == null || resolvedPricePerLb === "") {
    return {
      pricingUnitTypeSnapshot: pricingUnitType,
      pricePerUnitSnapshot: null,
      pricingConversionSnapshot:
        pricingUnitType === "per_case" ? conversionToBase : null,
    };
  }

  const priceNum = parseFloat(resolvedPricePerLb);
  if (!Number.isFinite(priceNum)) {
    return {
      pricingUnitTypeSnapshot: pricingUnitType,
      pricePerUnitSnapshot: null,
      pricingConversionSnapshot:
        pricingUnitType === "per_case" ? conversionToBase : null,
    };
  }

  if (pricingUnitType === "per_case") {
    const conv = parseFloat(conversionToBase);
    const pricePerCase =
      Number.isFinite(conv) && conv > 0 ? priceNum * conv : priceNum;
    return {
      pricingUnitTypeSnapshot: pricingUnitType,
      pricePerUnitSnapshot: pricePerCase.toFixed(4),
      pricingConversionSnapshot: conversionToBase,
    };
  }

  return {
    pricingUnitTypeSnapshot: pricingUnitType,
    pricePerUnitSnapshot: priceNum.toFixed(4),
    pricingConversionSnapshot: null,
  };
}

function buildSalesOrderLineSnapshot(
  line: {
    productId: string;
    salesUnitId: string;
    unitType: "catch_weight" | "fixed_case";
    resolvedPricePerLb: string | null;
  },
  validProducts: ValidSalesOrderProduct[],
  validSalesUnits: ValidSalesOrderUnit[],
  existingLine?: ExistingSnapshotLine | null,
): SalesOrderLineSnapshot {
  const matchingProduct = validProducts.find(product => product.id === line.productId);
  const matchingSalesUnit = validSalesUnits.find(
    unit =>
      unit.productId === line.productId && unit.unitId === line.salesUnitId,
  );

  if (!matchingProduct || !matchingSalesUnit) {
    throw new Error("One or more sales units are invalid for the selected product.");
  }

  const canReuseUnitSnapshot =
    existingLine?.productId === line.productId &&
    existingLine.salesUnitId === line.salesUnitId;

  // Pricing basis is stable only if product, sales unit, unit type, and the
  // resolved $/lb input are all unchanged from the previously saved line.
  const canReusePricingSnapshot =
    canReuseUnitSnapshot &&
    existingLine?.unitType === line.unitType &&
    (existingLine?.pricePerLbOverride ?? null) ===
      (line.resolvedPricePerLb ?? null) &&
    existingLine?.pricingUnitTypeSnapshot != null;

  const freshPricing = computePricingSnapshot(
    line.unitType,
    line.resolvedPricePerLb,
    matchingSalesUnit.conversionToBase,
  );

  return {
    salesUnitId: line.salesUnitId,
    conversionToBaseSnapshot:
      canReuseUnitSnapshot && existingLine
        ? (existingLine.conversionToBaseSnapshot ??
          matchingSalesUnit.conversionToBase)
        : matchingSalesUnit.conversionToBase,
    baseUnitIdSnapshot:
      canReuseUnitSnapshot && existingLine
        ? existingLine.baseUnitIdSnapshot ?? matchingProduct.baseUnitId
        : matchingProduct.baseUnitId,
    salesUnitNameSnapshot:
      canReuseUnitSnapshot && existingLine
        ? existingLine.salesUnitNameSnapshot ?? matchingSalesUnit.unit.name
        : matchingSalesUnit.unit.name,
    salesUnitAbbreviationSnapshot:
      canReuseUnitSnapshot && existingLine
        ? (existingLine.salesUnitAbbreviationSnapshot ??
          matchingSalesUnit.unit.abbreviation)
        : matchingSalesUnit.unit.abbreviation,
    pricingUnitTypeSnapshot:
      canReusePricingSnapshot && existingLine?.pricingUnitTypeSnapshot
        ? existingLine.pricingUnitTypeSnapshot
        : freshPricing.pricingUnitTypeSnapshot,
    pricePerUnitSnapshot:
      canReusePricingSnapshot && existingLine
        ? existingLine.pricePerUnitSnapshot ?? freshPricing.pricePerUnitSnapshot
        : freshPricing.pricePerUnitSnapshot,
    pricingConversionSnapshot:
      canReusePricingSnapshot && existingLine
        ? existingLine.pricingConversionSnapshot ??
          freshPricing.pricingConversionSnapshot
        : freshPricing.pricingConversionSnapshot,
  };
}

async function reconcileSalesOrderLineAllocations(lineId: string) {
  const line = await db.query.salesOrderLines.findFirst({
    where: eq(salesOrderLines.id, lineId),
    with: {
      allocations: {
        with: {
          inventoryItem: true,
        },
      },
      fulfillments: {
        with: {
          inventoryItem: {
            columns: {
              id: true,
              exactWeightLbs: true,
              cases: true,
            },
          },
        },
      },
    },
  });

  if (!line) {
    throw new Error("Sales order line not found.");
  }

  const remainingOpenQuantity = line.shortShippedAt
    ? 0
    : Math.max(0, line.expectedCases - line.fulfilledCases);

  const activeFulfillments = (line.fulfillments ?? []).filter(
    fulfillment => !fulfillment.reversedAt,
  );
  const reversedFulfillments = (line.fulfillments ?? []).filter(
    fulfillment => fulfillment.reversedAt && fulfillment.inventoryItemId,
  );

  const explicitConsumedItemIds = new Set(
    activeFulfillments
      .map(fulfillment => fulfillment.inventoryItemId)
      .filter((value): value is string => Boolean(value)),
  );

  const allocations = [...(line.allocations ?? [])].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return aTime - bTime;
  });

  const consumedAllocationIds = new Set<string>();
  const consumedInventoryItemIds = new Set<string>();

  for (const allocation of allocations) {
    if (!explicitConsumedItemIds.has(allocation.inventoryItemId)) continue;
    consumedAllocationIds.add(allocation.id);
    consumedInventoryItemIds.add(allocation.inventoryItemId);
  }

  const openAllocations = allocations.filter(
    allocation => !consumedAllocationIds.has(allocation.id),
  );

  const releaseAllocationIds = new Set<string>();
  const releaseInventoryItemIds = new Set<string>();
  let openAllocatedQuantity = openAllocations.reduce(
    (sum, allocation) => sum + getInventoryItemCases(allocation.inventoryItem),
    0,
  );

  const existingOpenAllocationItemIds = new Set(
    openAllocations.map(allocation => allocation.inventoryItemId),
  );
  const restoredInventoryItemIds = new Set<string>();
  const restoredAllocations: Array<{
    inventoryItemId: string;
    allocatedWeightLbs: string;
  }> = [];

  if (!line.shortShippedAt && openAllocatedQuantity < remainingOpenQuantity) {
    const restorationCandidates = [...reversedFulfillments]
      .filter(
        fulfillment =>
          !!fulfillment.inventoryItemId &&
          !!fulfillment.inventoryItem &&
          !explicitConsumedItemIds.has(fulfillment.inventoryItemId!) &&
          !existingOpenAllocationItemIds.has(fulfillment.inventoryItemId!),
      )
      .sort((a, b) => {
        const aTime = a.reversedAt ? new Date(a.reversedAt).getTime() : 0;
        const bTime = b.reversedAt ? new Date(b.reversedAt).getTime() : 0;
        return bTime - aTime;
      });

    for (const fulfillment of restorationCandidates) {
      if (!fulfillment.inventoryItemId || !fulfillment.inventoryItem) continue;
      if (existingOpenAllocationItemIds.has(fulfillment.inventoryItemId)) continue;
      if (openAllocatedQuantity >= remainingOpenQuantity) break;

      const candidateCases = getInventoryItemCases(fulfillment.inventoryItem);
      const neededQuantity = remainingOpenQuantity - openAllocatedQuantity;

      if (candidateCases > neededQuantity) continue;

      restoredInventoryItemIds.add(fulfillment.inventoryItemId);
      restoredAllocations.push({
        inventoryItemId: fulfillment.inventoryItemId,
        allocatedWeightLbs: getAllocationWeightForFulfillmentLink(fulfillment),
      });
      existingOpenAllocationItemIds.add(fulfillment.inventoryItemId);
      openAllocatedQuantity += candidateCases;
    }
  }

  for (const allocation of restoredAllocations) {
    await db.insert(salesOrderLineAllocations).values({
      salesOrderLineId: lineId,
      inventoryItemId: allocation.inventoryItemId,
      allocatedWeightLbs: allocation.allocatedWeightLbs,
    });
  }

  if (restoredInventoryItemIds.size > 0) {
    await markInventoryItemsAllocated([...restoredInventoryItemIds]);
  }

  const releasableAllocations = [...openAllocations].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return bTime - aTime;
  });

  for (const allocation of releasableAllocations) {
    if (openAllocatedQuantity <= remainingOpenQuantity) break;
    const itemCases = getInventoryItemCases(allocation.inventoryItem);
    // Don't release if doing so would drop coverage below the remaining demand.
    // This preserves overshooting allocations when no smaller items are available.
    if (openAllocatedQuantity - itemCases < remainingOpenQuantity) continue;
    releaseAllocationIds.add(allocation.id);
    releaseInventoryItemIds.add(allocation.inventoryItemId);
    openAllocatedQuantity -= itemCases;
  }

  if (consumedAllocationIds.size > 0) {
    await db
      .delete(salesOrderLineAllocations)
      .where(inArray(salesOrderLineAllocations.id, [...consumedAllocationIds]));
  }

  const soldInventoryItemIds = [
    ...new Set([...explicitConsumedItemIds, ...consumedInventoryItemIds]),
  ].filter(
    id => !releaseInventoryItemIds.has(id) && !restoredInventoryItemIds.has(id),
  );

  if (soldInventoryItemIds.length > 0) {
    await markInventoryItemsShipped(soldInventoryItemIds);
  }

  if (releaseAllocationIds.size > 0) {
    await db
      .delete(salesOrderLineAllocations)
      .where(inArray(salesOrderLineAllocations.id, [...releaseAllocationIds]));
  }

  if (releaseInventoryItemIds.size > 0) {
    await restoreInventoryItemsToStock([...releaseInventoryItemIds]);
  }

  const reversedInventoryItemIds = [...new Set(
    reversedFulfillments
      .map(fulfillment => fulfillment.inventoryItemId)
      .filter((value): value is string => Boolean(value)),
  )].filter(
    id =>
      !explicitConsumedItemIds.has(id) &&
      !restoredInventoryItemIds.has(id) &&
      !existingOpenAllocationItemIds.has(id),
  );

  if (reversedInventoryItemIds.length > 0) {
    await restoreInventoryItemsToStock(reversedInventoryItemIds);
  }
}

async function autoAllocateOldestInventoryToSalesOrderLine(input: {
  tenantId: string;
  salesOrderLineId: string;
  productId: string;
  targetQuantity: number;
}) {
  if (input.targetQuantity <= 0) return;

  const existingAllocations = await db.query.salesOrderLineAllocations.findMany({
    where: eq(salesOrderLineAllocations.salesOrderLineId, input.salesOrderLineId),
    with: {
      inventoryItem: {
        columns: {
          cases: true,
        },
      },
    },
  });
  const currentAllocatedQuantity = existingAllocations.reduce(
    (sum, allocation) => sum + getInventoryItemCases(allocation.inventoryItem),
    0,
  );
  const allocationGap = Math.max(0, input.targetQuantity - currentAllocatedQuantity);
  if (allocationGap <= 0) return;

  const inventory = await db.query.inventoryItems.findMany({
    where: and(
      eq(inventoryItems.productId, input.productId),
      eq(inventoryItems.status, "in_stock"),
    ),
    with: {
      lot: {
        columns: {
          tenantId: true,
          lotNumber: true,
          receiveDate: true,
          expirationDate: true,
          createdAt: true,
        },
      },
      allocations: {
        columns: {
          id: true,
        },
      },
    },
  });

  const selected: Array<(typeof inventory)[number]> = [];
  let selectedQuantity = 0;

  const candidates = inventory
    .filter(
      candidate =>
        candidate.lot?.tenantId === input.tenantId &&
        !isLotExpired(candidate.lot.expirationDate) &&
        (candidate.allocations ?? []).length === 0,
    )
    .sort(compareInventoryByOldestLot);

  for (const item of candidates) {
    const itemQuantity = getInventoryItemCases(item);
    if (selectedQuantity + itemQuantity > allocationGap) continue;

    selected.push(item);
    selectedQuantity += itemQuantity;

    if (selectedQuantity >= allocationGap) break;
  }

  // If the exact-fit pass left a gap, fill it with the next-smallest item even
  // if it overshoots. This handles lot sizes larger than the remaining demand.
  if (selectedQuantity < allocationGap) {
    const selectedIds = new Set(selected.map(s => s.id));
    const overshoots = candidates
      .filter(item => !selectedIds.has(item.id))
      .sort((a, b) => getInventoryItemCases(a) - getInventoryItemCases(b));

    for (const item of overshoots) {
      if (selectedQuantity >= allocationGap) break;
      selected.push(item);
      selectedQuantity += getInventoryItemCases(item);
    }
  }

  if (selected.length === 0) return;

  await db.insert(salesOrderLineAllocations).values(
    selected.map(item => ({
      salesOrderLineId: input.salesOrderLineId,
      inventoryItemId: item.id,
      allocatedWeightLbs: item.exactWeightLbs,
    })),
  );

  await markInventoryItemsAllocated(selected.map(item => item.id));
  await reconcileSalesOrderLineAllocations(input.salesOrderLineId);
}

export async function getSalesOrders() {
  const tenant = await getCurrentTenant();
  return await db.query.salesOrders.findMany({
    where: eq(salesOrders.tenantId, tenant.id),
    with: {
      customer: true,
      lines: {
        with: {
          salesUnit: true,
        },
      },
    },
    orderBy: [desc(salesOrders.orderDate), desc(salesOrders.createdAt)],
  });
}

export type SalesOrderListSort =
  | "orderNumber"
  | "orderDate"
  | "status"
  | "createdAt";

export type SalesOrderListParams = PaginatedQueryInput<SalesOrderListSort>;

export async function getSalesOrdersPage(input?: SalesOrderListParams) {
  const tenant = await getCurrentTenant();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "orderDate",
    defaultDirection: "desc",
    defaultFilters: {},
  });
  const where = and(
    eq(salesOrders.tenantId, tenant.id),
    buildTextSearchCondition(query.search, [
      salesOrders.orderNumber,
      customers.name,
    ]),
  );
  const [{ count }] = await db
    .select({ count: sql<number>`count(distinct ${salesOrders.id})::int` })
    .from(salesOrders)
    .leftJoin(customers, eq(customers.id, salesOrders.customerId))
    .where(where);
  const orderIds = await db
    .select({ id: salesOrders.id })
    .from(salesOrders)
    .leftJoin(customers, eq(customers.id, salesOrders.customerId))
    .where(where)
    .orderBy(
      ...resolveOrderBy({
        sort: query.sort,
        direction: query.direction,
        expressions: {
          orderNumber: salesOrders.orderNumber,
          orderDate: salesOrders.orderDate,
          status: salesOrders.status,
          createdAt: salesOrders.createdAt,
        },
      }),
      desc(salesOrders.createdAt),
    )
    .limit(query.pageSize)
    .offset(getPaginationOffset(query.page, query.pageSize));

  const ids = orderIds.map(row => row.id);
  if (ids.length === 0) {
    return createPaginatedResult({
      data: [],
      page: query.page,
      pageSize: query.pageSize,
      total: count ?? 0,
    });
  }

  const rows = await db.query.salesOrders.findMany({
    where: inArray(salesOrders.id, ids),
    with: {
      customer: true,
      lines: {
        with: {
          salesUnit: true,
        },
      },
    },
  });

  const rowMap = new Map(rows.map(row => [row.id, row]));
  return createPaginatedResult({
    data: ids
      .map(id => rowMap.get(id))
      .filter((row): row is (typeof rows)[number] => Boolean(row)),
    page: query.page,
    pageSize: query.pageSize,
    total: count ?? 0,
  });
}

/** Row shape returned by `getSalesOrders()` (for client `import type` only). */
export type SalesOrderListItem = Awaited<
  ReturnType<typeof getSalesOrders>
>[number];

export async function getSalesOrderById(id: string) {
  const tenant = await getCurrentTenant();
  const result = await db.query.salesOrders.findFirst({
    where: and(eq(salesOrders.id, id), eq(salesOrders.tenantId, tenant.id)),
    with: {
      customer: true,
      createdBy: true,
      updatedBy: true,
      lines: {
        with: {
          product: true,
          salesUnit: true,
          shortShippedBy: true,
          fulfillments: {
            with: {
              fulfilledBy: true,
              reversedBy: true,
              inventoryItem: {
                with: {
                  lot: true,
                },
              },
              lot: true,
            },
          },
          allocations: {
            with: {
              inventoryItem: {
                with: {
                  lot: true,
                },
              },
            },
          },
        },
      },
      fulfillments: {
        with: {
          fulfilledBy: true,
          reversedBy: true,
          inventoryItem: {
            with: {
              lot: true,
            },
          },
          lot: true,
        },
      },
      invoices: {
        with: {
          payments: true,
        },
      },
      attachments: {
        with: {
          file: {
            with: {
              uploadedByUser: true,
            },
          },
        },
        orderBy: (a, { asc }) => [asc(a.createdAt)],
      },
    },
  });
  return result ?? null;
}

export type SalesOrderDetail = NonNullable<
  Awaited<ReturnType<typeof getSalesOrderById>>
>;

export async function deleteSalesOrder(id: string) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();

  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }

  requirePermission(currentUser.role, "edit_order");

  await db
    .delete(salesOrders)
    .where(and(eq(salesOrders.id, id), eq(salesOrders.tenantId, tenant.id)));
}

export async function updateSalesOrderNotes(input: {
  id: string;
  customerNotes?: string | null;
  internalNotes?: string | null;
}) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();

  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }

  requirePermission(currentUser.role, "edit_order");

  const updates: Partial<typeof salesOrders.$inferInsert> = {};
  if (input.customerNotes !== undefined) {
    updates.customerNotes = input.customerNotes;
  }
  if (input.internalNotes !== undefined) {
    updates.internalNotes = input.internalNotes;
  }
  if (Object.keys(updates).length === 0) return;
  await db
    .update(salesOrders)
    .set(updates)
    .where(
      and(eq(salesOrders.id, input.id), eq(salesOrders.tenantId, tenant.id)),
    );
}

export async function updateSalesOrderStatus(input: {
  id: string;
  status: "confirmed";
}) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();

  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }

  requirePermission(currentUser.role, "confirm_order");

  const order = await db.query.salesOrders.findFirst({
    where: and(eq(salesOrders.id, input.id), eq(salesOrders.tenantId, tenant.id)),
    with: {
      lines: {
        columns: {
          id: true,
        },
      },
      invoices: {
        columns: {
          id: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error("Sales order not found.");
  }

  if (order.status === "cancelled") {
    throw new Error("Cancelled orders cannot be confirmed.");
  }

  if ((order.invoices?.length ?? 0) > 0) {
    throw new Error("Orders with invoices are already locked.");
  }

  if ((order.lines?.length ?? 0) === 0) {
    throw new Error("Add at least one line before confirming.");
  }

  if (input.status === "confirmed" && order.status !== "confirmed") {
    await db
      .update(salesOrders)
      .set({
        status: "confirmed",
        updatedByUserId: currentUser.id,
        updatedAt: new Date(),
      })
      .where(
        and(eq(salesOrders.id, input.id), eq(salesOrders.tenantId, tenant.id)),
      );
  }

  return getSalesOrderById(input.id);
}

/**
 * Cancel a sales order.
 *
 * Rules (enforced here, authoritative over any client-side gating):
 * - Requires `edit_order` permission.
 * - Tenant ownership is verified.
 * - Blocks if the order is already cancelled.
 * - Blocks if the order has any invoice (invoiced orders are financially locked).
 * - Blocks if any line has fulfillment or short-ship activity. Cancel is for
 *   orders that are still effectively open; once stock has moved out of the
 *   warehouse the correct tool is fulfillment reversal / credit-memo, not cancel.
 *
 * Writes a `sales_orders` row to `audit_logs` with the status transition and
 * optional reason so the activity timeline surfaces the cancellation.
 */
export async function cancelSalesOrder(input: {
  id: string;
  reason?: string | null;
}) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();

  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }

  requirePermission(currentUser.role, "edit_order");

  const order = await db.query.salesOrders.findFirst({
    where: and(eq(salesOrders.id, input.id), eq(salesOrders.tenantId, tenant.id)),
    with: {
      lines: {
        columns: {
          id: true,
          fulfilledCases: true,
          shortShippedAt: true,
        },
        with: {
          fulfillments: {
            columns: { id: true, reversedAt: true },
          },
        },
      },
      invoices: {
        columns: { id: true },
      },
    },
  });

  if (!order) {
    throw new Error("Sales order not found.");
  }

  if (order.status === "cancelled") {
    throw new Error("This order is already cancelled.");
  }

  if ((order.invoices?.length ?? 0) > 0) {
    throw new Error("Orders lock after invoicing and cannot be cancelled.");
  }

  const hasFulfillmentActivity = (order.lines ?? []).some(line => {
    if (line.fulfilledCases > 0) return true;
    if (line.shortShippedAt != null) return true;
    const activeFulfillments = (line.fulfillments ?? []).filter(
      fulfillment => fulfillment.reversedAt == null,
    );
    return activeFulfillments.length > 0;
  });

  if (hasFulfillmentActivity) {
    throw new Error(
      "Cannot cancel an order once fulfillment or short-ship activity has started. Reverse fulfillment first, then cancel.",
    );
  }

  const previousStatus = order.status;
  const trimmedReason = input.reason?.trim() ? input.reason.trim() : null;
  const now = new Date();

  await db
    .update(salesOrders)
    .set({
      status: "cancelled",
      updatedByUserId: currentUser.id,
      updatedAt: now,
    })
    .where(
      and(eq(salesOrders.id, input.id), eq(salesOrders.tenantId, tenant.id)),
    );

  await db.insert(auditLogs).values({
    tenantId: tenant.id,
    actorType: "portal_user",
    actorPortalUserId: currentUser.id,
    action: "update",
    entityTable: "sales_orders",
    entityId: input.id,
    entityLabel: order.orderNumber ?? null,
    changedFieldsJson: JSON.stringify(["status"]),
    beforeJson: JSON.stringify({ status: previousStatus }),
    afterJson: JSON.stringify({ status: "cancelled" }),
    contextJson: JSON.stringify({
      action: "cancel_order",
      reason: trimmedReason,
    }),
  });

  return getSalesOrderById(input.id);
}

export async function updateSalesOrder(input: {
  id: string;
  customerId: string;
  orderDate: string;
  dueDate?: string | null;
  addFuelSurcharge?: boolean;
  customerNotes?: string | null;
  internalNotes?: string | null;
  lines: Array<{
    existingLineId?: string;
    productId: string;
    salesUnitId: string;
    expectedCases: number;
    unitType?: "catch_weight" | "fixed_case";
    pricePerLbOverride?: string | null;
  }>;
}) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();

  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }

  requirePermission(currentUser.role, "edit_order");

  const order = await db.query.salesOrders.findFirst({
    where: and(eq(salesOrders.id, input.id), eq(salesOrders.tenantId, tenant.id)),
    with: {
      lines: {
        with: {
          fulfillments: {
            columns: {
              id: true,
            },
          },
          allocations: {
            columns: {
              id: true,
              inventoryItemId: true,
            },
          },
        },
      },
      invoices: {
        columns: {
          id: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error("Sales order not found.");
  }

  if (order.status === "cancelled") {
    throw new Error("Cancelled orders cannot be edited.");
  }

  if ((order.invoices?.length ?? 0) > 0) {
    throw new Error("Orders lock after invoicing.");
  }

  const hasFulfillmentActivity = (order.lines ?? []).some(
    line =>
      line.shortShippedAt != null ||
      line.fulfilledCases > 0 ||
      (line.fulfillments?.length ?? 0) > 0,
  );

  if (hasFulfillmentActivity) {
    throw new Error(
      "This order can no longer be edited because fulfillment activity has already started.",
    );
  }

  if (input.lines.length === 0) {
    throw new Error("Add at least one line item before saving.");
  }

  const providedExistingLineIds = input.lines
    .map(line => line.existingLineId)
    .filter((value): value is string => Boolean(value));
  if (new Set(providedExistingLineIds).size !== providedExistingLineIds.length) {
    throw new Error("Duplicate order lines were submitted.");
  }

  const existingLinesById = new Map(
    (order.lines ?? []).map(line => [line.id, line]),
  );
  for (const existingLineId of providedExistingLineIds) {
    if (!existingLinesById.has(existingLineId)) {
      throw new Error("One or more order lines could not be matched.");
    }
  }

  const customer = await db.query.customers.findFirst({
    where: and(eq(customers.id, input.customerId), eq(customers.tenantId, tenant.id)),
    columns: {
      id: true,
    },
  });

  if (!customer) {
    throw new Error("Customer not found.");
  }

  const { validProducts, validSalesUnits } = await validateSalesOrderLineSelections({
    tenantId: tenant.id,
    customerId: input.customerId,
    lines: input.lines,
  });
  await assertSalesOrderLinesCanAutoAllocateInventory({
    tenantId: tenant.id,
    lines: input.lines,
    validProducts,
    includeSalesOrderLineIds: (order.lines ?? []).map(line => line.id),
  });

  await db
    .update(salesOrders)
    .set({
      customerId: input.customerId,
      orderDate: input.orderDate,
      dueDate: input.dueDate ?? null,
      addFuelSurcharge: input.addFuelSurcharge ?? true,
      customerNotes: input.customerNotes ?? null,
      internalNotes: input.internalNotes ?? null,
      updatedByUserId: currentUser.id,
      updatedAt: new Date(),
    })
    .where(and(eq(salesOrders.id, input.id), eq(salesOrders.tenantId, tenant.id)));

  const allocationIdsToRelease = (order.lines ?? []).flatMap(line =>
    (line.allocations ?? []).map(allocation => allocation.id),
  );
  const inventoryItemIdsToRelease = (order.lines ?? []).flatMap(line =>
    (line.allocations ?? []).map(allocation => allocation.inventoryItemId),
  );

  if (allocationIdsToRelease.length > 0) {
    await db
      .delete(salesOrderLineAllocations)
      .where(inArray(salesOrderLineAllocations.id, allocationIdsToRelease));
    await restoreInventoryItemsToStock(inventoryItemIdsToRelease);
  }

  await db.delete(salesOrderLines).where(eq(salesOrderLines.salesOrderId, input.id));

  for (const line of input.lines) {
    const resolvedPricePerLb = await resolveLinePricePerLb({
      customerId: input.customerId,
      productId: line.productId,
      providedOverride: line.pricePerLbOverride,
      validProducts,
    });

    const unitType = line.unitType ?? "catch_weight";
    const snapshot = buildSalesOrderLineSnapshot(
      { ...line, unitType, resolvedPricePerLb },
      validProducts,
      validSalesUnits,
      line.existingLineId
        ? (existingLinesById.get(line.existingLineId) ?? null)
        : null,
    );

    const [createdLine] = await db
      .insert(salesOrderLines)
      .values({
        salesOrderId: input.id,
        productId: line.productId,
        ...snapshot,
        expectedCases: line.expectedCases,
        unitType,
        pricePerLbOverride: resolvedPricePerLb ?? undefined,
      })
      .returning();

    await autoAllocateOldestInventoryToSalesOrderLine({
      tenantId: tenant.id,
      salesOrderLineId: createdLine.id,
      productId: line.productId,
      targetQuantity: line.expectedCases,
    });
  }

  return getSalesOrderById(input.id);
}

export async function createSalesOrder(input: {
  customerId: string;
  orderDate: string;
  dueDate?: string;
  addFuelSurcharge?: boolean;
  status?: "sales_order" | "confirmed";
  customerNotes?: string;
  internalNotes?: string;
  lines: Array<{
    productId: string;
    salesUnitId: string;
    expectedCases: number;
    unitType?: "catch_weight" | "fixed_case";
    pricePerLbOverride?: string;
  }>;
}) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();

  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }

  requirePermission(currentUser.role, "edit_order");

  const maxMonthlyOrders = getPlanLimit(tenant, "maxMonthlyOrders");
  if ((await countCurrentMonthSalesOrdersForTenant(tenant.id)) + 1 > maxMonthlyOrders) {
    logSubscriptionEnforcementBlock({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        subscriptionPlan: tenant.subscriptionPlan,
        subscriptionStatus: tenant.subscriptionStatus,
      },
      reason: "limit_reached",
      key: "maxMonthlyOrders",
      limit: maxMonthlyOrders,
    });
    throw createPlanLimitReachedError({
      tenant,
      limitKey: "maxMonthlyOrders",
      limit: maxMonthlyOrders,
      resourceLabel: "orders per month",
      actionLabel: "create another sales order",
    });
  }

  if (input.lines.length === 0) {
    throw new Error("Add at least one line item before saving.");
  }

  const { validProducts, validSalesUnits } = await validateSalesOrderLineSelections({
    tenantId: tenant.id,
    customerId: input.customerId,
    lines: input.lines,
  });
  await assertSalesOrderLinesCanAutoAllocateInventory({
    tenantId: tenant.id,
    lines: input.lines,
    validProducts,
  });

  const [order] = await db
    .insert(salesOrders)
    .values({
      tenantId: tenant.id,
      customerId: input.customerId,
      orderDate: input.orderDate,
      dueDate: input.dueDate,
      addFuelSurcharge: input.addFuelSurcharge ?? true,
      customerNotes: input.customerNotes,
      internalNotes: input.internalNotes,
      createdByUserId: currentUser.id,
      updatedByUserId: currentUser.id,
      status: input.status ?? "sales_order",
    })
    .returning();

  const orderNumber = makeOrderNumber(order.id);

  await db
    .update(salesOrders)
    .set({ orderNumber })
    .where(eq(salesOrders.id, order.id));

  for (const line of input.lines) {
    const resolvedPricePerLb = await resolveLinePricePerLb({
      customerId: input.customerId,
      productId: line.productId,
      providedOverride: line.pricePerLbOverride,
      validProducts,
    });

    const unitType = line.unitType ?? "catch_weight";
    const snapshot = buildSalesOrderLineSnapshot(
      { ...line, unitType, resolvedPricePerLb },
      validProducts,
      validSalesUnits,
    );

    const [createdLine] = await db
      .insert(salesOrderLines)
      .values({
        salesOrderId: order.id,
        productId: line.productId,
        ...snapshot,
        expectedCases: line.expectedCases,
        unitType,
        pricePerLbOverride: resolvedPricePerLb ?? undefined,
      })
      .returning();

    await autoAllocateOldestInventoryToSalesOrderLine({
      tenantId: tenant.id,
      salesOrderLineId: createdLine.id,
      productId: line.productId,
      targetQuantity: line.expectedCases,
    });
  }

  return db.query.salesOrders.findFirst({
    where: eq(salesOrders.id, order.id),
    with: { lines: true },
  });
}

async function syncSalesOrderLineFulfillment(lineId: string) {
  const line = await db.query.salesOrderLines.findFirst({
    where: eq(salesOrderLines.id, lineId),
  });

  if (!line) {
    throw new Error("Sales order line not found.");
  }

  const fulfillments = await db.query.salesOrderFulfillments.findMany({
    where: eq(salesOrderFulfillments.salesOrderLineId, lineId),
  });
  const activeFulfillments = fulfillments.filter(
    fulfillment => !fulfillment.reversedAt,
  );

  const fulfilledCases = activeFulfillments.reduce(
    (sum, fulfillment) => sum + fulfillment.quantityFulfilled,
    0,
  );
  const totalBilledWeightLbs = activeFulfillments.reduce(
    (sum, fulfillment) => sum + (parseFloat(fulfillment.weightLbs ?? "0") || 0),
    0,
  );
  const caseWeights = activeFulfillments
    .map(fulfillment => parseFloat(fulfillment.weightLbs ?? ""))
    .filter(weight => Number.isFinite(weight) && weight > 0);

  await db
    .update(salesOrderLines)
    .set({
      fulfilledCases,
      totalBilledWeightLbs: totalBilledWeightLbs.toFixed(4),
      caseWeightsLbs: caseWeights.length > 0 ? JSON.stringify(caseWeights) : null,
      updatedAt: new Date(),
    })
    .where(eq(salesOrderLines.id, lineId));

  await reconcileSalesOrderLineAllocations(lineId);

  const orderLines = await db.query.salesOrderLines.findMany({
    where: eq(salesOrderLines.salesOrderId, line.salesOrderId),
    columns: {
      expectedCases: true,
      fulfilledCases: true,
      shortShippedAt: true,
    },
  });

  const allClosed =
    orderLines.length > 0 &&
    orderLines.every(orderLine => isLineClosed(orderLine));

  await db
    .update(salesOrders)
    .set({
      status: allClosed ? "fulfilled" : "confirmed",
      updatedAt: new Date(),
    })
    .where(eq(salesOrders.id, line.salesOrderId));
}

async function selectAutoFulfillmentInventory(input: {
  tenantId: string;
  salesOrderLineId: string;
  productId: string;
  quantityFulfilled: number;
}) {
  const allocations = await db.query.salesOrderLineAllocations.findMany({
    where: eq(salesOrderLineAllocations.salesOrderLineId, input.salesOrderLineId),
    with: {
      inventoryItem: {
        with: {
          lot: {
            columns: {
              tenantId: true,
              lotNumber: true,
              receiveDate: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  const selected: Array<{
    inventoryItemId: string;
    lotId: string;
    quantityFulfilled: number;
    originalCases: number;
    originalExactWeightLbs: string;
    allocatedWeightLbs: number;
    costPerUnitSnapshot: string;
    costUnitTypeSnapshot: "catch_weight" | "fixed_case";
  }> = [];
  let selectedQuantity = 0;

  const candidates = allocations
    .filter(allocation => {
      const item = allocation.inventoryItem;
      return (
        item != null &&
        item.productId === input.productId &&
        item.lot?.tenantId === input.tenantId &&
        item.status === "allocated"
      );
    })
    .sort((a, b) => {
      if (!a.inventoryItem || !b.inventoryItem) return 0;
      return compareInventoryByOldestLot(a.inventoryItem, b.inventoryItem);
    });

  for (const allocation of candidates) {
    const item = allocation.inventoryItem;
    if (!item) continue;

    const itemQuantity = getInventoryItemCases(item);
    if (selectedQuantity + itemQuantity > input.quantityFulfilled) continue;

    const allocatedWeight =
      parseFloat(allocation.allocatedWeightLbs ?? "") ||
      parseFloat(item.exactWeightLbs ?? "") ||
      0;

    selected.push({
      inventoryItemId: item.id,
      lotId: item.lotId,
      quantityFulfilled: itemQuantity,
      originalCases: itemQuantity,
      originalExactWeightLbs: item.exactWeightLbs ?? "0",
      allocatedWeightLbs: Number.isFinite(allocatedWeight) ? allocatedWeight : 0,
      costPerUnitSnapshot: item.costPerUnitSnapshot,
      costUnitTypeSnapshot: item.costUnitTypeSnapshot,
    });
    selectedQuantity += itemQuantity;

    if (selectedQuantity >= input.quantityFulfilled) break;
  }

  // If the exact-fit pass left a gap, take the next allocated item and cap its
  // quantity at the remaining demand. This handles lot sizes larger than the
  // fulfillment quantity (e.g. a 120-case item fulfilling a 100-case order).
  if (selectedQuantity < input.quantityFulfilled) {
    const selectedIds = new Set(selected.map(s => s.inventoryItemId));
    const remaining = input.quantityFulfilled - selectedQuantity;

    for (const allocation of candidates) {
      const item = allocation.inventoryItem;
      if (!item || selectedIds.has(item.id)) continue;

      const allocatedWeight =
        parseFloat(allocation.allocatedWeightLbs ?? "") ||
        parseFloat(item.exactWeightLbs ?? "") ||
        0;

      const itemCases = getInventoryItemCases(item);
      const useQuantity = Math.min(itemCases, remaining);
      selected.push({
        inventoryItemId: item.id,
        lotId: item.lotId,
        quantityFulfilled: useQuantity,
        originalCases: itemCases,
        originalExactWeightLbs: item.exactWeightLbs ?? "0",
        allocatedWeightLbs: Number.isFinite(allocatedWeight) ? allocatedWeight : 0,
        costPerUnitSnapshot: item.costPerUnitSnapshot,
        costUnitTypeSnapshot: item.costUnitTypeSnapshot,
      });
      selectedQuantity += useQuantity;

      if (selectedQuantity >= input.quantityFulfilled) break;
    }
  }

  if (selectedQuantity !== input.quantityFulfilled) {
    const allocatedQuantity = candidates.reduce(
      (sum, allocation) =>
        sum + getInventoryItemCases(allocation.inventoryItem),
      0,
    );

    throw new Error(
      `Could not automatically match ${input.quantityFulfilled} fulfilled case${input.quantityFulfilled === 1 ? "" : "s"} to allocated inventory. Only ${allocatedQuantity} allocated case${allocatedQuantity === 1 ? "" : "s"} are available for this product.`,
    );
  }

  return selected;
}

async function splitInventoryItemIfPartial(input: {
  inventoryItemId: string;
  quantityConsumed: number;
  originalCases: number;
  originalExactWeightLbs: string;
}) {
  if (input.quantityConsumed >= input.originalCases) return;

  const original = await db.query.inventoryItems.findFirst({
    where: eq(inventoryItems.id, input.inventoryItemId),
  });
  if (!original) return;

  const remainderCases = input.originalCases - input.quantityConsumed;
  const totalWeight = parseFloat(input.originalExactWeightLbs) || 0;
  const consumedWeight =
    totalWeight > 0 ? (totalWeight * input.quantityConsumed) / input.originalCases : 0;
  const remainderWeight = totalWeight > 0 ? totalWeight - consumedWeight : 0;

  await db
    .update(inventoryItems)
    .set({
      cases: input.quantityConsumed,
      exactWeightLbs: consumedWeight.toFixed(4),
      updatedAt: new Date(),
    })
    .where(eq(inventoryItems.id, input.inventoryItemId));

  await db.insert(inventoryItems).values({
    productId: original.productId,
    lotId: original.lotId,
    barcodeId: crypto.randomUUID(),
    exactWeightLbs: remainderWeight.toFixed(4),
    cases: remainderCases,
    costPerUnitSnapshot: original.costPerUnitSnapshot,
    costUnitTypeSnapshot: original.costUnitTypeSnapshot,
    status: "in_stock",
  });
}

async function recordAutoAllocatedFulfillments(input: {
  tenantId: string;
  currentUserId: string;
  salesOrderId: string;
  salesOrderLineId: string;
  productId: string;
  remainingQuantity: number;
  quantityFulfilled: number;
  weightLbs: number | null;
  fulfilledAt: Date;
  notes?: string | null;
}) {
  await autoAllocateOldestInventoryToSalesOrderLine({
    tenantId: input.tenantId,
    salesOrderLineId: input.salesOrderLineId,
    productId: input.productId,
    targetQuantity: input.remainingQuantity,
  });

  const selections = await selectAutoFulfillmentInventory({
    tenantId: input.tenantId,
    salesOrderLineId: input.salesOrderLineId,
    productId: input.productId,
    quantityFulfilled: input.quantityFulfilled,
  });
  const weights = distributeFulfillmentWeight(input.weightLbs, selections);
  const insertedIds: string[] = [];

  for (let index = 0; index < selections.length; index += 1) {
    const selection = selections[index];
    const rowWeight =
      weights[index] ??
      (selection.costUnitTypeSnapshot === "catch_weight" &&
      selection.allocatedWeightLbs > 0
        ? selection.allocatedWeightLbs
        : null);
    const costWeight =
      rowWeight ??
      (selection.allocatedWeightLbs > 0 ? selection.allocatedWeightLbs : null);
    const [fulfillment] = await db
      .insert(salesOrderFulfillments)
      .values({
        salesOrderId: input.salesOrderId,
        salesOrderLineId: input.salesOrderLineId,
        quantityFulfilled: selection.quantityFulfilled,
        weightLbs: rowWeight != null ? rowWeight.toFixed(4) : null,
        fulfilledByUserId: input.currentUserId,
        fulfilledAt: input.fulfilledAt,
        notes: input.notes ?? null,
        inventoryItemId: selection.inventoryItemId,
        lotId: selection.lotId,
        ...calculateFulfillmentCostSnapshot({
          costPerUnitSnapshot: selection.costPerUnitSnapshot,
          costUnitTypeSnapshot: selection.costUnitTypeSnapshot,
          quantityFulfilled: selection.quantityFulfilled,
          weightLbs: costWeight,
        }),
      })
      .returning({ id: salesOrderFulfillments.id });

    insertedIds.push(fulfillment.id);
  }

  for (const selection of selections) {
    if (selection.quantityFulfilled < selection.originalCases) {
      await splitInventoryItemIfPartial({
        inventoryItemId: selection.inventoryItemId,
        quantityConsumed: selection.quantityFulfilled,
        originalCases: selection.originalCases,
        originalExactWeightLbs: selection.originalExactWeightLbs,
      });
    }
  }

  return insertedIds[0] ?? null;
}

export async function recordSalesOrderFulfillment(input: {
  salesOrderId: string;
  salesOrderLineId: string;
  quantityFulfilled: number;
  weightLbs?: string | null;
  fulfilledAt?: Date | string;
  notes?: string | null;
  inventoryItemId?: string | null;
  lotId?: string | null;
}) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();

  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }

  requirePermission(currentUser.role, "fulfill_order");

  const order = await db.query.salesOrders.findFirst({
    where: and(
      eq(salesOrders.id, input.salesOrderId),
      eq(salesOrders.tenantId, tenant.id),
    ),
    with: {
      lines: {
        columns: {
          id: true,
          productId: true,
          expectedCases: true,
          fulfilledCases: true,
          shortShippedAt: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error("Sales order not found.");
  }
  if (order.status === "cancelled") {
    throw new Error("Cannot record fulfillment for a cancelled order.");
  }

  const matchingLine = order.lines.find(line => line.id === input.salesOrderLineId);
  if (!matchingLine) {
    throw new Error("Sales order line does not belong to this order.");
  }
  if (matchingLine.shortShippedAt) {
    throw new Error("This sales order line has already been short shipped.");
  }

  const remainingQuantity = Math.max(
    0,
    matchingLine.expectedCases - matchingLine.fulfilledCases,
  );
  if (remainingQuantity <= 0) {
    throw new Error("This sales order line is already fully fulfilled.");
  }

  const fulfilledAt =
    input.fulfilledAt instanceof Date
      ? input.fulfilledAt
      : input.fulfilledAt
        ? new Date(input.fulfilledAt)
        : new Date();

  if (!Number.isFinite(fulfilledAt.getTime())) {
    throw new Error("Invalid fulfillment timestamp.");
  }

  const quantityFulfilled = Math.trunc(input.quantityFulfilled);
  if (!Number.isFinite(quantityFulfilled) || quantityFulfilled <= 0) {
    throw new Error("Quantity fulfilled must be a positive whole number.");
  }
  if (quantityFulfilled > remainingQuantity) {
    throw new Error(
      `Quantity fulfilled cannot exceed the ${remainingQuantity} remaining on this line.`,
    );
  }

  const weight =
    input.weightLbs == null || input.weightLbs === ""
      ? null
      : parseFloat(input.weightLbs);

  if (weight != null && (!Number.isFinite(weight) || weight < 0)) {
    throw new Error("Weight must be a non-negative number.");
  }

  const firstFulfillmentId = await recordAutoAllocatedFulfillments({
    tenantId: tenant.id,
    currentUserId: currentUser.id,
    salesOrderId: input.salesOrderId,
    salesOrderLineId: input.salesOrderLineId,
    productId: matchingLine.productId,
    remainingQuantity,
    quantityFulfilled,
    weightLbs: weight,
    fulfilledAt,
    notes: input.notes ?? null,
  });

  await syncSalesOrderLineFulfillment(input.salesOrderLineId);

  if (!firstFulfillmentId) {
    throw new Error("Fulfillment could not be recorded.");
  }

  return db.query.salesOrderFulfillments.findFirst({
    where: eq(salesOrderFulfillments.id, firstFulfillmentId),
    with: {
      fulfilledBy: true,
      reversedBy: true,
      inventoryItem: {
        with: {
          lot: true,
        },
      },
      lot: true,
      salesOrderLine: true,
      salesOrder: true,
    },
  });
}

export async function markSalesOrderLineShortShipped(input: {
  salesOrderId: string;
  salesOrderLineId: string;
  notes?: string | null;
}) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();

  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }

  requirePermission(currentUser.role, "short_ship_order");

  const order = await db.query.salesOrders.findFirst({
    where: and(
      eq(salesOrders.id, input.salesOrderId),
      eq(salesOrders.tenantId, tenant.id),
    ),
    with: {
      lines: {
        columns: {
          id: true,
          expectedCases: true,
          fulfilledCases: true,
          shortShippedAt: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error("Sales order not found.");
  }
  if (order.status === "cancelled") {
    throw new Error("Cannot short ship a cancelled order.");
  }

  const matchingLine = order.lines.find(line => line.id === input.salesOrderLineId);
  if (!matchingLine) {
    throw new Error("Sales order line does not belong to this order.");
  }
  if (matchingLine.shortShippedAt) {
    throw new Error("This sales order line is already marked short shipped.");
  }
  if (matchingLine.fulfilledCases >= matchingLine.expectedCases) {
    throw new Error("A fully fulfilled line cannot be marked short shipped.");
  }

  await db
    .update(salesOrderLines)
    .set({
      shortShippedAt: new Date(),
      shortShippedByUserId: currentUser.id,
      shortShipNotes: input.notes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(salesOrderLines.id, input.salesOrderLineId));

  await reconcileSalesOrderLineAllocations(input.salesOrderLineId);
  await syncSalesOrderLineFulfillment(input.salesOrderLineId);

  return db.query.salesOrderLines.findFirst({
    where: eq(salesOrderLines.id, input.salesOrderLineId),
    with: {
      product: true,
      shortShippedBy: true,
      fulfillments: {
        with: {
          fulfilledBy: true,
          reversedBy: true,
          inventoryItem: {
            with: {
              lot: true,
            },
          },
          lot: true,
        },
      },
      allocations: {
        with: {
          inventoryItem: {
            with: {
              lot: true,
            },
          },
        },
      },
    },
  });
}

export async function reverseSalesOrderFulfillment(input: {
  salesOrderId: string;
  fulfillmentId: string;
  reversalReason?: string | null;
}) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();

  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }

  requirePermission(currentUser.role, "reverse_fulfillment");

  const order = await db.query.salesOrders.findFirst({
    where: and(
      eq(salesOrders.id, input.salesOrderId),
      eq(salesOrders.tenantId, tenant.id),
    ),
    with: {
      invoices: {
        columns: {
          id: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error("Sales order not found.");
  }

  if ((order.invoices?.length ?? 0) > 0) {
    throw new Error(
      "Fulfillment cannot be reversed after invoicing. Void or adjust the invoice first.",
    );
  }

  const fulfillment = await db.query.salesOrderFulfillments.findFirst({
    where: eq(salesOrderFulfillments.id, input.fulfillmentId),
    with: {
      salesOrderLine: {
        columns: {
          id: true,
          salesOrderId: true,
        },
      },
      salesOrder: {
        columns: {
          id: true,
          tenantId: true,
        },
      },
    },
  });

  if (!fulfillment) {
    throw new Error("Fulfillment entry not found.");
  }

  if (fulfillment.salesOrderId !== input.salesOrderId) {
    throw new Error("Fulfillment entry does not belong to this sales order.");
  }

  if (fulfillment.salesOrder?.tenantId !== tenant.id) {
    throw new Error("Fulfillment entry does not belong to this tenant.");
  }

  if (fulfillment.reversedAt) {
    throw new Error("This fulfillment entry has already been reversed.");
  }

  await db
    .update(salesOrderFulfillments)
    .set({
      reversedAt: new Date(),
      reversedByUserId: currentUser.id,
      reversalReason: input.reversalReason?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(salesOrderFulfillments.id, input.fulfillmentId));

  await syncSalesOrderLineFulfillment(fulfillment.salesOrderLineId);

  return db.query.salesOrderFulfillments.findFirst({
    where: eq(salesOrderFulfillments.id, input.fulfillmentId),
    with: {
      fulfilledBy: true,
      reversedBy: true,
      inventoryItem: {
        with: {
          lot: true,
        },
      },
      lot: true,
      salesOrderLine: true,
      salesOrder: true,
    },
  });
}

// -------------------- Attachments --------------------

const MAX_ORDER_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_ORDER_ATTACHMENT_FILENAME_LENGTH = 255;
const ALLOWED_ORDER_ATTACHMENT_EXTENSIONS = new Set([
  "pdf", "png", "jpg", "jpeg", "webp", "heic",
  "csv", "txt", "doc", "docx", "xls", "xlsx",
]);

function orderAttachmentExtension(filename: string): string | null {
  const dot = filename.lastIndexOf(".");
  if (dot < 0 || dot === filename.length - 1) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  if (!/^[a-z0-9]{1,16}$/.test(ext)) return null;
  if (!ALLOWED_ORDER_ATTACHMENT_EXTENSIONS.has(ext)) return null;
  return ext;
}


async function loadSalesOrderForAttachment(salesOrderId: string) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();

  const order = await db.query.salesOrders.findFirst({
    where: and(
      eq(salesOrders.id, salesOrderId),
      eq(salesOrders.tenantId, tenant.id),
    ),
    columns: { id: true, orderNumber: true },
  });
  if (!order) throw new Error("Sales order not found.");
  return { tenant, currentUser, order };
}

export type UploadSalesOrderAttachmentInput = {
  salesOrderId: string;
  originalFilename: string;
  mimeType: string | null;
  bytes: Buffer;
};

export async function uploadSalesOrderAttachment(
  input: UploadSalesOrderAttachmentInput,
) {
  const { tenant, currentUser, order } = await loadSalesOrderForAttachment(
    input.salesOrderId,
  );

  if (!input.bytes || input.bytes.byteLength === 0) {
    throw new Error("Uploaded file is empty.");
  }
  if (input.bytes.byteLength > MAX_ORDER_ATTACHMENT_BYTES) {
    throw new Error(
      `File is too large. Maximum is ${MAX_ORDER_ATTACHMENT_BYTES / (1024 * 1024)} MB.`,
    );
  }

  const originalFilename = input.originalFilename.trim();
  if (!originalFilename) throw new Error("File must have a name.");
  if (originalFilename.length > MAX_ORDER_ATTACHMENT_FILENAME_LENGTH) {
    throw new Error("Filename is too long.");
  }
  if (/[\u0000-\u001F\u007F]/.test(originalFilename)) {
    throw new Error("Filename contains invalid characters.");
  }

  const extension = orderAttachmentExtension(originalFilename);
  if (!extension) {
    throw new Error(
      "Unsupported file type. Allowed: PDF, PNG, JPG, JPEG, WEBP, HEIC, CSV, TXT, DOC, DOCX, XLS, XLSX.",
    );
  }

  const mimeType =
    input.mimeType?.trim().slice(0, 255) || null;

  const checksum = crypto
    .createHash("sha256")
    .update(input.bytes)
    .digest("hex");

  return await db.transaction(async tx => {
    const [fileRow] = await tx
      .insert(files)
      .values({
        tenantId: tenant.id,
        category: "sales_order_attachment",
        storageProvider: "r2",
        status: "ready",
        objectKey: `pending/${crypto.randomUUID()}`,
        bucket: process.env.R2_BUCKET_NAME ?? "erp-r2",
        originalFilename,
        mimeType,
        extension,
        sizeBytes: input.bytes.byteLength,
        checksumSha256: checksum,
        uploadedByUserId: currentUser.id,
      })
      .returning();

    const objectKey = buildSalesOrderObjectKey({
      tenantId: tenant.id,
      salesOrderId: order.id,
      fileId: fileRow.id,
      extension,
    });

    await tx
      .update(files)
      .set({ objectKey })
      .where(eq(files.id, fileRow.id));

    await tx.insert(salesOrderAttachments).values({
      salesOrderId: order.id,
      fileId: fileRow.id,
    });

    await tx.insert(auditLogs).values({
      tenantId: tenant.id,
      actorType: "portal_user",
      actorPortalUserId: currentUser.id,
      action: "file_uploaded",
      entityTable: "sales_order_attachments",
      entityId: fileRow.id,
      entityLabel: originalFilename,
      contextJson: JSON.stringify({ salesOrderId: order.id }),
    });

    await uploadFile({
      objectKey,
      body: input.bytes,
      contentType: mimeType ?? "application/octet-stream",
      contentLength: input.bytes.byteLength,
    });

    return { fileId: fileRow.id };
  });
}

export async function removeSalesOrderAttachment(input: {
  salesOrderId: string;
  fileId: string;
}) {
  const { tenant, currentUser, order } = await loadSalesOrderForAttachment(
    input.salesOrderId,
  );

  const attachment = await db.query.salesOrderAttachments.findFirst({
    where: and(
      eq(salesOrderAttachments.salesOrderId, order.id),
      eq(salesOrderAttachments.fileId, input.fileId),
    ),
    with: { file: true },
  });
  if (!attachment) throw new Error("Attachment not found.");

  const removedFilename =
    attachment.file.originalFilename ?? "attachment";

  await db.transaction(async tx => {
    await tx
      .delete(salesOrderAttachments)
      .where(
        and(
          eq(salesOrderAttachments.salesOrderId, order.id),
          eq(salesOrderAttachments.fileId, input.fileId),
        ),
      );
    await tx.delete(files).where(eq(files.id, input.fileId));
    await tx.insert(auditLogs).values({
      tenantId: tenant.id,
      actorType: "portal_user",
      actorPortalUserId: currentUser.id,
      action: "file_deleted",
      entityTable: "sales_order_attachments",
      entityId: input.fileId,
      entityLabel: removedFilename,
      contextJson: JSON.stringify({ salesOrderId: order.id }),
    });
  });

  await deleteFile(attachment.file.objectKey);
}

export async function getSalesOrderAttachmentDownload(args: {
  salesOrderId: string;
  fileId: string;
}) {
  const { order } = await loadSalesOrderForAttachment(args.salesOrderId);

  const attachment = await db.query.salesOrderAttachments.findFirst({
    where: and(
      eq(salesOrderAttachments.salesOrderId, order.id),
      eq(salesOrderAttachments.fileId, args.fileId),
    ),
    with: { file: true },
  });
  if (!attachment) throw new Error("Attachment not found.");

  const bytes = await downloadFile(attachment.file.objectKey);
  return {
    bytes,
    mimeType: attachment.file.mimeType ?? "application/octet-stream",
    originalFilename: attachment.file.originalFilename ?? "attachment",
    sizeBytes: attachment.file.sizeBytes ?? bytes.byteLength,
  };
}
