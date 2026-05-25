import { notFound } from "next/navigation";

import { isUuid } from "@/lib/utils/uuid";

import { LotDetailPage } from "../components/lot-detail-page";

// See inventory/routes/detail-page.tsx for the same rationale: prefetching
// the lot warmed the cache and silently suppressed the client-side
// DetailPageSkeleton. We now keep only the cheap UUID-format check on the
// server (cheap 404 for invalid format) and let the client own the
// loading state so the tailored skeleton actually shows.
export default async function LotsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  return <LotDetailPage lotId={id} />;
}
