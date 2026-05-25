import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>
      <Skeleton className="h-8 w-32" />
    </div>
  );
}

export function MetricCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("p-4 shadow-none", className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      <Skeleton className="mt-2.5 h-3 w-40" />
    </Card>
  );
}

export function TableSkeleton({
  rows = 8,
  columns = 5,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border-default bg-card", className)}>
      <div
        className="grid gap-4 border-b border-border-default bg-surface px-3 py-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-3/4" />
        ))}
      </div>
      <div className="divide-y divide-divider">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid gap-4 px-3 py-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, columnIndex) => (
              <Skeleton
                key={columnIndex}
                className={cn("h-3.5", columnIndex === columns - 1 ? "w-1/2" : "w-full")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailSectionSkeleton({
  fields = 4,
  className,
}: {
  fields?: number;
  className?: string;
}) {
  return (
    <Card className={cn("shadow-none", className)}>
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-36" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ListPageSkeleton({
  metricCards = 0,
  tableColumns = 5,
  tableRows = 8,
}: {
  metricCards?: number;
  tableColumns?: number;
  tableRows?: number;
}) {
  return (
    <section className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      {metricCards > 0 ? (
        <div className="grid grid-cols-1 gap-3 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
          {Array.from({ length: metricCards }).map((_, index) => (
            <MetricCardSkeleton key={index} />
          ))}
        </div>
      ) : null}
      <TableSkeleton columns={tableColumns} rows={tableRows} />
    </section>
  );
}

export function DetailPageSkeleton({
  sections = 3,
  metricCards = 0,
  tables = 0,
  activityCard = false,
  // includeTable kept for backwards-compatibility with existing call sites
  // that haven't migrated to `tables` yet. Treated as `tables: 1` when true.
  includeTable = false,
}: {
  sections?: number;
  /** Renders an N-column row of metric cards between the header and the
   *  detail sections. Inventory and lots detail pages put 3 cards here. */
  metricCards?: number;
  /** Renders this many table skeletons after the detail sections. */
  tables?: number;
  /** Reserves the bottom card-shaped placeholder for the activity feed
   *  that orders, bills, and inventory all render below their tables. */
  activityCard?: boolean;
  includeTable?: boolean;
}) {
  const tableCount = tables + (includeTable ? 1 : 0);
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      {metricCards > 0 ? (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${metricCards}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: metricCards }).map((_, index) => (
            <MetricCardSkeleton key={`metric-${index}`} />
          ))}
        </div>
      ) : null}
      {Array.from({ length: sections }).map((_, index) => (
        <DetailSectionSkeleton key={`section-${index}`} />
      ))}
      {Array.from({ length: tableCount }).map((_, index) => (
        <TableSkeleton key={`table-${index}`} columns={6} rows={4} />
      ))}
      {activityCard ? <DetailSectionSkeleton fields={6} /> : null}
    </div>
  );
}

export function FormPageSkeleton({
  sections = 2,
  fieldsPerSection = 6,
}: {
  sections?: number;
  fieldsPerSection?: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      {Array.from({ length: sections }).map((_, sectionIndex) => (
        <Card key={sectionIndex} className="shadow-none">
          <CardHeader className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: fieldsPerSection }).map((_, fieldIndex) => (
              <div key={fieldIndex} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <div className="flex justify-end gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-28" />
      </div>
    </div>
  );
}
