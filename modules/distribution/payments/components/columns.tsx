"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import type { PaymentListItem } from "../services/payments";

function paymentMethodLabel(
  method: PaymentListItem["paymentMethod"],
): string {
  const map: Record<PaymentListItem["paymentMethod"], string> = {
    cash: "Cash",
    check: "Check",
    ach: "ACH",
    zelle: "Zelle",
    credit_card: "Credit card",
  };
  return map[method] ?? method;
}

export const paymentColumns: ColumnDef<PaymentListItem>[] = [
  {
    accessorKey: "paymentDate",
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
        href={`/payments/${row.original.id}`}
        className="font-medium tabular-nums hover:underline"
      >
        {formatDisplayDate(row.getValue("paymentDate"))}
      </Link>
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
      <Badge variant="outline" className="font-normal">
        {paymentMethodLabel(row.original.paymentMethod)}
      </Badge>
    ),
  },
  {
    id: "customer",
    header: "Customer",
    accessorFn: row => row.salesInvoice?.customer?.name ?? "",
    cell: ({ row }) => {
      const customer = row.original.salesInvoice?.customer;
      if (!customer) {
        return <span className="text-muted-foreground">—</span>;
      }
      return (
        <Link
          href={`/customers/${customer.id}`}
          className="hover:underline"
        >
          {customer.name}
        </Link>
      );
    },
  },
  {
    id: "invoice",
    header: "Invoice",
    accessorFn: row => row.salesInvoice?.invoiceNumber ?? "",
    cell: ({ row }) => {
      const invoice = row.original.salesInvoice;
      if (!invoice) {
        return <span className="text-muted-foreground">—</span>;
      }
      return (
        <Link
          href={`/invoices/${invoice.id}`}
          className="hover:underline"
        >
          {invoice.invoiceNumber}
        </Link>
      );
    },
  },
  {
    id: "reference",
    header: "Reference",
    accessorFn: row => row.referenceNumber ?? row.checkNumber ?? "",
    cell: ({ row }) => {
      const { referenceNumber, checkNumber } = row.original;
      const value = referenceNumber ?? checkNumber ?? null;
      return value ? (
        <span className="font-mono text-xs">{value}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
  {
    id: "createdBy",
    header: "Recorded by",
    accessorFn: row => row.createdBy?.fullName ?? "",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.createdBy?.fullName ?? "—"}
      </span>
    ),
  },
];
