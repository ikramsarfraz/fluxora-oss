"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Trash2 } from "lucide-react";
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
import { CustomerListItem } from "@/services/customers";

type ColumnActions = {
  onDelete: (customer: CustomerListItem) => void;
};

function formatDate(value: string | Date) {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
}

function ActionsCell({
  customer,
  onDelete,
}: {
  customer: CustomerListItem;
  onDelete: (customer: CustomerListItem) => void;
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
            <Link href={`/customers/${customer.id}`}>View customer</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete customer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{customer.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onDelete(customer);
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

export function createColumns(actions: ColumnActions): ColumnDef<CustomerListItem>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <Link
          href={`/customers/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.getValue("name")}
        </Link>
      ),
    },
    {
      accessorKey: "phoneNumber",
      header: "Phone",
      cell: ({ row }) => {
        const phone = row.getValue("phoneNumber") as string | null;
        return phone ? (
          <span className="tabular-nums">{phone}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      id: "location",
      header: "Location",
      cell: ({ row }) => {
        const address = row.original.addresses?.[0];
        if (!address) {
          return <span className="text-muted-foreground">-</span>;
        }
        const parts = [address.city, address.state].filter(Boolean);
        return parts.length > 0 ? (
          <span>{parts.join(", ")}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "invoicePrefix",
      header: "Invoice Prefix",
      cell: ({ row }) => {
        const prefix = row.getValue("invoicePrefix") as string | null;
        return prefix ? (
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">{prefix}</code>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      id: "products",
      header: "Products",
      cell: ({ row }) => {
        const count = row.original.productPrices?.length ?? 0;
        return (
          <span className="tabular-nums text-muted-foreground">
            {count} {count === 1 ? "product" : "products"}
          </span>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Created
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {formatDate(row.getValue("createdAt"))}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <ActionsCell customer={row.original} onDelete={actions.onDelete} />
      ),
      meta: {
        className: "w-12 sticky right-0 bg-background",
      },
    },
  ];
}
