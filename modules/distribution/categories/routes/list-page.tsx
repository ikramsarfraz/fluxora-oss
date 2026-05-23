import { Suspense } from "react";

import Categories from "../components/categories-page";

// The client component drives its own query; prefetching here just delayed
// every navigation by a DB call (and Next.js Suspense fallback flash) for
// data the client cache usually already has. Matches the orders pattern.
export default function CategoriesListPage() {
  return (
    <Suspense>
      <Categories />
    </Suspense>
  );
}
