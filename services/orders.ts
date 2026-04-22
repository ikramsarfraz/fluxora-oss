import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  customerProductPrices,
  customers,
  inventoryItems,
  lots,
  products,
  salesOrderLineAllocations,
  salesOrderFulfillments,
  salesOrderLines,
  salesOrders,
} from "@/db/schema";
import {
  markInventoryItemAllocated,
  markInventoryItemsAllocated,
  markInventoryItemsShipped,
  restoreInventoryItemsToStock,
} from "./inventory-state";
import { getCurrentPortalUser } from "./portal-users";
import { getCurrentTenant } from "./tenants";

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
    releaseAllocationIds.add(allocation.id);
    releaseInventoryItemIds.add(allocation.inventoryItemId);
    openAllocatedQuantity -= getInventoryItemCases(allocation.inventoryItem);
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

export async function getSalesOrders() {
  const tenant = await getCurrentTenant();
  return await db.query.salesOrders.findMany({
    where: eq(salesOrders.tenantId, tenant.id),
    with: {
      customer: true,
      lines: true,
    },
    orderBy: [desc(salesOrders.orderDate), desc(salesOrders.createdAt)],
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
    },
  });
  return result ?? null;
}

export type SalesOrderDetail = NonNullable<
  Awaited<ReturnType<typeof getSalesOrderById>>
>;

export async function deleteSalesOrder(id: string) {
  const tenant = await getCurrentTenant();
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

export async function updateSalesOrder(input: {
  id: string;
  customerId: string;
  orderDate: string;
  dueDate?: string | null;
  addFuelSurcharge?: boolean;
  customerNotes?: string | null;
  internalNotes?: string | null;
  lines: Array<{
    productId: string;
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

  const hasOperationalActivity = (order.lines ?? []).some(
    line =>
      line.shortShippedAt != null ||
      line.fulfilledCases > 0 ||
      (line.fulfillments?.length ?? 0) > 0 ||
      (line.allocations?.length ?? 0) > 0,
  );

  if (hasOperationalActivity) {
    throw new Error(
      "This order can no longer be edited because fulfillment or allocation activity has already started.",
    );
  }

  if (input.lines.length === 0) {
    throw new Error("Add at least one line item before saving.");
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

  const productIds = [...new Set(input.lines.map(line => line.productId))];
  const validProducts = await db.query.products.findMany({
    where: and(inArray(products.id, productIds), eq(products.tenantId, tenant.id)),
    columns: {
      id: true,
      defaultPricePerLb: true,
    },
  });

  const invalidProductIds = productIds.filter(
    productId => !validProducts.some(product => product.id === productId),
  );
  if (invalidProductIds.length > 0) {
    throw new Error("One or more products are invalid.");
  }

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

  await db.delete(salesOrderLines).where(eq(salesOrderLines.salesOrderId, input.id));

  for (const line of input.lines) {
    let priceOverride = line.pricePerLbOverride?.trim() || undefined;

    if (!priceOverride) {
      const contractPrice = await db.query.customerProductPrices.findFirst({
        where: and(
          eq(customerProductPrices.customerId, input.customerId),
          eq(customerProductPrices.productId, line.productId),
        ),
      });

      if (contractPrice) {
        priceOverride = contractPrice.pricePerLb;
      } else {
        const product = validProducts.find(p => p.id === line.productId);
        priceOverride = product?.defaultPricePerLb;
      }
    }

    await db.insert(salesOrderLines).values({
      salesOrderId: input.id,
      productId: line.productId,
      expectedCases: line.expectedCases,
      unitType: line.unitType ?? "catch_weight",
      pricePerLbOverride: priceOverride,
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
    let priceOverride = line.pricePerLbOverride;

    if (!priceOverride) {
      const contractPrice = await db.query.customerProductPrices.findFirst({
        where: and(
          eq(customerProductPrices.customerId, input.customerId),
          eq(customerProductPrices.productId, line.productId),
        ),
      });

      if (contractPrice) {
        priceOverride = contractPrice.pricePerLb;
      } else {
        const product = await db.query.products.findFirst({
          where: eq(products.id, line.productId),
        });
        priceOverride = product?.defaultPricePerLb;
      }
    }

    await db.insert(salesOrderLines).values({
      salesOrderId: order.id,
      productId: line.productId,
      expectedCases: line.expectedCases,
      unitType: line.unitType ?? "catch_weight",
      pricePerLbOverride: priceOverride,
    });
  }

  return db.query.salesOrders.findFirst({
    where: eq(salesOrders.id, order.id),
    with: { lines: true },
  });
}

export async function allocateInventoryToSalesOrderLine(input: {
  salesOrderLineId: string;
  allocations: Array<{
    inventoryItemId: string;
    allocatedWeightLbs: string;
  }>;
}) {
  for (const allocation of input.allocations) {
    await db.insert(salesOrderLineAllocations).values({
      salesOrderLineId: input.salesOrderLineId,
      inventoryItemId: allocation.inventoryItemId,
      allocatedWeightLbs: allocation.allocatedWeightLbs,
    });

    await markInventoryItemAllocated(allocation.inventoryItemId);
  }

  await reconcileSalesOrderLineAllocations(input.salesOrderLineId);

  return db.query.salesOrderLines.findFirst({
    where: eq(salesOrderLines.id, input.salesOrderLineId),
    with: { allocations: true },
  });
}

export async function getSalesOrderLineAllocationEditor(input: {
  salesOrderId: string;
  salesOrderLineId: string;
}) {
  const tenant = await getCurrentTenant();

  const order = await db.query.salesOrders.findFirst({
    where: and(
      eq(salesOrders.id, input.salesOrderId),
      eq(salesOrders.tenantId, tenant.id),
    ),
    with: {
      lines: {
        with: {
          product: true,
          allocations: {
            with: {
              inventoryItem: {
                with: {
                  lot: true,
                },
              },
            },
          },
          fulfillments: {
            columns: {
              inventoryItemId: true,
              reversedAt: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new Error("Sales order not found.");
  }

  const line = order.lines.find(candidate => candidate.id === input.salesOrderLineId);
  if (!line) {
    throw new Error("Sales order line does not belong to this order.");
  }

  const remainingOpenQuantity = line.shortShippedAt
    ? 0
    : Math.max(0, line.expectedCases - line.fulfilledCases);
  const allocatedQuantity = (line.allocations ?? []).reduce(
    (sum, allocation) => sum + getInventoryItemCases(allocation.inventoryItem),
    0,
  );
  const allocationGap = Math.max(0, remainingOpenQuantity - allocatedQuantity);
  const activeFulfillmentItemIds = new Set(
    (line.fulfillments ?? [])
      .filter(fulfillment => !fulfillment.reversedAt)
      .map(fulfillment => fulfillment.inventoryItemId)
      .filter((value): value is string => Boolean(value)),
  );
  const isLineClosed = Boolean(line.shortShippedAt) || remainingOpenQuantity <= 0;

  const inventory = await db.query.inventoryItems.findMany({
    where: eq(inventoryItems.productId, line.productId),
    with: {
      lot: true,
    },
    orderBy: [desc(inventoryItems.updatedAt), desc(inventoryItems.createdAt)],
  });

  const availableInventory = inventory
    .filter(
      item =>
        item.lot?.tenantId === tenant.id &&
        item.status === "in_stock" &&
        !(line.allocations ?? []).some(
          allocation => allocation.inventoryItemId === item.id,
        ),
    )
    .map(item => {
      const canAllocate = !isLineClosed && getInventoryItemCases(item) <= allocationGap;
      let blockedReason: string | null = null;

      if (isLineClosed) {
        blockedReason =
          line.shortShippedAt != null
            ? "This line is closed short and cannot take new allocations."
            : "This line is already fully fulfilled.";
      } else if (getInventoryItemCases(item) > allocationGap) {
        blockedReason = `This item exceeds the ${allocationGap} remaining allocatable quantity.`;
      }

      return {
        id: item.id,
        barcodeId: item.barcodeId,
        exactWeightLbs: item.exactWeightLbs,
        cases: item.cases,
        status: item.status,
        lotId: item.lotId,
        lotNumber: item.lot?.lotNumber ?? null,
        receiveDate: item.lot?.receiveDate ?? null,
        expirationDate: item.lot?.expirationDate ?? null,
        lotStatus: getLotLifecycleStatus(item.lot?.expirationDate),
        canAllocate,
        blockedReason,
      };
    });

  const allocatedInventory = (line.allocations ?? []).map(allocation => {
    const inventoryItem = allocation.inventoryItem;
    const canRemove =
      !!inventoryItem &&
      !activeFulfillmentItemIds.has(allocation.inventoryItemId) &&
      inventoryItem.status !== "shipped" &&
      inventoryItem.status !== "sold";

    let blockedReason: string | null = null;
    if (activeFulfillmentItemIds.has(allocation.inventoryItemId)) {
      blockedReason =
        "This allocation is already linked to active fulfillment and cannot be removed.";
    } else if (
      inventoryItem?.status === "shipped" ||
      inventoryItem?.status === "sold"
    ) {
      blockedReason =
        "This inventory has already progressed past allocation and cannot be released here.";
    }

    return {
      allocationId: allocation.id,
      inventoryItemId: allocation.inventoryItemId,
      allocatedWeightLbs: allocation.allocatedWeightLbs,
      createdAt: allocation.createdAt,
      canRemove,
      blockedReason,
      inventoryItem: inventoryItem
        ? {
            id: inventoryItem.id,
            barcodeId: inventoryItem.barcodeId,
            exactWeightLbs: inventoryItem.exactWeightLbs,
            cases: inventoryItem.cases,
            status: inventoryItem.status,
            lotId: inventoryItem.lotId,
            lotNumber: inventoryItem.lot?.lotNumber ?? null,
            receiveDate: inventoryItem.lot?.receiveDate ?? null,
            expirationDate: inventoryItem.lot?.expirationDate ?? null,
            lotStatus: getLotLifecycleStatus(inventoryItem.lot?.expirationDate),
          }
        : null,
    };
  });

  return {
    salesOrderId: order.id,
    salesOrderLineId: line.id,
    line: {
      id: line.id,
      productId: line.productId,
      productLabel: line.product
        ? `${line.product.sku} · ${line.product.name}`
        : "Line item",
      expectedCases: line.expectedCases,
      fulfilledCases: line.fulfilledCases,
      remainingOpenQuantity,
      allocatedQuantity,
      allocationGap,
      unitType: line.unitType,
      shortShippedAt: line.shortShippedAt,
      isClosed: isLineClosed,
    },
    allocatedInventory,
    availableInventory,
  };
}

export async function addInventoryAllocationToSalesOrderLine(input: {
  salesOrderId: string;
  salesOrderLineId: string;
  inventoryItemId: string;
}) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();

  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }

  const order = await db.query.salesOrders.findFirst({
    where: and(
      eq(salesOrders.id, input.salesOrderId),
      eq(salesOrders.tenantId, tenant.id),
    ),
    with: {
      lines: {
        with: {
          allocations: {
            with: {
              inventoryItem: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new Error("Sales order not found.");
  }
  if (order.status === "cancelled") {
    throw new Error("Cannot edit allocations on a cancelled order.");
  }

  const line = order.lines.find(candidate => candidate.id === input.salesOrderLineId);
  if (!line) {
    throw new Error("Sales order line does not belong to this order.");
  }

  if (line.shortShippedAt) {
    throw new Error("Cannot add allocations to a short-shipped line.");
  }

  const remainingOpenQuantity = Math.max(
    0,
    line.expectedCases - line.fulfilledCases,
  );
  if (remainingOpenQuantity <= 0) {
    throw new Error("This line is already fully fulfilled.");
  }

  const inventoryItem = await db.query.inventoryItems.findFirst({
    where: eq(inventoryItems.id, input.inventoryItemId),
    with: {
      lot: {
        columns: {
          tenantId: true,
          lotNumber: true,
        },
      },
    },
  });

  if (!inventoryItem) {
    throw new Error("Inventory item not found.");
  }
  if (inventoryItem.lot?.tenantId !== tenant.id) {
    throw new Error("Inventory item does not belong to this tenant.");
  }
  if (inventoryItem.productId !== line.productId) {
    throw new Error("Inventory item does not match the line product.");
  }
  if (inventoryItem.status !== "in_stock") {
    throw new Error("Only in-stock inventory can be allocated to this line.");
  }

  const existingAllocation = await db.query.salesOrderLineAllocations.findFirst({
    where: eq(salesOrderLineAllocations.inventoryItemId, inventoryItem.id),
    columns: {
      id: true,
      salesOrderLineId: true,
    },
  });

  if (existingAllocation) {
    throw new Error("This inventory item is already allocated to another line.");
  }

  const currentAllocatedQuantity = (line.allocations ?? []).reduce(
    (sum, allocation) => sum + getInventoryItemCases(allocation.inventoryItem),
    0,
  );
  const proposedAllocatedQuantity =
    currentAllocatedQuantity + getInventoryItemCases(inventoryItem);

  if (proposedAllocatedQuantity > remainingOpenQuantity) {
    throw new Error(
      `This allocation would exceed the ${remainingOpenQuantity} remaining quantity on the line.`,
    );
  }

  await db.insert(salesOrderLineAllocations).values({
    salesOrderLineId: line.id,
    inventoryItemId: inventoryItem.id,
    allocatedWeightLbs: inventoryItem.exactWeightLbs,
  });

  await markInventoryItemAllocated(inventoryItem.id);
  await reconcileSalesOrderLineAllocations(line.id);

  return await getSalesOrderLineAllocationEditor({
    salesOrderId: input.salesOrderId,
    salesOrderLineId: input.salesOrderLineId,
  });
}

export async function removeSalesOrderLineAllocation(input: {
  salesOrderId: string;
  salesOrderLineId: string;
  allocationId: string;
}) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();

  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }

  const order = await db.query.salesOrders.findFirst({
    where: and(
      eq(salesOrders.id, input.salesOrderId),
      eq(salesOrders.tenantId, tenant.id),
    ),
    with: {
      lines: {
        with: {
          allocations: {
            with: {
              inventoryItem: true,
            },
          },
          fulfillments: {
            columns: {
              inventoryItemId: true,
              reversedAt: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new Error("Sales order not found.");
  }

  const line = order.lines.find(candidate => candidate.id === input.salesOrderLineId);
  if (!line) {
    throw new Error("Sales order line does not belong to this order.");
  }

  const allocation = (line.allocations ?? []).find(
    candidate => candidate.id === input.allocationId,
  );
  if (!allocation) {
    throw new Error("Allocation not found for this line.");
  }

  const activeFulfillmentItemIds = new Set(
    (line.fulfillments ?? [])
      .filter(fulfillment => !fulfillment.reversedAt)
      .map(fulfillment => fulfillment.inventoryItemId)
      .filter((value): value is string => Boolean(value)),
  );

  if (activeFulfillmentItemIds.has(allocation.inventoryItemId)) {
    throw new Error(
      "This allocation is linked to active fulfillment and cannot be removed.",
    );
  }

  if (
    allocation.inventoryItem?.status === "shipped" ||
    allocation.inventoryItem?.status === "sold"
  ) {
    throw new Error(
      "This inventory item has already progressed past allocation and cannot be released here.",
    );
  }

  await db
    .delete(salesOrderLineAllocations)
    .where(eq(salesOrderLineAllocations.id, allocation.id));

  await restoreInventoryItemsToStock([allocation.inventoryItemId]);
  await reconcileSalesOrderLineAllocations(line.id);

  return await getSalesOrderLineAllocationEditor({
    salesOrderId: input.salesOrderId,
    salesOrderLineId: input.salesOrderLineId,
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

  let inventoryItemLotId: string | null = null;

  if (input.inventoryItemId) {
    const inventoryItem = await db.query.inventoryItems.findFirst({
      where: eq(inventoryItems.id, input.inventoryItemId),
      columns: {
        id: true,
        productId: true,
        lotId: true,
      },
      with: {
        lot: {
          columns: {
            tenantId: true,
          },
        },
      },
    });

    if (!inventoryItem || inventoryItem.id !== input.inventoryItemId) {
      throw new Error("Inventory item not found.");
    }

    if (inventoryItem.lot?.tenantId !== tenant.id) {
      throw new Error("Inventory item does not belong to this tenant.");
    }

    if (inventoryItem.productId !== matchingLine.productId) {
      throw new Error("Inventory item does not match the sales order line product.");
    }

    inventoryItemLotId = inventoryItem.lotId;
  }

  if (input.lotId) {
    const lot = await db.query.lots.findFirst({
      where: eq(lots.id, input.lotId),
      columns: {
        id: true,
        tenantId: true,
      },
    });

    if (!lot || lot.id !== input.lotId) {
      throw new Error("Lot not found.");
    }

    if (lot.tenantId !== tenant.id) {
      throw new Error("Lot does not belong to this tenant.");
    }

    if (!input.inventoryItemId) {
      const matchingLotInventory = await db.query.inventoryItems.findFirst({
        where: and(
          eq(inventoryItems.productId, matchingLine.productId),
          eq(inventoryItems.lotId, input.lotId),
        ),
        with: {
          lot: {
            columns: {
              tenantId: true,
            },
          },
        },
      });

      if (!matchingLotInventory || matchingLotInventory.lot?.tenantId !== tenant.id) {
        throw new Error(
          "Lot does not have inventory for this product, so it cannot be linked to this fulfillment.",
        );
      }
    }
  }

  if (input.lotId && inventoryItemLotId && input.lotId !== inventoryItemLotId) {
    throw new Error("Lot does not match the selected inventory item.");
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

  const [fulfillment] = await db
    .insert(salesOrderFulfillments)
    .values({
      salesOrderId: input.salesOrderId,
      salesOrderLineId: input.salesOrderLineId,
      quantityFulfilled,
      weightLbs: weight != null ? weight.toFixed(4) : null,
      fulfilledByUserId: currentUser.id,
      fulfilledAt,
      notes: input.notes ?? null,
      inventoryItemId: input.inventoryItemId ?? null,
      lotId: input.lotId ?? null,
    })
    .returning();

  await syncSalesOrderLineFulfillment(input.salesOrderLineId);

  return db.query.salesOrderFulfillments.findFirst({
    where: eq(salesOrderFulfillments.id, fulfillment.id),
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
