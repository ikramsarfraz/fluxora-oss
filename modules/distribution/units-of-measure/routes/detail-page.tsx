import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { queryKeys } from "@/lib/query/keys";
import { isUuid } from "@/lib/utils/uuid";
import { getUnitOfMeasureById } from "../services/units-of-measure";

import { UnitDetailPage } from "../components/unit-detail-page";

export default async function UnitDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.unitsOfMeasure.detail(id),
      queryFn: () => getUnitOfMeasureById(id),
    });
  } catch {
    notFound();
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UnitDetailPage unitId={id} />
    </HydrationBoundary>
  );
}
