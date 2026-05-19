import { Suspense } from "react";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getSuppliers } from "@/modules/distribution/suppliers/services/suppliers";
import { queryKeys } from "@/lib/query/keys";
import { getSupplierComparisonData } from "@/modules/distribution/suppliers/services/supplier-comparison";
import { SupplierComparisonPage } from "@/modules/distribution/suppliers/components/supplier-comparison-page";
import Suppliers from "@/modules/distribution/suppliers/components/suppliers-page";
import { ViewSwitcher } from "@/modules/distribution/suppliers/components/suppliers-view-switcher";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; category?: string }>;
}) {
  const { view, category } = await searchParams;
  const activeView = view === "compare" ? "compare" : "list";

  if (activeView === "compare") {
    const data = await getSupplierComparisonData(category ?? null);
    const selectedCategoryId = category ?? data.categories[0]?.id ?? null;

    return (
      <div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20,
        }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", margin: 0 }}>
            Suppliers
          </h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px",
              borderRadius: 7, fontSize: 12.5, fontWeight: 500,
              border: "1px solid var(--color-border-default)", background: "var(--color-card)", color: "var(--color-ink)",
              cursor: "pointer", fontFamily: "inherit",
            }}>↑ Export</button>
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px",
              borderRadius: 7, fontSize: 12.5, fontWeight: 500,
              background: "var(--color-ink)", color: "var(--color-card)", border: "none",
              cursor: "pointer", fontFamily: "inherit",
            }}>→ Send RFQ</button>
          </div>
        </div>
        <ViewSwitcher activeView="compare" />
        <SupplierComparisonPage
          data={data}
          selectedCategoryId={selectedCategoryId}
          embedded
        />
      </div>
    );
  }

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.suppliers.all,
    queryFn: () => getSuppliers(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <Suppliers belowHeader={<ViewSwitcher activeView="list" />} />
      </Suspense>
    </HydrationBoundary>
  );
}
