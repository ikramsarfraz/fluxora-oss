import { notFound } from "next/navigation";

import type { FeatureKey } from "./constants";
import { getTenantFeatureEnabled } from "./queries";

export async function hasFeature(
  tenantId: string,
  feature: FeatureKey,
): Promise<boolean> {
  return getTenantFeatureEnabled(tenantId, feature);
}

export async function requireFeature(
  tenantId: string,
  feature: FeatureKey,
): Promise<void> {
  const enabled = await getTenantFeatureEnabled(tenantId, feature);
  if (!enabled) {
    notFound();
  }
}
