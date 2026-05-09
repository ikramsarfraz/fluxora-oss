"use client";

import { useParams } from "next/navigation";

import { isUuid } from "@/lib/utils/uuid";
import { PageError } from "@/components/page-error";

import { InventoryDetailPage } from "../components/inventory-detail-page";

export default function InventoryDetailRoute() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  if (!isUuid(id)) {
    return <PageError message="Invalid inventory item ID." />;
  }

  return <InventoryDetailPage inventoryItemId={id} />;
}
