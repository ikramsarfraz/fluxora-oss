"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useUsers } from "@/hooks/use-users";
import { useUserInvitations } from "@/hooks/use-user-invitations";
import { Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { EmptyState } from "@/components/empty-state";

import { columns, type UsersDirectoryRow } from "./columns";
import { DataTable } from "./data-table";

export default function Users() {
  const { data: users, isLoading: usersLoading, error: usersError, refetch: refetchUsers } = useUsers();
  const {
    data: invitations,
    isLoading: invitationsLoading,
    error: invitationsError,
    refetch: refetchInvitations,
  } = useUserInvitations();

  const rows = useMemo<UsersDirectoryRow[]>(() => {
    const userRows: UsersDirectoryRow[] = (users ?? []).map(row => ({
      kind: "user" as const,
      row,
    }));
    const inviteRows: UsersDirectoryRow[] = (invitations ?? []).map(row => ({
      kind: "invitation" as const,
      row,
    }));
    return [...userRows, ...inviteRows].sort(
      (a, b) =>
        new Date(b.row.createdAt).getTime() -
        new Date(a.row.createdAt).getTime(),
    );
  }, [users, invitations]);

  if (usersLoading || invitationsLoading) {
    return <PageLoading message="Loading users..." />;
  }

  if (usersError) {
    return (
      <PageError
        message={(usersError as Error).message}
        onRetry={() => refetchUsers()}
      />
    );
  }

  if (invitationsError) {
    return (
      <PageError
        message={(invitationsError as Error).message}
        onRetry={() => refetchInvitations()}
      />
    );
  }

  const hasUsers = rows.length > 0;

  return (
    <section className="flex flex-col gap-6" aria-labelledby="users-heading">
      <PageHeader
        title="Users"
        description="Manage team members and pending invitations."
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
          getRowId={r =>
            r.kind === "user"
              ? `user-${r.row.id}`
              : `invitation-${r.row.id}`
          }
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
