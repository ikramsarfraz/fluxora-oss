import { Suspense } from "react";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { InvitationExpiryCard } from "@/modules/core/workspace-settings/components/invitation-expiry-card";
import { listPendingInvitationsForAdmin } from "@/modules/core/workspace-settings/services/invitations";
import {
  getCurrentPortalUser,
  getUsers,
} from "@/modules/shared/services/portal-users";
import Users from "@/modules/core/workspace-settings/users/components/users-page";
import { SettingsForbidden } from "@/modules/core/workspace-settings/components/settings-hub/settings-forbidden";

export default async function MembersSettingsPage() {
  const current = await getCurrentPortalUser();
  if (current.role !== "owner" && current.role !== "admin") {
    return <SettingsForbidden leafLabel="Members" />;
  }

  const queryClient = new QueryClient();
  const [tenant] = await Promise.all([
    getCurrentTenant(),
    queryClient.prefetchQuery({
      queryKey: queryKeys.users.all,
      queryFn: () => getUsers(),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.users.invitations,
      queryFn: () => listPendingInvitationsForAdmin(),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col gap-6">
        <Suspense>
          <Users
            title="Members"
            subtitle="People with access to this workspace. Invite teammates and assign roles."
          />
        </Suspense>
        <InvitationExpiryCard
          currentValue={tenant.invitationExpiryDays}
        />
      </div>
    </HydrationBoundary>
  );
}
