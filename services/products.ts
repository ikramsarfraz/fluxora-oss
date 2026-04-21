import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories, productCategories, products } from "@/db/schema";
import { getCurrentTenant } from "./tenants";

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

export async function getProductById(productId: string) {
  const result = await db.query.products.findFirst({
    where: eq(products.id, productId),
  });

  return result ?? null;
}

export async function getProducts() {
  const tenant = await getCurrentTenant();
  const result = await db.query.products.findMany({
    where: eq(products.tenantId, tenant.id),
    with: {
      productCategories: {
        with: { category: true },
      },
    },
  });

  return result ?? [];
}

export async function getProductCategories() {
  const tenant = await getCurrentTenant();
  const result = await db.query.categories.findMany({
    where: eq(categories.tenantId, tenant.id),
  });
  return result ?? [];
}

export async function createCategory(name: string) {
  const tenant = await getCurrentTenant();
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const [row] = await db
    .insert(categories)
    .values({ tenantId: tenant.id, name: name.trim(), slug })
    .returning();

  return row;
}

export async function createProduct(input: {
  sku: string;
  name: string;
  categoryIds: string[];
  stockUnitId?: string | null;
  purchaseUnitId?: string | null;
  salesUnitId?: string | null;
}) {
  const tenant = await getCurrentTenant();

  if (input.categoryIds.length > 0) {
    const validCategories = await db.query.categories.findMany({
      where: inArray(categories.id, input.categoryIds),
    });
    const invalidIds = input.categoryIds.filter(
      id => !validCategories.some(c => c.id === id && c.tenantId === tenant.id),
    );
    if (invalidIds.length > 0) {
      throw new Error("One or more category IDs are invalid.");
    }
  }

  const [product] = await db
    .insert(products)
    .values({
      tenantId: tenant.id,
      sku: input.sku.trim(),
      name: input.name.trim(),
      defaultPricePerLb: "0",
    })
    .returning();

  if (input.categoryIds.length > 0) {
    await db.insert(productCategories).values(
      input.categoryIds.map(categoryId => ({
        productId: product.id,
        categoryId,
      })),
    );
  }

  return product;
}

/** Row shape returned by `getProducts()` / `GET /api/products` (for client `import type` only). */
export type ProductListItem = Awaited<ReturnType<typeof getProducts>>[number];
export type ProductCategory = Awaited<
  ReturnType<typeof getProductCategories>
>[number];
