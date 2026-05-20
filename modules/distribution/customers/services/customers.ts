import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  customerAddresses,
  customerProductPrices,
  customers,
  products,
  salesInvoices,
  salesOrderLines,
  salesOrders,
} from "@/db/schema";
import type { NewCustomer, NewCustomerAddress } from "@/db/types";
import { getPlanLimit } from "@/lib/subscription-plan-capabilities";
import {
  createPlanLimitReachedError,
  logSubscriptionEnforcementBlock,
} from "@/lib/subscription-enforcement";
import { countActiveCustomersForTenant } from "@/modules/core/billing/services/subscription-usage";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import {
  buildTextSearchCondition,
  createPaginatedResult,
  getPaginationOffset,
  normalizePaginatedQuery,
  resolveOrderBy,
  type PaginatedQueryInput,
} from "@/lib/pagination";

export async function createCustomer(
  input: Omit<NewCustomer, "tenantId"> & {
    addresses?: Omit<NewCustomerAddress, "customerId">[];
  },
) {
  const tenant = await getCurrentTenant();
  const maxCustomers = getPlanLimit(tenant, "maxCustomers");
  if ((await countActiveCustomersForTenant(tenant.id)) + 1 > maxCustomers) {
    logSubscriptionEnforcementBlock({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        subscriptionPlan: tenant.subscriptionPlan,
        subscriptionStatus: tenant.subscriptionStatus,
      },
      reason: "limit_reached",
      key: "maxCustomers",
      limit: maxCustomers,
    });
    throw createPlanLimitReachedError({
      tenant,
      limitKey: "maxCustomers",
      limit: maxCustomers,
      resourceLabel: "customers",
      actionLabel: "add another customer",
    });
  }

  const [customer] = await db
    .insert(customers)
    .values({
      tenantId: tenant.id,
      name: input.name,
      abbreviation: input.abbreviation,
      email: input.email,
      phoneNumber: input.phoneNumber,
      taxId: input.taxId,
      netDays: input.netDays,
      fuelSurchargeAmount: input.fuelSurchargeAmount,
    })
    .returning();

  if (input.addresses?.length) {
    await db.insert(customerAddresses).values(
      input.addresses.map((addr, i) => ({
        customerId: customer.id,
        addressType: addr.addressType ?? "shipping",
        street: addr.street,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
        isDefault: addr.isDefault ?? i === 0,
      })),
    );
  }

  return customer;
}

/**
 * Tenant-scoped insert without the per-call plan-limit check. Used by
 * the bulk import path which runs a single upfront limit check against
 * the total row count (the per-row check would either falsely trip
 * partway through a valid batch or silently let some rows through).
 */
async function createCustomerForTenant(
  tenantId: string,
  input: Omit<NewCustomer, "tenantId"> & {
    addresses?: Omit<NewCustomerAddress, "customerId">[];
  },
) {
  const [customer] = await db
    .insert(customers)
    .values({
      tenantId,
      name: input.name,
      abbreviation: input.abbreviation,
      email: input.email,
      phoneNumber: input.phoneNumber,
      taxId: input.taxId,
      netDays: input.netDays,
      fuelSurchargeAmount: input.fuelSurchargeAmount,
    })
    .returning();

  if (input.addresses?.length) {
    await db.insert(customerAddresses).values(
      input.addresses.map((addr, i) => ({
        customerId: customer.id,
        addressType: addr.addressType ?? "shipping",
        street: addr.street,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
        isDefault: addr.isDefault ?? i === 0,
      })),
    );
  }

  return customer;
}

export type BulkCreateCustomerInput = Omit<NewCustomer, "tenantId"> & {
  addresses?: Omit<NewCustomerAddress, "customerId">[];
};

/**
 * One conflict found between a row in a bulk-import payload and an
 * existing customer record. `rowIndex` is 0-based against the input
 * array; the modal converts to 1-based + header for display.
 *
 * `reason`:
 *   - "duplicate-name-active"   — an active customer with this name
 *     already exists; insert would be rejected by the unique index.
 *   - "duplicate-name-archived" — an archived customer with this name
 *     exists; insert would still be rejected, but the user might prefer
 *     to restore rather than create a new one.
 *   - "duplicate-email-active"  — an active customer with this email
 *     already exists. Email isn't unique, but importing the same
 *     contact twice is usually a mistake worth flagging.
 */
export type CustomerImportConflict = {
  rowIndex: number;
  reason:
    | "duplicate-name-active"
    | "duplicate-name-archived"
    | "duplicate-email-active";
  existingCustomerId: string;
  existingCustomerName: string;
};

export async function findCustomerImportConflicts(
  rows: ReadonlyArray<{ name?: string; email?: string }>,
): Promise<CustomerImportConflict[]> {
  const tenant = await getCurrentTenant();
  const names = Array.from(
    new Set(
      rows
        .map(r => r.name?.trim().toLowerCase())
        .filter((n): n is string => !!n && n.length > 0),
    ),
  );
  const emails = Array.from(
    new Set(
      rows
        .map(r => r.email?.trim().toLowerCase())
        .filter((e): e is string => !!e && e.length > 0),
    ),
  );
  if (names.length === 0 && emails.length === 0) return [];

  const nameCondition =
    names.length > 0
      ? sql`lower(${customers.name}) in (${sql.join(
          names.map(n => sql`${n}`),
          sql`, `,
        )})`
      : null;
  const emailCondition =
    emails.length > 0 ? inArray(customers.email, emails) : null;
  const matchCondition =
    nameCondition && emailCondition
      ? or(nameCondition, emailCondition)
      : (nameCondition ?? emailCondition);
  const existing = await db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      archivedAt: customers.archivedAt,
    })
    .from(customers)
    .where(and(eq(customers.tenantId, tenant.id), matchCondition!));

  const byName = new Map<
    string,
    { id: string; name: string; archived: boolean }
  >();
  const byEmail = new Map<string, { id: string; name: string }>();
  for (const row of existing) {
    const lowerName = row.name.toLowerCase();
    if (!byName.has(lowerName)) {
      byName.set(lowerName, { id: row.id, name: row.name, archived: !!row.archivedAt });
    }
    if (row.email && !row.archivedAt) {
      const lowerEmail = row.email.toLowerCase();
      if (!byEmail.has(lowerEmail)) {
        byEmail.set(lowerEmail, { id: row.id, name: row.name });
      }
    }
  }

  const conflicts: CustomerImportConflict[] = [];
  rows.forEach((row, idx) => {
    const lname = row.name?.trim().toLowerCase();
    const lemail = row.email?.trim().toLowerCase();
    if (lname && byName.has(lname)) {
      const hit = byName.get(lname)!;
      conflicts.push({
        rowIndex: idx,
        reason: hit.archived
          ? "duplicate-name-archived"
          : "duplicate-name-active",
        existingCustomerId: hit.id,
        existingCustomerName: hit.name,
      });
      return;
    }
    if (lemail && byEmail.has(lemail)) {
      const hit = byEmail.get(lemail)!;
      conflicts.push({
        rowIndex: idx,
        reason: "duplicate-email-active",
        existingCustomerId: hit.id,
        existingCustomerName: hit.name,
      });
    }
  });
  return conflicts;
}

export type BulkCreateCustomersResult = {
  total: number;
  created: number;
  failed: Array<{ row: number; name: string; message: string }>;
};

function formatBulkCustomerError(error: unknown): string {
  if (error instanceof Error) {
    // No tenant-unique constraint on customer name today, but if one's
    // added later the same friendlier-message path applies.
    if (/duplicate key.*customers/i.test(error.message)) {
      return "A customer with this name already exists.";
    }
    return error.message;
  }
  return "Unknown error.";
}

/**
 * Insert N customers in one call. Single upfront plan-limit check so a
 * batch either fully fits or fully rejects — no partial commits when the
 * tenant is at the edge of their plan. Per-row failures past the plan
 * check (validation errors, etc.) are caught and returned in `failed`.
 */
export async function bulkCreateCustomers(
  rows: BulkCreateCustomerInput[],
): Promise<BulkCreateCustomersResult> {
  const tenant = await getCurrentTenant();

  const existing = await countActiveCustomersForTenant(tenant.id);
  const maxCustomers = getPlanLimit(tenant, "maxCustomers");
  if (existing + rows.length > maxCustomers) {
    logSubscriptionEnforcementBlock({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        subscriptionPlan: tenant.subscriptionPlan,
        subscriptionStatus: tenant.subscriptionStatus,
      },
      reason: "limit_reached",
      key: "maxCustomers",
      limit: maxCustomers,
    });
    throw createPlanLimitReachedError({
      tenant,
      limitKey: "maxCustomers",
      limit: maxCustomers,
      resourceLabel: "customers",
      actionLabel: `import ${rows.length} customer${rows.length === 1 ? "" : "s"}`,
    });
  }

  let created = 0;
  const failed: BulkCreateCustomersResult["failed"] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    try {
      await createCustomerForTenant(tenant.id, row);
      created++;
    } catch (error) {
      failed.push({
        row: i,
        name: typeof row.name === "string" ? row.name : "",
        message: formatBulkCustomerError(error),
      });
    }
  }

  return { total: rows.length, created, failed };
}

export async function updateCustomer(
  input: Partial<Omit<NewCustomer, "tenantId">> & {
    id: string;
    addresses?: Omit<NewCustomerAddress, "customerId">[];
  },
) {
  const tenant = await getCurrentTenant();
  const existing = await db.query.customers.findFirst({
    where: and(eq(customers.id, input.id), eq(customers.tenantId, tenant.id)),
    columns: {
      id: true,
    },
  });
  if (!existing) {
    throw new Error("Customer not found.");
  }

  const [customer] = await db
    .update(customers)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phoneNumber !== undefined
        ? { phoneNumber: input.phoneNumber }
        : {}),
      ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
      ...(input.netDays !== undefined ? { netDays: input.netDays } : {}),
      ...(input.fuelSurchargeAmount !== undefined
        ? { fuelSurchargeAmount: input.fuelSurchargeAmount }
        : {}),
      ...(input.abbreviation !== undefined
        ? { abbreviation: input.abbreviation }
        : {}),
    })
    .where(and(eq(customers.id, input.id), eq(customers.tenantId, tenant.id)))
    .returning();

  if (!customer) {
    throw new Error("Failed to update customer.");
  }

  await db
    .delete(customerAddresses)
    .where(eq(customerAddresses.customerId, input.id));

  if (input.addresses?.length) {
    await db.insert(customerAddresses).values(
      input.addresses.map((addr, i) => ({
        customerId: customer.id,
        addressType: addr.addressType ?? "shipping",
        street: addr.street,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
        isDefault: addr.isDefault ?? i === 0,
      })),
    );
  }

  return customer;
}

export async function getCustomerById(customerId: string) {
  const tenant = await getCurrentTenant();
  const result = await db.query.customers.findFirst({
    where: and(eq(customers.id, customerId), eq(customers.tenantId, tenant.id)),
    with: {
      addresses: true,
      productPrices: true,
    },
  });

  return result ?? null;
}

export type CustomerDetail = NonNullable<
  Awaited<ReturnType<typeof getCustomerById>>
>;

export type CustomerListSort = "name" | "createdAt";

/**
 * Lightweight typeahead row for order/invoice/payment customer lookups.
 * Carries enough to render the selector option and the post-selection
 * chip without a follow-up fetch, but skips heavy joins (addresses[],
 * productPrices[]) — those are fetched on demand via `getCustomerById`.
 */
export type CustomerSearchResult = {
  id: string;
  name: string;
  abbreviation: string | null;
  phoneNumber: string | null;
  email: string | null;
  fuelSurchargeAmount: string | null;
  netDays: number | null;
  defaultAddress: {
    street: string;
    city: string | null;
    state: string | null;
    zip: string | null;
  } | null;
};

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;

/**
 * Typeahead query for the customer combobox. Returns up to `limit` active
 * (non-archived) customers matching the query against name / abbreviation
 * / phone / email. Empty query returns the most recent N customers, so
 * the popover isn't empty before the user types.
 */
export async function searchCustomers(
  query: string = "",
  limit: number = DEFAULT_SEARCH_LIMIT,
): Promise<CustomerSearchResult[]> {
  const tenant = await getCurrentTenant();
  const cappedLimit = Math.min(Math.max(limit, 1), MAX_SEARCH_LIMIT);
  const where = and(
    eq(customers.tenantId, tenant.id),
    isNull(customers.archivedAt),
    buildTextSearchCondition(query, [
      customers.name,
      customers.abbreviation,
      customers.phoneNumber,
      customers.email,
    ]),
  );
  const rows = await db.query.customers.findMany({
    where,
    columns: {
      id: true,
      name: true,
      abbreviation: true,
      phoneNumber: true,
      email: true,
      fuelSurchargeAmount: true,
      netDays: true,
    },
    with: {
      addresses: {
        columns: {
          street: true,
          city: true,
          state: true,
          zip: true,
          isDefault: true,
        },
      },
    },
    orderBy: [desc(customers.createdAt)],
    limit: cappedLimit,
  });
  return rows.map(row => {
    const def =
      row.addresses.find(a => a.isDefault) ?? row.addresses[0] ?? null;
    return {
      id: row.id,
      name: row.name,
      abbreviation: row.abbreviation,
      phoneNumber: row.phoneNumber,
      email: row.email,
      fuelSurchargeAmount: row.fuelSurchargeAmount,
      netDays: row.netDays,
      defaultAddress: def
        ? {
            street: def.street,
            city: def.city,
            state: def.state,
            zip: def.zip,
          }
        : null,
    };
  });
}

/**
 * Active (non-archived) customers in the tenant. Used by order/invoice
 * lookups — archived customers must not be selectable for new business
 * activity.
 *
 * @deprecated Prefer {@link searchCustomers} for typeahead and
 * {@link getCustomerById} for single-customer lookups. Loading every
 * customer into the client is unsafe past a few hundred rows.
 */
export async function getCustomers() {
  const tenant = await getCurrentTenant();
  const result = await db.query.customers.findMany({
    where: and(
      eq(customers.tenantId, tenant.id),
      isNull(customers.archivedAt),
    ),
    with: {
      addresses: true,
      productPrices: true,
    },
  });

  return result;
}

/**
 * Filter for the paginated list page.
 *   - "active"   (default): only non-archived customers
 *   - "archived": only archived customers
 *   - "all":      everything
 */
export type CustomerArchivedFilter = "active" | "archived" | "all";

export type CustomerListParams = PaginatedQueryInput<CustomerListSort> & {
  archived?: CustomerArchivedFilter;
};

export async function getCustomersPage(input?: CustomerListParams) {
  const tenant = await getCurrentTenant();
  const archived = input?.archived ?? "active";
  const query = normalizePaginatedQuery(input, {
    defaultSort: "createdAt",
    defaultDirection: "desc",
    defaultFilters: {},
  });
  const archivedCondition =
    archived === "active"
      ? isNull(customers.archivedAt)
      : archived === "archived"
        ? isNotNull(customers.archivedAt)
        : undefined;
  const where = and(
    eq(customers.tenantId, tenant.id),
    archivedCondition,
    buildTextSearchCondition(query.search, [
      customers.name,
      customers.phoneNumber,
      customers.abbreviation,
      customers.email,
    ]),
  );
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customers)
    .where(where);
  const result = await db.query.customers.findMany({
    where,
    with: {
      addresses: true,
      productPrices: true,
    },
    orderBy: resolveOrderBy({
      sort: query.sort,
      direction: query.direction,
      expressions: {
        name: customers.name,
        createdAt: customers.createdAt,
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

/**
 * Soft-delete a customer. Sets `archivedAt` + `archivedByUserId`; the row
 * stays in the table so historical orders / invoices / payments keep
 * working. Archived customers are hidden from list pages and order
 * lookups by default, but are restorable.
 */
export async function archiveCustomer(customerId: string) {
  const [tenant, user] = await Promise.all([
    getCurrentTenant(),
    getCurrentPortalUser(),
  ]);
  const [row] = await db
    .update(customers)
    .set({
      archivedAt: new Date(),
      archivedByUserId: user.id,
    })
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.tenantId, tenant.id),
        isNull(customers.archivedAt),
      ),
    )
    .returning({ id: customers.id });
  if (!row) {
    throw new Error("Customer not found or already archived.");
  }
  return row;
}

/**
 * Reverse an archive. Clears `archivedAt` / `archivedByUserId`. Fails if
 * another active customer already holds this customer's name — the
 * (tenant_id, name) unique constraint applies to active and archived
 * rows alike, but UX-wise it's worth surfacing this clearly.
 */
export async function restoreCustomer(customerId: string) {
  const tenant = await getCurrentTenant();
  const [row] = await db
    .update(customers)
    .set({
      archivedAt: null,
      archivedByUserId: null,
    })
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.tenantId, tenant.id),
        isNotNull(customers.archivedAt),
      ),
    )
    .returning({ id: customers.id });
  if (!row) {
    throw new Error("Customer not found or not archived.");
  }
  return row;
}

/**
 * Permanently remove a customer. Only allowed when no orders or invoices
 * reference the customer (both FKs are ON DELETE RESTRICT, so attempting
 * this against a customer with history would fail at the DB anyway —
 * checking first lets us give a human-readable error). For customers
 * with history, use {@link archiveCustomer}.
 */
export async function permanentlyDeleteCustomer(customerId: string) {
  const tenant = await getCurrentTenant();
  const [orderCountRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(salesOrders)
    .where(
      and(
        eq(salesOrders.customerId, customerId),
        eq(salesOrders.tenantId, tenant.id),
      ),
    );
  const [invoiceCountRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(salesInvoices)
    .where(
      and(
        eq(salesInvoices.customerId, customerId),
        eq(salesInvoices.tenantId, tenant.id),
      ),
    );
  const orderCount = orderCountRow?.n ?? 0;
  const invoiceCount = invoiceCountRow?.n ?? 0;
  if (orderCount > 0 || invoiceCount > 0) {
    const parts: string[] = [];
    if (orderCount > 0) parts.push(`${orderCount} order${orderCount === 1 ? "" : "s"}`);
    if (invoiceCount > 0) parts.push(`${invoiceCount} invoice${invoiceCount === 1 ? "" : "s"}`);
    throw new Error(
      `This customer has ${parts.join(" and ")} on record and can't be permanently deleted. Archive instead — historical records will be preserved.`,
    );
  }
  await db
    .delete(customers)
    .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenant.id)));
}

/** Row shape returned by `getCustomers()` / `GET /api/customers` (for client `import type` only). */
export type CustomerListItem = Awaited<ReturnType<typeof getCustomers>>[number];

export async function getCustomerPortfolio(customerId: string) {
  const tenant = await getCurrentTenant();

  const [customer, recentOrders, recentInvoices, invoiceAggRows, orderAggRows] =
    await Promise.all([
      db.query.customers.findFirst({
        where: and(eq(customers.id, customerId), eq(customers.tenantId, tenant.id)),
        with: { addresses: true },
      }),
      db.query.salesOrders.findMany({
        where: and(
          eq(salesOrders.customerId, customerId),
          eq(salesOrders.tenantId, tenant.id),
        ),
        columns: { id: true, orderNumber: true, orderDate: true, dueDate: true, status: true },
        orderBy: [desc(salesOrders.orderDate), desc(salesOrders.createdAt)],
        limit: 20,
      }),
      db.query.salesInvoices.findMany({
        where: and(
          eq(salesInvoices.customerId, customerId),
          eq(salesInvoices.tenantId, tenant.id),
        ),
        columns: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          dueDate: true,
          status: true,
          totalAmount: true,
          amountPaid: true,
          balanceDue: true,
        },
        orderBy: [desc(salesInvoices.invoiceDate)],
        limit: 20,
      }),
      db
        .select({
          totalRevenue: sql<string>`coalesce(sum(case when ${salesInvoices.status} <> 'void' then ${salesInvoices.totalAmount}::numeric else 0 end), 0)`,
          totalBalanceDue: sql<string>`coalesce(sum(case when ${salesInvoices.status} <> 'void' then ${salesInvoices.balanceDue}::numeric else 0 end), 0)`,
          totalPaid: sql<string>`coalesce(sum(case when ${salesInvoices.status} <> 'void' then ${salesInvoices.amountPaid}::numeric else 0 end), 0)`,
          totalCount: sql<number>`count(*)::int`,
        })
        .from(salesInvoices)
        .where(
          and(
            eq(salesInvoices.customerId, customerId),
            eq(salesInvoices.tenantId, tenant.id),
          ),
        ),
      db
        .select({
          openCount: sql<number>`count(case when ${salesOrders.status} not in ('fulfilled', 'cancelled') then 1 end)::int`,
          totalCount: sql<number>`count(*)::int`,
        })
        .from(salesOrders)
        .where(
          and(
            eq(salesOrders.customerId, customerId),
            eq(salesOrders.tenantId, tenant.id),
          ),
        ),
    ]);

  if (!customer) return null;

  return {
    customer,
    recentOrders,
    totalOrdersCount: orderAggRows[0]?.totalCount ?? 0,
    recentInvoices,
    totalInvoicesCount: invoiceAggRows[0]?.totalCount ?? 0,
    metrics: {
      totalRevenue: invoiceAggRows[0]?.totalRevenue ?? "0",
      balanceDue: invoiceAggRows[0]?.totalBalanceDue ?? "0",
      totalPaid: invoiceAggRows[0]?.totalPaid ?? "0",
      openOrdersCount: orderAggRows[0]?.openCount ?? 0,
    },
  };
}

export type CustomerPortfolio = NonNullable<Awaited<ReturnType<typeof getCustomerPortfolio>>>;

export async function getCustomerPrices(customerId: string) {
  const tenant = await getCurrentTenant();
  const rows = await db
    .select({
      id: customerProductPrices.id,
      productId: customerProductPrices.productId,
      pricePerLb: customerProductPrices.pricePerLb,
      productSku: products.sku,
      productName: products.name,
    })
    .from(customerProductPrices)
    .innerJoin(products, eq(customerProductPrices.productId, products.id))
    .where(
      and(
        eq(customerProductPrices.customerId, customerId),
        eq(products.tenantId, tenant.id),
      ),
    );
  return rows;
}

export async function setCustomerPrice(
  customerId: string,
  productId: string,
  pricePerLb: string,
) {
  const tenant = await getCurrentTenant();
  const customer = await db.query.customers.findFirst({
    where: and(eq(customers.id, customerId), eq(customers.tenantId, tenant.id)),
    columns: { id: true },
  });
  if (!customer) throw new Error("Customer not found.");

  await db
    .insert(customerProductPrices)
    .values({ customerId, productId, pricePerLb })
    .onConflictDoUpdate({
      target: [customerProductPrices.customerId, customerProductPrices.productId],
      set: { pricePerLb, updatedAt: new Date() },
    });
}

export async function deleteCustomerPrice(customerId: string, productId: string) {
  const tenant = await getCurrentTenant();
  const customer = await db.query.customers.findFirst({
    where: and(eq(customers.id, customerId), eq(customers.tenantId, tenant.id)),
    columns: { id: true },
  });
  if (!customer) throw new Error("Customer not found.");

  await db
    .delete(customerProductPrices)
    .where(
      and(
        eq(customerProductPrices.customerId, customerId),
        eq(customerProductPrices.productId, productId),
      ),
    );
}

export type CustomerPriceRow = Awaited<ReturnType<typeof getCustomerPrices>>[number];

export type CustomerOrdersSort = "orderDate";
export type CustomerOrdersParams = PaginatedQueryInput<CustomerOrdersSort>;

export async function getCustomerOrdersPage(customerId: string, input?: CustomerOrdersParams) {
  const tenant = await getCurrentTenant();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "orderDate",
    defaultDirection: "desc",
    defaultFilters: {},
  });

  const where = and(
    eq(salesOrders.customerId, customerId),
    eq(salesOrders.tenantId, tenant.id),
  );

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(salesOrders)
    .where(where);

  const rows = await db
    .select({
      id: salesOrders.id,
      orderNumber: salesOrders.orderNumber,
      orderDate: salesOrders.orderDate,
      dueDate: salesOrders.dueDate,
      status: salesOrders.status,
      itemsCount: sql<number>`count(distinct ${salesOrderLines.id})::int`,
      total: sql<string>`coalesce(sum(${salesInvoices.totalAmount}), '0')`,
    })
    .from(salesOrders)
    .leftJoin(salesOrderLines, eq(salesOrderLines.salesOrderId, salesOrders.id))
    .leftJoin(salesInvoices, eq(salesInvoices.salesOrderId, salesOrders.id))
    .where(where)
    .groupBy(salesOrders.id)
    .orderBy(desc(salesOrders.orderDate), desc(salesOrders.createdAt))
    .limit(query.pageSize)
    .offset(getPaginationOffset(query.page, query.pageSize));

  return createPaginatedResult({
    data: rows,
    page: query.page,
    pageSize: query.pageSize,
    total: count ?? 0,
  });
}

export type CustomerOrderRow = Awaited<ReturnType<typeof getCustomerOrdersPage>>["data"][number];

export type CustomerInvoicesSort = "invoiceDate";
export type CustomerInvoicesParams = PaginatedQueryInput<CustomerInvoicesSort>;

export async function getCustomerInvoicesPage(customerId: string, input?: CustomerInvoicesParams) {
  const tenant = await getCurrentTenant();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "invoiceDate",
    defaultDirection: "desc",
    defaultFilters: {},
  });

  const where = and(
    eq(salesInvoices.customerId, customerId),
    eq(salesInvoices.tenantId, tenant.id),
  );

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(salesInvoices)
    .where(where);

  const result = await db.query.salesInvoices.findMany({
    where,
    columns: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      dueDate: true,
      status: true,
      totalAmount: true,
      balanceDue: true,
    },
    orderBy: [desc(salesInvoices.invoiceDate)],
    limit: query.pageSize,
    offset: getPaginationOffset(query.page, query.pageSize),
  });

  return createPaginatedResult({
    data: result,
    page: query.page,
    pageSize: query.pageSize,
    total: count ?? 0,
  });
}

export type CustomerInvoiceRow = Awaited<ReturnType<typeof getCustomerInvoicesPage>>["data"][number];
