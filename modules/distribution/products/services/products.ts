import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  productCategories,
  products,
  productUnits,
  supplierInvoiceLines,
} from "@/db/schema";
import { getPlanLimit } from "@/lib/subscription-plan-capabilities";
import {
  createPlanLimitReachedError,
  logSubscriptionEnforcementBlock,
} from "@/lib/subscription-enforcement";
import { countActiveProductsForTenant } from "@/modules/core/billing/services/subscription-usage";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import {
  buildTextSearchCondition,
  createPaginatedResult,
  getPaginationOffset,
  normalizePaginatedQuery,
  resolveOrderBy,
  type PaginatedQueryInput,
} from "@/lib/pagination";

type ProductUnitInput = {
  unitId: string;
  purpose: "stock" | "purchase" | "sales" | "pricing" | "display";
  conversionToBase: string;
  isDefault?: boolean;
  allowsFractional?: boolean;
  sortOrder?: number;
};

export async function getProductById(productId: string) {
  const tenant = await getCurrentTenant();
  const [result, [purchaseCountRow]] = await Promise.all([
    db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.tenantId, tenant.id)),
      with: {
        productCategories: {
          with: { category: true },
        },
        productUnits: {
          with: { unit: true },
        },
        baseUnit: true,
      },
    }),
    db
      .select({ count: count() })
      .from(supplierInvoiceLines)
      .where(eq(supplierInvoiceLines.productId, productId)),
  ]);

  if (!result) return null;
  return { ...result, _purchaseCount: purchaseCountRow?.count ?? 0 };
}

export type ProductDetail = NonNullable<
  Awaited<ReturnType<typeof getProductById>>
>;

export type ProductListSort =
  | "sku"
  | "name"
  | "defaultPricePerLb"
  | "createdAt";

export type ProductListParams = PaginatedQueryInput<ProductListSort>;

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

export async function getProductsPage(input?: ProductListParams) {
  const tenant = await getCurrentTenant();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "createdAt",
    defaultDirection: "desc",
    defaultFilters: {},
  });
  const where = and(
    eq(products.tenantId, tenant.id),
    buildTextSearchCondition(query.search, [products.sku, products.name]),
  );
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(where);
  const result = await db.query.products.findMany({
    where,
    with: {
      productCategories: {
        with: { category: true },
      },
      productUnits: {
        with: { unit: true },
      },
      baseUnit: true,
    },
    orderBy: resolveOrderBy({
      sort: query.sort,
      direction: query.direction,
      expressions: {
        sku: products.sku,
        name: products.name,
        defaultPricePerLb: products.defaultPricePerLb,
        createdAt: products.createdAt,
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
  defaultPricePerLb?: string;
  baseUnitId?: string | null;
  units?: ProductUnitInput[];
}) {
  const tenant = await getCurrentTenant();
  const maxProducts = getPlanLimit(tenant, "maxProducts");
  if ((await countActiveProductsForTenant(tenant.id)) + 1 > maxProducts) {
    logSubscriptionEnforcementBlock({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        subscriptionPlan: tenant.subscriptionPlan,
        subscriptionStatus: tenant.subscriptionStatus,
      },
      reason: "limit_reached",
      key: "maxProducts",
      limit: maxProducts,
    });
    throw createPlanLimitReachedError({
      tenant,
      limitKey: "maxProducts",
      limit: maxProducts,
      resourceLabel: "products",
      actionLabel: "add another product",
    });
  }

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
      defaultPricePerLb: input.defaultPricePerLb ?? "0",
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

export async function updateProduct(input: {
  id: string;
  sku: string;
  name: string;
  categoryIds: string[];
  defaultPricePerLb?: string;
  baseUnitId?: string | null;
  units?: ProductUnitInput[];
}) {
  const tenant = await getCurrentTenant();

  const existing = await db.query.products.findFirst({
    where: and(eq(products.id, input.id), eq(products.tenantId, tenant.id)),
    columns: {
      id: true,
    },
  });
  if (!existing) {
    throw new Error("Product not found.");
  }

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

  const [updated] = await db
    .update(products)
    .set({
      sku: input.sku.trim(),
      name: input.name.trim(),
      ...(input.defaultPricePerLb !== undefined && {
        defaultPricePerLb: input.defaultPricePerLb,
      }),
      baseUnitId: input.baseUnitId ?? null,
    })
    .where(and(eq(products.id, input.id), eq(products.tenantId, tenant.id)))
    .returning();

  if (!updated) {
    throw new Error("Failed to update product.");
  }

  await db
    .delete(productCategories)
    .where(eq(productCategories.productId, input.id));

  if (input.categoryIds.length > 0) {
    await db.insert(productCategories).values(
      input.categoryIds.map(categoryId => ({
        productId: input.id,
        categoryId,
      })),
    );
  }

  await db
    .delete(productUnits)
    .where(eq(productUnits.productId, input.id));

  if (input.units && input.units.length > 0) {
    await db.insert(productUnits).values(
      input.units.map((u, i) => ({
        productId: input.id,
        unitId: u.unitId,
        purpose: u.purpose,
        conversionToBase: u.conversionToBase,
        isDefault: u.isDefault ?? i === 0,
        allowsFractional: u.allowsFractional ?? true,
        sortOrder: u.sortOrder ?? i,
      })),
    );
  }

  return updated;
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
