import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customerAddresses, customers } from "@/db/schema";

export async function createCustomer(input: {
  name: string;
  phoneNumber?: string;
  fuelSurchargeAmount?: string;
  invoicePrefix?: string;
  address?: {
    addressType?: "billing" | "shipping" | "warehouse" | "other";
    street: string;
    city?: string;
    state?: string;
    zip?: string;
    isDefault?: boolean;
  };
}) {
  const [customer] = await db
    .insert(customers)
    .values({
      name: input.name,
      phoneNumber: input.phoneNumber,
      fuelSurchargeAmount: input.fuelSurchargeAmount,
      invoicePrefix: input.invoicePrefix,
    })
    .returning();

  if (input.address) {
    await db.insert(customerAddresses).values({
      customerId: customer.id,
      addressType: input.address.addressType ?? "shipping",
      street: input.address.street,
      city: input.address.city,
      state: input.address.state,
      zip: input.address.zip,
      isDefault: input.address.isDefault ?? true,
    });
  }

  return customer;
}

export async function getCustomerById(customerId: number) {
  const result = await db.query.customers.findFirst({
    where: eq(customers.id, customerId),
    with: {
      addresses: true,
      productPrices: true,
    },
  });

  return result ?? null;
}
