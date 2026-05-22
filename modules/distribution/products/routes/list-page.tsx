import { Suspense } from "react";
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";

import {
  getProductsPage,
  type ProductArchivedFilter,
  type ProductListParams,
} from "../services/products";
import { queryKeys } from "@/lib/query/keys";
import { ListPageSkeleton } from "@/components/loading-skeletons";

import Products from "../components/products-page";

type SearchParams = Promise<{
  page?: string;
  pageSize?: string;
  search?: string;
  sort?: string;
  direction?: string;
  archived?: string;
}>;

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const SORT_KEYS = new Set<ProductListParams["sort"]>([
  "sku",
  "name",
  "defaultPricePerLb",
  "createdAt",
]);

const ARCHIVED_FILTERS = new Set<ProductArchivedFilter>([
  "active",
  "archived",
  "all",
]);

export default async function ProductsListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  // Mirror the URL contract that `useUrlPaginationState` exposes on the
  // client. Keeping the prefetched query key identical to the client-side
  // key means deep links land with cache hits instead of a wasted server
  // fetch followed by a client re-fetch.
  const prefetchParams: ProductListParams = {
    page: parsePositiveInt(params.page, 1),
    pageSize: parsePositiveInt(params.pageSize, 10),
    search: params.search ?? "",
    sort:
      params.sort && SORT_KEYS.has(params.sort as ProductListParams["sort"])
        ? (params.sort as ProductListParams["sort"])
        : "createdAt",
    direction: params.direction === "asc" ? "asc" : "desc",
    archived:
      params.archived &&
      ARCHIVED_FILTERS.has(params.archived as ProductArchivedFilter)
        ? (params.archived as ProductArchivedFilter)
        : "active",
  };

  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.products.list(prefetchParams),
    queryFn: () => getProductsPage(prefetchParams),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<ListPageSkeleton tableColumns={4} />}>
        <Products />
      </Suspense>
    </HydrationBoundary>
  );
}
