export const INVENTORY_STATUS_LABELS = {
  in_stock: "In stock",
  allocated: "Allocated",
  picked: "Picked",
  packed: "Packed",
  shipped: "Shipped",
  sold: "Sold",
  damaged: "Damaged",
  expired: "Expired",
} as const;

export function getInventoryStatusLabel(
  status: string | null | undefined,
) {
  if (!status) return "Unknown";
  return (
    INVENTORY_STATUS_LABELS[
      status as keyof typeof INVENTORY_STATUS_LABELS
    ] ?? status.replaceAll("_", " ")
  );
}
