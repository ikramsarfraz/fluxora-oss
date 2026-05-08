import type { InventoryLifecycleState } from "./insights";

export const INVENTORY_ADJUSTMENT_REASON_OPTIONS = [
  { value: "damaged", label: "Damaged" },
  { value: "expired", label: "Expired" },
  { value: "quality_hold", label: "Quality hold" },
  { value: "count_correction", label: "Count correction" },
  { value: "weight_correction", label: "Weight correction" },
  { value: "return_to_stock", label: "Return to stock" },
  { value: "other", label: "Other" },
] as const;

export type InventoryAdjustmentReason =
  (typeof INVENTORY_ADJUSTMENT_REASON_OPTIONS)[number]["value"];

export const INVENTORY_STATUS_ADJUSTMENT_OPTIONS: Array<{
  value: Extract<
    InventoryLifecycleState,
    "in_stock" | "damaged" | "expired"
  >;
  label: string;
}> = [
  { value: "in_stock", label: "Return to in stock" },
  { value: "damaged", label: "Mark damaged" },
  { value: "expired", label: "Mark expired" },
];
