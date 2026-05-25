"use client";

import { Fragment, type ReactNode } from "react";
import {
  AlertTriangle,
  Clock,
  DollarSign,
  Package,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PortalUserRole } from "@/lib/auth/permissions";
import {
  isMetricVisible,
  type DashboardMetricCard,
} from "@/lib/dashboard/visibility";
import { formatMoney } from "@/lib/utils/currency";
import type { DashboardMetrics } from "@/modules/distribution/services/dashboard";

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  helper?: string;
  tone?: "default" | "warning" | "danger";
};

function MetricCard({ icon: Icon, label, value, helper, tone = "default" }: MetricCardProps) {
  const isDanger = tone === "danger";
  const isWarning = tone === "warning";

  return (
    <Card
      className={cn(
        "@container/card flex-col gap-0 p-4 shadow-none",
        isDanger && "bg-danger-bg border-danger-border",
        isWarning && "bg-warning-bg border-warning-border",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.06em]",
          isDanger ? "text-danger-fg" : isWarning ? "text-warning-fg" : "text-subtle",
        )}
      >
        <Icon className="size-3" />
        {label}
      </div>
      <div
        className={cn(
          "mt-2 font-serif text-[26px] font-medium tracking-[-0.02em] leading-none tabular-nums",
          isDanger ? "text-danger-fg" : isWarning ? "text-warning-fg" : "text-ink",
        )}
      >
        {value}
      </div>
      {helper ? (
        <p
          className={cn(
            "mt-2 text-[11px]",
            isDanger ? "text-danger-fg/80" : isWarning ? "text-warning-fg/80" : "text-muted",
          )}
        >
          {helper}
        </p>
      ) : null}
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
      key: "sales30d",
      node: (
        <MetricCard
          icon={TrendingUp}
          label="Revenue (last 30d)"
          value={formatMoney(metrics.sales30d)}
          helper="Non-void invoices, by invoice date."
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
    <div className="grid grid-cols-1 gap-3 px-4 lg:px-6 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
      {visible.map(card => (
        <Fragment key={card.key}>{card.node}</Fragment>
      ))}
    </div>
  );
}
