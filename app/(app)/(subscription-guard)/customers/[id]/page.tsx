import { Suspense } from "react";
import DetailPage from "@/modules/distribution/customers/routes/detail-page";
import { PageLoading } from "@/components/page-loading";

export default function Page() {
  return (
    <Suspense fallback={<PageLoading message="Loading customer..." />}>
      <DetailPage />
    </Suspense>
  );
}
