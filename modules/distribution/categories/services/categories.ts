import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
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
  await db
    .delete(categories)
    .where(
      and(eq(categories.id, categoryId), eq(categories.tenantId, tenant.id)),
    );
}

/** Row shape returned by `getCategories()` / `GET /api/categories` (for client `import type` only). */
export type Category = Awaited<ReturnType<typeof getCategories>>[number];
