import { redirect } from "next/navigation";

export default function InventoryIndexPage() {
  // Inventory v2: hub with Items/Lots views. Default landing is items.
  // Per-user view persistence is TBD; until then, URL is authoritative and
  // /inventory routes to /inventory/items.
  redirect("/inventory/items");
}
