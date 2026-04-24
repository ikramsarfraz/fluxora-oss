import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

export function MetricCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20" />
      </CardContent>
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
    <div className={cn("overflow-hidden rounded-md border", className)}>
      <div
        className="grid gap-4 border-b bg-muted px-4 py-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-3/4" />
        ))}
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid gap-4 px-4 py-4"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, columnIndex) => (
              <Skeleton
                key={columnIndex}
                className={cn("h-4", columnIndex === columns - 1 ? "w-1/2" : "w-full")}
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
    <Card className={className}>
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-36" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ListPageSkeleton({
  metricCards = 0,
  tableColumns = 5,
}: {
  metricCards?: number;
  tableColumns?: number;
}) {
  return (
    <section className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      {metricCards > 0 ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: metricCards }).map((_, index) => (
            <MetricCardSkeleton key={index} />
          ))}
        </div>
      ) : null}
      <TableSkeleton columns={tableColumns} />
    </section>
  );
}

export function DetailPageSkeleton({
  sections = 3,
  includeTable = false,
}: {
  sections?: number;
  includeTable?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      {Array.from({ length: sections }).map((_, index) => (
        <DetailSectionSkeleton key={index} />
      ))}
      {includeTable ? <TableSkeleton columns={6} /> : null}
    </div>
  );
}
