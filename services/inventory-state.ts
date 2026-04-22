import "server-only";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { inventoryItems } from "@/db/schema";
import type { InventoryItem } from "@/db/types";

export type InventoryLifecycleState = InventoryItem["status"];

async function updateInventoryItemStatuses(
  inventoryItemIds: string[],
  status: InventoryLifecycleState,
) {
  const uniqueIds = [...new Set(inventoryItemIds)].filter(Boolean);

  if (uniqueIds.length === 0) {
    return;
  }

  await db
    .update(inventoryItems)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(inArray(inventoryItems.id, uniqueIds));
}

export async function markInventoryItemsAllocated(inventoryItemIds: string[]) {
  await updateInventoryItemStatuses(inventoryItemIds, "allocated");
}

export async function restoreInventoryItemsToStock(inventoryItemIds: string[]) {
  await updateInventoryItemStatuses(inventoryItemIds, "in_stock");
}

export async function markInventoryItemsShipped(inventoryItemIds: string[]) {
  await updateInventoryItemStatuses(inventoryItemIds, "shipped");
}

export async function markInventoryItemsSold(inventoryItemIds: string[]) {
  await updateInventoryItemStatuses(inventoryItemIds, "sold");
}

export async function markInventoryItemAllocated(inventoryItemId: string) {
  await db
    .update(inventoryItems)
    .set({
      status: "allocated",
      updatedAt: new Date(),
    })
    .where(eq(inventoryItems.id, inventoryItemId));
}
