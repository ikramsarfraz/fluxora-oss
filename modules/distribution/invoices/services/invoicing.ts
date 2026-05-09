import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  payments,
  salesInvoiceLines,
  salesInvoices,
  salesOrderLines,
  salesOrders,
} from "@/db/schema";
import { markInventoryItemsSold } from "@/modules/distribution/services/inventory-state";
import { getCurrentPortalUser } from "@/modules/core/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { requirePermission } from "@/lib/auth/permissions";
import {
  buildTextSearchCondition,
  createPaginatedResult,
  getPaginationOffset,
  normalizePaginatedQuery,
  resolveOrderBy,
  type PaginatedQueryInput,
} from "@/lib/pagination";

function makeInvoiceNumber(prefix: string | null | undefined, id: string) {
  const numericSuffix = parseInt(String(id).replaceAll("-", "").slice(-6), 16);
  const base = `INV-${String(numericSuffix || 0).padStart(6, "0")}`;
  return prefix ? `${prefix}-${base}` : base;
}

function roundMoney4(value: number) {
  return value.toFixed(4);
}

function roundMoney2(value: number) {
  return value.toFixed(2);
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
  const tenant = await getCurrentTenant();
  const order = await db.query.salesOrders.findFirst({
    where: and(
      eq(salesOrders.id, input.salesOrderId),
      eq(salesOrders.tenantId, tenant.id),
    ),
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
              costAmountSnapshot: true,
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
    cogsAmountSnapshot: string;
  }> = [];

  for (const line of order.lines) {
    const billedWeight = Number(line.totalBilledWeightLbs ?? "0");

    const unitPrice = Number(
      line.pricePerLbOverride ?? line.product.defaultPricePerLb,
    );

    const lineTotal = billedWeight * unitPrice;
    const cogsAmount = (line.fulfillments ?? [])
      .filter(fulfillment => !fulfillment.reversedAt)
      .reduce(
        (sum, fulfillment) =>
          sum + (Number(fulfillment.costAmountSnapshot ?? "0") || 0),
        0,
      );
    subtotal += lineTotal;

    invoiceLinesPayload.push({
      productId: line.productId,
      quantityCases: line.fulfilledCases || line.expectedCases,
      billedWeightLbs: billedWeight.toFixed(4),
      unitPrice: roundMoney4(unitPrice),
      lineTotal: roundMoney2(lineTotal),
      cogsAmountSnapshot: roundMoney4(cogsAmount),
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
      cogsAmountSnapshot: line.cogsAmountSnapshot,
    });
  }

  const fulfilledInventoryItemIds = order.lines.flatMap(line =>
    (line.fulfillments ?? [])
      .filter(
        fulfillment =>
          !fulfillment.reversedAt && Boolean(fulfillment.inventoryItemId),
      )
      .map(fulfillment => fulfillment.inventoryItemId!),
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

  requirePermission(currentUser.role, "generate_invoice");

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
    throw new Error(
      "An invoice has already been generated for this sales order.",
    );
  }

  const hasLines = (order.lines?.length ?? 0) > 0;
  const allLinesClosed =
    hasLines &&
    (order.lines ?? []).every(
      line =>
        line.shortShippedAt != null ||
        line.fulfilledCases >= line.expectedCases,
    );

  if (!allLinesClosed) {
    throw new Error(
      "Invoice generation is only allowed after every line is fulfilled or short shipped.",
    );
  }

  const invoiceDate =
    input.invoiceDate ?? new Date().toISOString().slice(0, 10);

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
      customer: {
        with: {
          addresses: true,
        },
      },
      salesOrder: {
        with: {
          customer: {
            with: {
              addresses: true,
            },
          },
          lines: {
            with: {
              product: true,
              fulfillments: {
                with: {
                  inventoryItem: true,
                },
              },
            },
          },
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

export type SalesInvoiceDetail = NonNullable<
  Awaited<ReturnType<typeof getSalesInvoiceById>>
>;

export async function getSalesInvoices() {
  const tenant = await getCurrentTenant();
  return db.query.salesInvoices.findMany({
    where: eq(salesInvoices.tenantId, tenant.id),
    with: {
      customer: true,
    },
    orderBy: [desc(salesInvoices.invoiceDate)],
  });
}

export type SalesInvoiceListSort =
  | "invoiceNumber"
  | "invoiceDate"
  | "status"
  | "totalAmount"
  | "balanceDue";

export type SalesInvoiceListParams = PaginatedQueryInput<SalesInvoiceListSort>;

export async function getSalesInvoicesPage(input?: SalesInvoiceListParams) {
  const tenant = await getCurrentTenant();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "invoiceDate",
    defaultDirection: "desc",
    defaultFilters: {},
  });
  const where = and(
    eq(salesInvoices.tenantId, tenant.id),
    buildTextSearchCondition(query.search, [
      salesInvoices.invoiceNumber,
      salesInvoices.status,
      customers.name,
    ]),
  );
  const [{ count }] = await db
    .select({ count: sql<number>`count(distinct ${salesInvoices.id})::int` })
    .from(salesInvoices)
    .leftJoin(customers, eq(customers.id, salesInvoices.customerId))
    .where(where);
  const invoiceIds = await db
    .select({ id: salesInvoices.id })
    .from(salesInvoices)
    .leftJoin(customers, eq(customers.id, salesInvoices.customerId))
    .where(where)
    .orderBy(
      ...resolveOrderBy({
        sort: query.sort,
        direction: query.direction,
        expressions: {
          invoiceNumber: salesInvoices.invoiceNumber,
          invoiceDate: salesInvoices.invoiceDate,
          status: salesInvoices.status,
          totalAmount: salesInvoices.totalAmount,
          balanceDue: salesInvoices.balanceDue,
        },
      }),
      desc(salesInvoices.createdAt),
    )
    .limit(query.pageSize)
    .offset(getPaginationOffset(query.page, query.pageSize));
  const ids = invoiceIds.map(row => row.id);
  if (ids.length === 0) {
    return createPaginatedResult({
      data: [],
      page: query.page,
      pageSize: query.pageSize,
      total: count ?? 0,
    });
  }

  const rows = await db.query.salesInvoices.findMany({
    where: inArray(salesInvoices.id, ids),
    with: {
      customer: true,
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

/** Row shape returned by `getSalesInvoices()` (for client `import type` only). */
export type SalesInvoiceListItem = Awaited<
  ReturnType<typeof getSalesInvoices>
>[number];

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

  requirePermission(currentUser.role, "record_payment");

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
    .where(
      and(
        eq(salesOrders.id, salesOrderId),
        eq(salesOrders.tenantId, tenant.id),
      ),
    );

  return { updatedCount: inventoryItemIds.length };
}
