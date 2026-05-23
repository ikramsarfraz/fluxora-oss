import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
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
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { requireTenantForMutation } from "@/lib/subscription-guard";
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
  const tenant = await requireTenantForMutation();
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
    const fulfilledCases = line.fulfilledCases || line.expectedCases;

    // The order line's `pricePerLbOverride` is semantically
    // "$/pricing-unit" — for `per_lb` snapshots it's per-lb, for
    // `per_case` it's per-case. Falling back to `defaultPricePerLb`
    // (which is "$/base-unit") is correct for per_lb / per_each, but
    // wrong for per_case where the customer expects a per-case price.
    // We branch on the pricing snapshot so each line resolves the
    // right number; PDF math reads the same shape.
    const pricingType =
      line.pricingUnitTypeSnapshot ??
      (line.unitType === "fixed_case" ? "per_case" : "per_lb");
    const snapshotPrice =
      line.pricePerUnitSnapshot != null
        ? Number(line.pricePerUnitSnapshot)
        : null;
    const overridePrice =
      line.pricePerLbOverride != null
        ? Number(line.pricePerLbOverride)
        : null;
    const defaultPrice = Number(line.product.defaultPricePerLb);
    // Snapshot wins; then override; then product default. For per_case
    // pricing the product-default fallback is rough (it's $/base-unit,
    // not $/case) — multiplied by conversion below to recover a sane
    // per-case figure when nothing else is set.
    let unitPrice =
      snapshotPrice ??
      overridePrice ??
      (pricingType === "per_case"
        ? defaultPrice *
          Number(
            line.pricingConversionSnapshot ??
              line.conversionToBaseSnapshot ??
              "1",
          )
        : defaultPrice);
    if (!Number.isFinite(unitPrice)) unitPrice = 0;

    // Line total math now mirrors the bill side:
    //   per_lb       → billedWeight × $/lb     (catch-weight meat)
    //   per_case     → cases × $/case          (fixed-case meat, beverages by case)
    //   per_each / per_unit (no pricing snap) → cases × $/unit
    // Falling back to the case path when billedWeight is zero keeps
    // non-weight bills (cans of soda) from rendering "$0.00".
    let lineTotal: number;
    if (pricingType === "per_lb" && billedWeight > 0) {
      lineTotal = billedWeight * unitPrice;
    } else {
      lineTotal = fulfilledCases * unitPrice;
    }

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
      quantityCases: fulfilledCases,
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
    order.customer.abbreviation,
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
    // Discount captured on the order at create/edit time flows through
    // to the invoice. `createInvoiceFromSalesOrder` already accepts an
    // explicit `discountAmount`, so we just hand it the order's stored
    // value (defaults to "0" for orders saved before the column existed).
    discountAmount: order.discountAmount ?? undefined,
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
          product: {
            // Eager-load baseUnit so the invoice detail page can render
            // per-line UOM suffixes ("/lb", "/ea", "/gal") without an
            // extra join. The invoice-line schema doesn't snapshot the
            // unit itself — we read the product's current base UOM,
            // which is locked once any bill lands.
            with: {
              baseUnit: {
                columns: { id: true, abbreviation: true, family: true },
              },
            },
          },
        },
      },
      payments: {
        with: {
          createdBy: true,
        },
        orderBy: [desc(payments.paymentDate), desc(payments.createdAt)],
      },
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

// "all" is the UI sentinel for no filter; "overdue" is computed (status=sent
// AND balance>0 AND due_date < today). The other values map 1:1 to the
// stored sales_invoices.status enum.
export type SalesInvoiceStatusFilter =
  | "all"
  | "draft"
  | "sent"
  | "overdue"
  | "partially_paid"
  | "paid"
  | "void";

export type SalesInvoiceFilters = {
  status?: SalesInvoiceStatusFilter;
  dateFrom?: string;
  dateTo?: string;
};

function buildSalesInvoiceFilterClauses(
  filters: SalesInvoiceFilters,
): SQL[] {
  const clauses: SQL[] = [];
  if (filters.status && filters.status !== "all") {
    if (filters.status === "overdue") {
      // Overdue = sent + has balance + due date passed.
      clauses.push(eq(salesInvoices.status, "sent"));
      clauses.push(sql`${salesInvoices.balanceDue}::numeric > 0`);
      clauses.push(
        sql`${salesInvoices.dueDate} IS NOT NULL AND ${salesInvoices.dueDate} < current_date`,
      );
    } else {
      clauses.push(eq(salesInvoices.status, filters.status));
    }
  }
  if (filters.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(filters.dateFrom)) {
    clauses.push(gte(salesInvoices.invoiceDate, filters.dateFrom));
  }
  if (filters.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo)) {
    clauses.push(lte(salesInvoices.invoiceDate, filters.dateTo));
  }
  return clauses;
}

export type SalesInvoiceListParams = PaginatedQueryInput<
  SalesInvoiceListSort,
  SalesInvoiceFilters
>;

export async function getSalesInvoicesPage(input?: SalesInvoiceListParams) {
  const tenant = await getCurrentTenant();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "invoiceDate",
    defaultDirection: "desc",
    defaultFilters: {} as SalesInvoiceFilters,
  });
  const where = and(
    eq(salesInvoices.tenantId, tenant.id),
    ...buildSalesInvoiceFilterClauses(query.filters),
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

export type SalesInvoicesSummary = {
  /** Filter context: total grand_total across the filtered set. */
  totalAmount: number;
  /** Filter context: total open balance_due across the filtered set. */
  totalOpenBalance: number;
  /** Count of invoices in the filtered set. */
  invoiceCount: number;
  /** Count with balance_due > 0 AND status != 'void'. */
  openCount: number;
  /** Count of "sent" invoices with due_date < today AND balance > 0. */
  overdueCount: number;
  /** Sum of balance_due across overdue invoices only. */
  overdueAmount: number;
};

/**
 * Aggregate stats for the current filter set — drives the KPI strip on
 * the invoices listing. Same filter clauses as getSalesInvoicesPage so
 * the numbers always match what's visible.
 */
export async function getSalesInvoicesSummary(
  filters: SalesInvoiceFilters = {},
  search: string = "",
): Promise<SalesInvoicesSummary> {
  const tenant = await getCurrentTenant();
  const where = and(
    eq(salesInvoices.tenantId, tenant.id),
    ...buildSalesInvoiceFilterClauses(filters),
    buildTextSearchCondition(search, [
      salesInvoices.invoiceNumber,
      salesInvoices.status,
      customers.name,
    ]),
  );

  const [row] = await db
    .select({
      totalAmount: sql<string>`coalesce(sum(${salesInvoices.totalAmount}::numeric), 0)`,
      totalOpenBalance: sql<string>`coalesce(sum(${salesInvoices.balanceDue}::numeric), 0)`,
      invoiceCount: sql<number>`count(*)::int`,
      openCount: sql<number>`count(*) filter (where ${salesInvoices.balanceDue}::numeric > 0 and ${salesInvoices.status} != 'void')::int`,
      overdueCount: sql<number>`count(*) filter (where ${salesInvoices.status} = 'sent' and ${salesInvoices.balanceDue}::numeric > 0 and ${salesInvoices.dueDate} is not null and ${salesInvoices.dueDate} < current_date)::int`,
      overdueAmount: sql<string>`coalesce(sum(${salesInvoices.balanceDue}::numeric) filter (where ${salesInvoices.status} = 'sent' and ${salesInvoices.balanceDue}::numeric > 0 and ${salesInvoices.dueDate} is not null and ${salesInvoices.dueDate} < current_date), 0)`,
    })
    .from(salesInvoices)
    .leftJoin(customers, eq(customers.id, salesInvoices.customerId))
    .where(where);

  return {
    totalAmount: Number(row?.totalAmount ?? 0),
    totalOpenBalance: Number(row?.totalOpenBalance ?? 0),
    invoiceCount: row?.invoiceCount ?? 0,
    openCount: row?.openCount ?? 0,
    overdueCount: row?.overdueCount ?? 0,
    overdueAmount: Number(row?.overdueAmount ?? 0),
  };
}

/**
 * Tenant-scoped list of invoices with a non-zero balance due and a
 * non-void status — drives the "Record payment" picker dialog on
 * /payments. Supports an optional search across invoice number and
 * customer name. Limited to keep the picker snappy; users can fall
 * back to the invoice detail page for invoices beyond the list.
 */
export async function getOpenInvoicesForPayment(input: {
  search?: string;
  limit?: number;
} = {}) {
  const tenant = await getCurrentTenant();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);

  const where = and(
    eq(salesInvoices.tenantId, tenant.id),
    sql`${salesInvoices.balanceDue}::numeric > 0`,
    sql`${salesInvoices.status} != 'void'`,
    input.search && input.search.trim()
      ? sql`(${salesInvoices.invoiceNumber} ILIKE ${`%${input.search.trim()}%`} OR ${customers.name} ILIKE ${`%${input.search.trim()}%`})`
      : undefined,
  );

  const rows = await db
    .select({
      id: salesInvoices.id,
      invoiceNumber: salesInvoices.invoiceNumber,
      invoiceDate: salesInvoices.invoiceDate,
      dueDate: salesInvoices.dueDate,
      status: salesInvoices.status,
      totalAmount: salesInvoices.totalAmount,
      amountPaid: salesInvoices.amountPaid,
      balanceDue: salesInvoices.balanceDue,
      salesOrderId: salesInvoices.salesOrderId,
      customerId: customers.id,
      customerName: customers.name,
    })
    .from(salesInvoices)
    .innerJoin(customers, eq(customers.id, salesInvoices.customerId))
    .where(where)
    .orderBy(desc(salesInvoices.dueDate), desc(salesInvoices.invoiceDate))
    .limit(limit);

  return rows;
}

export type OpenInvoiceForPayment = Awaited<
  ReturnType<typeof getOpenInvoicesForPayment>
>[number];

/**
 * Open (balance > 0, non-void) invoices for a single customer. Drives
 * the bulk-allocate dialog launched from the customer detail page.
 * Ordered oldest-first so the default FIFO auto-allocate picks the
 * oldest balances to clear.
 */
export async function getOpenInvoicesForCustomer(customerId: string) {
  const tenant = await getCurrentTenant();
  return db
    .select({
      id: salesInvoices.id,
      invoiceNumber: salesInvoices.invoiceNumber,
      invoiceDate: salesInvoices.invoiceDate,
      dueDate: salesInvoices.dueDate,
      status: salesInvoices.status,
      totalAmount: salesInvoices.totalAmount,
      amountPaid: salesInvoices.amountPaid,
      balanceDue: salesInvoices.balanceDue,
      salesOrderId: salesInvoices.salesOrderId,
    })
    .from(salesInvoices)
    .where(
      and(
        eq(salesInvoices.tenantId, tenant.id),
        eq(salesInvoices.customerId, customerId),
        sql`${salesInvoices.balanceDue}::numeric > 0`,
        sql`${salesInvoices.status} != 'void'`,
      ),
    )
    .orderBy(salesInvoices.invoiceDate);
}

export type OpenInvoiceForCustomer = Awaited<
  ReturnType<typeof getOpenInvoicesForCustomer>
>[number];

/**
 * Postgres unique-violation guard. Used to detect the race-safety
 * 23505 fired by the (tenant_id, idempotency_key) partial unique
 * index on `payments`.
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

/**
 * Returns the same shape `recordPayment` does — used by the
 * idempotency dedup paths to give the caller an identical-looking
 * success response after the original submit has already committed.
 */
function readSalesInvoiceWithRelations(salesInvoiceId: string) {
  return db.query.salesInvoices.findFirst({
    where: eq(salesInvoices.id, salesInvoiceId),
    with: {
      payments: true,
      lines: true,
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
  /**
   * Client-generated UUID per payment-submit attempt. When provided,
   * the service dedupes against the (tenant_id, idempotency_key)
   * partial unique index — a second call with the same key returns
   * the existing payment's invoice state instead of creating a
   * duplicate row (double-click / retried fetch protection).
   *
   * Optional for legacy + server-internal call paths. Form-driven
   * submits should always pass a stable per-form-instance UUID.
   */
  idempotencyKey?: string | null;
}) {
  const tenant = await requireTenantForMutation();

  // Idempotency happy-path: if this key has already produced a
  // payment row, return the current invoice state straight away.
  // The unique index below is what enforces correctness; this
  // lookup just skips the 23505 round-trip in the common case.
  if (input.idempotencyKey) {
    const existing = await db.query.payments.findFirst({
      where: and(
        eq(payments.tenantId, tenant.id),
        eq(payments.idempotencyKey, input.idempotencyKey),
      ),
    });
    if (existing) {
      return readSalesInvoiceWithRelations(existing.salesInvoiceId);
    }
  }

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

  try {
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
      idempotencyKey: input.idempotencyKey ?? null,
    });
  } catch (err) {
    // Race-safety net: a concurrent submit with the same key may
    // have committed between our pre-check above and this INSERT.
    // The partial unique index then raises 23505 — return the
    // already-recorded payment's invoice state.
    if (input.idempotencyKey && isUniqueViolation(err)) {
      return readSalesInvoiceWithRelations(input.salesInvoiceId);
    }
    throw err;
  }

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

  return readSalesInvoiceWithRelations(input.salesInvoiceId);
}

/**
 * Apply a single payment event spread across N invoices for the same
 * customer (one check / wire / ACH covering multiple bills).
 *
 * Behaviour:
 *   - All allocations commit in one transaction. All-or-nothing — a
 *     mid-batch failure rolls back the whole thing so the user never
 *     ends up with a partially-applied check.
 *   - Each allocation gets its own row in `payments` (the schema
 *     models each application as a discrete event for audit clarity)
 *     and updates its parent invoice's amount_paid / balance_due /
 *     status the same way recordPayment does.
 *   - Validates: target invoice belongs to this customer + tenant,
 *     amount > 0, amount <= current balance (1¢ tolerance), method
 *     is in the enum.
 *   - record_payment permission is enforced. Tenant cross-check too.
 */
export async function recordBulkPaymentForCustomer(input: {
  customerId: string;
  paymentDate: string;
  paymentMethod: "cash" | "zelle" | "check" | "credit_card" | "ach";
  checkNumber?: string;
  referenceNumber?: string;
  notes?: string;
  allocations: Array<{ salesInvoiceId: string; amount: string }>;
}): Promise<{
  createdPayments: Array<{ paymentId: string; invoiceId: string }>;
}> {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentPortalUser();

  if (currentUser.tenantId !== tenant.id) {
    throw new Error("Forbidden");
  }
  requirePermission(currentUser.role, "record_payment");

  if (input.allocations.length === 0) {
    throw new Error("Provide at least one invoice allocation.");
  }

  // Validate the allocations array shape + amounts upfront. Doing this
  // before opening the transaction means simple input errors don't even
  // touch the DB.
  for (const a of input.allocations) {
    const amount = Number(a.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Each allocation amount must be greater than 0.");
    }
  }

  return await db.transaction(async tx => {
    const invoiceIds = input.allocations.map(a => a.salesInvoiceId);
    const invoices = await tx.query.salesInvoices.findMany({
      where: and(
        inArray(salesInvoices.id, invoiceIds),
        eq(salesInvoices.tenantId, tenant.id),
        eq(salesInvoices.customerId, input.customerId),
      ),
    });

    if (invoices.length !== invoiceIds.length) {
      throw new Error(
        "One or more invoices were not found for this customer.",
      );
    }

    const invoiceById = new Map(invoices.map(inv => [inv.id, inv]));
    const createdPayments: Array<{ paymentId: string; invoiceId: string }> = [];

    for (const allocation of input.allocations) {
      const invoice = invoiceById.get(allocation.salesInvoiceId);
      if (!invoice) {
        throw new Error("Invoice not found in the loaded batch.");
      }

      const paymentAmount = Number(allocation.amount);
      const currentBalanceDue = Number(invoice.balanceDue);

      if (currentBalanceDue <= 0) {
        throw new Error(
          `Invoice ${invoice.invoiceNumber} is already fully paid.`,
        );
      }
      if (paymentAmount - currentBalanceDue > 0.01) {
        throw new Error(
          `Amount for invoice ${invoice.invoiceNumber} exceeds its balance due.`,
        );
      }

      const currentPaid = Number(invoice.amountPaid);
      const totalAmount = Number(invoice.totalAmount);
      const newAmountPaid = currentPaid + paymentAmount;
      const newBalanceDue = totalAmount - newAmountPaid;

      const [inserted] = await tx
        .insert(payments)
        .values({
          tenantId: tenant.id,
          salesInvoiceId: invoice.id,
          createdByUserId: currentUser.id,
          paymentDate: input.paymentDate,
          amount: allocation.amount,
          paymentMethod: input.paymentMethod,
          checkNumber: input.checkNumber,
          referenceNumber: input.referenceNumber,
          notes: input.notes,
        })
        .returning({ id: payments.id });

      await tx
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
        .where(eq(salesInvoices.id, invoice.id));

      createdPayments.push({ paymentId: inserted.id, invoiceId: invoice.id });
    }

    return { createdPayments };
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
  /** Forwarded to `recordPayment` — see that function's docstring. */
  idempotencyKey?: string | null;
}) {
  const tenant = await requireTenantForMutation();
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
    idempotencyKey: input.idempotencyKey ?? null,
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
