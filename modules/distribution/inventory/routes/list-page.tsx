import { Suspense } from "react";

import { InventoryPage } from "../components/inventory-page";

// The client component drives its own paginated/filtered query via
// `useInventoryItemsPage` — prefetching here would require knowing the
// page/sort/filter URL params, which only the client resolves. The
// previous prefetch ran an unbounded `getInventoryItems()` into a query
// key the client never reads (waste of a DB round-trip on every page
// navigation, also a visible "loading" flash because every nav blocked
// on a DB call before hydrating). Closes the inventory side of #205.
export default function InventoryListPage() {
  return (
    <Suspense>
      <InventoryPage />
    </Suspense>
  );
}
