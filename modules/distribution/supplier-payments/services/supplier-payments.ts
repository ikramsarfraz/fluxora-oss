import {
  and,
  desc,
  eq,
  gte,
  inArray,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import {
  suppliers,
  supplierInvoicePayments,
  supplierInvoices,
} from "@/db/schema";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import {
  buildTextSearchCondition,
  createPaginatedResult,
  getPaginationOffset,
  normalizePaginatedQuery,
  resolveOrderBy,
  type PaginatedQueryInput,
} from "@/lib/pagination";

export type BillPaymentMethod =
  | "cash"
  | "check"
  | "ach"
  | "zelle"
  | "credit_card";

const BILL_PAYMENT_METHODS: ReadonlySet<BillPaymentMethod> = new Set([
  "cash",
  "check",
  "ach",
  "zelle",
  "credit_card",
]);

export type BillPaymentFilters = {
  method?: string;
  dateFrom?: string;
  dateTo?: string;
};

function buildBillPaymentFilterClauses(
  filters: BillPaymentFilters,
): SQL[] {
  const clauses: SQL[] = [];
  if (
    filters.method &&
    BILL_PAYMENT_METHODS.has(filters.method as BillPaymentMethod)
  ) {
    clauses.push(
      eq(supplierInvoicePayments.paymentMethod, filters.method as BillPaymentMethod),
    );
  }
  if (filters.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(filters.dateFrom)) {
    clauses.push(gte(supplierInvoicePayments.paymentDate, filters.dateFrom));
  }
  if (filters.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo)) {
    clauses.push(lte(supplierInvoicePayments.paymentDate, filters.dateTo));
  }
  return clauses;
}

export type BillPaymentListSort =
  | "paymentDate"
  | "amount"
  | "paymentMethod"
  | "createdAt";

export type BillPaymentListParams = PaginatedQueryInput<
  BillPaymentListSort,
  BillPaymentFilters
>;

/**
 * Tenant-scoped paginated listing of AP payments. Joins through to
 * supplier_invoices and suppliers so the table can render bill # and
 * supplier name without N+1 follow-ups. Sort and filter clauses mirror
 * the AR payments service so behaviour stays parallel.
 */
export async function getBillPaymentsPage(input?: BillPaymentListParams) {
  const tenant = await getCurrentTenant();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "paymentDate",
    defaultDirection: "desc",
    defaultFilters: {} as BillPaymentFilters,
  });

  const where = and(
    eq(supplierInvoicePayments.tenantId, tenant.id),
    ...buildBillPaymentFilterClauses(query.filters),
    buildTextSearchCondition(query.search, [
      supplierInvoicePayments.checkNumber,
      supplierInvoicePayments.referenceNumber,
      supplierInvoices.invoiceNumber,
      suppliers.name,
    ]),
  );

  const [{ count }] = await db
    .select({ count: sql<number>`count(distinct ${supplierInvoicePayments.id})::int` })
    .from(supplierInvoicePayments)
    .leftJoin(
      supplierInvoices,
      eq(supplierInvoices.id, supplierInvoicePayments.supplierInvoiceId),
    )
    .leftJoin(suppliers, eq(suppliers.id, supplierInvoices.supplierId))
    .where(where);

  const ids = (
    await db
      .select({ id: supplierInvoicePayments.id })
      .from(supplierInvoicePayments)
      .leftJoin(
        supplierInvoices,
        eq(supplierInvoices.id, supplierInvoicePayments.supplierInvoiceId),
      )
      .leftJoin(suppliers, eq(suppliers.id, supplierInvoices.supplierId))
      .where(where)
      .orderBy(
        ...resolveOrderBy({
          sort: query.sort,
          direction: query.direction,
          expressions: {
            paymentDate: supplierInvoicePayments.paymentDate,
            amount: supplierInvoicePayments.amount,
            paymentMethod: supplierInvoicePayments.paymentMethod,
            createdAt: supplierInvoicePayments.createdAt,
          },
        }),
        desc(supplierInvoicePayments.createdAt),
      )
      .limit(query.pageSize)
      .offset(getPaginationOffset(query.page, query.pageSize))
  ).map(r => r.id);

  const rows = ids.length
    ? await db.query.supplierInvoicePayments.findMany({
        where: inArray(supplierInvoicePayments.id, ids),
        with: {
          supplierInvoice: {
            with: { supplier: true },
          },
          createdBy: true,
        },
      })
    : [];

  const rowMap = new Map(rows.map(row => [row.id, row]));
  return createPaginatedResult({
    data: ids
      .map(id => rowMap.get(id))
      .filter((r): r is (typeof rows)[number] => Boolean(r)),
    page: query.page,
    pageSize: query.pageSize,
    total: count ?? 0,
  });
}

export type BillPaymentListItem = NonNullable<
  Awaited<ReturnType<typeof getBillPaymentsPage>>["data"][number]
>;

export type BillPaymentsSummary = {
  totalAmount: number;
  count: number;
  byMethod: Array<{ method: BillPaymentMethod; count: number; amount: number }>;
};

/**
 * KPI strip aggregates for the current filter set. Same SQL shape and
 * filter helpers as the listing so the totals always match the visible
 * rows.
 */
export async function getBillPaymentsSummary(
  filters: BillPaymentFilters = {},
  search: string = "",
): Promise<BillPaymentsSummary> {
  const tenant = await getCurrentTenant();
  const where = and(
    eq(supplierInvoicePayments.tenantId, tenant.id),
    ...buildBillPaymentFilterClauses(filters),
    buildTextSearchCondition(search, [
      supplierInvoicePayments.checkNumber,
      supplierInvoicePayments.referenceNumber,
      supplierInvoices.invoiceNumber,
      suppliers.name,
    ]),
  );

  const rows = await db
    .select({
      method: supplierInvoicePayments.paymentMethod,
      count: sql<number>`count(*)::int`,
      amount: sql<string>`coalesce(sum(${supplierInvoicePayments.amount}::numeric), 0)`,
    })
    .from(supplierInvoicePayments)
    .leftJoin(
      supplierInvoices,
      eq(supplierInvoices.id, supplierInvoicePayments.supplierInvoiceId),
    )
    .leftJoin(suppliers, eq(suppliers.id, supplierInvoices.supplierId))
    .where(where)
    .groupBy(supplierInvoicePayments.paymentMethod);

  const byMethod = rows.map(row => ({
    method: row.method as BillPaymentMethod,
    count: row.count,
    amount: Number(row.amount),
  }));

  return {
    totalAmount: byMethod.reduce((sum, m) => sum + m.amount, 0),
    count: byMethod.reduce((sum, m) => sum + m.count, 0),
    byMethod,
  };
}

/**
 * Tenant-scoped detail for a single AP payment. Loads the linked bill,
 * supplier, recorder, and all sibling payments on the same bill so the
 * detail page can render partial-payment context without a follow-up
 * roundtrip — same pattern as getPaymentById on the AR side.
 */
export async function getBillPaymentById(id: string) {
  const tenant = await getCurrentTenant();
  const row = await db.query.supplierInvoicePayments.findFirst({
    where: and(
      eq(supplierInvoicePayments.id, id),
      eq(supplierInvoicePayments.tenantId, tenant.id),
    ),
    with: {
      supplierInvoice: {
        with: {
          supplier: true,
          payments: {
            with: { createdBy: true },
            orderBy: [
              desc(supplierInvoicePayments.paymentDate),
              desc(supplierInvoicePayments.createdAt),
            ],
          },
        },
      },
      createdBy: true,
    },
  });
  return row ?? null;
}

export type BillPaymentDetail = NonNullable<
  Awaited<ReturnType<typeof getBillPaymentById>>
>;

/**
 * Open bills with non-zero balance — drives the global "Record payment"
 * picker on /bill-payments. Joins supplier for display. Limited to
 * keep the picker snappy.
 */
export async function getOpenBillsForPayment(input: {
  search?: string;
  limit?: number;
} = {}) {
  const tenant = await getCurrentTenant();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const searchTerm = input.search?.trim() ?? "";

  // We need to compute balance_due from payments[] sum since the
  // supplier_invoices column is vestigial. Use a subquery to aggregate
  // payments per bill, then filter to ones where total > paid.
  const paidByInvoice = db
    .select({
      invoiceId: supplierInvoicePayments.supplierInvoiceId,
      paid: sql<string>`coalesce(sum(${supplierInvoicePayments.amount}::numeric), 0)`.as(
        "paid",
      ),
    })
    .from(supplierInvoicePayments)
    .where(eq(supplierInvoicePayments.tenantId, tenant.id))
    .groupBy(supplierInvoicePayments.supplierInvoiceId)
    .as("paid_by_invoice");

  const where = and(
    eq(supplierInvoices.tenantId, tenant.id),
    eq(supplierInvoices.status, "completed"),
    sql`(${supplierInvoices.totalAmount}::numeric - coalesce(${paidByInvoice.paid}::numeric, 0)) > 0.005`,
    searchTerm
      ? sql`(${supplierInvoices.invoiceNumber} ILIKE ${`%${searchTerm}%`} OR ${suppliers.name} ILIKE ${`%${searchTerm}%`})`
      : undefined,
  );

  // Supplier "due date" is derived from invoice_date + supplier.net_days,
  // not a stored column. Compute it inline so the picker can flag overdue
  // bills the same way the AR picker does for sales invoices.
  const rows = await db
    .select({
      id: supplierInvoices.id,
      invoiceNumber: supplierInvoices.invoiceNumber,
      invoiceDate: supplierInvoices.invoiceDate,
      computedDueDate: sql<string | null>`
        case
          when ${suppliers.netDays} is null then null
          else (${supplierInvoices.invoiceDate}::date + (${suppliers.netDays} || ' days')::interval)::date
        end
      `,
      totalAmount: supplierInvoices.totalAmount,
      paid: sql<string>`coalesce(${paidByInvoice.paid}::numeric, 0)`,
      balanceDue: sql<string>`(${supplierInvoices.totalAmount}::numeric - coalesce(${paidByInvoice.paid}::numeric, 0))`,
      supplierId: suppliers.id,
      supplierName: suppliers.name,
      supplierNetDays: suppliers.netDays,
    })
    .from(supplierInvoices)
    .innerJoin(suppliers, eq(suppliers.id, supplierInvoices.supplierId))
    .leftJoin(paidByInvoice, eq(paidByInvoice.invoiceId, supplierInvoices.id))
    .where(where)
    .orderBy(desc(supplierInvoices.invoiceDate))
    .limit(limit);

  return rows;
}

export type OpenBillForPayment = Awaited<
  ReturnType<typeof getOpenBillsForPayment>
>[number];
