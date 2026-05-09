import { Suspense } from "react";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import Users from "@/modules/core/workspace-settings/users/components/users-page";
import { queryKeys } from "@/lib/query/keys";
import { listPendingInvitationsForAdmin } from "@/modules/core/workspace-settings/services/invitations";
import { getUsers } from "@/modules/core/shared/services/portal-users";

export default async function WorkspaceUsersListPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.users.all,
    queryFn: () => getUsers(),
  });
  await queryClient.prefetchQuery({
    queryKey: queryKeys.users.invitations,
    queryFn: () => listPendingInvitationsForAdmin(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <Users />
      </Suspense>
    </HydrationBoundary>
  );
}
