import { Suspense } from "react";

import { getConnectedBanks } from "@/modules/distribution/plaid/actions";
import { BanksSettingsPage } from "@/modules/distribution/plaid/components/banks-settings-page";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { SettingsForbidden } from "@/modules/core/workspace-settings/components/settings-hub/settings-forbidden";

async function BanksContent() {
  const banks = await getConnectedBanks();
  return <BanksSettingsPage initialBanks={banks} />;
}

export default async function BanksSettingsRoutePage() {
  const current = await getCurrentPortalUser();
  if (current.role !== "owner" && current.role !== "admin") {
    return <SettingsForbidden leafLabel="Banks" />;
  }

  return (
    <Suspense fallback={<div className="text-[13px] text-subtle">Loading…</div>}>
      <BanksContent />
    </Suspense>
  );
}
