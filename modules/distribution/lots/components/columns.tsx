"use client";

import { useState } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Trash2 } from "lucide-react";

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
import type { LotListItem } from "../services/lots";
import { formatDisplayDate } from "@/lib/utils/date";

type ColumnActions = {
  onDelete: (lot: LotListItem) => void;
};

function parseIsoDate(s: string): Date {
  return new Date(s + "T12:00:00Z");
}

function ExpirationCell({ expirationDate }: { expirationDate: string }) {
  const exp = parseIsoDate(expirationDate);
  const now = new Date();
  const daysLeft = Math.ceil(
    (exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
  );

  let variant: "destructive" | "secondary" | "outline" = "outline";
  let label = formatDisplayDate(expirationDate);
  if (daysLeft < 0) {
    variant = "destructive";
    label = `Expired ${formatDisplayDate(expirationDate)}`;
  } else if (daysLeft <= 7) {
    variant = "secondary";
    label = `Expires ${formatDisplayDate(expirationDate)}`;
  }
  return (
    <Badge variant={variant} className="font-normal">
      {label}
    </Badge>
  );
}

function ActionsCell({
  lot,
  onDelete,
}: {
  lot: LotListItem;
  onDelete: (lot: LotListItem) => void;
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
            <Link href={`/inventory/lots/${lot.id}`}>View lot</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 />
            Delete lot
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete lot &quot;{lot.lotNumber}&quot;?
              This may fail if inventory or supplier invoices still reference
              it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onDelete(lot);
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

export function createColumns(
  actions: ColumnActions,
): ColumnDef<LotListItem>[] {
  return [
    {
      accessorKey: "lotNumber",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Lot number
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <Link
          href={`/inventory/lots/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.getValue("lotNumber")}
        </Link>
      ),
    },
    {
      id: "supplier",
      header: "Supplier",
      cell: ({ row }) => {
        const supplier = row.original.supplier;
        return supplier ? (
          <span>{supplier.name}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "receiveDate",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Received
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm tabular-nums">
          {formatDisplayDate(row.getValue("receiveDate"))}
        </span>
      ),
    },
    {
      accessorKey: "expirationDate",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Expiration
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <ExpirationCell expirationDate={row.getValue("expirationDate")} />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-center">
          <ActionsCell lot={row.original} onDelete={actions.onDelete} />
        </div>
      ),
      meta: {
        className: "w-[80px] text-center",
      },
    },
  ];
}
