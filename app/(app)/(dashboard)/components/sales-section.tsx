"use client";

import Link from "next/link";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  CheckCircle2,
  CircleAlert,
  CircleDot,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/utils/currency";
import type {
  SalesFulfillmentBreakdown,
  SalesOverTimePoint,
  TopCustomerRow,
  TopProductRow,
} from "@/services/dashboard";

const chartConfig = {
  total: {
    label: "Daily sales",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

type Props = {
  sales: {
    overTime: SalesOverTimePoint[];
    fulfillment: SalesFulfillmentBreakdown;
    topCustomers: TopCustomerRow[];
    topProducts: TopProductRow[];
  };
};

export function SalesSection({ sales }: Props) {
  return (
    <section className="flex flex-col gap-4">
      <div className="px-4 lg:px-6">
        <h2 className="text-base font-semibold tracking-tight">Sales</h2>
        <p className="text-sm text-muted-foreground">
          Recent invoicing activity, order workflow health, and top accounts.
        </p>
      </div>

      <div className="px-4 lg:px-6">
        <SalesOverTimeCard points={sales.overTime} />
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @3xl/main:grid-cols-3">
        <FulfillmentBreakdownCard fulfillment={sales.fulfillment} />
        <TopCustomersCard rows={sales.topCustomers} />
        <TopProductsCard rows={sales.topProducts} />
      </div>
    </section>
  );
}

function SalesOverTimeCard({ points }: { points: SalesOverTimePoint[] }) {
  const data = points.map(p => ({
    date: p.date,
    total: Number(p.total) || 0,
    invoiceCount: p.invoiceCount,
  }));

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Sales over time</CardTitle>
        <CardDescription>Daily invoiced sales, last 30 days.</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[240px] w-full"
        >
          <AreaChart data={data}>
            <defs>
              <linearGradient id="fillSalesTotal" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-total)"
                  stopOpacity={0.9}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-total)"
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={value =>
                new Date(value).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={60}
              tickFormatter={v =>
                v >= 1000
                  ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
                  : `$${v}`
              }
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={v =>
                    new Date(v).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }
                  formatter={(value, name) =>
                    name === "total"
                      ? [formatMoney(value as number), "Sales"]
                      : [String(value), String(name)]
                  }
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="total"
              type="natural"
              fill="url(#fillSalesTotal)"
              stroke="var(--color-total)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

type FulfillmentTile = {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
};

function FulfillmentBreakdownCard({
  fulfillment,
}: {
  fulfillment: SalesFulfillmentBreakdown;
}) {
  const tiles: FulfillmentTile[] = [
    {
      label: "Open",
      value: fulfillment.open,
      icon: CircleDot,
      tone: "text-primary",
    },
    {
      label: "Fulfilled",
      value: fulfillment.fulfilled,
      icon: CheckCircle2,
      tone: "text-emerald-600 dark:text-emerald-500",
    },
    {
      label: "Short-shipped",
      value: fulfillment.shortShipped,
      icon: CircleAlert,
      tone: "text-amber-600 dark:text-amber-500",
    },
    {
      label: "Cancelled",
      value: fulfillment.cancelled,
      icon: XCircle,
      tone: "text-muted-foreground",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order workflow</CardTitle>
        <CardDescription>
          Sales order status across the pipeline.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map(tile => {
            const Icon = tile.icon;
            return (
              <div
                key={tile.label}
                className="flex flex-col gap-1 rounded-lg border p-3"
              >
                <div
                  className={`flex items-center gap-1.5 text-xs font-medium ${tile.tone}`}
                >
                  <Icon className="size-3.5" />
                  {tile.label}
                </div>
                <div className="text-2xl font-semibold tabular-nums">
                  {tile.value.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Short-shipped counts orders with any line closed short; it may
          overlap with fulfilled or open buckets.
        </p>
      </CardContent>
    </Card>
  );
}

function TopCustomersCard({ rows }: { rows: TopCustomerRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top customers by profit</CardTitle>
        <CardDescription>Gross profit on non-void invoices, last 30 days.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <EmptyCellText>No invoices in the last 30 days.</EmptyCellText>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
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
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.invoiceCount}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(row.revenue)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(row.grossProfit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.marginPercent}%
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

function TopProductsCard({ rows }: { rows: TopProductRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top products by profit</CardTitle>
        <CardDescription>Gross profit on non-void invoices, last 30 days.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <EmptyCellText>No invoiced lines in the last 30 days.</EmptyCellText>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Cases</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.productId}>
                  <TableCell>
                    <Link
                      href={`/products/${row.productId}`}
                      className="font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {row.sku}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.quantityCases}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(row.revenue)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(row.grossProfit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.marginPercent}%
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

function EmptyCellText({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-6 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
