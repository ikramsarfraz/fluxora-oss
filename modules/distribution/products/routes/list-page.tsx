import { Suspense } from "react";

import Products from "../components/products-page";

// Previously this route SSR-prefetched the first page of products keyed
// off the incoming searchParams. The cache-warm benefit was real but came
// at the cost of running a DB call on every navigation and forcing the
// Suspense fallback (loading.tsx / parent loading.tsx) to flash on every
// click. Operators perceived that flash as the page "loading every time".
// The client's `useProductsPage(params)` hook + 60s default staleTime
// (set in QueryProvider) keeps revisits instant from the client cache.
export default function ProductsListPage() {
  return (
    <Suspense>
      <Products />
    </Suspense>
  );
}
