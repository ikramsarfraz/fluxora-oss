"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Package,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/utils/date";

import type { SalesOrderDetail } from "@/services/orders";

type Line = SalesOrderDetail["lines"][number];

type FulfillmentStatus = "not_started" | "partial" | "complete";

interface FulfillmentStats {
  status: FulfillmentStatus;
  expectedCases: number;
  fulfilledCases: number;
  casesPct: number;
  weightLbs: number;
  allocationCount: number;
  allocatedWeightLbs: number;
  lastActivityAt: Date | null;
}

function computeStats(lines: Line[]): FulfillmentStats {
  let expectedCases = 0;
  let fulfilledCases = 0;
  let weightLbs = 0;
  let allocationCount = 0;
  let allocatedWeightLbs = 0;
  let lastActivity: number | null = null;

  for (const line of lines) {
    expectedCases += line.expectedCases;
    fulfilledCases += line.fulfilledCases;
    weightLbs += parseFloat(line.totalBilledWeightLbs ?? "0") || 0;
    const allocs = line.allocations ?? [];
    allocationCount += allocs.length;
    for (const a of allocs) {
      allocatedWeightLbs += parseFloat(a.allocatedWeightLbs ?? "0") || 0;
      const t = a.createdAt ? new Date(a.createdAt).getTime() : NaN;
      if (Number.isFinite(t)) {
        lastActivity = lastActivity == null ? t : Math.max(lastActivity, t);
      }
    }
    const lineUpdated = line.updatedAt
      ? new Date(line.updatedAt).getTime()
      : NaN;
    if (Number.isFinite(lineUpdated) && line.fulfilledCases > 0) {
      lastActivity =
        lastActivity == null ? lineUpdated : Math.max(lastActivity, lineUpdated);
    }
  }

  const casesPct =
    expectedCases > 0
      ? Math.min(100, Math.round((fulfilledCases / expectedCases) * 100))
      : 0;

  const status: FulfillmentStatus =
    fulfilledCases <= 0
      ? "not_started"
      : expectedCases > 0 && fulfilledCases >= expectedCases
        ? "complete"
        : "partial";

  return {
    status,
    expectedCases,
    fulfilledCases,
    casesPct,
    weightLbs,
    allocationCount,
    allocatedWeightLbs,
    lastActivityAt: lastActivity != null ? new Date(lastActivity) : null,
  };
}

const STATUS_META: Record<
  FulfillmentStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge: "default" | "secondary" | "outline";
    className?: string;
  }
> = {
  not_started: {
    label: "Not started",
    icon: CircleDashed,
    badge: "outline",
  },
  partial: {
    label: "Partial",
    icon: CircleDot,
    badge: "secondary",
  },
  complete: {
    label: "Complete",
    icon: CheckCircle2,
    badge: "default",
  },
};

function ProgressBar({
  value,
  tone = "neutral",
}: {
  value: number;
  tone?: "neutral" | "partial" | "complete";
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const barClass =
    tone === "complete"
      ? "bg-emerald-500"
      : tone === "partial"
        ? "bg-amber-500"
        : "bg-muted-foreground/40";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all", barClass)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function tone(status: FulfillmentStatus): "neutral" | "partial" | "complete" {
  if (status === "complete") return "complete";
  if (status === "partial") return "partial";
  return "neutral";
}

interface OrderFulfillmentSectionProps {
  order: SalesOrderDetail;
}

export function OrderFulfillmentSection({
  order,
}: OrderFulfillmentSectionProps) {
  const lines = order.lines ?? [];
  const stats = useMemo(() => computeStats(lines), [lines]);
  const meta = STATUS_META[stats.status];
  const Icon = meta.icon;
  const updatedBy = order.updatedBy?.fullName ?? null;

  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add line items to begin fulfillment.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              stats.status === "complete" &&
                "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
              stats.status === "partial" &&
                "bg-amber-500/15 text-amber-600 dark:text-amber-400",
              stats.status === "not_started" &&
                "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{meta.label}</span>
              <Badge variant={meta.badge} className="text-xs">
                {stats.fulfilledCases} / {stats.expectedCases} cases
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              {stats.lastActivityAt ? (
                <>
                  Last activity {formatDisplayDate(stats.lastActivityAt)}
                  {updatedBy && <> · by {updatedBy}</>}
                </>
              ) : (
                "No fulfillment activity yet."
              )}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 sm:w-auto sm:min-w-88">
          <SummaryStat
            label="Cases"
            value={`${stats.fulfilledCases} / ${stats.expectedCases}`}
          />
          <SummaryStat
            label="Weight captured"
            value={`${stats.weightLbs.toFixed(2)} lbs`}
          />
          <SummaryStat
            label="Boxes allocated"
            value={
              stats.allocationCount === 0
                ? "0"
                : `${stats.allocationCount} · ${stats.allocatedWeightLbs.toFixed(2)} lbs`
            }
          />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="font-medium uppercase tracking-wide text-muted-foreground">
            Overall progress
          </span>
          <span className="tabular-nums text-muted-foreground">
            {stats.casesPct}%
          </span>
        </div>
        <ProgressBar value={stats.casesPct} tone={tone(stats.status)} />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Per-line breakdown
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="w-[22%]">Progress</TableHead>
              <TableHead className="text-right">Cases</TableHead>
              <TableHead className="text-right">Weight (lbs)</TableHead>
              <TableHead className="text-right">Boxes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map(line => {
              const lineStatus: FulfillmentStatus =
                line.fulfilledCases <= 0
                  ? "not_started"
                  : line.fulfilledCases >= line.expectedCases
                    ? "complete"
                    : "partial";
              const linePct =
                line.expectedCases > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (line.fulfilledCases / line.expectedCases) * 100,
                      ),
                    )
                  : 0;
              const lineWeight =
                parseFloat(line.totalBilledWeightLbs ?? "0") || 0;
              const boxes = line.allocations?.length ?? 0;
              return (
                <TableRow key={line.id}>
                  <TableCell>
                    {line.product ? (
                      <Link
                        href={`/products/${line.product.id}`}
                        className="hover:underline"
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {line.product.sku}
                        </span>{" "}
                        <span>{line.product.name}</span>
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <ProgressBar value={linePct} tone={tone(lineStatus)} />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {linePct}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      lineStatus === "complete" &&
                        "text-emerald-600 dark:text-emerald-400",
                      lineStatus === "partial" &&
                        "text-amber-600 dark:text-amber-400",
                      lineStatus === "not_started" && "text-muted-foreground",
                    )}
                  >
                    {line.fulfilledCases} / {line.expectedCases}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {lineWeight.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {boxes > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Package className="h-3 w-3 text-muted-foreground" />
                        {boxes}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}
