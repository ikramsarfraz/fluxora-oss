import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  customerProductPrices,
  products,
  salesOrderLineAllocations,
  salesOrderLines,
  salesOrders,
} from "@/db/schema";
import { getCurrentPortalUser } from "./portal-users";
import { getCurrentTenant } from "./tenants";

/** Short human-readable suffix. Prefix (if any) is applied downstream per-customer. */
function makeOrderNumber(id: string) {
  return `SO-${id.slice(0, 8).toUpperCase()}`;
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
          allocations: {
            with: {
              inventoryItem: true,
            },
          },
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
  }

  return db.query.salesOrderLines.findFirst({
    where: eq(salesOrderLines.id, input.salesOrderLineId),
    with: { allocations: true },
  });
}
