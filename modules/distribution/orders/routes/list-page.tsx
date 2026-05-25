import { Suspense } from "react";

import Orders from "../components/orders-page";

// The client component drives its own paginated/filtered query via
// `useSalesOrdersPage` — prefetching here would require knowing the
// page/sort/filter URL params, which only the client resolves. The
// previous prefetch ran an unbounded `getSalesOrders()` into a query
// key the client never reads (waste of a DB round-trip).
export default function OrdersListPage() {
  return (
    <Suspense>
      <Orders />
    </Suspense>
  );
}
