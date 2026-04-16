import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import Users from "./components/users-page";
import { queryKeys } from "@/lib/query/keys";
import { listPendingInvitationsForAdmin } from "@/services/invitations";
import { getUsers } from "@/services/portal-users";

export default async function UsersPage() {
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
      <Users />
    </HydrationBoundary>
  );
}
