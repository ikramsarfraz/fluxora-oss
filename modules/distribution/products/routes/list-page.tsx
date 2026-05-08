import { Suspense } from "react";
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";

import { getProductsPage, type ProductListParams } from "@/services/products";
import { queryKeys } from "@/lib/query/keys";

import Products from "../components/products-page";

const defaultParams: ProductListParams = {
  page: 1,
  pageSize: 10,
  search: "",
  sort: "createdAt",
  direction: "desc",
};

export default async function ProductsListPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.products.list(defaultParams),
    queryFn: () => getProductsPage(defaultParams),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <Products />
      </Suspense>
    </HydrationBoundary>
  );
}
