"use client";

import Link from "next/link";
import { useMemo, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageError } from "@/components/page-error";
import { EmptyState } from "@/components/empty-state";
import { ListPageSkeleton } from "@/components/loading-skeletons";
import { toast } from "sonner";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";

import { createColumns, type UsersDirectoryRow } from "./columns";
import { DataTable } from "./data-table";
import {
  useResendUserInvitation,
  useRevokeUserInvitation,
  useUsersDirectoryPage,
} from "@/hooks/use-users";
import type { UsersDirectoryListSort } from "@/services/portal-users";

export default function Users() {
  const [resendInvitationId, setResendInvitationId] = useState<string | null>(
    null,
  );
  const pagination = useUrlPaginationState<UsersDirectoryListSort>({
    defaultSort: "createdAt",
    defaultDirection: "desc",
  });
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useUsersDirectoryPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
  });
  const resendMutation = useResendUserInvitation();
  const revokeMutation = useRevokeUserInvitation();

  const handleDeleteUser = useCallback((user: Extract<UsersDirectoryRow, { kind: "user" }>["row"]) => {
    // TODO: Implement user deletion
    toast.info(`Delete user "${user.fullName}" - not yet implemented`);
  }, []);

  const handleResendInvitation = useCallback(
    async (invitation: Extract<UsersDirectoryRow, { kind: "invitation" }>["row"]) => {
      setResendInvitationId(invitation.id);
      try {
        await resendMutation.mutateAsync(invitation.id);
        toast.success("Invitation email sent.");
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not resend the invitation.",
        );
      } finally {
        setResendInvitationId(null);
      }
    },
    [resendMutation],
  );

  const handleRevokeInvitation = useCallback(
    async (invitation: Extract<UsersDirectoryRow, { kind: "invitation" }>["row"]) => {
      try {
        await revokeMutation.mutateAsync(invitation.id);
        toast.success("Invitation revoked.");
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not revoke the invitation.",
        );
      }
    },
    [revokeMutation],
  );

  const columns = useMemo(
    () =>
      createColumns({
        onDeleteUser: handleDeleteUser,
        onResendInvitation: handleResendInvitation,
        onRevokeInvitation: handleRevokeInvitation,
        resendInvitationId,
      }),
    [
      handleDeleteUser,
      handleResendInvitation,
      handleRevokeInvitation,
      resendInvitationId,
    ],
  );

  const rows = useMemo<UsersDirectoryRow[]>(() => data?.data ?? [], [data]);

  if (isLoading) {
    return <ListPageSkeleton tableColumns={7} />;
  }

  if (error) {
    return (
      <PageError
        message={(error as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  const hasUsers =
    (data?.total ?? 0) > 0 || pagination.searchInput.trim().length > 0;

  return (
    <section className="flex flex-col gap-6" aria-labelledby="users-heading">
      <PageHeader
        title="Users"
        description="Manage team members and invitations."
      >
        <Button asChild>
          <Link href="/users/new">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Invite User</span>
          </Link>
        </Button>
      </PageHeader>
      {hasUsers ? (
        <DataTable
          columns={columns}
          data={rows}
          searchValue={pagination.searchInput}
          onSearchChange={pagination.setSearch}
          page={data?.page ?? pagination.page}
          pageSize={data?.pageSize ?? pagination.pageSize}
          total={data?.total ?? 0}
          pageCount={data?.pageCount ?? 1}
          sort={pagination.sort}
          direction={pagination.direction}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          onSortChange={(nextSort, nextDirection) => {
            pagination.setSort(
              nextSort as UsersDirectoryListSort,
              nextDirection,
            );
          }}
          searchPlaceholder="Search users and invitations..."
          getRowId={r =>
            r.kind === "user"
              ? `user-${r.row.id}`
              : `invitation-${r.row.id}`
          }
          isFetching={isFetching}
        />
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title="No users yet"
          description="Invite team members to start collaborating on your distribution operations."
        >
          <Button asChild>
            <Link href="/users/new">
              <Plus className="size-4" />
              Invite User
            </Link>
          </Button>
        </EmptyState>
      )}
    </section>
  );
}
