"use client";

import { useState } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import type { SupplierInvoiceListItem } from "../services/receiving";
import { getSupplierInvoiceStatusInfo } from "../utils/status";

type ColumnActions = {
  onDelete: (invoice: SupplierInvoiceListItem) => void;
  canDelete: boolean;
  deleteDisabledReason?: string;
};

function StatusBadge({ status }: { status: string }) {
  const info = getSupplierInvoiceStatusInfo(status);
  // Map our tone vocabulary onto the shadcn Badge variants. "success"
  // tone gets the success-bg helper since Badge variant="default" reads
  // as informational primary, not finance-positive.
  if (info.tone === "success") {
    return (
      <Badge
        variant="outline"
        className="border-transparent bg-success-bg font-normal text-success-fg"
      >
        {info.label}
      </Badge>
    );
  }
  if (info.tone === "default") {
    return (
      <Badge variant="default" className="font-normal">
        {info.label}
      </Badge>
    );
  }
  if (info.tone === "info") {
    return (
      <Badge
        variant="outline"
        className="border-transparent bg-info-bg font-normal text-info-fg"
      >
        {info.label}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="font-normal">
      {info.label}
    </Badge>
  );
}

function ActionsCell({
  invoice,
  onDelete,
  canDelete,
  deleteDisabledReason,
}: {
  invoice: SupplierInvoiceListItem;
  onDelete: (invoice: SupplierInvoiceListItem) => void;
  canDelete: boolean;
  deleteDisabledReason?: string;
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isDraft = invoice.status === "draft";
  const deleteEnabled = isDraft && canDelete;
  const deleteTitle = !isDraft
    ? "Completed invoices cannot be deleted."
    : !canDelete
      ? deleteDisabledReason
      : undefined;

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
            <Link href={`/supplier-invoices/${invoice.id}`}>View invoice</Link>
          </DropdownMenuItem>
          {isDraft && (
            <DropdownMenuItem asChild>
              <Link href={`/supplier-invoices/${invoice.id}/edit`}>
                <Pencil />
                Edit draft
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={!deleteEnabled}
            onClick={() => setShowDeleteDialog(true)}
            title={deleteTitle}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete supplier invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Delete draft invoice{" "}
              <strong>&quot;{invoice.invoiceNumber}&quot;</strong>? This removes
              the invoice header and its line items. No inventory has been
              created yet, so nothing in stock will change. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onDelete(invoice);
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
): ColumnDef<SupplierInvoiceListItem>[] {
  return [
    {
      accessorKey: "referenceNumber",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Reference
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <Link
          href={`/supplier-invoices/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.original.referenceNumber}
        </Link>
      ),
    },
    {
      accessorKey: "invoiceNumber",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Supplier inv #
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.getValue("invoiceNumber") || "—"}
        </span>
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
        <span className="text-muted-foreground text-sm tabular-nums">
          {formatDisplayDate(row.getValue("invoiceDate"))}
        </span>
      ),
    },
    {
      accessorKey: "receiveDate",
      header: "Received",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm tabular-nums">
          {formatDisplayDate(row.getValue("receiveDate"))}
        </span>
      ),
    },
    {
      accessorKey: "totalAmount",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Total
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatMoney(row.getValue("totalAmount"))}
        </span>
      ),
      meta: { className: "text-right" },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge
          status={row.getValue("status") as string}
        />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-center">
          <ActionsCell
            invoice={row.original}
            onDelete={actions.onDelete}
            canDelete={actions.canDelete}
            deleteDisabledReason={actions.deleteDisabledReason}
          />
        </div>
      ),
      meta: { className: "w-[80px] text-center" },
    },
  ];
}
