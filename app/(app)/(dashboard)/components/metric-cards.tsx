"use client";

import {
  AlertTriangle,
  Calendar,
  Clock,
  DollarSign,
  Package,
  ReceiptText,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardMetrics } from "@/services/dashboard";
import { formatMoney } from "@/lib/utils/currency";

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  helper?: string;
  tone?: "default" | "warning" | "danger";
};

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = "default",
}: MetricCardProps) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-500"
        : "text-muted-foreground";

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription className={`flex items-center gap-2 ${toneClass}`}>
          <Icon className="size-4" />
          {label}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
        {helper ? (
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        ) : null}
      </CardHeader>
    </Card>
  );
}

export function MetricCards({ metrics }: { metrics: DashboardMetrics }) {
  const expiringTone =
    metrics.expiringLotsCount > 0 ? "warning" : "default";
  const expiredTone = metrics.expiredLotsCount > 0 ? "danger" : "default";

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-sm *:data-[slot=card]:border lg:px-6 @xl/main:grid-cols-2 @3xl/main:grid-cols-3 @5xl/main:grid-cols-4">
      <MetricCard
        icon={TrendingUp}
        label="Sales (last 7d)"
        value={formatMoney(metrics.sales7d)}
        helper="Non-void invoices, by invoice date."
      />
      <MetricCard
        icon={Calendar}
        label="Sales (last 30d)"
        value={formatMoney(metrics.sales30d)}
        helper="Non-void invoices, by invoice date."
      />
      <MetricCard
        icon={ReceiptText}
        label="Purchases (last 30d)"
        value={formatMoney(metrics.purchases30d)}
        helper="Completed supplier invoices, by receive date."
      />
      <MetricCard
        icon={Wallet}
        label="Unpaid customer balances"
        value={formatMoney(metrics.unpaidCustomerBalance)}
        helper="Open balance on non-void invoices."
      />
      <MetricCard
        icon={DollarSign}
        label="Unpaid supplier balances"
        value={formatMoney(metrics.unpaidSupplierBalance)}
        helper="Balance due on completed supplier invoices."
      />
      <MetricCard
        icon={Package}
        label="Inventory value"
        value={formatMoney(metrics.inventoryValue)}
        helper="Active inventory valued at receipt price."
      />
      <MetricCard
        icon={Clock}
        label="Expiring soon (7d)"
        value={metrics.expiringLotsCount.toLocaleString()}
        helper="Lots with active inventory expiring within 7 days."
        tone={expiringTone}
      />
      <MetricCard
        icon={AlertTriangle}
        label="Expired lots"
        value={metrics.expiredLotsCount.toLocaleString()}
        helper="Expired lots still holding active inventory."
        tone={expiredTone}
      />
    </div>
  );
}
