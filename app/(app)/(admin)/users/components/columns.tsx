"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpDown,
  Check,
  Mail,
  MoreHorizontal,
  UserMinus,
  X,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import type { UsersDirectoryListItem } from "@/services/portal-users";
import { formatDisplayDate } from "@/lib/utils/date";

export type UsersDirectoryRow = UsersDirectoryListItem;

type ColumnActions = {
  onDeactivateUser: (user: Extract<UsersDirectoryRow, { kind: "user" }>["row"]) => void;
  onResendInvitation: (
    invitation: Extract<UsersDirectoryRow, { kind: "invitation" }>["row"],
  ) => void;
  onRevokeInvitation: (
    invitation: Extract<UsersDirectoryRow, { kind: "invitation" }>["row"],
  ) => void;
  resendInvitationId: string | null;
};

function ActionsCell({
  row,
  onDeactivateUser,
  onResendInvitation,
  onRevokeInvitation,
  resendInvitationId,
}: {
  row: UsersDirectoryRow;
  onDeactivateUser: (user: Extract<UsersDirectoryRow, { kind: "user" }>["row"]) => void;
  onResendInvitation: (
    invitation: Extract<UsersDirectoryRow, { kind: "invitation" }>["row"],
  ) => void;
  onRevokeInvitation: (
    invitation: Extract<UsersDirectoryRow, { kind: "invitation" }>["row"],
  ) => void;
  resendInvitationId: string | null;
}) {
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [deactivateUserOpen, setDeactivateUserOpen] = useState(false);

  if (row.kind === "invitation") {
    const inv = row.row;
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => onResendInvitation(inv)}
              disabled={resendInvitationId === inv.id}
            >
              <Mail />
              Resend email
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setRevokeOpen(true)}
            >
              <UserMinus className="size-4" />
              Revoke invitation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke invitation</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to revoke the invitation for &quot;
                {inv.email}&quot;? They will no longer be able to accept this
                invitation.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  onRevokeInvitation(inv);
                  setRevokeOpen(false);
                }}
              >
                Revoke
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  const user = row.row;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href={`/users/${user.id}`}>View user</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {user.isActive ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeactivateUserOpen(true)}
            >
              <UserMinus className="size-4" />
              Deactivate user
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={deactivateUserOpen}
        onOpenChange={setDeactivateUserOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate user</AlertDialogTitle>
            <AlertDialogDescription>
              Deactivate &quot;{user.fullName}&quot;? They will no longer be
              able to sign in to this workspace until reactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onDeactivateUser(user);
                setDeactivateUserOpen(false);
              }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function createColumns(
  actions: ColumnActions,
): ColumnDef<UsersDirectoryRow>[] {
  return [
    {
      id: "fullName",
      accessorFn: r => r.row.fullName,
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="p-0"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Full name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const original = row.original;
        if (original.kind === "invitation") {
          return <span className="font-medium">{original.row.fullName}</span>;
        }
        return (
          <Link
            href={`/users/${original.row.id}`}
            className="font-medium hover:underline"
          >
            {original.row.fullName}
          </Link>
        );
      },
    },
    {
      id: "email",
      accessorFn: r => r.row.email,
      header: "Email",
    },
    {
      id: "role",
      accessorFn: r => r.row.role,
      header: "Role",
      cell: ({ row }) => {
        const role = row.original.row.role;
        return (
          <Badge variant="outline">
            {role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()}
          </Badge>
        );
      },
    },
    {
      id: "emailVerified",
      header: () => <div className="text-center">Email verified</div>,
      cell: ({ row }) => {
        if (row.original.kind === "invitation") {
          return (
            <div className="text-center text-muted-foreground">
              <span className="sr-only">Not applicable</span>—
            </div>
          );
        }
        const verified = row.original.row.authUser?.emailVerified ?? false;
        return (
          <div className="flex items-center justify-center gap-1">
            <Badge variant="outline">
              {verified ? (
                <Check className="h-4 w-4 text-green-700" />
              ) : (
                <X className="h-4 w-4 text-red-700" />
              )}
              <span className="sr-only">
                {verified ? "Verified" : "Not verified"}
              </span>
            </Badge>
          </div>
        );
      },
    },
    {
      id: "createdAt",
      accessorFn: r => new Date(r.row.createdAt).getTime(),
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="p-0"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Created
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {formatDisplayDate(row.original.row.createdAt)}
        </span>
      ),
    },
    {
      id: "inviteExpiresAt",
      accessorFn: r =>
        r.kind === "invitation"
          ? new Date(r.row.inviteExpiresAt).getTime()
          : null,
      header: "Pending until",
      cell: ({ row }) => {
        if (row.original.kind === "user") {
          return (
            <span className="text-muted-foreground">
              <span className="sr-only">Not applicable</span>—
            </span>
          );
        }
        const ex = row.original.row.inviteExpiresAt;
        return (
          <span className="tabular-nums text-muted-foreground">
            {formatDisplayDate(ex)}
          </span>
        );
      },
    },
    {
      id: "isActive",
      header: () => <div className="text-center">Status</div>,
      cell: ({ row }) => {
        if (row.original.kind === "invitation") {
          const expired = row.original.row.inviteIsExpired;
          return (
            <div className="flex justify-center">
              {expired ? (
                <Badge variant="destructive">Invite expired</Badge>
              ) : (
                <Badge variant="secondary">Pending invite</Badge>
              )}
            </div>
          );
        }
        const user = row.original.row;
        return (
          <div className="flex items-center justify-center gap-1">
            <Badge variant="outline">
              {user.isActive ? (
                <Check className="h-4 w-4 text-green-700" />
              ) : (
                <X className="h-4 w-4 text-red-700" />
              )}
              <span className="sr-only">
                {user.isActive ? "Active" : "Inactive"}
              </span>
            </Badge>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-center">
          <ActionsCell
            row={row.original}
            onDeactivateUser={actions.onDeactivateUser}
            onResendInvitation={actions.onResendInvitation}
            onRevokeInvitation={actions.onRevokeInvitation}
            resendInvitationId={actions.resendInvitationId}
          />
        </div>
      ),
      meta: {
        className: "w-[80px] text-center",
      },
    },
  ];
}
