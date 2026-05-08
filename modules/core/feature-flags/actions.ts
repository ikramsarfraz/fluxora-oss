"use server";

import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import { tenantFeatures } from "@/db/schema";

import type { FeatureKey } from "./constants";

export async function setTenantFeatureAction(
  tenantId: string,
  feature: FeatureKey,
  enabled: boolean,
): Promise<void> {
  await db
    .insert(tenantFeatures)
    .values({ tenantId, feature, enabled })
    .onConflictDoUpdate({
      target: [tenantFeatures.tenantId, tenantFeatures.feature],
      set: { enabled, updatedAt: new Date() },
    });
}

export async function enableTenantFeatureAction(
  tenantId: string,
  feature: FeatureKey,
): Promise<void> {
  return setTenantFeatureAction(tenantId, feature, true);
}

export async function disableTenantFeatureAction(
  tenantId: string,
  feature: FeatureKey,
): Promise<void> {
  return setTenantFeatureAction(tenantId, feature, false);
}

export async function deleteTenantFeatureOverrideAction(
  tenantId: string,
  feature: FeatureKey,
): Promise<void> {
  await db
    .delete(tenantFeatures)
    .where(
      and(
        eq(tenantFeatures.tenantId, tenantId),
        eq(tenantFeatures.feature, feature),
      ),
    );
}
