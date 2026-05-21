import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import { getActivityForSalesOrder } from "@/modules/distribution/services/audit";
import { getSalesOrderById } from "../services/orders";

import { OrderDetailPage } from "../components/order-detail-page";

export default async function OrdersDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  const queryClient = new QueryClient();
  try {
    const order = await getSalesOrderById(id);
    if (!order) {
      notFound();
    }
    queryClient.setQueryData(queryKeys.salesOrders.detail(id), order);
  } catch {
    notFound();
  }

  // Activity feed is shown below the fold; prefetching it avoids a
  // post-mount fetch. The previous full-list prefetch was dropped — the
  // detail page doesn't read the orders list.
  await queryClient
    .prefetchQuery({
      queryKey: queryKeys.salesOrders.activity(id),
      queryFn: () => getActivityForSalesOrder(id),
    })
    .catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrderDetailPage orderId={id} />
    </HydrationBoundary>
  );
}
