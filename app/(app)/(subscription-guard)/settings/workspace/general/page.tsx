import { CurrencyTaxCard } from "@/modules/core/workspace-settings/components/currency-tax-card";
import { TenantBrandingCard } from "@/modules/core/workspace-settings/components/tenant-admin/tenant-branding-card";
import { SettingsPageHeader } from "@/modules/core/workspace-settings/components/settings-hub/settings-page-header";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import type { CurrencyCode } from "@/lib/utils/currency";

export default async function GeneralSettingsPage() {
  const tenant = await getCurrentTenant();
  return (
    <div className="flex flex-col gap-6">
      <SettingsPageHeader
        title="General"
        description="Workspace identity. Your logo appears in the sidebar and on customer-facing documents."
      />
      <TenantBrandingCard />
      <CurrencyTaxCard
        currentBaseCurrency={tenant.baseCurrency as CurrencyCode}
        currentTaxInclusive={tenant.taxInclusive}
        currentDefaultTaxRate={tenant.defaultTaxRate}
      />
    </div>
  );
}
