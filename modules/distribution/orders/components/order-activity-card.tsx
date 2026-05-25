"use client";

import { ActivityCard } from "@/modules/distribution/components/activity-card";
import { useSalesOrderActivity } from "@/modules/distribution/hooks/use-activity";

export function OrderActivityCard({ orderId }: { orderId: string }) {
  const { data, isLoading, isError } = useSalesOrderActivity(orderId);
  return <ActivityCard items={data} isLoading={isLoading} isError={isError} />;
}
