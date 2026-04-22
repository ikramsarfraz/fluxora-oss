import { and, desc, eq } from "drizzle-orm";
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
    orderBy: [desc(lots.expirationDate)],
  });

  return result ?? [];
}

export async function createLot(input: {
  lotNumber: string;
  supplierId: string;
  receiveDate: string;
  expirationDate: string;
}) {
  const tenant = await getCurrentTenant();
  const [row] = await db
    .insert(lots)
    .values({
      tenantId: tenant.id,
      lotNumber: input.lotNumber.trim(),
      supplierId: input.supplierId,
      receiveDate: input.receiveDate,
      expirationDate: input.expirationDate,
    })
    .returning();

  return row;
}

export async function deleteLot(lotId: string) {
  const tenant = await getCurrentTenant();
  await db
    .delete(lots)
    .where(and(eq(lots.id, lotId), eq(lots.tenantId, tenant.id)));
}

/** Row shape returned by `getLots()` (for client `import type` only). */
export type LotListItem = Awaited<ReturnType<typeof getLots>>[number];
export type LotDetail = NonNullable<Awaited<ReturnType<typeof getLotById>>>;
