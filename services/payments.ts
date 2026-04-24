import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { customers, payments, salesInvoices } from "@/db/schema";

import { getCurrentTenant } from "./tenants";
import {
  buildTextSearchCondition,
  createPaginatedResult,
  getPaginationOffset,
  normalizePaginatedQuery,
  resolveOrderBy,
  type PaginatedQueryInput,
} from "@/lib/pagination";

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

export type PaymentListParams = PaginatedQueryInput<PaymentListSort>;

export async function getPaymentsPage(input?: PaymentListParams) {
  const tenant = await getCurrentTenant();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "paymentDate",
    defaultDirection: "desc",
    defaultFilters: {},
  });
  const where = and(
    eq(payments.tenantId, tenant.id),
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
