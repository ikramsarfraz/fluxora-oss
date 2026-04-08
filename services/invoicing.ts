import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  inventoryItems,
  payments,
  salesInvoiceLines,
  salesInvoices,
  salesOrderLineAllocations,
  salesOrderLines,
  salesOrders,
} from "@/db/schema";

function makeInvoiceNumber(prefix: string | null | undefined, id: number) {
  const base = `INV-${String(id).padStart(6, "0")}`;
  return prefix ? `${prefix}-${base}` : base;
}

export async function createInvoiceFromSalesOrder(input: {
  salesOrderId: number;
  createdByUserId: number;
  invoiceDate: string;
  dueDate?: string;
  discountAmount?: string;
  creditType?: "early_payment" | "volume" | "promotional" | "other";
  creditAmount?: string;
}) {
  const order = await db.query.salesOrders.findFirst({
    where: eq(salesOrders.id, input.salesOrderId),
    with: {
      customer: true,
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
    },
  });

  if (!order) {
    throw new Error("Sales order not found");
  }

  let subtotal = 0;
  const invoiceLinesPayload: Array<{
    productId: number;
    quantityCases: number;
    billedWeightLbs: string;
    unitPrice: string;
    lineTotal: string;
  }> = [];

  for (const line of order.lines) {
    const billedWeight = line.allocations.reduce(
      (sum, allocation) => sum + Number(allocation.allocatedWeightLbs),
      0,
    );

    const unitPrice = Number(
      line.pricePerLbOverride ?? line.product.defaultPricePerLb,
    );

    const lineTotal = billedWeight * unitPrice;
    subtotal += lineTotal;

    invoiceLinesPayload.push({
      productId: line.productId,
      quantityCases: line.fulfilledCases || line.expectedCases,
      billedWeightLbs: billedWeight.toFixed(4),
      unitPrice: unitPrice.toFixed(4),
      lineTotal: lineTotal.toFixed(2),
    });
  }

  const fuelSurchargeAmount =
    order.addFuelSurcharge && order.customer.fuelSurchargeAmount
      ? Number(order.customer.fuelSurchargeAmount)
      : 0;

  const discountAmount = Number(input.discountAmount ?? "0");
  const creditAmount = Number(input.creditAmount ?? "0");
  const totalAmount =
    subtotal + fuelSurchargeAmount - discountAmount - creditAmount;
  const balanceDue = totalAmount;

  const [invoice] = await db
    .insert(salesInvoices)
    .values({
      invoiceNumber: `TEMP-${input.salesOrderId}-${Date.now()}`,
      salesOrderId: order.id,
      customerId: order.customerId,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      status: "draft",
      subtotal: subtotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      creditType: input.creditType,
      creditAmount: creditAmount.toFixed(2),
      fuelSurchargeAmount: fuelSurchargeAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      amountPaid: "0",
      balanceDue: balanceDue.toFixed(2),
      createdByUserId: input.createdByUserId,
    })
    .returning();

  const invoiceNumber = makeInvoiceNumber(
    order.customer.invoicePrefix,
    invoice.id,
  );

  await db
    .update(salesInvoices)
    .set({
      invoiceNumber,
    })
    .where(eq(salesInvoices.id, invoice.id));

  for (const line of invoiceLinesPayload) {
    await db.insert(salesInvoiceLines).values({
      salesInvoiceId: invoice.id,
      productId: line.productId,
      quantityCases: line.quantityCases,
      billedWeightLbs: line.billedWeightLbs,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
    });
  }

  return db.query.salesInvoices.findFirst({
    where: eq(salesInvoices.id, invoice.id),
    with: {
      lines: true,
      customer: true,
      salesOrder: true,
    },
  });
}

export async function recordPayment(input: {
  salesInvoiceId: number;
  createdByUserId: number;
  paymentDate: string;
  amount: string;
  paymentMethod: "cash" | "zelle" | "check" | "credit_card" | "ach";
  checkNumber?: string;
  referenceNumber?: string;
  notes?: string;
}) {
  const invoice = await db.query.salesInvoices.findFirst({
    where: eq(salesInvoices.id, input.salesInvoiceId),
  });

  if (!invoice) {
    throw new Error("Sales invoice not found");
  }

  const paymentAmount = Number(input.amount);
  const currentPaid = Number(invoice.amountPaid);
  const totalAmount = Number(invoice.totalAmount);
  const newAmountPaid = currentPaid + paymentAmount;
  const newBalanceDue = totalAmount - newAmountPaid;

  await db.insert(payments).values({
    salesInvoiceId: input.salesInvoiceId,
    createdByUserId: input.createdByUserId,
    paymentDate: input.paymentDate,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    checkNumber: input.checkNumber,
    referenceNumber: input.referenceNumber,
    notes: input.notes,
  });

  await db
    .update(salesInvoices)
    .set({
      amountPaid: newAmountPaid.toFixed(2),
      balanceDue: Math.max(newBalanceDue, 0).toFixed(2),
      status:
        newAmountPaid >= totalAmount
          ? "paid"
          : newAmountPaid > 0
            ? "partially_paid"
            : invoice.status,
    })
    .where(eq(salesInvoices.id, input.salesInvoiceId));

  return db.query.salesInvoices.findFirst({
    where: eq(salesInvoices.id, input.salesInvoiceId),
    with: {
      payments: true,
      lines: true,
    },
  });
}

export async function markAllocatedInventoryAsShipped(salesOrderId: number) {
  const orderLines = await db.query.salesOrderLines.findMany({
    where: eq(salesOrderLines.salesOrderId, salesOrderId),
    with: {
      allocations: true,
    },
  });

  const inventoryItemIds = orderLines.flatMap(line =>
    line.allocations.map(allocation => allocation.inventoryItemId),
  );

  if (inventoryItemIds.length === 0) {
    return { updatedCount: 0 };
  }

  await db
    .update(inventoryItems)
    .set({
      status: "shipped",
      updatedAt: new Date(),
    })
    .where(inArray(inventoryItems.id, inventoryItemIds));

  await db
    .update(salesOrders)
    .set({
      status: "fulfilled",
      updatedAt: new Date(),
    })
    .where(eq(salesOrders.id, salesOrderId));

  return { updatedCount: inventoryItemIds.length };
}
