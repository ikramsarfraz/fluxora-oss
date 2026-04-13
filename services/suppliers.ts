import { eq } from "drizzle-orm";
import { db } from "@/db";
import { suppliers } from "@/db/schema";

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
//   const [supplier] = await db
//     .insert(suppliers)
//     .values({
//       name: input.name,
//       phoneNumber: input.phoneNumber,
//       fuelSurchargeAmount: input.fuelSurchargeAmount,
//       invoicePrefix: input.invoicePrefix,
//     })
//     .returning();

//   if (input.address) {
//     await db.insert(supplierAddresses).values({
//       supplierId: supplier.id,
//       addressType: input.address.addressType ?? "shipping",
//       street: input.address.street,
//       city: input.address.city,
//       state: input.address.state,
//       zip: input.address.zip,
//       isDefault: input.address.isDefault ?? true,
//     });
//   }

//   return supplier;
// }

export async function getSupplierById(supplierId: number) {
  const result = await db.query.suppliers.findFirst({
    where: eq(suppliers.id, supplierId),
  });

  return result ?? null;
}

export async function getSuppliers() {
  const result = await db.query.suppliers.findMany();

  return result;
}

/** Row shape returned by `getSuppliers()` / list APIs (for client `import type` only). */
export type SupplierListItem = Awaited<ReturnType<typeof getSuppliers>>[number];
