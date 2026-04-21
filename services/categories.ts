import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { getCurrentTenant } from "./tenants";

export async function getCategoryById(categoryId: string) {
  const result = await db.query.categories.findFirst({
    where: eq(categories.id, categoryId),
  });
  return result ?? null;
}

export async function getCategories() {
  const tenant = await getCurrentTenant();
  const result = await db.query.categories.findMany({
    where: eq(categories.tenantId, tenant.id),
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
