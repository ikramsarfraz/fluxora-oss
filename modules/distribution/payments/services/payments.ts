import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { customers, payments, salesInvoices } from "@/db/schema";

import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import {
  buildTextSearchCondition,
  createPaginatedResult,
  getPaginationOffset,
  normalizePaginatedQuery,
  resolveOrderBy,
  type PaginatedQueryInput,
} from "@/lib/pagination";

export type PaymentMethod = "cash" | "check" | "ach" | "zelle" | "credit_card";

const PAYMENT_METHODS: ReadonlySet<PaymentMethod> = new Set([
  "cash",
  "check",
  "ach",
  "zelle",
  "credit_card",
]);

export type PaymentFilters = {
  /** Single method to filter by; ignored if not in the enum. */
  method?: string;
  /** Inclusive lower bound on payment_date (YYYY-MM-DD). */
  dateFrom?: string;
  /** Inclusive upper bound on payment_date (YYYY-MM-DD). */
  dateTo?: string;
};

/**
 * Build the SQL clauses for the current filter set. Returns an array of
 * conditions to AND into the where clause — keeps the listing and summary
 * services in sync without copy-paste.
 */
function buildPaymentFilterClauses(filters: PaymentFilters): SQL[] {
  const clauses: SQL[] = [];
  if (filters.method && PAYMENT_METHODS.has(filters.method as PaymentMethod)) {
    clauses.push(eq(payments.paymentMethod, filters.method as PaymentMethod));
  }
  if (filters.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(filters.dateFrom)) {
    clauses.push(gte(payments.paymentDate, filters.dateFrom));
  }
  if (filters.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo)) {
    clauses.push(lte(payments.paymentDate, filters.dateTo));
  }
  return clauses;
}

/**
 * Tenant-scoped list of customer payments, newest first. Each row is joined
 * to its sales invoice (with customer) plus the portal user who recorded it.
 */
export async function getPayments() {
  const tenant = await getCurrentTenant();
  return db.query.payments.findMany({
    where: eq(payments.tenantId, tenant.id),
    with: {
      salesInvoice: {
        with: {
          customer: true,
        },
      },
      createdBy: true,
    },
    orderBy: [desc(payments.paymentDate), desc(payments.createdAt)],
  });
}

export type PaymentListSort =
  | "paymentDate"
  | "amount"
  | "paymentMethod"
  | "createdAt";

export type PaymentListParams = PaginatedQueryInput<
  PaymentListSort,
  PaymentFilters
>;

export async function getPaymentsPage(input?: PaymentListParams) {
  const tenant = await getCurrentTenant();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "paymentDate",
    defaultDirection: "desc",
    defaultFilters: {} as PaymentFilters,
  });
  const where = and(
    eq(payments.tenantId, tenant.id),
    ...buildPaymentFilterClauses(query.filters),
    buildTextSearchCondition(query.search, [
      payments.referenceNumber,
      payments.checkNumber,
      salesInvoices.invoiceNumber,
      customers.name,
    ]),
  );
  const [{ count }] = await db
    .select({ count: sql<number>`count(distinct ${payments.id})::int` })
    .from(payments)
    .leftJoin(salesInvoices, eq(salesInvoices.id, payments.salesInvoiceId))
    .leftJoin(customers, eq(customers.id, salesInvoices.customerId))
    .where(where);
  const paymentIds = await db
    .select({ id: payments.id })
    .from(payments)
    .leftJoin(salesInvoices, eq(salesInvoices.id, payments.salesInvoiceId))
    .leftJoin(customers, eq(customers.id, salesInvoices.customerId))
    .where(where)
    .orderBy(
      ...resolveOrderBy({
        sort: query.sort,
        direction: query.direction,
        expressions: {
          paymentDate: payments.paymentDate,
          amount: payments.amount,
          paymentMethod: payments.paymentMethod,
          createdAt: payments.createdAt,
        },
      }),
      desc(payments.createdAt),
    )
    .limit(query.pageSize)
    .offset(getPaginationOffset(query.page, query.pageSize));
  const ids = paymentIds.map(row => row.id);
  if (ids.length === 0) {
    return createPaginatedResult({
      data: [],
      page: query.page,
      pageSize: query.pageSize,
      total: count ?? 0,
    });
  }

  const rows = await db.query.payments.findMany({
    where: inArray(payments.id, ids),
    with: {
      salesInvoice: {
        with: {
          customer: true,
        },
      },
      createdBy: true,
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

/** Row shape returned by `getPayments()` (client-safe via `import type`). */
export type PaymentListItem = Awaited<ReturnType<typeof getPayments>>[number];

export type PaymentsSummary = {
  totalAmount: number;
  count: number;
  byMethod: Array<{ method: PaymentMethod; count: number; amount: number }>;
};

/**
 * Aggregate stats for the current filter set — drives the KPI strip above
 * the payments listing. Excludes pagination, applies the same filter
 * clauses as getPaymentsPage so the numbers always match what's visible.
 */
export async function getPaymentsSummary(
  filters: PaymentFilters = {},
  search: string = "",
): Promise<PaymentsSummary> {
  const tenant = await getCurrentTenant();
  const where = and(
    eq(payments.tenantId, tenant.id),
    ...buildPaymentFilterClauses(filters),
    buildTextSearchCondition(search, [
      payments.referenceNumber,
      payments.checkNumber,
      salesInvoices.invoiceNumber,
      customers.name,
    ]),
  );

  const rows = await db
    .select({
      method: payments.paymentMethod,
      count: sql<number>`count(*)::int`,
      amount: sql<string>`coalesce(sum(${payments.amount}::numeric), 0)`,
    })
    .from(payments)
    .leftJoin(salesInvoices, eq(salesInvoices.id, payments.salesInvoiceId))
    .leftJoin(customers, eq(customers.id, salesInvoices.customerId))
    .where(where)
    .groupBy(payments.paymentMethod);

  const byMethod = rows.map(row => ({
    method: row.method as PaymentMethod,
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
 * Tenant-scoped payment detail. Returns `null` if no payment matches.
 */
export async function getPaymentById(id: string) {
  const tenant = await getCurrentTenant();
  const row = await db.query.payments.findFirst({
    where: and(eq(payments.id, id), eq(payments.tenantId, tenant.id)),
    with: {
      salesInvoice: {
        with: {
          customer: true,
          // All payment events on this invoice — the detail page shows the
          // current event prominently and the rest as "other payments on
          // this invoice" so partial-payment context is visible without a
          // separate roundtrip.
          payments: {
            with: { createdBy: true },
            orderBy: [desc(payments.paymentDate), desc(payments.createdAt)],
          },
        },
      },
      createdBy: true,
    },
  });
  return row ?? null;
}

export type PaymentDetail = NonNullable<
  Awaited<ReturnType<typeof getPaymentById>>
>;
