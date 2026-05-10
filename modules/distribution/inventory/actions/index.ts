"use server";

import {
  adjustInventoryItem,
  bulkAdjustLotInventory,
  getInventoryItemById,
  getInventoryItems,
  getInventoryItemsPage,
} from "../services/inventory";

export async function getInventoryItemsAction() {
  return await getInventoryItems();
}

export async function getInventoryItemsPageAction(
  input?: Parameters<typeof getInventoryItemsPage>[0],
) {
  return await getInventoryItemsPage(input);
}

export async function getInventoryItemByIdAction(id: string) {
  return await getInventoryItemById(id);
}

export async function adjustInventoryItemAction(input: {
  inventoryItemId: string;
  targetStatus?: "in_stock" | "damaged" | "expired" | null;
  correctedWeightLbs?: string | null;
  reason: string;
  notes?: string | null;
}) {
  return await adjustInventoryItem(input);
}

export async function bulkAdjustLotInventoryAction(input: {
  lotId: string;
  targetStatus: "in_stock" | "damaged" | "expired";
  reason: string;
  notes?: string | null;
}) {
  return await bulkAdjustLotInventory(input);
}
