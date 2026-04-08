/** Human-readable labels for order/invoice status. */
export function orderStatusLabel(status: string): string {
  switch (status) {
    case "sales_order":
      return "Sales order";
    case "invoice":
      return "Invoice";
    case "cancelled":
      return "Cancelled";
    default:
      return status || "—";
  }
}

/** Human-readable labels for inventory item status. */
export function inventoryStatusLabel(status: string): string {
  switch (status) {
    case "in_stock":
      return "In stock";
    case "picked":
      return "Reserved";
    case "shipped":
      return "Shipped";
    default:
      return status || "—";
  }
}
