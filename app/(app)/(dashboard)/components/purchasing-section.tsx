"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import type {
  RecentSupplierInvoiceRow,
  SpendBySupplierRow,
} from "@/services/dashboard";

type Props = {
  purchasing: {
    recent: RecentSupplierInvoiceRow[];
    unpaid: RecentSupplierInvoiceRow[];
    spendBySupplier: SpendBySupplierRow[];
  };
};

export function PurchasingSection({ purchasing }: Props) {
  return (
    <section className="flex flex-col gap-4">
      <div className="px-4 lg:px-6">
        <h2 className="text-base font-semibold tracking-tight">Purchasing</h2>
        <p className="text-sm text-muted-foreground">
          Supplier activity and open payables.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @3xl/main:grid-cols-3">
        <RecentSupplierInvoicesCard rows={purchasing.recent} />
        <UnpaidSupplierInvoicesCard rows={purchasing.unpaid} />
        <SpendBySupplierCard rows={purchasing.spendBySupplier} />
      </div>
    </section>
  );
}

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge variant="default">Completed</Badge>;
    case "draft":
      return <Badge variant="secondary">Draft</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function RecentSupplierInvoicesCard({
  rows,
}: {
  rows: RecentSupplierInvoiceRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent supplier invoices</CardTitle>
        <CardDescription>Newest 8 across all statuses.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <Empty>No supplier invoices yet.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Status</TableHead>
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
                  <TableCell className="text-sm">{row.supplierName}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDisplayDate(row.receiveDate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(row.totalAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {statusBadge(row.status)}
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

function UnpaidSupplierInvoicesCard({
  rows,
}: {
  rows: RecentSupplierInvoiceRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Unpaid supplier invoices</CardTitle>
        <CardDescription>
          Completed invoices with balance remaining.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <Empty>All supplier invoices are fully paid.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Balance</TableHead>
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
                  <TableCell className="text-sm">{row.supplierName}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDisplayDate(row.receiveDate)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(row.balanceDue)}
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

function SpendBySupplierCard({ rows }: { rows: SpendBySupplierRow[] }) {
  const maxTotal = rows.reduce(
    (max, row) => Math.max(max, Number(row.total) || 0),
    0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spend by supplier</CardTitle>
        <CardDescription>
          Completed invoice totals, last 90 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <Empty>No completed supplier invoices in the last 90 days.</Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map(row => {
              const pct =
                maxTotal > 0
                  ? Math.max(5, (Number(row.total) / maxTotal) * 100)
                  : 0;
              return (
                <li key={row.supplierId} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <Link
                      href={`/suppliers/${row.supplierId}`}
                      className="font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    <span className="tabular-nums">
                      {formatMoney(row.total)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative h-2 flex-1 overflow-hidden rounded bg-muted">
                      <div
                        className="absolute inset-y-0 left-0 rounded bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-14 text-right text-xs text-muted-foreground tabular-nums">
                      {row.invoiceCount} inv
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
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
