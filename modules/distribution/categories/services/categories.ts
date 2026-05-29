import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, productCategories, products } from "@/db/schema";
import {
  createPaginatedResult,
  getPaginationOffset,
  normalizePaginatedQuery,
  resolveOrderBy,
  type PaginatedQueryInput,
} from "@/lib/pagination";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";

/**
 * Postgres raises code `23505` on unique-constraint violations. The
 * `categories` table has two such constraints (`categories_tenant_name_unique`
 * and `categories_tenant_slug_unique`) — both fire on the same user
 * intent: "name already taken in this tenant". A single friendly message
 * covers both cases.
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

export async function getCategoryById(categoryId: string) {
  const tenant = await getCurrentTenant();
  const result = await db.query.categories.findFirst({
    where: and(eq(categories.id, categoryId), eq(categories.tenantId, tenant.id)),
  });
  return result ?? null;
}

export type CategoryDetail = NonNullable<
  Awaited<ReturnType<typeof getCategoryById>>
>;

/**
 * Count of tenant-scoped products still tagged with this category. The
 * detail page reads this in parallel with `getCategoryById` so the
 * Danger Zone dialog can open already routed to the right phase (plain
 * confirm vs archive-or-untag) — no mid-flow flip on click.
 */
export async function getCategoryProductCount(
  categoryId: string,
): Promise<number> {
  const tenant = await getCurrentTenant();
  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(productCategories)
    .innerJoin(products, eq(products.id, productCategories.productId))
    .where(
      and(
        eq(productCategories.categoryId, categoryId),
        eq(products.tenantId, tenant.id),
      ),
    );
  return count;
}

export type CategoryProductsSort = "name" | "sku" | "createdAt";

export type CategoryProductsParams = PaginatedQueryInput<
  CategoryProductsSort,
  { includeArchived?: "1" }
>;

/**
 * Paginated list of products tagged with this category, scoped to the
 * current tenant. Powers the products section on the category detail
 * page so users can see exactly which products would lose their tag
 * before clicking "Untag and delete". Archived products are excluded
 * by default — toggle by passing `filters.includeArchived = "1"`,
 * mirroring how products-page handles its own archived filter.
 *
 * Returns the same `createPaginatedResult` shape every other detail-
 * page paginated read uses (customer orders, supplier invoices), so
 * `<TablePager />` + `useClientPagination`-free wiring just works.
 */
export async function getCategoryProductsPage(
  categoryId: string,
  input?: CategoryProductsParams,
) {
  const tenant = await getCurrentTenant();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "name",
    defaultDirection: "asc",
    defaultFilters: {},
  });

  const includeArchived = query.filters.includeArchived === "1";
  const where = and(
    eq(productCategories.categoryId, categoryId),
    eq(products.tenantId, tenant.id),
    includeArchived ? undefined : isNull(products.archivedAt),
  );

  // Count first via the same JOIN shape so the "Showing X of N" stays
  // accurate when archived are filtered out.
  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(productCategories)
    .innerJoin(products, eq(products.id, productCategories.productId))
    .where(where);

  // Select only what the table needs — the full product record (with
  // relations) is one click away on the product detail page.
  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      defaultPricePerLb: products.defaultPricePerLb,
      baseUnitId: products.baseUnitId,
      archivedAt: products.archivedAt,
      createdAt: products.createdAt,
    })
    .from(productCategories)
    .innerJoin(products, eq(products.id, productCategories.productId))
    .where(where)
    .orderBy(
      ...resolveOrderBy({
        sort: query.sort,
        direction: query.direction,
        expressions: {
          name: products.name,
          sku: products.sku,
          createdAt: products.createdAt,
        },
      }),
      // Stable secondary sort so equal-name rows don't flip page to
      // page; product ids are uuid v4 so this is just a tie-breaker.
      asc(products.id),
    )
    .limit(query.pageSize)
    .offset(getPaginationOffset(query.page, query.pageSize));

  return createPaginatedResult({
    data: rows,
    page: query.page,
    pageSize: query.pageSize,
    total: count ?? 0,
  });
}

export type CategoryProductRow = Awaited<
  ReturnType<typeof getCategoryProductsPage>
>["data"][number];

/**
 * Returns categories visible to selectors (product form, etc.). Archived
 * categories are excluded — they shouldn't appear in pickers, but the
 * admin list page reads via `getAllCategories()` so it can still surface
 * archived rows behind a badge.
 *
 * Each row carries a `productCount` (tenant-scoped) so the delete
 * confirmation dialog can route directly to the archive-or-untag branch
 * without round-tripping a probe call first. Computed via a LEFT JOIN
 * on `product_categories` (joined to `products` for tenant scoping)
 * grouped by category id — one query for the full list.
 */
export async function getCategories() {
  const tenant = await getCurrentTenant();

  // The relation API can't compute a count column inline, so drop to
  // the query builder. The aliased `productCount` column lands on the
  // returned row alongside every base column of `categories`.
  const rows = await db
    .select({
      id: categories.id,
      tenantId: categories.tenantId,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      isActive: categories.isActive,
      createdByUserId: categories.createdByUserId,
      updatedByUserId: categories.updatedByUserId,
      archivedByUserId: categories.archivedByUserId,
      archivedAt: categories.archivedAt,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
      productCount: sql<number>`cast(count(${products.id}) as int)`,
    })
    .from(categories)
    .leftJoin(
      productCategories,
      eq(productCategories.categoryId, categories.id),
    )
    .leftJoin(
      products,
      and(
        eq(products.id, productCategories.productId),
        eq(products.tenantId, tenant.id),
      ),
    )
    .where(
      and(
        eq(categories.tenantId, tenant.id),
        eq(categories.isActive, true),
        isNull(categories.archivedAt),
      ),
    )
    .groupBy(categories.id);

  return rows;
}

/**
 * Returns every category in the tenant — active and archived alike.
 * Backs the categories admin page so the user can see + restore archived
 * categories. Order: active first (alphabetical), then archived
 * (alphabetical), so the picker-visible set stays at the top.
 */
export async function getAllCategories() {
  const tenant = await getCurrentTenant();
  const result = await db.query.categories.findMany({
    where: and(
      eq(categories.tenantId, tenant.id),
      eq(categories.isActive, true),
    ),
  });

  return result ?? [];
}

export async function createCategory(input: { name: string; description?: string | null }) {
  const tenant = await getCurrentTenant();
  const slug = input.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  try {
    const [row] = await db
      .insert(categories)
      .values({
        tenantId: tenant.id,
        name: input.name.trim(),
        slug,
        description: input.description?.trim() || null,
      })
      .returning();

    return row;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new Error("A category with that name already exists.");
    }
    throw err;
  }
}

export async function updateCategory(input: {
  id: string;
  name: string;
  description?: string | null;
}) {
  const tenant = await getCurrentTenant();
  // Note: `slug` variable name kept for clarity — this is the URL-safe
  // form of the name, persisted alongside `name` for the slug unique
  // index. Both `name` and `slug` indexes guard against duplicates;
  // either can trip the 23505 below.
  const slug = input.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  try {
    const [row] = await db
      .update(categories)
      .set({
        name: input.name.trim(),
        slug,
        description: input.description?.trim() || null,
      })
      .where(and(eq(categories.id, input.id), eq(categories.tenantId, tenant.id)))
      .returning();

    if (!row) {
      throw new Error("Category not found.");
    }

    return row;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new Error("A category with that name already exists.");
    }
    throw err;
  }
}

/**
 * Result shape for {@link deleteCategory}. The "in use" case is no longer
 * a thrown error — the UI needs the product count to render the
 * archive-or-untag dialog, and parsing error-message strings is brittle.
 * True DB failures still throw.
 */
export type DeleteCategoryResult =
  | { status: "deleted" }
  | { status: "blocked"; productCount: number };

/**
 * Attempts a hard delete. Returns `{ status: "blocked", productCount }`
 * when the category is still tagged on any product — the caller surfaces
 * the archive-or-untag dialog. Returns `{ status: "deleted" }` after a
 * successful delete.
 *
 * The block exists because `product_categories.category_id` carries
 * `ON DELETE CASCADE`: letting a delete go through unchecked would
 * silently strip the tag from every product that referenced it.
 */
export async function deleteCategory(
  categoryId: string,
): Promise<DeleteCategoryResult> {
  const tenant = await getCurrentTenant();

  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(productCategories)
    .innerJoin(products, eq(products.id, productCategories.productId))
    .where(
      and(
        eq(productCategories.categoryId, categoryId),
        eq(products.tenantId, tenant.id),
      ),
    );

  if (count > 0) {
    return { status: "blocked", productCount: count };
  }

  await db
    .delete(categories)
    .where(
      and(eq(categories.id, categoryId), eq(categories.tenantId, tenant.id)),
    );
  return { status: "deleted" };
}

/**
 * Soft-delete a category. Sets `archivedAt` + `archivedByUserId`; the row
 * stays in the table so historical product tags keep resolving. Archived
 * categories are excluded from `getCategories()` (the picker-feeding
 * read) but remain visible on the admin list page.
 */
export async function archiveCategory(categoryId: string) {
  const [tenant, user] = await Promise.all([
    getCurrentTenant(),
    getCurrentPortalUser(),
  ]);
  const [row] = await db
    .update(categories)
    .set({
      archivedAt: new Date(),
      archivedByUserId: user.id,
    })
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.tenantId, tenant.id),
        isNull(categories.archivedAt),
      ),
    )
    .returning({ id: categories.id });
  if (!row) {
    throw new Error("Category not found or already archived.");
  }
  return row;
}

/**
 * Reverse an archive — clears `archivedAt` / `archivedByUserId`. The
 * (tenant_id, name) unique constraint covers active + archived rows
 * alike, so a restore only fails if the row is genuinely missing.
 */
export async function restoreCategory(categoryId: string) {
  const tenant = await getCurrentTenant();
  const [row] = await db
    .update(categories)
    .set({
      archivedAt: null,
      archivedByUserId: null,
    })
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.tenantId, tenant.id),
        isNotNull(categories.archivedAt),
      ),
    )
    .returning({ id: categories.id });
  if (!row) {
    throw new Error("Category not found or not archived.");
  }
  return row;
}

/**
 * Detach the category from every product that referenced it, then hard
 * delete the category. Wrapped in a transaction so the join-table cleanup
 * and the category delete are atomic — a partial state would leave the
 * tenant with orphan rows or, worse, the cascade FK firing mid-flight
 * against an only-partially-detached row.
 *
 * Returns the number of product_categories rows that were removed so the
 * caller can surface "Untagged from N products and deleted." in the
 * toast.
 */
export async function untagAndDeleteCategory(
  categoryId: string,
): Promise<{ untaggedCount: number }> {
  const tenant = await getCurrentTenant();

  return await db.transaction(async tx => {
    // Tenant-scoped subquery so we only remove join rows whose product
    // belongs to this tenant. Mirrors the count() in deleteCategory.
    const detached = await tx
      .delete(productCategories)
      .where(
        and(
          eq(productCategories.categoryId, categoryId),
          sql`${productCategories.productId} IN (
            SELECT ${products.id} FROM ${products}
            WHERE ${products.tenantId} = ${tenant.id}
          )`,
        ),
      )
      .returning({ productId: productCategories.productId });

    await tx
      .delete(categories)
      .where(
        and(eq(categories.id, categoryId), eq(categories.tenantId, tenant.id)),
      );

    return { untaggedCount: detached.length };
  });
}

/** Row shape returned by `getCategories()` / `GET /api/categories` (for client `import type` only). */
export type Category = Awaited<ReturnType<typeof getCategories>>[number];
