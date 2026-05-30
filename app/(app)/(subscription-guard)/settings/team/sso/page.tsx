import Link from "next/link";

import { canUseFeature } from "@/lib/subscription-plan-capabilities";
import { formatSubscriptionPlanLabel } from "@/lib/subscription-display";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { hasFeature } from "@/modules/core/feature-flags/guards";
import { FEATURES } from "@/modules/core/feature-flags/constants";
import { SettingsForbidden } from "@/modules/core/workspace-settings/components/settings-hub/settings-forbidden";
import { getTenantSsoConnection } from "@/modules/core/workspace-settings/services/sso-settings";
import { SsoSettingsCard } from "@/modules/core/workspace-settings/components/sso/sso-settings-card";

export default async function SsoSettingsPage() {
  const current = await getCurrentPortalUser();
  if (current.role !== "owner" && current.role !== "admin") {
    return <SettingsForbidden leafLabel="Single Sign-On" />;
  }

  const tenant = await getCurrentTenant();
  const flagEnabled = await hasFeature(tenant.id, FEATURES.CORE_SSO);

  if (!canUseFeature(tenant, "sso") || !flagEnabled) {
    return (
      <div className="flex max-w-xl flex-col gap-3 p-1">
        <h1 className="font-serif text-[22px] font-medium tracking-[-0.01em] text-ink">
          Single Sign-On
        </h1>
        <p className="text-[13px] leading-[1.6] text-subtle">
          SAML 2.0 and OIDC single sign-on are available on the{" "}
          <span className="font-medium text-ink">Enterprise</span> plan. Your
          workspace is currently on{" "}
          <span className="font-medium text-ink">
            {formatSubscriptionPlanLabel(tenant.subscriptionPlan)}
          </span>
          .
        </p>
        <Link
          href="/settings/billing/plan-and-usage"
          className="inline-flex w-fit items-center rounded-md border-[0.5px] border-border-default bg-card px-[14px] py-[7px] text-[13px] font-medium text-ink-warm transition-colors hover:bg-surface"
        >
          View plans
        </Link>
      </div>
    );
  }

  const connection = await getTenantSsoConnection();

  return <SsoSettingsCard connection={connection} />;
}
