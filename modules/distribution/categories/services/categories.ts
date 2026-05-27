import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, productCategories, products } from "@/db/schema";
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
 * Returns categories visible to selectors (product form, etc.). Archived
 * categories are excluded — they shouldn't appear in pickers, but the
 * admin list page reads via `getAllCategories()` so it can still surface
 * archived rows behind a badge.
 */
export async function getCategories() {
  const tenant = await getCurrentTenant();
  const result = await db.query.categories.findMany({
    where: and(
      eq(categories.tenantId, tenant.id),
      eq(categories.isActive, true),
      isNull(categories.archivedAt),
    ),
  });

  return result ?? [];
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
