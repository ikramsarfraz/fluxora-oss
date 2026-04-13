import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { getProduct, getProducts } from "@/lib/api/products";
import { queryKeys } from "@/lib/query/keys";

import { ProductDetailPage } from "../components/product-detail-page";

export default async function ProductDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.products.detail(id),
      queryFn: () => getProduct(id),
    });
  } catch {
    notFound();
  }

  await queryClient.prefetchQuery({
    queryKey: queryKeys.products.all,
    queryFn: getProducts,
  }).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductDetailPage productId={id} />
    </HydrationBoundary>
  );
}
