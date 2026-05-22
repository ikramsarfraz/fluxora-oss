import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";

import { InventoryDetailPage } from "../components/inventory-detail-page";
import { getInventoryItemById } from "../services/inventory";

export default async function InventoryDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const queryClient = new QueryClient();
  try {
    const item = await queryClient.fetchQuery({
      queryKey: queryKeys.inventory.detail(id),
      queryFn: () => getInventoryItemById(id),
    });
    if (!item) notFound();
  } catch {
    notFound();
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <InventoryDetailPage inventoryItemId={id} />
    </HydrationBoundary>
  );
}
