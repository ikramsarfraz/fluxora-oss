import { notFound } from "next/navigation";

import { isUuid } from "@/lib/utils/uuid";

import { InventoryDetailPage } from "../components/inventory-detail-page";

// Server-side data prefetch removed deliberately: warming the React Query
// cache here meant the in-component DetailPageSkeleton never fired on a
// cold visit, because the client found the data immediately. Operators
// want the tailored skeleton during the first paint, so the client now
// owns the loading state.
//
// We keep the cheap UUID-format check on the server — invalid format is
// guaranteed-bogus without a DB call, so 404 right away. Valid UUIDs that
// don't resolve (missing row, cross-tenant) fall through to the client,
// which renders <PageError> from the same query result.
export default async function InventoryDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  return <InventoryDetailPage inventoryItemId={id} />;
}
