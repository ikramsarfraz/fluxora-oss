"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";

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
import { useArAging } from "@/hooks/use-dashboard";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import type {
  ArAging,
  ArAgingCustomerRow,
  ArAgingInvoiceRow,
} from "@/services/aging";

import { BucketBadge, BucketBars } from "./aging-shared";

export function ArAgingSection() {
  const { data, isPending, isError, error } = useArAging();

  return (
    <section className="flex flex-col gap-4">
      <div className="px-4 lg:px-6">
        <h2 className="text-base font-semibold tracking-tight">
          Accounts receivable aging
        </h2>
        <p className="text-sm text-muted-foreground">
          Open customer invoices bucketed by days past their due date.
          Invoices without a due date are treated as current.
        </p>
      </div>

      {isPending ? (
        <ArAgingSkeleton />
      ) : isError || !data ? (
        <div className="px-4 lg:px-6">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Could not load AR aging</AlertTitle>
            <AlertDescription>
              {error instanceof Error
                ? error.message
                : "An unexpected error occurred."}
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <ArAgingContent data={data} />
      )}
    </section>
  );
}

function ArAgingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @3xl/main:grid-cols-3">
      <Skeleton className="h-[260px] rounded-xl" />
      <Skeleton className="h-[260px] rounded-xl" />
      <Skeleton className="h-[260px] rounded-xl" />
    </div>
  );
}

function ArAgingContent({ data }: { data: ArAging }) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @3xl/main:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Open balance</CardTitle>
          <CardDescription>
            Non-void invoices with balance remaining.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col rounded-lg border p-3">
              <span className="text-xs text-muted-foreground">
                Total open
              </span>
              <span className="text-xl font-semibold tabular-nums">
                {formatMoney(data.totalOpen)}
              </span>
            </div>
            <div className="flex flex-col rounded-lg border p-3">
              <span className="text-xs text-destructive">Overdue</span>
              <span className="text-xl font-semibold tabular-nums">
                {formatMoney(data.totalOverdue)}
              </span>
            </div>
          </div>
          <BucketBars buckets={data.buckets} />
        </CardContent>
      </Card>

      <TopCustomersCard rows={data.topCustomers} />
      <RecentOverdueCard rows={data.recentOverdueInvoices} />
    </div>
  );
}

function TopCustomersCard({ rows }: { rows: ArAgingCustomerRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top overdue customers</CardTitle>
        <CardDescription>By overdue balance across open invoices.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <Empty>No open customer balances.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead className="text-right">Oldest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.customerId}>
                  <TableCell>
                    <Link
                      href={`/customers/${row.customerId}`}
                      className="font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {row.invoiceCount} invoice
                      {row.invoiceCount === 1 ? "" : "s"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(row.totalOverdue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
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

function RecentOverdueCard({ rows }: { rows: ArAgingInvoiceRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent overdue invoices</CardTitle>
        <CardDescription>Oldest past-due invoices, top 8.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <Empty>No overdue invoices.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
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
                      href={`/invoices/${row.id}`}
                      className="font-medium hover:underline"
                    >
                      {row.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    <Link
                      href={`/customers/${row.customerId}`}
                      className="hover:underline"
                    >
                      {row.customerName}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {row.dueDate ? formatDisplayDate(row.dueDate) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(row.balanceDue)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <BucketBadge bucket={row.bucket} />
                      <span className="text-xs text-muted-foreground tabular-nums">
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
    <p className="px-6 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
