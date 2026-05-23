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

export async function getArAgingAction() {
  const tenant = await getCurrentTenantCached();
  assertTenantCanUseFeature(tenant, "reports");
  return await getArAging();
}

export async function getApAgingAction() {
  return await getApAging();
}

export async function getActivityForSalesOrderAction(orderId: string) {
  return await getActivityForSalesOrder(orderId);
}

export async function getActivityForSupplierInvoiceAction(
  supplierInvoiceId: string,
) {
  return await getActivityForSupplierInvoice(supplierInvoiceId);
}

export async function getActivityForInventoryItemAction(
  inventoryItemId: string,
) {
  return await getActivityForInventoryItem(inventoryItemId);
}

export async function getDashboardSummaryAction() {
  return await getDashboardSummary();
}
