import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { getCurrentTenant } from "./tenants";

export async function getSupplierById(supplierId: string) {
  const tenant = await getCurrentTenant();
  const result = await db.query.suppliers.findFirst({
    where: and(eq(suppliers.id, supplierId), eq(suppliers.tenantId, tenant.id)),
  });

  return result ?? null;
}

export async function getSuppliers() {
  const tenant = await getCurrentTenant();
  const result = await db.query.suppliers.findMany({
    with: {
      productCosts: true,
    },
    where: eq(suppliers.tenantId, tenant.id),
  });

  return result;
}

export async function deleteSupplier(id: string) {
  const tenant = await getCurrentTenant();
  await db
    .delete(suppliers)
    .where(and(eq(suppliers.id, id), eq(suppliers.tenantId, tenant.id)));
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                   */
/* -------------------------------------------------------------------------- */

export type CreateSupplierInput = {
  name: string;
  /** Payment terms in days (net N). Must be a non-negative integer when set. */
  netDays?: number | null;
};

export type UpdateSupplierInput = {
  id: string;
  name?: string;
  netDays?: number | null;
};

function normalizeNetDays(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) {
    throw new Error("Payment terms must be a number.");
  }
  const n = Math.trunc(value);
  if (n < 0) {
    throw new Error("Payment terms cannot be negative.");
  }
  if (n > 365) {
    throw new Error("Payment terms cannot exceed 365 days.");
  }
  return n;
}

export async function createSupplier(input: CreateSupplierInput) {
  const tenant = await getCurrentTenant();
  const name = input.name?.trim();
  if (!name) {
    throw new Error("Supplier name is required.");
  }
  const netDays = normalizeNetDays(input.netDays ?? null);

  const [row] = await db
    .insert(suppliers)
    .values({
      tenantId: tenant.id,
      name,
      netDays,
    })
    .returning();

  if (!row) throw new Error("Failed to create supplier.");
  return row;
}

export async function updateSupplier(input: UpdateSupplierInput) {
  const tenant = await getCurrentTenant();
  const patch: Partial<typeof suppliers.$inferInsert> = {};

  if (input.name !== undefined) {
    const name = input.name?.trim();
    if (!name) {
      throw new Error("Supplier name cannot be empty.");
    }
    patch.name = name;
  }

  if (input.netDays !== undefined) {
    patch.netDays = normalizeNetDays(input.netDays);
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("Nothing to update.");
  }

  const [row] = await db
    .update(suppliers)
    .set(patch)
    .where(and(eq(suppliers.id, input.id), eq(suppliers.tenantId, tenant.id)))
    .returning();

  if (!row) throw new Error("Supplier not found.");
  return row;
}

/** Row shape returned by `getSuppliers()` / list APIs (for client `import type` only). */
export type SupplierListItem = Awaited<ReturnType<typeof getSuppliers>>[number];
