"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useUsers } from "@/hooks/use-users";
import { useUserInvitations } from "@/hooks/use-user-invitations";
import { Plus } from "lucide-react";

import { columns, type UsersDirectoryRow } from "./columns";
import { DataTable } from "./data-table";

export default function Users() {
  const { data: users, isLoading: usersLoading, error: usersError } = useUsers();
  const {
    data: invitations,
    isLoading: invitationsLoading,
    error: invitationsError,
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

  if (usersLoading || invitationsLoading)
    return <div className="loading">Loading users…</div>;
  if (usersError)
    return (
      <div className="error">
        Failed to load users: {(usersError as Error).message}
      </div>
    );
  if (invitationsError)
    return (
      <div className="error">
        Failed to load invitations: {(invitationsError as Error).message}
      </div>
    );

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="users-table-heading"
    >
      <div className="flex items-center justify-between gap-2">
        <h1 id="users-table-heading">Users</h1>
        <Button asChild>
          <Link href="/users/new">
            <Plus />
            <span className="hidden lg:inline">Invite user</span>
          </Link>
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={r =>
          r.kind === "user"
            ? `user-${r.row.id}`
            : `invitation-${r.row.id}`
        }
      />
    </section>
  );
}
