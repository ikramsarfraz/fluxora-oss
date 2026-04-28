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
import { SupplierListItem } from "@/services/suppliers";
import { formatDisplayDate } from "@/lib/utils/date";

type ColumnActions = {
  onDelete: (supplier: SupplierListItem) => void;
};

function ActionsCell({
  supplier,
  onDelete,
}: {
  supplier: SupplierListItem;
  onDelete: (supplier: SupplierListItem) => void;
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
            <Link href={`/suppliers/${supplier.id}`}>View supplier</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 />
            Delete supplier
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{supplier.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onDelete(supplier);
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

export function createColumns(actions: ColumnActions): ColumnDef<SupplierListItem>[] {
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
          href={`/suppliers/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.getValue("name")}
        </Link>
      ),
    },
    {
      id: "products",
      header: "Products",
      cell: ({ row }) => {
        const count = row.original.productCosts?.length ?? 0;
        return (
          <span className="tabular-nums text-muted-foreground">
            {count} {count === 1 ? "product" : "products"}
          </span>
        );
      },
    },
    {
      id: "paymentTerms",
      accessorKey: "netDays",
      header: "Payment terms",
      cell: ({ row }) => {
        const netDays = row.original.netDays;
        if (netDays == null) {
          return (
            <span className="text-muted-foreground">Net-0 (not set)</span>
          );
        }
        return (
          <span className="tabular-nums text-muted-foreground">
            Net-{netDays}
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
          {formatDisplayDate(row.getValue("createdAt"))}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-center">
          <ActionsCell supplier={row.original} onDelete={actions.onDelete} />
        </div>
      ),
      meta: {
        className: "w-[80px] text-center",
      },
    },
  ];
}
