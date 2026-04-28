"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
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
import type { SalesOrderListItem } from "@/services/orders";
import { formatDisplayDate } from "@/lib/utils/date";
import { orderStatusLabel } from "@/lib/utils/status-labels";

type ColumnActions = {
  onDelete: (order: SalesOrderListItem) => void;
};

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  sales_order: "outline",
  confirmed: "secondary",
  fulfilled: "default",
  cancelled: "destructive",
};

function ActionsCell({
  order,
  onDelete,
}: {
  order: SalesOrderListItem;
  onDelete: (order: SalesOrderListItem) => void;
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const label = order.orderNumber ?? order.id.slice(0, 8);

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
            <Link href={`/orders/${order.id}`}>View order</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 />
            Delete order
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sales order</AlertDialogTitle>
            <AlertDialogDescription>
              Delete order <strong>{label}</strong>? This will release any
              allocated inventory back to stock and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onDelete(order);
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
): ColumnDef<SalesOrderListItem>[] {
  return [
    {
      accessorKey: "orderNumber",
      header: "Order #",
      cell: ({ row }) => {
        const orderNumber = row.original.orderNumber;
        return (
          <Link
            href={`/orders/${row.original.id}`}
            className="font-mono text-sm hover:underline"
          >
            {orderNumber ?? row.original.id.slice(0, 8)}
          </Link>
        );
      },
    },
    {
      id: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const customer = row.original.customer;
        return customer ? (
          <Link
            href={`/customers/${customer.id}`}
            className="font-medium hover:underline"
          >
            {customer.name}
          </Link>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "orderDate",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Order date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatDisplayDate(row.getValue("orderDate"))}
        </span>
      ),
    },
    {
      accessorKey: "dueDate",
      header: "Due",
      cell: ({ row }) => {
        const dueDate = row.getValue("dueDate") as string | null;
        return dueDate ? (
          <span className="tabular-nums">{formatDisplayDate(dueDate)}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge variant={STATUS_VARIANT[status] ?? "outline"}>
            {orderStatusLabel(status)}
          </Badge>
        );
      },
    },
    {
      id: "lines",
      header: "Lines",
      cell: ({ row }) => {
        const count = row.original.lines?.length ?? 0;
        return (
          <span className="tabular-nums text-muted-foreground">
            {count} {count === 1 ? "line" : "lines"}
          </span>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Created
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
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
          <ActionsCell order={row.original} onDelete={actions.onDelete} />
        </div>
      ),
      meta: {
        className: "w-[80px] text-center",
      },
    },
  ];
}
