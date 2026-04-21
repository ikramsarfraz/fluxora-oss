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

/** Row shape returned by `getSuppliers()` / list APIs (for client `import type` only). */
export type SupplierListItem = Awaited<ReturnType<typeof getSuppliers>>[number];
