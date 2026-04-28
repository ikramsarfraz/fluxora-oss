import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  productCategories,
  products,
  productUnits,
} from "@/db/schema";
import { getPlanLimit } from "@/lib/subscription-plan-capabilities";
import { formatSubscriptionPlanLabel } from "@/lib/subscription-display";
import { getCurrentTenant } from "./tenants";
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
  baseUnitId?: string | null;
  units?: ProductUnitInput[];
}) {
  const tenant = await getCurrentTenant();
  const [{ c: existingProductCount }] = await db
    .select({ c: count() })
    .from(products)
    .where(and(eq(products.tenantId, tenant.id), isNull(products.archivedAt)));

  const maxProducts = getPlanLimit(tenant, "maxProducts");
  if ((existingProductCount ?? 0) + 1 > maxProducts) {
    throw new Error(
      `Your current plan (${formatSubscriptionPlanLabel(
        tenant.subscriptionPlan,
      )}) allows up to ${maxProducts} products. Upgrade your plan to add another product.`,
    );
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
