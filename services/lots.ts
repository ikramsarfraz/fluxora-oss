import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { lots } from "@/db/schema";
import { getCurrentTenant } from "./tenants";

export async function getLotById(lotId: string) {
  const tenant = await getCurrentTenant();
  const result = await db.query.lots.findFirst({
    where: and(eq(lots.id, lotId), eq(lots.tenantId, tenant.id)),
    with: {
      supplier: true,
    },
  });

  return result ?? null;
}

export async function getLots() {
  const tenant = await getCurrentTenant();
  const result = await db.query.lots.findMany({
    where: eq(lots.tenantId, tenant.id),
    with: {
      supplier: true,
    },
  });

  return result ?? [];
}

export async function deleteLot(lotId: string) {
  await db.delete(lots).where(eq(lots.id, lotId));
}

/** Row shape returned by `getCustomers()` / `GET /api/customers` (for client `import type` only). */
export type CustomerListItem = Awaited<ReturnType<typeof getLots>>[number];
