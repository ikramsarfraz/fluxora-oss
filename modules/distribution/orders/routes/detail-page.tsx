import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import { getActivityForSalesOrder } from "@/services/audit";
import { getSalesOrderById, getSalesOrders } from "../services/orders";

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

  await Promise.all([
    queryClient
      .prefetchQuery({
        queryKey: queryKeys.salesOrders.all,
        queryFn: getSalesOrders,
      })
      .catch(() => {}),
    queryClient
      .prefetchQuery({
        queryKey: queryKeys.salesOrders.activity(id),
        queryFn: () => getActivityForSalesOrder(id),
      })
      .catch(() => {}),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrderDetailPage orderId={id} />
    </HydrationBoundary>
  );
}
