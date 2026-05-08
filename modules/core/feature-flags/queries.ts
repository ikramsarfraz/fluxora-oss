import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { tenantFeatures } from "@/db/schema";

import type { FeatureKey } from "./constants";

export async function getTenantFeatureEnabled(
  tenantId: string,
  feature: FeatureKey,
): Promise<boolean> {
  const row = await db.query.tenantFeatures.findFirst({
    where: and(
      eq(tenantFeatures.tenantId, tenantId),
      eq(tenantFeatures.feature, feature),
    ),
    columns: { enabled: true },
  });
  // No row = feature not explicitly overridden → default enabled
  return row?.enabled ?? true;
}

export async function getAllTenantFeatures(
  tenantId: string,
): Promise<{ feature: string; enabled: boolean }[]> {
  return db.query.tenantFeatures.findMany({
    where: eq(tenantFeatures.tenantId, tenantId),
    columns: { feature: true, enabled: true },
  });
}
