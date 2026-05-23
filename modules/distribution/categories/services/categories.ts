import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, productCategories, products } from "@/db/schema";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";

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

export async function getCategories() {
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

export async function deleteCategory(categoryId: string) {
  const tenant = await getCurrentTenant();

  // `product_categories.category_id` has ON DELETE CASCADE on the
  // FK — letting a delete go through here silently strips the
  // category tag off every product that referenced it. Block the
  // hard delete when the category is still in use and surface a
  // friendly error so the caller can choose: archive the category
  // (preserves history, hides from pickers) or untag the products
  // first. Tenant-scoped join via `products.tenant_id` so we don't
  // count cross-tenant rows even though the FK is uuid-keyed.
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
    throw new Error(
      count === 1
        ? "Can't delete: 1 product is tagged with this category. Archive the category instead, or untag the product first."
        : `Can't delete: ${count} products are tagged with this category. Archive the category instead, or untag the products first.`,
    );
  }

  await db
    .delete(categories)
    .where(
      and(eq(categories.id, categoryId), eq(categories.tenantId, tenant.id)),
    );
}

/** Row shape returned by `getCategories()` / `GET /api/categories` (for client `import type` only). */
export type Category = Awaited<ReturnType<typeof getCategories>>[number];
