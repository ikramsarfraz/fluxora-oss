"use client";

import Link from "next/link";
import { type ComponentType, useMemo } from "react";
import { CircleDollarSign, FileText, Info, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";

import type { SalesOrderDetail } from "../services/orders";

import { getLineFulfilledWeight } from "./order-fulfillment-utils";

type Invoice = SalesOrderDetail["invoices"][number];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  check: "Check",
  credit_card: "Credit card",
  ach: "ACH",
  zelle: "Zelle",
};

interface OrderFinancialSummaryProps {
  order: SalesOrderDetail;
  onGenerateInvoice?: () => void;
  onRecordPayment?: () => void;
  canGenerateInvoice?: boolean;
  readyToInvoice?: boolean;
}

interface EstimateTotals {
  mode: "estimate";
  subtotal: number;
  fuelSurcharge: number;
  total: number;
  hasPriceData: boolean;
}

interface ActualTotals {
  mode: "actual";
  subtotal: number;
  discount: number;
  credit: number;
  fuelSurcharge: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  invoices: Invoice[];
}

type Totals = EstimateTotals | ActualTotals;

function computeEstimate(order: SalesOrderDetail): EstimateTotals {
  let subtotal = 0;
  let hasPriceData = false;
  for (const line of order.lines ?? []) {
    const price = line.pricePerLbOverride
      ? parseFloat(line.pricePerLbOverride)
      : NaN;
    const weight = getLineFulfilledWeight(line);
    if (Number.isFinite(price) && Number.isFinite(weight) && weight > 0) {
      subtotal += price * weight;
      hasPriceData = true;
    }
  }
  const customerSurcharge = order.customer?.fuelSurchargeAmount
    ? parseFloat(order.customer.fuelSurchargeAmount) || 0
    : 0;
  const fuelSurcharge = order.addFuelSurcharge ? customerSurcharge : 0;
  return {
    mode: "estimate",
    subtotal,
    fuelSurcharge,
    total: subtotal + fuelSurcharge,
    hasPriceData,
  };
}

function computeActual(invoices: Invoice[]): ActualTotals {
  let subtotal = 0;
  let discount = 0;
  let credit = 0;
  let fuelSurcharge = 0;
  let total = 0;
  let amountPaid = 0;
  let balanceDue = 0;
  for (const inv of invoices) {
    subtotal += parseFloat(inv.subtotal ?? "0") || 0;
    discount += parseFloat(inv.discountAmount ?? "0") || 0;
    credit += parseFloat(inv.creditAmount ?? "0") || 0;
    fuelSurcharge += parseFloat(inv.fuelSurchargeAmount ?? "0") || 0;
    total += parseFloat(inv.totalAmount ?? "0") || 0;
    amountPaid += parseFloat(inv.amountPaid ?? "0") || 0;
    balanceDue += parseFloat(inv.balanceDue ?? "0") || 0;
  }
  return {
    mode: "actual",
    subtotal,
    discount,
    credit,
    fuelSurcharge,
    total,
    amountPaid,
    balanceDue,
    invoices,
  };
}

export function OrderFinancialSummary({
  order,
  onGenerateInvoice,
  onRecordPayment,
  canGenerateInvoice = false,
  readyToInvoice = false,
}: OrderFinancialSummaryProps) {
  const invoices = order.invoices ?? [];
  const hasInvoice = invoices.length > 0;

  const totals: Totals = useMemo(
    () => (hasInvoice ? computeActual(invoices) : computeEstimate(order)),
    [hasInvoice, invoices, order],
  );

  const allPayments = useMemo(
    () =>
      invoices
        .flatMap(inv => inv.payments ?? [])
        .sort((a, b) => {
          const ta = new Date(a.paymentDate).getTime();
          const tb = new Date(b.paymentDate).getTime();
          return tb - ta;
        }),
    [invoices],
  );

  const paymentStatus = hasInvoice
    ? totals.mode === "actual" && totals.balanceDue <= 0
      ? "Paid"
      : allPayments.length > 0
        ? "Partial"
        : "Unpaid"
    : "Not invoiced";
  const latestInvoice = invoices
    .slice()
    .sort(
      (a, b) =>
        new Date(b.invoiceDate ?? b.createdAt).getTime() -
        new Date(a.invoiceDate ?? a.createdAt).getTime(),
    )[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <FinancialStatusCard
          icon={FileText}
          label="Invoice status"
          value={
            hasInvoice
              ? (latestInvoice?.status ?? "invoiced")
              : readyToInvoice
                ? "ready_to_invoice"
                : "not_invoiced"
          }
        />
        <FinancialStatusCard
          icon={Wallet}
          label="Payment status"
          value={paymentStatus}
        />
        <FinancialStatusCard
          icon={CircleDollarSign}
          label="Balance due"
          value={
            totals.mode === "actual"
              ? formatMoney(totals.balanceDue)
              : "Awaiting invoice"
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge
          variant={totals.mode === "actual" ? "default" : "outline"}
          className="text-xs"
        >
          {totals.mode === "actual" ? "Actual (invoiced)" : "Estimate"}
        </Badge>
        {hasInvoice && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {invoices.map(inv => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono hover:bg-accent"
              >
                <FileText className="h-3 w-3" />
                {inv.invoiceNumber}
              </Link>
            ))}
          </div>
        )}
      </div>

      {hasInvoice && latestInvoice ? (
        <div className="rounded-md border bg-background px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {latestInvoice.invoiceNumber}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {latestInvoice.status.replaceAll("_", " ")}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Dated {formatDisplayDate(latestInvoice.invoiceDate)}
            </span>
            <Link
              href={`/invoices/${latestInvoice.id}`}
              className="text-xs font-medium hover:underline"
            >
              Open invoice
            </Link>
          </div>
        </div>
      ) : null}

      {!hasInvoice && readyToInvoice ? (
        <div className="flex items-start gap-2 rounded-md border border-success-border bg-success-bg/60 px-3 py-2 text-xs text-success-fg dark:border-emerald-900/40 dark:bg-success-fg/20 dark:text-success-fg">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Ready for invoicing. All order lines are closed, and billed weight
            is ready to flow into the invoice.
          </span>
        </div>
      ) : null}

      {totals.mode === "estimate" && !totals.hasPriceData && (
        <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Line prices or weights are missing — estimate will be available once
            lines are priced.
          </span>
        </div>
      )}

      <dl className="flex flex-col gap-1.5 text-sm">
        {totals.mode === "actual" && (
          <>
            <SummaryRow label="Total billed amount" value={totals.total} />
            <SummaryRow label="Total paid amount" value={-totals.amountPaid} />
            <SummaryRow
              label="Balance due"
              value={totals.balanceDue}
              className={cn(
                "font-semibold",
                totals.balanceDue > 0
                  ? "text-warning-fg dark:text-warning-fg"
                  : "text-success-fg dark:text-success-fg",
              )}
            />
            <div className="my-1 border-t" />
          </>
        )}
        <SummaryRow label="Subtotal" value={totals.subtotal} />
        {totals.mode === "actual" && totals.discount > 0 && (
          <SummaryRow label="Discount" value={-totals.discount} />
        )}
        {totals.mode === "actual" && totals.credit > 0 && (
          <SummaryRow label="Credit" value={-totals.credit} />
        )}
        {totals.fuelSurcharge > 0 && (
          <SummaryRow
            label="Fuel surcharge"
            value={totals.fuelSurcharge}
            hint={
              totals.mode === "estimate" && order.addFuelSurcharge
                ? "From customer default"
                : undefined
            }
          />
        )}
        <div className="my-1 border-t" />
        <SummaryRow
          label="Total"
          value={totals.total}
          className="font-semibold text-base"
        />
        {totals.mode === "actual" && (
          <>
            <SummaryRow
              label="Amount paid"
              value={-totals.amountPaid}
              hint="Applied across invoice payments"
            />
          </>
        )}
      </dl>

      {allPayments.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Payments ({allPayments.length})
          </h4>
          <ul className="divide-y rounded-md border">
            {allPayments.map(p => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {formatMoney(p.amount)}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[p.paymentMethod] ??
                        p.paymentMethod}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDisplayDate(p.paymentDate)}
                    {p.checkNumber && <> · Check #{p.checkNumber}</>}
                    {p.referenceNumber && <> · Ref {p.referenceNumber}</>}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!hasInvoice && onGenerateInvoice && (
          <Button
            type="button"
            size="sm"
            onClick={onGenerateInvoice}
            disabled={!canGenerateInvoice}
          >
            <FileText className="mr-2 h-4 w-4" />
            Generate invoice
          </Button>
        )}
        {hasInvoice &&
          totals.mode === "actual" &&
          totals.balanceDue > 0 &&
          onRecordPayment && (
            <Button type="button" size="sm" onClick={onRecordPayment}>
              Record payment
            </Button>
          )}
      </div>
    </div>
  );
}

function FinancialStatusCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: number;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <dt className="text-muted-foreground">
        {label}
        {hint && (
          <span className="ml-1 text-xs italic opacity-70">({hint})</span>
        )}
      </dt>
      <dd className="tabular-nums">{formatMoney(value)}</dd>
    </div>
  );
}
