import type { ReactNode } from "react";

import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { listPendingInvitationsForAdmin } from "@/modules/core/workspace-settings/services/invitations";
import { getConnectedBanks } from "@/modules/distribution/plaid/actions";
import { SettingsBreadcrumb } from "@/modules/core/workspace-settings/components/settings-hub/settings-breadcrumb";
import { buildSettingsGroups } from "@/modules/core/workspace-settings/components/settings-hub/settings-groups";
import { SettingsSubNav } from "@/modules/core/workspace-settings/components/settings-hub/settings-sub-nav";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const current = await getCurrentPortalUser();
  const canManageWorkspace = current.role === "owner" || current.role === "admin";

  // Sidebar badges. Only fetched when the user can actually see those groups —
  // members never see Team / Integrations so the counts would be wasted work.
  const [pendingInvites, connectedBanks] = canManageWorkspace
    ? await Promise.all([
        listPendingInvitationsForAdmin().catch(() => []),
        getConnectedBanks().catch(() => []),
      ])
    : [[] as Array<unknown>, [] as Array<unknown>];

  const groups = buildSettingsGroups({
    canManageWorkspace,
    pendingInviteCount: pendingInvites.length,
    connectedBankCount: connectedBanks.length,
  });

  return (
    <div className="-mx-4 -mb-4 flex min-h-[calc(100dvh-4rem)] flex-col">
      <SettingsBreadcrumb groups={groups} />
      <div className="flex flex-1 items-stretch">
        <SettingsSubNav groups={groups} />
        <div className="flex-1 overflow-y-auto bg-stone-bg px-9 pb-20 pt-8">
          {children}
        </div>
      </div>
    </div>
  );
}
