import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customerAddresses, customers } from "@/db/schema";
import type { NewCustomer, NewCustomerAddress } from "@/db/types";
import { getPlanLimit } from "@/lib/subscription-plan-capabilities";
import {
  createPlanLimitReachedError,
  logSubscriptionEnforcementBlock,
} from "@/lib/subscription-enforcement";
import { countActiveCustomersForTenant } from "@/services/subscription-usage";
import { getCurrentTenant } from "@/services/tenants";
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
      phoneNumber: input.phoneNumber,
      fuelSurchargeAmount: input.fuelSurchargeAmount,
      invoicePrefix: input.invoicePrefix,
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
      ...(input.invoicePrefix !== undefined
        ? { invoicePrefix: input.invoicePrefix }
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
      customers.invoicePrefix,
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
