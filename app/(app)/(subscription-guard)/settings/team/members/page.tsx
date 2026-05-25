import { Suspense } from "react";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";
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
  await Promise.all([
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
      <Suspense>
        <Users
          title="Members"
          subtitle="People with access to this workspace. Invite teammates and assign roles."
        />
      </Suspense>
    </HydrationBoundary>
  );
}
