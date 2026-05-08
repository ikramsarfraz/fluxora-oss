"use client";

import { useMemo, useState } from "react";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
  Activity,
  Archive,
  ClipboardList,
  FileText,
  PackageCheck,
  PackagePlus,
  Pencil,
  Receipt,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesOrderActivity } from "@/hooks/use-activity";
import { cn } from "@/lib/utils";
import type {
  ActivityScope,
  ActivityTimelineItem,
} from "@/modules/distribution/services/audit";

interface OrderActivityTimelineProps {
  orderId: string;
}

type FilterKey = "all" | ActivityScope;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "order", label: "Order" },
  { key: "line", label: "Line items" },
  { key: "allocation", label: "Fulfillment" },
  { key: "invoice", label: "Invoices" },
  { key: "payment", label: "Payments" },
];

const SCOPE_STYLES: Record<
  ActivityScope,
  { icon: typeof Activity; dot: string; chip: string }
> = {
  order: {
    icon: ClipboardList,
    dot: "bg-blue-500/15 text-blue-600 ring-blue-500/20 dark:text-blue-400",
    chip: "border-blue-500/30 text-blue-700 dark:text-blue-400",
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
  if (item.action === "delete" || item.action === "file_deleted")
    return <Trash2 className={className} />;
  if (item.action === "soft_delete") return <Archive className={className} />;
  if (item.action === "file_uploaded") return <Upload className={className} />;
  if (item.action === "insert" && item.scope === "allocation")
    return <PackagePlus className={className} />;
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

export function OrderActivityTimeline({ orderId }: OrderActivityTimelineProps) {
  const { data, isLoading, isError, error } = useSalesOrderActivity(orderId);
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
    return items.filter(i => i.scope === filter);
  }, [items, filter]);

  const COLLAPSED_LIMIT = 10;
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
        {FILTERS.map(f => {
          const count = counts.get(f.key) ?? 0;
          const isActive = filter === f.key;
          return (
            <Button
              key={f.key}
              type="button"
              onClick={() => {
                setFilter(f.key);
                setShowAll(false);
              }}
              disabled={count === 0 && f.key !== "all"}
              className={cn(
                "h-auto gap-1.5 rounded-full border px-3 py-1 text-xs font-medium shadow-none transition-colors",
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                count === 0 &&
                  f.key !== "all" &&
                  "cursor-not-allowed opacity-40 hover:border-border hover:text-muted-foreground",
              )}
            >
              {f.label}
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
                  <ActivityRow key={entry.id} item={entry} />
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-dashed bg-muted/20 p-4">
        <div className="mb-2 text-sm font-medium">Audit timeline</div>
        <p className="text-sm text-muted-foreground">
          This timeline already tracks order, line, fulfillment, invoice, and
          payment events. Future backend support can add user mentions,
          attachment events, and workflow-specific comments.
        </p>
      </div>

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

function ActivityRow({ item }: { item: ActivityTimelineItem }) {
  const style = SCOPE_STYLES[item.scope] ?? SCOPE_STYLES.other;
  const date = new Date(item.at);
  const actorName = item.actor.name ?? (item.actor.type === "system"
    ? "System"
    : item.actor.email ?? "Unknown");

  return (
    <li className="relative">
      <span
        className={cn(
          "absolute -left-[34px] top-1 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background",
          style.dot,
        )}
      >
        {renderActionIcon(item)}
      </span>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {item.summary}
          </span>
          {item.source === "derived" ? (
            <Badge
              variant="outline"
              className="h-5 border-dashed px-1.5 text-[10px] font-normal text-muted-foreground"
              title="Derived from the entity record. Will be replaced by an explicit audit log entry once written."
            >
              derived
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">{actorName}</span>
          <span>·</span>
          <span title={format(date, "PPpp")}>
            {formatDistanceToNow(date, { addSuffix: true })}
          </span>
          <span>·</span>
          <span>{format(date, "h:mm a")}</span>
          {item.changedFields && item.changedFields.length > 0 ? (
            <>
              <span>·</span>
              <span className="truncate">
                fields: {item.changedFields.join(", ")}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}
