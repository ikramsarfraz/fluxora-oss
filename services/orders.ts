import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  customerProductPrices,
  products,
  salesOrderLineAllocations,
  salesOrderLines,
  salesOrders,
} from "@/db/schema";

function makeOrderNumber(id: number) {
  return `SO-${String(id).padStart(6, "0")}`;
}

export async function createSalesOrder(input: {
  customerId: number;
  createdByUserId: number;
  orderDate: string;
  dueDate?: string;
  addFuelSurcharge?: boolean;
  lines: Array<{
    productId: number;
    expectedCases: number;
    unitType?: "catch_weight" | "case" | "packet";
    pricePerLbOverride?: string;
  }>;
}) {
  const [order] = await db
    .insert(salesOrders)
    .values({
      customerId: input.customerId,
      orderDate: input.orderDate,
      dueDate: input.dueDate,
      addFuelSurcharge: input.addFuelSurcharge ?? true,
      createdByUserId: input.createdByUserId,
      updatedByUserId: input.createdByUserId,
      status: "sales_order",
    })
    .returning();

  const orderNumber = makeOrderNumber(order.id);

  await db
    .update(salesOrders)
    .set({
      orderNumber,
    })
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
    with: {
      lines: true,
    },
  });
}

export async function allocateInventoryToSalesOrderLine(input: {
  salesOrderLineId: number;
  allocations: Array<{
    inventoryItemId: number;
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
    with: {
      allocations: true,
    },
  });
}
