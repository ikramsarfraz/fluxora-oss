"use server";

import {
  adjustInventoryItemAction as adjustInventoryItemActionImpl,
  bulkAdjustLotInventoryAction as bulkAdjustLotInventoryActionImpl,
  getInventoryItemByIdAction as getInventoryItemByIdActionImpl,
  getInventoryItemsAction as getInventoryItemsActionImpl,
  getInventoryItemsPageAction as getInventoryItemsPageActionImpl,
} from "@/modules/distribution/inventory/actions";

export async function getInventoryItemsAction() {
  return getInventoryItemsActionImpl();
}

export async function getInventoryItemsPageAction(
  ...args: Parameters<typeof getInventoryItemsPageActionImpl>
) {
  return getInventoryItemsPageActionImpl(...args);
}

export async function getInventoryItemByIdAction(
  ...args: Parameters<typeof getInventoryItemByIdActionImpl>
) {
  return getInventoryItemByIdActionImpl(...args);
}

export async function adjustInventoryItemAction(
  ...args: Parameters<typeof adjustInventoryItemActionImpl>
) {
  return adjustInventoryItemActionImpl(...args);
}

export async function bulkAdjustLotInventoryAction(
  ...args: Parameters<typeof bulkAdjustLotInventoryActionImpl>
) {
  return bulkAdjustLotInventoryActionImpl(...args);
}
