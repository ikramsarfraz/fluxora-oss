"use client";

import { Fragment, type ReactNode } from "react";
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
import type { PortalUserRole } from "@/lib/auth/permissions";
import {
  isMetricVisible,
  type DashboardMetricCard,
} from "@/lib/dashboard/visibility";
import { formatMoney } from "@/lib/utils/currency";
import type { DashboardMetrics } from "@/services/dashboard";

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

export function MetricCards({
  metrics,
  role,
}: {
  metrics: DashboardMetrics;
  role: PortalUserRole;
}) {
  const expiringTone = metrics.expiringLotsCount > 0 ? "warning" : "default";
  const expiredTone = metrics.expiredLotsCount > 0 ? "danger" : "default";

  const cards: Array<{ key: DashboardMetricCard; node: ReactNode }> = [
    {
      key: "sales7d",
      node: (
        <MetricCard
          icon={TrendingUp}
          label="Sales (last 7d)"
          value={formatMoney(metrics.sales7d)}
          helper="Non-void invoices, by invoice date."
        />
      ),
    },
    {
      key: "sales30d",
      node: (
        <MetricCard
          icon={Calendar}
          label="Sales (last 30d)"
          value={formatMoney(metrics.sales30d)}
          helper="Non-void invoices, by invoice date."
        />
      ),
    },
    {
      key: "purchases30d",
      node: (
        <MetricCard
          icon={ReceiptText}
          label="Purchases (last 30d)"
          value={formatMoney(metrics.purchases30d)}
          helper="Completed supplier invoices, by receive date."
        />
      ),
    },
    {
      key: "unpaidCustomerBalance",
      node: (
        <MetricCard
          icon={Wallet}
          label="Unpaid customer balances"
          value={formatMoney(metrics.unpaidCustomerBalance)}
          helper="Open balance on non-void invoices."
        />
      ),
    },
    {
      key: "unpaidSupplierBalance",
      node: (
        <MetricCard
          icon={DollarSign}
          label="Unpaid supplier balances"
          value={formatMoney(metrics.unpaidSupplierBalance)}
          helper="Balance due on completed supplier invoices."
        />
      ),
    },
    {
      key: "inventoryValue",
      node: (
        <MetricCard
          icon={Package}
          label="Inventory value"
          value={formatMoney(metrics.inventoryValue)}
          helper="Active inventory valued at receipt price."
        />
      ),
    },
    {
      key: "expiringLots",
      node: (
        <MetricCard
          icon={Clock}
          label="Expiring soon (7d)"
          value={metrics.expiringLotsCount.toLocaleString()}
          helper="Lots with active inventory expiring within 7 days."
          tone={expiringTone}
        />
      ),
    },
    {
      key: "expiredLots",
      node: (
        <MetricCard
          icon={AlertTriangle}
          label="Expired lots"
          value={metrics.expiredLotsCount.toLocaleString()}
          helper="Expired lots still holding active inventory."
          tone={expiredTone}
        />
      ),
    },
  ];

  const visible = cards.filter(card => isMetricVisible(role, card.key));
  if (visible.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-sm *:data-[slot=card]:border lg:px-6 @xl/main:grid-cols-2 @3xl/main:grid-cols-3 @5xl/main:grid-cols-4">
      {visible.map(card => (
        <Fragment key={card.key}>{card.node}</Fragment>
      ))}
    </div>
  );
}
