import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  lots,
  supplierInvoices,
  suppliers,
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

export async function getSupplierById(supplierId: string) {
  const tenant = await getCurrentTenant();
  const result = await db.query.suppliers.findFirst({
    where: and(eq(suppliers.id, supplierId), eq(suppliers.tenantId, tenant.id)),
  });

  return result ?? null;
}

export type SupplierDetail = NonNullable<
  Awaited<ReturnType<typeof getSupplierById>>
>;

export type SupplierListSort = "name" | "netDays" | "createdAt";
export type SupplierListParams = PaginatedQueryInput<SupplierListSort>;

export async function getSuppliers() {
  const tenant = await getCurrentTenant();
  const result = await db.query.suppliers.findMany({
    with: {
      productCosts: true,
    },
    where: eq(suppliers.tenantId, tenant.id),
  });

  return result;
}

export async function getSuppliersPage(input?: SupplierListParams) {
  const tenant = await getCurrentTenant();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "createdAt",
    defaultDirection: "desc",
    defaultFilters: {},
  });
  const where = and(
    eq(suppliers.tenantId, tenant.id),
    buildTextSearchCondition(query.search, [suppliers.name]),
  );
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(suppliers)
    .where(where);
  const result = await db.query.suppliers.findMany({
    with: {
      productCosts: true,
    },
    where,
    orderBy: resolveOrderBy({
      sort: query.sort,
      direction: query.direction,
      expressions: {
        name: suppliers.name,
        netDays: suppliers.netDays,
        createdAt: suppliers.createdAt,
      },
    }),
    limit: query.pageSize,
    offset: getPaginationOffset(query.page, query.pageSize),
  });

  return createPaginatedResult({
    data: result ?? [],
    page: query.page,
    pageSize: query.pageSize,
    total: count ?? 0,
  });
}

export async function deleteSupplier(id: string) {
  const tenant = await getCurrentTenant();
  await db
    .delete(suppliers)
    .where(and(eq(suppliers.id, id), eq(suppliers.tenantId, tenant.id)));
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                   */
/* -------------------------------------------------------------------------- */

export type CreateSupplierInput = {
  name: string;
  /** Payment terms in days (net N). Must be a non-negative integer when set. */
  netDays?: number | null;
};

export type UpdateSupplierInput = {
  id: string;
  name?: string;
  netDays?: number | null;
};

function normalizeNetDays(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) {
    throw new Error("Payment terms must be a number.");
  }
  const n = Math.trunc(value);
  if (n < 0) {
    throw new Error("Payment terms cannot be negative.");
  }
  if (n > 365) {
    throw new Error("Payment terms cannot exceed 365 days.");
  }
  return n;
}

export async function createSupplier(input: CreateSupplierInput) {
  const tenant = await getCurrentTenant();
  const name = input.name?.trim();
  if (!name) {
    throw new Error("Supplier name is required.");
  }
  const netDays = normalizeNetDays(input.netDays ?? null);

  const [row] = await db
    .insert(suppliers)
    .values({
      tenantId: tenant.id,
      name,
      netDays,
    })
    .returning();

  if (!row) throw new Error("Failed to create supplier.");
  return row;
}

export async function updateSupplier(input: UpdateSupplierInput) {
  const tenant = await getCurrentTenant();
  const patch: Partial<typeof suppliers.$inferInsert> = {};

  if (input.name !== undefined) {
    const name = input.name?.trim();
    if (!name) {
      throw new Error("Supplier name cannot be empty.");
    }
    patch.name = name;
  }

  if (input.netDays !== undefined) {
    patch.netDays = normalizeNetDays(input.netDays);
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("Nothing to update.");
  }

  const [row] = await db
    .update(suppliers)
    .set(patch)
    .where(and(eq(suppliers.id, input.id), eq(suppliers.tenantId, tenant.id)))
    .returning();

  if (!row) throw new Error("Supplier not found.");
  return row;
}

/** Row shape returned by `getSuppliers()` / list APIs (for client `import type` only). */
export type SupplierListItem = Awaited<ReturnType<typeof getSuppliers>>[number];

/* -------------------------------------------------------------------------- */
/* Portfolio (hero KPIs + recent invoices/lots, mirrors getCustomerPortfolio) */
/* -------------------------------------------------------------------------- */

export async function getSupplierPortfolio(supplierId: string) {
  const tenant = await getCurrentTenant();

  const [supplier, invoiceAggRows, recentInvoices] = await Promise.all([
    db.query.suppliers.findFirst({
      where: and(eq(suppliers.id, supplierId), eq(suppliers.tenantId, tenant.id)),
    }),
    db
      .select({
        totalSpent: sql<string>`coalesce(sum(${supplierInvoices.totalAmount}::numeric), 0)`,
        totalPaid: sql<string>`coalesce(sum(${supplierInvoices.amountPaid}::numeric), 0)`,
        openBalance: sql<string>`coalesce(sum((${supplierInvoices.totalAmount}::numeric) - (${supplierInvoices.amountPaid}::numeric)), 0)`,
        totalCount: sql<number>`count(*)::int`,
        openCount: sql<number>`count(case when (${supplierInvoices.totalAmount}::numeric) - (${supplierInvoices.amountPaid}::numeric) > 0 then 1 end)::int`,
        lastInvoiceDate: sql<string | null>`max(${supplierInvoices.invoiceDate})`,
      })
      .from(supplierInvoices)
      .where(
        and(
          eq(supplierInvoices.supplierId, supplierId),
          eq(supplierInvoices.tenantId, tenant.id),
        ),
      ),
    db
      .select({
        id: supplierInvoices.id,
        invoiceNumber: supplierInvoices.invoiceNumber,
        invoiceDate: supplierInvoices.invoiceDate,
        status: supplierInvoices.status,
        totalAmount: supplierInvoices.totalAmount,
        amountPaid: supplierInvoices.amountPaid,
      })
      .from(supplierInvoices)
      .where(
        and(
          eq(supplierInvoices.supplierId, supplierId),
          eq(supplierInvoices.tenantId, tenant.id),
        ),
      )
      .orderBy(desc(supplierInvoices.invoiceDate))
      .limit(5),
  ]);

  if (!supplier) return null;

  return {
    supplier,
    recentInvoices,
    metrics: {
      totalSpent: invoiceAggRows[0]?.totalSpent ?? "0",
      totalPaid: invoiceAggRows[0]?.totalPaid ?? "0",
      openBalance: invoiceAggRows[0]?.openBalance ?? "0",
      totalInvoicesCount: invoiceAggRows[0]?.totalCount ?? 0,
      openInvoicesCount: invoiceAggRows[0]?.openCount ?? 0,
      lastInvoiceDate: invoiceAggRows[0]?.lastInvoiceDate ?? null,
    },
  };
}

export type SupplierPortfolio = NonNullable<Awaited<ReturnType<typeof getSupplierPortfolio>>>;

export type SupplierInvoicesSort = "invoiceDate";
export type SupplierInvoicesParams = PaginatedQueryInput<SupplierInvoicesSort>;

export async function getInvoicesForSupplierPage(
  supplierId: string,
  input?: SupplierInvoicesParams,
) {
  const tenant = await getCurrentTenant();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "invoiceDate",
    defaultDirection: "desc",
    defaultFilters: {},
  });

  const where = and(
    eq(supplierInvoices.supplierId, supplierId),
    eq(supplierInvoices.tenantId, tenant.id),
  );

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(supplierInvoices)
    .where(where);

  const rows = await db
    .select({
      id: supplierInvoices.id,
      invoiceNumber: supplierInvoices.invoiceNumber,
      invoiceDate: supplierInvoices.invoiceDate,
      receiveDate: supplierInvoices.receiveDate,
      status: supplierInvoices.status,
      totalAmount: supplierInvoices.totalAmount,
      amountPaid: supplierInvoices.amountPaid,
      paymentMethod: supplierInvoices.paymentMethod,
    })
    .from(supplierInvoices)
    .where(where)
    .orderBy(desc(supplierInvoices.invoiceDate), desc(supplierInvoices.createdAt))
    .limit(query.pageSize)
    .offset(getPaginationOffset(query.page, query.pageSize));

  return createPaginatedResult({
    data: rows,
    page: query.page,
    pageSize: query.pageSize,
    total: count ?? 0,
  });
}

export type SupplierPortfolioInvoiceRow = Awaited<ReturnType<typeof getInvoicesForSupplierPage>>["data"][number];

export type SupplierLotsSort = "receiveDate";
export type SupplierLotsParams = PaginatedQueryInput<SupplierLotsSort>;

export async function getSupplierLotsPage(
  supplierId: string,
  input?: SupplierLotsParams,
) {
  const tenant = await getCurrentTenant();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "receiveDate",
    defaultDirection: "desc",
    defaultFilters: {},
  });

  const where = and(
    eq(lots.tenantId, tenant.id),
    eq(lots.supplierId, supplierId),
  );

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lots)
    .where(where);

  const rows = await db
    .select({
      id: lots.id,
      lotNumber: lots.lotNumber,
      receiveDate: lots.receiveDate,
      expirationDate: lots.expirationDate,
    })
    .from(lots)
    .where(where)
    .orderBy(desc(lots.receiveDate), desc(lots.createdAt))
    .limit(query.pageSize)
    .offset(getPaginationOffset(query.page, query.pageSize));

  return createPaginatedResult({
    data: rows,
    page: query.page,
    pageSize: query.pageSize,
    total: count ?? 0,
  });
}

export type SupplierLotRow = Awaited<ReturnType<typeof getSupplierLotsPage>>["data"][number];
