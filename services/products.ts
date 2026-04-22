import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  productCategories,
  products,
  productUnits,
} from "@/db/schema";
import { getCurrentTenant } from "./tenants";

type ProductUnitInput = {
  unitId: string;
  purpose: "stock" | "purchase" | "sales" | "pricing" | "display";
  conversionToBase: string;
  isDefault?: boolean;
  allowsFractional?: boolean;
  sortOrder?: number;
};

export async function getProductById(productId: string) {
  const result = await db.query.products.findFirst({
    where: eq(products.id, productId),
    with: {
      productCategories: {
        with: { category: true },
      },
      productUnits: {
        with: { unit: true },
      },
      baseUnit: true,
    },
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
      productUnits: {
        with: { unit: true },
      },
      baseUnit: true,
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

export async function createProduct(input: {
  sku: string;
  name: string;
  categoryIds: string[];
  baseUnitId?: string | null;
  units?: ProductUnitInput[];
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
      baseUnitId: input.baseUnitId ?? null,
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

  if (input.units && input.units.length > 0) {
    await db.insert(productUnits).values(
      input.units.map((u, i) => ({
        productId: product.id,
        unitId: u.unitId,
        purpose: u.purpose,
        conversionToBase: u.conversionToBase,
        isDefault: u.isDefault ?? i === 0,
        allowsFractional: u.allowsFractional ?? true,
        sortOrder: u.sortOrder ?? i,
      })),
    );
  }

  return product;
}

export async function deleteProduct(productId: string) {
  const tenant = await getCurrentTenant();
  await db
    .delete(products)
    .where(and(eq(products.id, productId), eq(products.tenantId, tenant.id)));
}

/** Row shape returned by `getProducts()` / `GET /api/products` (for client `import type` only). */
export type ProductListItem = Awaited<ReturnType<typeof getProducts>>[number];
export type ProductCategory = Awaited<
  ReturnType<typeof getProductCategories>
>[number];
