"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Check, MoreHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { PendingInvitationListItem } from "@/services/invitations";
import type { PortalUserListItem } from "@/services/portal-users";

export type UsersDirectoryRow =
  | { kind: "user"; row: PortalUserListItem }
  | { kind: "invitation"; row: PendingInvitationListItem };

function formatCreatedAt(value: string | Date) {
  const d = new Date(value);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export const columns: ColumnDef<UsersDirectoryRow>[] = [
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
    cell: ({ row }) => {
      const original = row.original;
      if (original.kind === "invitation") {
        const inv = original.row;
        return (
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
                onClick={() =>
                  navigator.clipboard.writeText(inv.id.toString())
                }
              >
                Copy invitation ID
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }

      const user = original.row;
      return (
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
              onClick={() => navigator.clipboard.writeText(user.id.toString())}
            >
              Copy user ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/users/${user.id}`}>View user</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
