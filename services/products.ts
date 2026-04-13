import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";

// export async function createCustomer(input: {
//   name: string;
//   phoneNumber?: string;
//   fuelSurchargeAmount?: string;
//   invoicePrefix?: string;
//   address?: {
//     addressType?: "billing" | "shipping" | "warehouse" | "other";
//     street: string;
//     city?: string;
//     state?: string;
//     zip?: string;
//     isDefault?: boolean;
//   };
// }) {
//   const [customer] = await db
//     .insert(customers)
//     .values({
//       name: input.name,
//       phoneNumber: input.phoneNumber,
//       fuelSurchargeAmount: input.fuelSurchargeAmount,
//       invoicePrefix: input.invoicePrefix,
//     })
//     .returning();

//   if (input.address) {
//     await db.insert(customerAddresses).values({
//       customerId: customer.id,
//       addressType: input.address.addressType ?? "shipping",
//       street: input.address.street,
//       city: input.address.city,
//       state: input.address.state,
//       zip: input.address.zip,
//       isDefault: input.address.isDefault ?? true,
//     });
//   }

//   return customer;
// }

export async function getProductById(productId: number) {
  const result = await db.query.products.findFirst({
    where: eq(products.id, productId),
  });

  return result ?? null;
}

export async function getProducts() {
  const result = await db.query.products.findMany();

  return result;
}

/** Row shape returned by `getProducts()` / `GET /api/products` (for client `import type` only). */
export type ProductListItem = Awaited<ReturnType<typeof getProducts>>[number];
