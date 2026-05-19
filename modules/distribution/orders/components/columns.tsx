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
import type { SalesOrderListItem } from "../services/orders";
import { formatDisplayDate } from "@/lib/utils/date";

type ColumnActions = {
  onDelete: (order: SalesOrderListItem) => void;
};

// ── Status pill — mirrors the detail page tokens ───────────────────────────

interface PillConfig {
  label: string;
  bg: string;
  color: string;
}

const STATUS_PILL: Record<string, PillConfig> = {
  sales_order: {
    label: "Draft",
    bg: "var(--color-divider)",
    color: "var(--color-subtle)",
  },
  confirmed: {
    label: "Awaiting fulfillment",
    bg: "var(--color-info-bg)",
    color: "var(--color-info-fg)",
  },
  fulfilled: {
    label: "Fulfilled",
    bg: "var(--color-success-bg)",
    color: "var(--color-success-fg)",
  },
  cancelled: {
    label: "Cancelled",
    bg: "var(--color-warning-bg)",
    color: "var(--color-warning-fg)",
  },
};

function OrderStatusPill({ status }: { status: string }) {
  const pill = STATUS_PILL[status] ?? {
    label: status.replaceAll("_", " "),
    bg: "var(--color-divider)",
    color: "var(--color-subtle)",
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 9px",
        borderRadius: "100px",
        fontSize: "12px",
        fontWeight: 500,
        background: pill.bg,
        color: pill.color,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: "currentColor",
          flexShrink: 0,
        }}
      />
      {pill.label}
    </span>
  );
}

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
      cell: ({ row }) => (
        <OrderStatusPill status={row.getValue("status") as string} />
      ),
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
