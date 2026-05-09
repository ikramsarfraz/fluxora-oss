"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { ListingAction, ListingPage, StatusPill, type ListingColumn } from "@/components/listing-page";
import {
  useResendUserInvitation,
  useRevokeUserInvitation,
  useSetUserActive,
  useUsersDirectoryPage,
} from "@/hooks/use-users";
import { useUrlPaginationState } from "@/hooks/use-url-pagination";
import { formatDisplayDate } from "@/lib/utils/date";
import type { UsersDirectoryListItem, UsersDirectoryListSort } from "@/modules/shared/services/portal-users";

type UserRow = UsersDirectoryListItem;

function RoleChip({ role }: { role: string }) {
  const label = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 100,
        background: "oklch(96% 0.03 240)",
        color: "oklch(60% 0.15 240)",
        fontWeight: 500,
      }}
    >
      {label}
    </span>
  );
}

function buildColumns(handlers: {
  onResend: (row: Extract<UserRow, { kind: "invitation" }>["row"]) => void;
  onRevoke: (row: Extract<UserRow, { kind: "invitation" }>["row"]) => void;
  onDeactivate: (row: Extract<UserRow, { kind: "user" }>["row"]) => void;
}): ListingColumn<UserRow>[] {
  return [
    {
      key: "name",
      header: "Name",
      sortKey: "fullName",
      render: row => ({
        primary: <span style={{ fontWeight: 500 }}>{row.row.fullName}</span>,
        secondary: row.row.email,
      }),
    },
    {
      key: "role",
      header: "Role",
      render: row => ({ primary: <RoleChip role={row.row.role} /> }),
    },
    {
      key: "status",
      header: "Status",
      render: row => {
        if (row.kind === "invitation") {
          const inv = row.row;
          if (inv.inviteIsExpired) {
            return { primary: <StatusPill label="Expired" bg="#f5f5f4" color="#78716c" /> };
          }
          return { primary: <StatusPill label="Invited" bg="oklch(97% 0.04 70)" color="oklch(60% 0.14 70)" /> };
        }
        const user = row.row;
        if (!user.isActive) {
          return { primary: <StatusPill label="Inactive" bg="#f5f5f4" color="#78716c" /> };
        }
        if (!user.authUser?.emailVerified) {
          return { primary: <StatusPill label="Unverified" bg="oklch(97% 0.04 70)" color="oklch(60% 0.14 70)" /> };
        }
        return { primary: <StatusPill label="Active" bg="oklch(96% 0.04 155)" color="oklch(58% 0.13 155)" /> };
      },
    },
    {
      key: "createdAt",
      header: "Joined",
      sortKey: "createdAt",
      render: row => ({ primary: formatDisplayDate(row.row.createdAt) }),
    },
  ];
}

export default function Users() {
  const [resendInvitationId, setResendInvitationId] = useState<string | null>(null);

  const pagination = useUrlPaginationState<UsersDirectoryListSort>({
    defaultSort: "createdAt",
    defaultDirection: "desc",
  });

  const { data, isLoading, isFetching, error, refetch } = useUsersDirectoryPage({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sort: pagination.sort,
    direction: pagination.direction,
  });

  const resendMutation = useResendUserInvitation();
  const revokeMutation = useRevokeUserInvitation();
  const setActiveMutation = useSetUserActive();

  const handleResend = useCallback(
    async (inv: Extract<UserRow, { kind: "invitation" }>["row"]) => {
      setResendInvitationId(inv.id);
      try {
        await resendMutation.mutateAsync(inv.id);
        toast.success("Invitation email sent.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not resend the invitation.");
      } finally {
        setResendInvitationId(null);
      }
    },
    [resendMutation],
  );

  const handleRevoke = useCallback(
    async (inv: Extract<UserRow, { kind: "invitation" }>["row"]) => {
      try {
        await revokeMutation.mutateAsync(inv.id);
        toast.success("Invitation revoked.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not revoke the invitation.");
      }
    },
    [revokeMutation],
  );

  const handleDeactivate = useCallback(
    async (user: Extract<UserRow, { kind: "user" }>["row"]) => {
      try {
        await setActiveMutation.mutateAsync({ id: user.id, isActive: false });
        toast.success(`${user.fullName} was deactivated.`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not deactivate this user.");
      }
    },
    [setActiveMutation],
  );

  const columns = buildColumns({
    onResend: handleResend,
    onRevoke: handleRevoke,
    onDeactivate: handleDeactivate,
  });

  if (error) {
    return (
      <div style={{ padding: 24, color: "oklch(0.55 0.22 25)", fontSize: 14 }}>
        {(error as Error).message}{" "}
        <button type="button" onClick={() => refetch()} style={{ textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <ListingPage
      title="Users"
      subtitle="Manage team members and invitations."
      primaryAction={
        <ListingAction href="/users/new">
          <Plus className="size-3.5" />
          Invite user
        </ListingAction>
      }
      columns={columns}
      getRowId={row => row.kind === "user" ? `user-${row.row.id}` : `invitation-${row.row.id}`}
      rowActions={[
        {
          label: "Resend invite",
          onClick: row => {
            if (row.kind !== "invitation") return;
            void handleResend(row.row);
          },
        },
        {
          label: "Revoke invite",
          variant: "destructive",
          onClick: row => {
            if (row.kind !== "invitation") return;
            void handleRevoke(row.row);
          },
        },
        {
          label: "Deactivate",
          variant: "destructive",
          onClick: row => {
            if (row.kind !== "user") return;
            void handleDeactivate(row.row);
          },
        },
      ]}
      rows={data?.data ?? []}
      total={data?.total ?? 0}
      isLoading={isLoading}
      isFetching={isFetching}
      searchPlaceholder="Search users and invitations…"
      emptyTitle="No users yet"
      emptyDescription="Invite team members to start collaborating."
      emptyAction={
        <ListingAction href="/users/new">
          <Plus className="size-3.5" />
          Invite user
        </ListingAction>
      }
      page={data?.page ?? pagination.page}
      pageSize={data?.pageSize ?? pagination.pageSize}
      pageCount={data?.pageCount ?? 1}
      searchInput={pagination.searchInput}
      sort={pagination.sort}
      direction={pagination.direction}
      onPageChange={pagination.setPage}
      onPageSizeChange={pagination.setPageSize}
      onSearchChange={pagination.setSearch}
      onSortChange={(key, dir) => pagination.setSort(key as UsersDirectoryListSort, dir)}
    />
  );
}
