import { Suspense } from "react";

import Customers from "../components/customers-page";

// The client component drives its own paginated/filtered query; prefetching
// here just delayed every navigation by a DB call for an unbounded key the
// client doesn't read. Matches the orders pattern.
export default function CustomersListPage() {
  return (
    <Suspense>
      <Customers />
    </Suspense>
  );
}
