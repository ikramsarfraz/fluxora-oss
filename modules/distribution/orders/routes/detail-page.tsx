import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import { captureException } from "@/lib/sentry-scope";
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
  // post-mount fetch. A failure here shouldn't break the page render
  // (client refetches on mount) but it shouldn't vanish silently
  // either — tag it for Sentry so we see prefetch regressions.
  await queryClient
    .prefetchQuery({
      queryKey: queryKeys.salesOrders.activity(id),
      queryFn: () => getActivityForSalesOrder(id),
    })
    .catch((e: unknown) => {
      captureException(e, {
        stage: "orders-detail-prefetch",
        query: "salesOrders.activity",
        orderId: id,
      });
    });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrderDetailPage orderId={id} />
    </HydrationBoundary>
  );
}
