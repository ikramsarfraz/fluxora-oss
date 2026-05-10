import { and, desc, eq, sql } from "drizzle-orm";
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
      phoneNumber: input.phoneNumber,
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
      ...(input.phoneNumber !== undefined
        ? { phoneNumber: input.phoneNumber }
        : {}),
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
export type CustomerListParams = PaginatedQueryInput<CustomerListSort>;

export async function getCustomers() {
  const tenant = await getCurrentTenant();
  const result = await db.query.customers.findMany({
    where: eq(customers.tenantId, tenant.id),
    with: {
      addresses: true,
      productPrices: true,
    },
  });

  return result;
}

export async function getCustomersPage(input?: CustomerListParams) {
  const tenant = await getCurrentTenant();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "createdAt",
    defaultDirection: "desc",
    defaultFilters: {},
  });
  const where = and(
    eq(customers.tenantId, tenant.id),
    buildTextSearchCondition(query.search, [
      customers.name,
      customers.phoneNumber,
      customers.abbreviation,
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

export async function deleteCustomer(customerId: string) {
  const tenant = await getCurrentTenant();
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
