import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import { getProductById, getProducts } from "@/services/products";

import { ProductDetailPage } from "../components/product-detail-page";

export default async function ProductsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.products.detail(id),
      queryFn: () => getProductById(id),
    });
  } catch {
    notFound();
  }

  await queryClient
    .prefetchQuery({
      queryKey: queryKeys.products.all,
      queryFn: getProducts,
    })
    .catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductDetailPage productId={id} />
    </HydrationBoundary>
  );
}
