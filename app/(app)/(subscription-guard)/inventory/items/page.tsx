import InventoryListRoute from "@/modules/distribution/inventory/routes/list-page";
import { InventoryViewToggle } from "@/modules/distribution/inventory/components/inventory-view-toggle";

export default async function InventoryItemsRoute() {
  return (
    <>
      <InventoryViewToggle />
      <InventoryListRoute />
    </>
  );
}
