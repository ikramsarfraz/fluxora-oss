"use client";

import { useMemo, useState } from "react";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
  Activity,
  FileText,
  PackageCheck,
  Pencil,
  Receipt,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupplierInvoiceActivity } from "@/hooks/use-activity";
import { cn } from "@/lib/utils";
import type {
  ActivityScope,
  ActivityTimelineItem,
} from "@/modules/distribution/services/audit";

interface SupplierInvoiceActivityTimelineProps {
  supplierInvoiceId: string;
}

type FilterKey = "all" | ActivityScope;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "invoice", label: "Invoice" },
  { key: "payment", label: "Payments" },
  { key: "file", label: "Files" },
];

const SCOPE_STYLES: Record<
  ActivityScope,
  { icon: typeof Activity; dot: string; chip: string }
> = {
  order: {
    icon: Activity,
    dot: "bg-muted text-muted-foreground ring-border",
    chip: "border-muted-foreground/30 text-muted-foreground",
  },
  line: {
    icon: Pencil,
    dot: "bg-slate-500/15 text-slate-600 ring-slate-500/20 dark:text-slate-300",
    chip: "border-slate-500/30 text-slate-700 dark:text-slate-300",
  },
  allocation: {
    icon: PackageCheck,
    dot: "bg-amber-500/15 text-amber-700 ring-amber-500/20 dark:text-amber-400",
    chip: "border-amber-500/30 text-amber-700 dark:text-amber-400",
  },
  invoice: {
    icon: Receipt,
    dot: "bg-violet-500/15 text-violet-600 ring-violet-500/20 dark:text-violet-400",
    chip: "border-violet-500/30 text-violet-700 dark:text-violet-400",
  },
  payment: {
    icon: Wallet,
    dot: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
    chip: "border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
  },
  file: {
    icon: FileText,
    dot: "bg-sky-500/15 text-sky-600 ring-sky-500/20 dark:text-sky-400",
    chip: "border-sky-500/30 text-sky-700 dark:text-sky-400",
  },
  other: {
    icon: Activity,
    dot: "bg-muted text-muted-foreground ring-border",
    chip: "border-muted-foreground/30 text-muted-foreground",
  },
};

function renderActionIcon(item: ActivityTimelineItem) {
  const className = "h-3.5 w-3.5";
  if (item.action === "file_uploaded") return <Upload className={className} />;
  if (item.action === "file_deleted" || item.action === "delete")
    return <Trash2 className={className} />;
  const ScopeIcon = SCOPE_STYLES[item.scope]?.icon ?? Activity;
  return <ScopeIcon className={className} />;
}

function formatDayHeading(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEE, MMM d, yyyy");
}

function dayKey(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd");
}

export function SupplierInvoiceActivityTimeline({
  supplierInvoiceId,
}: SupplierInvoiceActivityTimelineProps) {
  const { data, isLoading, isError, error } =
    useSupplierInvoiceActivity(supplierInvoiceId);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showAll, setShowAll] = useState(false);

  const items = data ?? [];

  const counts = useMemo(() => {
    const map = new Map<FilterKey, number>();
    map.set("all", items.length);
    for (const item of items) {
      map.set(item.scope, (map.get(item.scope) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter(item => item.scope === filter);
  }, [filter, items]);

  const COLLAPSED_LIMIT = 12;
  const visible = showAll ? filtered : filtered.slice(0, COLLAPSED_LIMIT);
  const hasMore = filtered.length > visible.length;

  const groups = useMemo(() => {
    const bucket = new Map<string, ActivityTimelineItem[]>();
    for (const item of visible) {
      const key = dayKey(item.at);
      const arr = bucket.get(key) ?? [];
      arr.push(item);
      bucket.set(key, arr);
    }
    return Array.from(bucket.entries()).map(([key, entries]) => ({
      key,
      heading: formatDayHeading(entries[0].at),
      entries,
    }));
  }, [visible]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Failed to load activity: {(error as Error)?.message ?? "Unknown error"}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No activity recorded yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(filterOption => {
          const count = counts.get(filterOption.key) ?? 0;
          const isActive = filter === filterOption.key;
          return (
            <Button
              key={filterOption.key}
              type="button"
              onClick={() => {
                setFilter(filterOption.key);
                setShowAll(false);
              }}
              disabled={count === 0 && filterOption.key !== "all"}
              className={cn(
                "h-auto gap-1.5 rounded-full border px-3 py-1 text-xs font-medium shadow-none transition-colors",
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                count === 0 &&
                  filterOption.key !== "all" &&
                  "cursor-not-allowed opacity-40 hover:border-border hover:text-muted-foreground",
              )}
            >
              {filterOption.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  isActive
                    ? "bg-background/20 text-background"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            </Button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No events match this filter.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(group => (
            <div key={group.key} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.heading}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <ol className="relative ml-3 flex flex-col gap-4 border-l border-border pl-6">
                {group.entries.map(entry => (
                  <SupplierInvoiceActivityRow key={entry.id} item={entry} />
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {hasMore ? (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(true)}
            className="text-muted-foreground"
          >
            Show {filtered.length - visible.length} earlier{" "}
            {filtered.length - visible.length === 1 ? "event" : "events"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SupplierInvoiceActivityRow({
  item,
}: {
  item: ActivityTimelineItem;
}) {
  const actorLabel =
    item.actor.name ?? item.actor.email ?? (item.actor.type === "system" ? "System" : "Unknown");

  return (
    <li className="relative">
      <span
        className={cn(
          "absolute -left-[1.9rem] top-1 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-background",
          SCOPE_STYLES[item.scope]?.dot ?? SCOPE_STYLES.other.dot,
        )}
      >
        {renderActionIcon(item)}
      </span>

      <div className="rounded-xl border bg-background p-4 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-[11px]",
              SCOPE_STYLES[item.scope]?.chip ?? SCOPE_STYLES.other.chip,
            )}
          >
            {item.scope}
          </Badge>
          {item.source === "derived" ? (
            <Badge variant="secondary" className="text-[11px]">
              Derived
            </Badge>
          ) : null}
          <span
            className="text-xs text-muted-foreground"
            title={format(new Date(item.at), "PPpp")}
          >
            {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
          </span>
        </div>

        <div className="text-sm font-medium">{item.summary}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{format(new Date(item.at), "PPp")}</span>
          <span>&middot;</span>
          <span>{actorLabel}</span>
          {item.entityLabel ? (
            <>
              <span>&middot;</span>
              <span>{item.entityLabel}</span>
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}
