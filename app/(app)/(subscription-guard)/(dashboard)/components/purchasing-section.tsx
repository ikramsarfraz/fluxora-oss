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
} from "@/modules/distribution/services/dashboard";

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
        <div className="border-b border-stone-line pb-3">
          <h2 className="text-sm font-semibold text-stone-ink">Purchasing</h2>
          <p className="mt-0.5 text-xs text-stone-muted">
            Supplier activity and open payables.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 px-4 lg:px-6 @3xl/main:grid-cols-3">
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

function RecentSupplierInvoicesCard({ rows }: { rows: RecentSupplierInvoiceRow[] }) {
  return (
    <Card className="shadow-none overflow-hidden">
      <CardHeader className="border-b border-stone-line pb-3">
        <CardTitle className="text-sm font-semibold text-stone-ink">Recent supplier invoices</CardTitle>
        <CardDescription className="text-xs text-stone-muted">
          Newest 8 across all statuses.
        </CardDescription>
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

function UnpaidSupplierInvoicesCard({ rows }: { rows: RecentSupplierInvoiceRow[] }) {
  return (
    <Card className="shadow-none overflow-hidden">
      <CardHeader className="border-b border-stone-line pb-3">
        <CardTitle className="text-sm font-semibold text-stone-ink">Unpaid supplier invoices</CardTitle>
        <CardDescription className="text-xs text-stone-muted">
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
    <Card className="shadow-none">
      <CardHeader className="border-b border-stone-line pb-3">
        <CardTitle className="text-sm font-semibold text-stone-ink">Spend by supplier</CardTitle>
        <CardDescription className="text-xs text-stone-muted">
          Completed invoice totals, last 90 days.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
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
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-stone-line2">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-14 text-right text-xs text-stone-muted tabular-nums">
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
    <p className="px-6 py-6 text-center text-xs text-stone-muted">
      {children}
    </p>
  );
}
