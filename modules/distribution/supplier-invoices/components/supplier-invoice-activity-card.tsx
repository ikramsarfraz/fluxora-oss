"use client";

import { ActivityCard } from "@/modules/distribution/components/activity-card";
import { useSupplierInvoiceActivity } from "@/modules/distribution/hooks/use-activity";

export function SupplierInvoiceActivityCard({
  supplierInvoiceId,
}: {
  supplierInvoiceId: string;
}) {
  const { data, isLoading, isError } =
    useSupplierInvoiceActivity(supplierInvoiceId);
  return <ActivityCard items={data} isLoading={isLoading} isError={isError} />;
}
