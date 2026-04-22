import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  payments,
  salesInvoiceLines,
  salesInvoices,
  salesOrderLines,
  salesOrders,
} from "@/db/schema";
import { markInventoryItemsSold } from "./inventory-state";
import { getCurrentPortalUser } from "./portal-users";
import { getCurrentTenant } from "./tenants";

function makeInvoiceNumber(prefix: string | null | undefined, id: string) {
  const numericSuffix = parseInt(String(id).replaceAll("-", "").slice(-6), 16);
  const base = `INV-${String(numericSuffix || 0).padStart(6, "0")}`;
  return prefix ? `${prefix}-${base}` : base;
}

export async function createInvoiceFromSalesOrder(input: {
  salesOrderId: string;
  createdByUserId: string;
  invoiceDate: string;
  dueDate?: string;
  discountAmount?: string;
  creditType?: "fixed" | "percentage";
  creditAmount?: string;
}) {
  const order = await db.query.salesOrders.findFirst({
    where: eq(salesOrders.id, input.salesOrderId),
    columns: {
      id: true,
      tenantId: true,
      customerId: true,
      addFuelSurcharge: true,
    },
    with: {
      customer: true,
      lines: {
        with: {
          product: true,
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
    throw new Error("Sales order not found");
  }

  let subtotal = 0;
  const invoiceLinesPayload: Array<{
    productId: string;
    quantityCases: number;
    billedWeightLbs: string;
    unitPrice: string;
    lineTotal: string;
  }> = [];

  for (const line of order.lines) {
    const billedWeight = Number(line.totalBilledWeightLbs ?? "0");

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
      tenantId: order.tenantId,
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

  const fulfilledInventoryItemIds = order.lines.flatMap(line =>
    (line.fulfillments ?? [])
      .filter(
        fulfillment =>
          !fulfillment.reversedAt && Boolean(fulfillment.inventoryItemId),
      )
      .map(fulfillment => fulfillment.inventoryItemId!)
  );

  await markInventoryItemsSold(fulfilledInventoryItemIds);

  return db.query.salesInvoices.findFirst({
    where: eq(salesInvoices.id, invoice.id),
    with: {
      lines: true,
      customer: true,
      salesOrder: true,
      payments: true,
    },
  });
}

export async function generateInvoiceForSalesOrder(input: {
  salesOrderId: string;
  invoiceDate?: string;
  dueDate?: string;
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
      customer: true,
      lines: {
        columns: {
          expectedCases: true,
          fulfilledCases: true,
          shortShippedAt: true,
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

  if ((order.invoices?.length ?? 0) > 0) {
    throw new Error("An invoice has already been generated for this sales order.");
  }

  const hasLines = (order.lines?.length ?? 0) > 0;
  const allLinesClosed =
    hasLines &&
    (order.lines ?? []).every(
      line =>
        line.shortShippedAt != null || line.fulfilledCases >= line.expectedCases,
    );

  if (!allLinesClosed) {
    throw new Error(
      "Invoice generation is only allowed after every line is fulfilled or short shipped.",
    );
  }

  const invoiceDate =
    input.invoiceDate ??
    new Date().toISOString().slice(0, 10);

  return createInvoiceFromSalesOrder({
    salesOrderId: order.id,
    createdByUserId: currentUser.id,
    invoiceDate,
    dueDate: input.dueDate ?? order.dueDate ?? undefined,
  });
}

export async function getSalesInvoiceById(id: string) {
  const tenant = await getCurrentTenant();
  return db.query.salesInvoices.findFirst({
    where: and(eq(salesInvoices.id, id), eq(salesInvoices.tenantId, tenant.id)),
    with: {
      customer: true,
      salesOrder: {
        with: {
          customer: true,
        },
      },
      lines: {
        with: {
          product: true,
        },
      },
      payments: true,
      createdBy: true,
      updatedBy: true,
    },
  });
}

export async function recordPayment(input: {
  salesInvoiceId: string;
  createdByUserId: string;
  paymentDate: string;
  amount: string;
  paymentMethod: "cash" | "zelle" | "check" | "credit_card" | "ach";
  checkNumber?: string;
  referenceNumber?: string;
  notes?: string;
}) {
  const tenant = await getCurrentTenant();
  const invoice = await db.query.salesInvoices.findFirst({
    where: and(
      eq(salesInvoices.id, input.salesInvoiceId),
      eq(salesInvoices.tenantId, tenant.id),
    ),
  });

  if (!invoice) {
    throw new Error("Sales invoice not found");
  }

  const paymentAmount = Number(input.amount);
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new Error("Payment amount must be greater than 0.");
  }
  const currentPaid = Number(invoice.amountPaid);
  const totalAmount = Number(invoice.totalAmount);
  const currentBalanceDue = Number(invoice.balanceDue);

  if (currentBalanceDue <= 0) {
    throw new Error("This invoice is already fully paid.");
  }

  if (paymentAmount - currentBalanceDue > 0.01) {
    throw new Error("Payment amount cannot exceed the invoice balance due.");
  }

  const newAmountPaid = currentPaid + paymentAmount;
  const newBalanceDue = totalAmount - newAmountPaid;

  await db.insert(payments).values({
    tenantId: tenant.id,
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

export async function recordPaymentForSalesOrderInvoice(input: {
  salesOrderId: string;
  salesInvoiceId: string;
  paymentDate: string;
  amount: string;
  paymentMethod: "cash" | "zelle" | "check" | "credit_card" | "ach";
  checkNumber?: string;
  referenceNumber?: string;
  notes?: string;
}) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();

  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }

  const invoice = await db.query.salesInvoices.findFirst({
    where: and(
      eq(salesInvoices.id, input.salesInvoiceId),
      eq(salesInvoices.salesOrderId, input.salesOrderId),
      eq(salesInvoices.tenantId, tenant.id),
    ),
    columns: {
      id: true,
    },
  });

  if (!invoice) {
    throw new Error("Invoice does not belong to this sales order.");
  }

  return recordPayment({
    salesInvoiceId: input.salesInvoiceId,
    createdByUserId: currentUser.id,
    paymentDate: input.paymentDate,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    checkNumber: input.checkNumber,
    referenceNumber: input.referenceNumber,
    notes: input.notes,
  });
}

export async function markAllocatedInventoryAsShipped(salesOrderId: string) {
  const tenant = await getCurrentTenant();
  const order = await db.query.salesOrders.findFirst({
    where: and(
      eq(salesOrders.id, salesOrderId),
      eq(salesOrders.tenantId, tenant.id),
    ),
    columns: {
      id: true,
    },
  });

  if (!order) {
    throw new Error("Sales order not found");
  }

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

  await markInventoryItemsSold(inventoryItemIds);

  await db
    .update(salesOrders)
    .set({
      status: "fulfilled",
      updatedAt: new Date(),
    })
    .where(and(eq(salesOrders.id, salesOrderId), eq(salesOrders.tenantId, tenant.id)));

  return { updatedCount: inventoryItemIds.length };
}
