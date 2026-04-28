import { PageHeader } from "@/components/page-header";
import { PlanFeatureGate } from "@/components/subscription/plan-feature-gate";
import { canUseFeature } from "@/lib/subscription-plan-capabilities";
import { getCurrentTenantCached } from "@/services/tenants";

import { PriceChartClient } from "./price-chart-client";

export default async function PriceChartPage() {
  const tenant = await getCurrentTenantCached();
  const canAccessReports = canUseFeature(tenant, "reports");

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Price Chart"
        description="Customer-specific pricing and cost views for internal reporting workflows."
      />
      <PlanFeatureGate
        enabled={canAccessReports}
        featureKey="reports"
        currentPlan={tenant.subscriptionPlan}
        requiredPlan="growth"
      >
        <PriceChartClient />
      </PlanFeatureGate>
    </section>
  );
}
