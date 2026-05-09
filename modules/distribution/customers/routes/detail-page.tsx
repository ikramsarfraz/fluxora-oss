"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { DollarSign, Pencil, ShoppingCart, TrendingUp, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useCustomerPortfolio } from "../hooks/use-customers";
import { DetailPageHeader } from "@/components/detail-page-header";
import { DetailSection, DetailField, DetailGrid } from "@/components/detail-section";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatPhone } from "@/lib/utils/phone";
import { isUuid } from "@/lib/utils/uuid";
import { useSetBreadcrumbLabel } from "@/components/breadcrumb-label-provider";

const ORDER_STATUS: Record<string, { label: string; className: string }> = {
  sales_order: { label: "Sales Order", className: "bg-stone-100 text-stone-600" },
  confirmed: { label: "Confirmed", className: "bg-blue-50 text-blue-700" },
  fulfilled: { label: "Fulfilled", className: "bg-green-50 text-green-700" },
  cancelled: { label: "Cancelled", className: "bg-red-50 text-red-600" },
};

const INVOICE_STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-stone-100 text-stone-600" },
  sent: { label: "Sent", className: "bg-blue-50 text-blue-700" },
  partially_paid: { label: "Partial", className: "bg-orange-50 text-orange-700" },
  paid: { label: "Paid", className: "bg-green-50 text-green-700" },
  void: { label: "Void", className: "bg-stone-100 text-stone-400" },
};

const ADDRESS_TYPE_LABEL: Record<string, string> = {
  shipping: "Shipping",
  billing: "Billing",
  warehouse: "Warehouse",
  other: "Other",
};

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  helper?: string;
  tone?: "default" | "warning" | "danger";
};

function MetricCard({ icon: Icon, label, value, helper, tone = "default" }: MetricCardProps) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-status-warn"
        : "text-stone-muted";
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardDescription className={`flex items-center gap-1.5 text-xs font-medium ${toneClass}`}>
          <Icon className="size-3.5" />
          {label}
        </CardDescription>
        <CardTitle className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
          {value}
        </CardTitle>
        {helper ? <p className="mt-1 text-[11px] text-stone-muted">{helper}</p> : null}
      </CardHeader>
    </Card>
  );
}

function StatusChip({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

export default function CustomerPortfolioPage() {
  const params = useParams<{ id: string }>();
  const customerId = params.id ?? "";

  const { data: portfolio, isLoading, error } = useCustomerPortfolio(customerId);

  const customer = portfolio?.customer;
  useSetBreadcrumbLabel(`/customers/${customerId}`, customer?.name);

  if (!isUuid(customerId)) return <PageError message="Invalid customer ID." />;
  if (isLoading) return <PageLoading message="Loading customer..." />;
  if (error) return <PageError message={(error as Error).message} />;
  if (!portfolio || !customer) return null;

  const { metrics, recentOrders, recentInvoices } = portfolio;
  const balanceDue = parseFloat(metrics.balanceDue);
  const balanceTone = balanceDue > 0 ? "danger" : "default";

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={customer.name}
        description="Customer portfolio — account summary, orders, and invoices."
      >
        <Button variant="outline" asChild>
          <Link href={`/customers/${customer.id}/edit`}>
            <Pencil className="size-4" />
            Edit
          </Link>
        </Button>
      </DetailPageHeader>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={Wallet}
          label="Balance due"
          value={formatMoney(metrics.balanceDue)}
          helper="Open balance on non-void invoices."
          tone={balanceTone}
        />
        <MetricCard
          icon={TrendingUp}
          label="Total sold"
          value={formatMoney(metrics.totalRevenue)}
          helper="Sum of all non-void invoices."
        />
        <MetricCard
          icon={DollarSign}
          label="Total paid"
          value={formatMoney(metrics.totalPaid)}
        />
        <MetricCard
          icon={ShoppingCart}
          label="Open orders"
          value={String(metrics.openOrdersCount)}
          helper="Pending and confirmed orders."
          tone={metrics.openOrdersCount > 0 ? "warning" : "default"}
        />
      </div>

      {/* Customer details — always shown */}
      <DetailSection
        title="Details"
        description="Contact information and billing configuration."
      >
        <DetailGrid>
          <DetailField label="Abbreviation">
            {customer.abbreviation ?? "—"}
          </DetailField>
          <DetailField label="Phone">
            {customer.phoneNumber ? formatPhone(customer.phoneNumber) : "—"}
          </DetailField>
          <DetailField label="Fuel surcharge">
            {customer.fuelSurchargeAmount != null
              ? `$${Number(customer.fuelSurchargeAmount).toFixed(2)}/lb`
              : "—"}
          </DetailField>
        </DetailGrid>
      </DetailSection>

      {/* Recent orders */}
      <DetailSection
        title="Orders"
        description={
          recentOrders.length === 0
            ? "No orders on record."
            : `Showing ${recentOrders.length} most recent order${recentOrders.length !== 1 ? "s" : ""}.`
        }
      >
        {recentOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.map(order => {
                const s = ORDER_STATUS[order.status] ?? {
                  label: order.status,
                  className: "bg-stone-100 text-stone-600",
                };
                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {order.orderNumber ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDisplayDate(order.orderDate)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDisplayDate(order.dueDate) ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusChip label={s.label} className={s.className} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DetailSection>

      {/* Recent invoices */}
      <DetailSection
        title="Invoices"
        description={
          recentInvoices.length === 0
            ? "No invoices on record."
            : `Showing ${recentInvoices.length} most recent invoice${recentInvoices.length !== 1 ? "s" : ""}.`
        }
      >
        {recentInvoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentInvoices.map(inv => {
                const s = INVOICE_STATUS[inv.status] ?? {
                  label: inv.status,
                  className: "bg-stone-100 text-stone-600",
                };
                const hasBalance = parseFloat(inv.balanceDue) > 0;
                return (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDisplayDate(inv.invoiceDate)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDisplayDate(inv.dueDate) ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusChip label={s.label} className={s.className} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatMoney(inv.totalAmount)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-xs ${hasBalance ? "font-semibold text-destructive" : ""}`}
                    >
                      {formatMoney(inv.balanceDue)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DetailSection>

      {/* Addresses */}
      {customer.addresses.length > 0 && (
        <DetailSection
          title="Addresses"
          description={`${customer.addresses.length} address${customer.addresses.length !== 1 ? "es" : ""} on file.`}
        >
          <div className="flex flex-col divide-y">
            {customer.addresses.map(addr => {
              const line2 = [addr.city, addr.state, addr.zip].filter(Boolean).join(", ");
              return (
                <div
                  key={addr.id}
                  className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{addr.street}</p>
                    {line2 && (
                      <p className="text-sm text-muted-foreground">{line2}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="capitalize">
                      {ADDRESS_TYPE_LABEL[addr.addressType] ?? addr.addressType}
                    </Badge>
                    {addr.isDefault && <Badge variant="secondary">Default</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </DetailSection>
      )}
    </div>
  );
}
