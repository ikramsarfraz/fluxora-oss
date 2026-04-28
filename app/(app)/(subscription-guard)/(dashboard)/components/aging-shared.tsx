"use client";

import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils/currency";
import type {
  AgingBucketKey,
  AgingBucketRow,
} from "@/services/aging";

const BUCKET_TONE: Record<AgingBucketKey, string> = {
  current: "bg-muted text-muted-foreground",
  d1_30: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
  d31_60:
    "bg-orange-100 text-orange-900 dark:bg-orange-500/15 dark:text-orange-200",
  d61_90:
    "bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-200",
  d90_plus:
    "bg-destructive/10 text-destructive dark:bg-destructive/20",
};

export function BucketBadge({ bucket }: { bucket: AgingBucketKey }) {
  const label =
    bucket === "current"
      ? "Current"
      : bucket === "d1_30"
        ? "1–30d"
        : bucket === "d31_60"
          ? "31–60d"
          : bucket === "d61_90"
            ? "61–90d"
            : "90+ d";
  return (
    <Badge variant="outline" className={`font-medium ${BUCKET_TONE[bucket]}`}>
      {label}
    </Badge>
  );
}

export function BucketBars({ buckets }: { buckets: AgingBucketRow[] }) {
  const max = buckets.reduce(
    (acc, b) => Math.max(acc, Number(b.total) || 0),
    0,
  );
  return (
    <ul className="flex flex-col gap-3">
      {buckets.map(bucket => {
        const total = Number(bucket.total) || 0;
        const pct =
          max > 0 ? Math.max(total > 0 ? 5 : 0, (total / max) * 100) : 0;
        return (
          <li key={bucket.key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <BucketBadge bucket={bucket.key} />
                <span className="text-muted-foreground">
                  {bucket.invoiceCount} invoice
                  {bucket.invoiceCount === 1 ? "" : "s"}
                </span>
              </div>
              <span className="font-medium tabular-nums">
                {formatMoney(bucket.total)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-muted">
              <div
                className="h-full rounded bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
