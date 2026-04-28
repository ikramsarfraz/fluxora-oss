"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SalesInvoiceListItem } from "@/services/invoicing";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatMoney } from "@/lib/utils/currency";

const STATUS_META: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  draft: { label: "Draft", variant: "outline" },
  sent: { label: "Sent", variant: "secondary" },
  partially_paid: { label: "Partially paid", variant: "secondary" },
  paid: { label: "Paid", variant: "default" },
  void: { label: "Void", variant: "destructive" },
};

function ActionsCell({ invoice }: { invoice: SalesInvoiceListItem }) {
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
        <DropdownMenuItem asChild>
          <Link href={`/invoices/${invoice.id}`}>View invoice</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/orders/${invoice.salesOrderId}`}>View order</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function createColumns(): ColumnDef<SalesInvoiceListItem>[] {
  return [
    {
      accessorKey: "invoiceNumber",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Invoice #
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <Link
          href={`/invoices/${row.original.id}`}
          className="font-mono text-sm font-medium hover:underline"
        >
          {row.getValue("invoiceNumber")}
        </Link>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const customer = row.original.customer;
        return customer ? (
          <span>{customer.name}</span>
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
        const meta = STATUS_META[status] ?? {
          label: status,
          variant: "outline" as const,
        };
        return (
          <Badge variant={meta.variant} className="font-normal capitalize">
            {meta.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "invoiceDate",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Invoice date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatDisplayDate(row.getValue("invoiceDate"))}
        </span>
      ),
    },
    {
      accessorKey: "dueDate",
      header: "Due",
      cell: ({ row }) => {
        const dueDate = row.getValue("dueDate") as string | null;
        return dueDate ? (
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatDisplayDate(dueDate)}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "totalAmount",
      header: () => <div className="text-right">Total</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {formatMoney(row.getValue("totalAmount"))}
        </div>
      ),
    },
    {
      accessorKey: "balanceDue",
      header: () => <div className="text-right">Balance due</div>,
      cell: ({ row }) => {
        const balance = Number(row.getValue("balanceDue"));
        return (
          <div
            className={
              balance > 0
                ? "text-right font-medium tabular-nums"
                : "text-right tabular-nums text-muted-foreground"
            }
          >
            {formatMoney(row.getValue("balanceDue"))}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-center">
          <ActionsCell invoice={row.original} />
        </div>
      ),
      meta: {
        className: "w-[80px] text-center",
      },
    },
  ];
}
