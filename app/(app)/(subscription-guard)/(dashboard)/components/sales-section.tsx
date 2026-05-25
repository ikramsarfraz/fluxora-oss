"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
import { formatMoney } from "@/lib/utils/currency";
import type { SalesOverTimePoint } from "@/modules/distribution/services/dashboard";

const chartConfig = {
  total: {
    label: "Daily sales",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

export function SalesSection({ overTime }: { overTime: SalesOverTimePoint[] }) {
  const data = overTime.map(p => ({
    date: p.date,
    total: Number(p.total) || 0,
    invoiceCount: p.invoiceCount,
  }));

  return (
    <div className="px-4 lg:px-6">
      <Card className="@container/card shadow-none">
        <CardHeader className="border-b border-border-default pb-3">
          <CardTitle className="text-sm font-medium text-ink">Sales over time</CardTitle>
          <CardDescription className="text-xs text-subtle">
            Daily invoiced sales, last 30 days.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-60 w-full"
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
    </div>
  );
}
