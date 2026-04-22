import type { InventoryLifecycleState } from "./insights";

export function getInventoryAdjustmentDisabledReason(input: {
  status: InventoryLifecycleState;
  allocationCount: number;
  activeFulfillmentCount: number;
}) {
  if (input.status === "shipped" || input.status === "sold") {
    return "Shipped or sold inventory is locked and cannot be corrected from this screen.";
  }
  if (input.allocationCount > 0) {
    return "Inventory with active allocations cannot be adjusted from this screen.";
  }
  if (input.activeFulfillmentCount > 0) {
    return "Inventory with active fulfillment history cannot be adjusted from this screen.";
  }
  return null;
}
