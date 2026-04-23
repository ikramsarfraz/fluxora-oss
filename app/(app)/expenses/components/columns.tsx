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
import {
  expenseCategoryLabel,
  expensePaymentMethodLabel,
  type ExpensePaymentMethod,
} from "@/lib/expenses/metadata";
import type { ExpenseListItem } from "@/services/expenses";

type ColumnActions = {
  canManage: boolean;
  manageDisabledReason?: string;
  onDelete: (expense: ExpenseListItem) => void;
};

function ActionsCell({
  expense,
  canManage,
  manageDisabledReason,
  onDelete,
}: {
  expense: ExpenseListItem;
  canManage: boolean;
  manageDisabledReason?: string;
  onDelete: (expense: ExpenseListItem) => void;
}) {
  const [showDelete, setShowDelete] = useState(false);

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
            <Link href={`/expenses/${expense.id}`}>View</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            asChild={canManage}
            disabled={!canManage}
            title={!canManage ? manageDisabledReason : undefined}
          >
            {canManage ? (
              <Link href={`/expenses/${expense.id}/edit`}>
                <Pencil />
                Edit
              </Link>
            ) : (
              <>
                <Pencil />
                Edit
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={!canManage}
            onClick={() => setShowDelete(true)}
            title={!canManage ? manageDisabledReason : undefined}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this expense for{" "}
              <strong>{formatMoney(expense.amount)}</strong> on{" "}
              <strong>{formatDisplayDate(expense.expenseDate)}</strong>? This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onDelete(expense);
                setShowDelete(false);
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

export function createExpenseColumns(
  actions: ColumnActions,
): ColumnDef<ExpenseListItem>[] {
  return [
    {
      accessorKey: "expenseDate",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <Link
          href={`/expenses/${row.original.id}`}
          className="font-medium tabular-nums hover:underline"
        >
          {formatDisplayDate(row.getValue("expenseDate"))}
        </Link>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-normal">
          {expenseCategoryLabel(row.getValue("category"))}
        </Badge>
      ),
    },
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatMoney(row.getValue("amount"))}
        </span>
      ),
      meta: { className: "text-right" },
      sortingFn: (a, b) =>
        Number(a.getValue("amount")) - Number(b.getValue("amount")),
    },
    {
      accessorKey: "paymentMethod",
      header: "Method",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {expensePaymentMethodLabel(
            row.original.paymentMethod as ExpensePaymentMethod | null,
          )}
        </span>
      ),
    },
    {
      accessorKey: "note",
      header: "Notes",
      cell: ({ row }) => {
        const note = row.original.note;
        return note ? (
          <span className="text-sm">{note}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      id: "createdBy",
      header: "Created by",
      accessorFn: row => row.createdBy?.fullName ?? "",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.createdBy?.fullName ?? "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-center">
          <ActionsCell
            expense={row.original}
            canManage={actions.canManage}
            manageDisabledReason={actions.manageDisabledReason}
            onDelete={actions.onDelete}
          />
        </div>
      ),
      meta: { className: "w-[80px] text-center" },
    },
  ];
}
