import LotsListRoute from "@/modules/distribution/lots/routes/list-page";
import { InventoryViewToggle } from "@/modules/distribution/inventory/components/inventory-view-toggle";

export default async function InventoryLotsRoute() {
  return (
    <>
      <InventoryViewToggle />
      <LotsListRoute />
    </>
  );
}
