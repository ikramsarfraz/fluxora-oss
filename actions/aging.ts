"use server";

import { assertTenantCanUseFeature } from "@/lib/subscription-plan-capabilities";
import { getApAging, getArAging } from "@/modules/distribution/services/aging";
import { getCurrentTenantCached } from "@/modules/core/tenants/services/tenants";

export async function getArAgingAction() {
  const tenant = await getCurrentTenantCached();
  assertTenantCanUseFeature(tenant, "reports");
  return await getArAging();
}

export async function getApAgingAction() {
  return await getApAging();
}
