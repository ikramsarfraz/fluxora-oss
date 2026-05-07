import { Suspense } from "react";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";
import { listPendingInvitationsForAdmin } from "@/services/invitations";
import { getUsers, requireAdminPortalUser } from "@/services/portal-users";
import UserManagementTabs from "./components/user-management-tabs";

export default async function UserManagementPage() {
  const currentUser = await requireAdminPortalUser();

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
        <UserManagementTabs currentUserRole={currentUser.role} />
      </Suspense>
    </HydrationBoundary>
  );
}
