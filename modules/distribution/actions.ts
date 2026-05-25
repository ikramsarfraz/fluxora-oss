"use server";

import { assertTenantCanUseFeature } from "@/lib/subscription-plan-capabilities";
import { getApAging, getArAging } from "@/modules/distribution/services/aging";
import {
  getActivityForInventoryItem,
  getActivityForSalesOrder,
  getActivityForSupplierInvoice,
} from "@/modules/distribution/services/audit";
import { getDashboardSummary } from "@/modules/distribution/services/dashboard";
import { getCurrentTenantCached } from "@/modules/core/tenants/services/tenants";

/**
 * All aggregate distribution actions gate by `assertTenantCanUseFeature`
 * so a tenant on a plan tier that doesn't include the relevant feature
 * (e.g. free plan + reports) is rejected at the server boundary, not
 * just hidden in the UI. Subscription-guard layout blocks canceled /
 * expired tenants but does not gate by plan tier — that's this file's
 * responsibility.
 */

export async function getArAgingAction() {
  const tenant = await getCurrentTenantCached();
  assertTenantCanUseFeature(tenant, "reports");
  return await getArAging();
}

export async function getApAgingAction() {
  const tenant = await getCurrentTenantCached();
  assertTenantCanUseFeature(tenant, "reports");
  return await getApAging();
}

export async function getActivityForSalesOrderAction(orderId: string) {
  const tenant = await getCurrentTenantCached();
  assertTenantCanUseFeature(tenant, "sales_orders");
  return await getActivityForSalesOrder(orderId);
}

export async function getActivityForSupplierInvoiceAction(
  supplierInvoiceId: string,
) {
  const tenant = await getCurrentTenantCached();
  assertTenantCanUseFeature(tenant, "purchasing");
  return await getActivityForSupplierInvoice(supplierInvoiceId);
}

export async function getActivityForInventoryItemAction(
  inventoryItemId: string,
) {
  const tenant = await getCurrentTenantCached();
  assertTenantCanUseFeature(tenant, "inventory");
  return await getActivityForInventoryItem(inventoryItemId);
}

export async function getDashboardSummaryAction() {
  const tenant = await getCurrentTenantCached();
  assertTenantCanUseFeature(tenant, "dashboard");
  return await getDashboardSummary();
}
