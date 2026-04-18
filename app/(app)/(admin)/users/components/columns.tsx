"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Check, MoreHorizontal, X, Trash2 } from "lucide-react";
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
import type { PendingInvitationListItem } from "@/services/invitations";
import type { PortalUserListItem } from "@/services/portal-users";

export type UsersDirectoryRow =
  | { kind: "user"; row: PortalUserListItem }
  | { kind: "invitation"; row: PendingInvitationListItem };

type ColumnActions = {
  onDeleteUser: (user: PortalUserListItem) => void;
  onRevokeInvitation: (invitation: PendingInvitationListItem) => void;
};

function formatCreatedAt(value: string | Date) {
  const d = new Date(value);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ActionsCell({
  row,
  onDeleteUser,
  onRevokeInvitation,
}: {
  row: UsersDirectoryRow;
  onDeleteUser: (user: PortalUserListItem) => void;
  onRevokeInvitation: (invitation: PendingInvitationListItem) => void;
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Revoke invitation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke invitation</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to revoke the invitation for &quot;{inv.email}&quot;? They will no longer be able to accept this invitation.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  onRevokeInvitation(inv);
                  setShowDeleteDialog(false);
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
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete user
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{user.fullName}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onDeleteUser(user);
                setShowDeleteDialog(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function createColumns(actions: ColumnActions): ColumnDef<UsersDirectoryRow>[] {
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
              <span className="sr-only">Not applicable</span>
              —
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
          {formatCreatedAt(row.original.row.createdAt)}
        </span>
      ),
    },
    {
      id: "isActive",
      header: () => <div className="text-center">Active</div>,
      cell: ({ row }) => {
        if (row.original.kind === "invitation") {
          return (
            <div className="flex justify-center">
              <Badge variant="secondary">Pending invite</Badge>
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
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <ActionsCell
          row={row.original}
          onDeleteUser={actions.onDeleteUser}
          onRevokeInvitation={actions.onRevokeInvitation}
        />
      ),
      meta: {
        className: "w-12 sticky right-0 bg-background",
      },
    },
  ];
}
