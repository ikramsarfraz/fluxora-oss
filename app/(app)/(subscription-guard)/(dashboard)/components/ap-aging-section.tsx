"use client";

import Link from "next/link";
import { AlertCircle, Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApAging } from "@/modules/distribution/hooks/use-dashboard";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import type {
  ApAging,
  ApAgingInvoiceRow,
  ApAgingSupplierRow,
} from "@/modules/distribution/services/aging";

import { BucketBadge, BucketBars } from "./aging-shared";

export function ApAgingSection() {
  const { data, isPending, isError, error } = useApAging();

  return (
    <section className="flex flex-col gap-4">
      <div className="px-4 lg:px-6">
        <div className="border-b border-stone-line pb-3">
          <h2 className="text-sm font-semibold text-stone-ink">
            Accounts payable aging
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-muted">
            <Info className="size-3.5 shrink-0" />
            Due date = invoice date + supplier payment terms (net days). Suppliers
            without terms configured fall back to Net-0 (due on invoice date).
          </p>
        </div>
      </div>

      {isPending ? (
        <ApAgingSkeleton />
      ) : isError || !data ? (
        <div className="px-4 lg:px-6">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Could not load AP aging</AlertTitle>
            <AlertDescription>
              {error instanceof Error
                ? error.message
                : "An unexpected error occurred."}
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <ApAgingContent data={data} />
      )}
    </section>
  );
}

function ApAgingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 px-4 lg:px-6 @3xl/main:grid-cols-3">
      <Skeleton className="h-[260px] rounded-xl" />
      <Skeleton className="h-[260px] rounded-xl" />
      <Skeleton className="h-[260px] rounded-xl" />
    </div>
  );
}

function ApAgingContent({ data }: { data: ApAging }) {
  return (
    <div className="grid grid-cols-1 gap-3 px-4 lg:px-6 @3xl/main:grid-cols-3">
      <Card className="shadow-none">
        <CardHeader className="border-b border-stone-line pb-3">
          <CardTitle className="text-sm font-semibold text-stone-ink">Open balance</CardTitle>
          <CardDescription className="text-xs text-stone-muted">
            Completed supplier invoices with balance remaining.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col rounded-lg border border-stone-line p-3">
              <span className="text-xs text-stone-muted">Total open</span>
              <span className="font-mono text-xl font-semibold tabular-nums text-stone-ink">
                {formatMoney(data.totalOpen)}
              </span>
            </div>
            <div className="flex flex-col rounded-lg border border-stone-line p-3">
              <span className="text-xs text-destructive">Overdue</span>
              <span className="font-mono text-xl font-semibold tabular-nums text-stone-ink">
                {formatMoney(data.totalOverdue)}
              </span>
            </div>
          </div>
          <BucketBars buckets={data.buckets} />
        </CardContent>
      </Card>

      <TopSuppliersCard rows={data.topSuppliers} />
      <RecentOverdueCard rows={data.recentOverdueInvoices} />
    </div>
  );
}

function TopSuppliersCard({ rows }: { rows: ApAgingSupplierRow[] }) {
  return (
    <Card className="shadow-none overflow-hidden">
      <CardHeader className="border-b border-stone-line pb-3">
        <CardTitle className="text-sm font-semibold text-stone-ink">Top unpaid suppliers</CardTitle>
        <CardDescription className="text-xs text-stone-muted">
          By overdue balance across open invoices.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <Empty>No open supplier balances.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead className="text-right">Oldest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.supplierId}>
                  <TableCell>
                    <Link
                      href={`/suppliers/${row.supplierId}`}
                      className="font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    <div className="text-xs text-stone-muted">
                      {row.invoiceCount} invoice
                      {row.invoiceCount === 1 ? "" : "s"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(row.totalOverdue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-stone-muted">
                    {formatMoney(row.totalBalance)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.oldestDaysOverdue > 0
                      ? `${row.oldestDaysOverdue}d`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function RecentOverdueCard({ rows }: { rows: ApAgingInvoiceRow[] }) {
  return (
    <Card className="shadow-none overflow-hidden">
      <CardHeader className="border-b border-stone-line pb-3">
        <CardTitle className="text-sm font-semibold text-stone-ink">Recent overdue invoices</CardTitle>
        <CardDescription className="text-xs text-stone-muted">
          Oldest past-due invoices, top 8.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <Empty>No overdue supplier invoices.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/supplier-invoices/${row.id}`}
                      className="font-medium hover:underline"
                    >
                      {row.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    <Link
                      href={`/suppliers/${row.supplierId}`}
                      className="hover:underline"
                    >
                      {row.supplierName}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    <div className="flex flex-col">
                      <span>{formatDisplayDate(row.dueDate)}</span>
                      <span className="text-xs text-stone-muted">
                        {row.netDays == null
                          ? "Net-0 (no terms)"
                          : `Net-${row.netDays}`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(row.balanceDue)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <BucketBadge bucket={row.bucket} />
                      <span className="text-xs text-stone-muted tabular-nums">
                        {row.daysOverdue}d
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-6 py-6 text-center text-xs text-stone-muted">
      {children}
    </p>
  );
}
