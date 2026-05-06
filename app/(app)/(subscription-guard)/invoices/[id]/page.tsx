import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import { getSalesInvoiceById } from "@/services/invoicing";
import { isUuid } from "@/lib/utils/uuid";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  const invoice = await getSalesInvoiceById(id);
  if (!invoice) {
    notFound();
  }

  const payments = invoice.payments ?? [];
  const totalRevenue = Number(invoice.totalAmount ?? 0);
  const totalCogs = (invoice.lines ?? []).reduce(
    (sum, line) => sum + (Number(line.cogsAmountSnapshot ?? 0) || 0),
    0,
  );
  const grossProfit = totalRevenue - totalCogs;
  const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            {invoice.invoiceNumber}
          </h1>
          <Badge variant="outline">{invoice.status.replaceAll("_", " ")}</Badge>
          <Button asChild variant="outline" size="sm">
            <Link href={`/invoices/${invoice.id}/preview`}>
              <Eye className="size-4" />
              Preview PDF
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/api/invoices/${invoice.id}/pdf`}>
              <Download className="size-4" />
              Download PDF
            </Link>
          </Button>
          {invoice.salesOrder ? (
            <Link
              href={`/orders/${invoice.salesOrder.id}`}
              className="text-sm font-medium text-muted-foreground hover:underline"
            >
              View order
            </Link>
          ) : null}
        </div>
        <div className="text-sm text-muted-foreground">
          Invoice date {formatDisplayDate(invoice.invoiceDate)}
          {invoice.dueDate ? ` · Due ${formatDisplayDate(invoice.dueDate)}` : ""}
          {invoice.customer ? ` · ${invoice.customer.name}` : ""}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Subtotal" value={formatMoney(invoice.subtotal)} />
        <SummaryCard label="Total" value={formatMoney(invoice.totalAmount)} />
        <SummaryCard label="Paid" value={formatMoney(invoice.amountPaid)} />
        <SummaryCard label="Balance due" value={formatMoney(invoice.balanceDue)} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="COGS" value={formatMoney(totalCogs)} />
        <SummaryCard label="Gross profit" value={formatMoney(grossProfit)} />
        <SummaryCard
          label="Margin"
          value={`${marginPercent.toFixed(1)}%`}
          helper="Revenue minus receipt-cost COGS."
        />
      </div>

      <div className="rounded-lg border bg-background">
        <div className="border-b px-4 py-3 text-sm font-medium">Invoice lines</div>
        <div className="divide-y">
          {invoice.lines.map(line => (
            <div
              key={line.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="flex flex-col">
                <span>{line.product?.name ?? "Product"}</span>
                <span className="text-xs text-muted-foreground">
                  {line.product?.sku ?? "—"} · {line.quantityCases} cases ·{" "}
                  {Number(line.billedWeightLbs ?? 0).toFixed(2)} lbs
                </span>
                <span className="text-xs text-muted-foreground">
                  COGS {formatMoney(line.cogsAmountSnapshot)} · Gross profit{" "}
                  {formatMoney(
                    (Number(line.lineTotal ?? 0) || 0) -
                      (Number(line.cogsAmountSnapshot ?? 0) || 0),
                  )}
                </span>
              </div>
              <span className="tabular-nums">{formatMoney(line.lineTotal)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-background">
        <div className="border-b px-4 py-3 text-sm font-medium">
          Payments ({payments.length})
        </div>
        {payments.length > 0 ? (
          <div className="divide-y">
            {payments.map(payment => (
              <div
                key={payment.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="flex flex-col">
                  <span>{payment.paymentMethod.replaceAll("_", " ")}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDisplayDate(payment.paymentDate)}
                  </span>
                </div>
                <span className="tabular-nums">{formatMoney(payment.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            No payments recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-base font-semibold">{value}</div>
      {helper ? <div className="mt-1 text-xs text-muted-foreground">{helper}</div> : null}
    </div>
  );
}
