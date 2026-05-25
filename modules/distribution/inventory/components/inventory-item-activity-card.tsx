"use client";

import { ActivityCard } from "@/modules/distribution/components/activity-card";
import { useInventoryItemActivity } from "@/modules/distribution/hooks/use-activity";

// Thin domain wrapper around the shared ActivityCard — mirrors the pattern
// already used by OrderActivityCard and SupplierInvoiceActivityCard so the
// "what happened to this thing" surface looks identical across orders,
// bills, and inventory items. Closes #215.
export function InventoryItemActivityCard({
  inventoryItemId,
}: {
  inventoryItemId: string;
}) {
  const { data, isLoading, isError } = useInventoryItemActivity(inventoryItemId);
  return <ActivityCard items={data} isLoading={isLoading} isError={isError} />;
}
