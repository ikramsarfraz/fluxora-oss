import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customerAddresses, customers } from "@/db/schema";
import type { NewCustomer, NewCustomerAddress } from "@/db/types";
import { getCurrentTenant } from "./tenants";

export async function createCustomer(
  input: Omit<NewCustomer, "tenantId"> & {
    addresses?: Omit<NewCustomerAddress, "customerId">[];
  },
) {
  const tenant = await getCurrentTenant();

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

export async function getCustomerById(customerId: string) {
  const result = await db.query.customers.findFirst({
    where: eq(customers.id, customerId),
    with: {
      addresses: true,
      productPrices: true,
    },
  });

  return result ?? null;
}

export async function getCustomers() {
  const result = await db.query.customers.findMany({
    with: {
      addresses: true,
      productPrices: true,
    },
  });

  return result;
}

export async function deleteCustomer(customerId: string) {
  await db.delete(customers).where(eq(customers.id, customerId));
}

/** Row shape returned by `getCustomers()` / `GET /api/customers` (for client `import type` only). */
export type CustomerListItem = Awaited<ReturnType<typeof getCustomers>>[number];
