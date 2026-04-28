"use server";

import { assertTenantCanUseFeature } from "@/lib/subscription-plan-capabilities";
import { getApAging, getArAging } from "@/services/aging";
import { getCurrentTenantCached } from "@/services/tenants";

export async function getArAgingAction() {
  const tenant = await getCurrentTenantCached();
  assertTenantCanUseFeature(tenant, "reports");
  return await getArAging();
}

export async function getApAgingAction() {
  return await getApAging();
}
