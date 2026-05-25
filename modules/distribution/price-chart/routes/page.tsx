import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireFeature } from "@/modules/core/feature-flags";
import { getCurrentTenantCached } from "@/modules/core/tenants/services/tenants";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { PriceChartClient } from "../components/price-chart-client";
import { PRICE_CHART_FEATURE } from "../feature";
import { isPriceChartManager } from "../services/price-chart";

export default async function PriceChartPage() {
  const tenant = await getCurrentTenantCached();
  await requireFeature(tenant.id, PRICE_CHART_FEATURE);
  const portalUser = await getCurrentPortalUser();
  if (!isPriceChartManager(portalUser.role)) {
    notFound();
  }
  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Price Chart"
        description="Pick a customer on the left and edit customer-specific prices on the right. Empty fields use the product default price."
      />
      <PriceChartClient />
    </section>
  );
}
