"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Search,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export interface TwoLineCell {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}

function isTwoLine(v: unknown): v is TwoLineCell {
  return typeof v === "object" && v !== null && "primary" in v;
}

export interface ListingColumn<TRow> {
  key: string;
  header: string;
  sortKey?: string;
  align?: "left" | "right" | "center";
  width?: string;
  render: (row: TRow) => React.ReactNode | TwoLineCell;
}

export interface ListingRowAction<TRow> {
  label: string;
  href?: (row: TRow) => string;
  onClick?: (row: TRow) => void;
  isVisible?: (row: TRow) => boolean;
  variant?: "default" | "destructive";
}

export interface ListingKPI {
  label: string;
  value: React.ReactNode;
  sub?: string;
}

export interface SavedView {
  id: string;
  label: string;
  count?: number;
}

export interface StatusSegment {
  value: string;
  label: string;
}

export interface ListingPageProps<TRow> {
  title: string;
  subtitle?: string;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  /**
   * Suppress the entire title + subtitle + actions row. Used when this
   * component is embedded inside a parent that already owns those slots
   * (e.g. a tabbed shell with shared header chrome). The body, filters,
   * pagination, etc. still render normally.
   */
  hideHeader?: boolean;
  belowHeader?: React.ReactNode;
  savedViews?: SavedView[];
  activeView?: string;
  onViewChange?: (id: string) => void;
  kpis?: ListingKPI[];
  headerExtra?: React.ReactNode;
  searchPlaceholder?: string;
  statusSegments?: StatusSegment[];
  activeSegment?: string;
  onSegmentChange?: (value: string) => void;
  columns: ListingColumn<TRow>[];
  getRowId?: (row: TRow) => string;
  onRowClick?: (row: TRow) => void;
  rowActions?: ListingRowAction<TRow>[];
  rows: TRow[];
  total: number;
  isLoading?: boolean;
  isFetching?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  hidePagination?: boolean;
  page: number;
  pageSize: number;
  pageCount: number;
  searchInput: string;
  sort?: string;
  direction?: "asc" | "desc";
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSearchChange: (value: string) => void;
  onSortChange?: (key: string, dir: "asc" | "desc") => void;
}

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: "asc" | "desc";
}) {
  if (!active) return <ChevronsUpDown className="size-3 opacity-40" />;
  if (direction === "asc") return <ChevronUp className="size-3" />;
  return <ChevronDown className="size-3" />;
}

function LoadingBar() {
  return (
    <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-divider">
      <div className="h-full w-2/5 animate-[listing-slide_1.2s_ease-in-out_infinite] rounded-sm bg-primary" />
    </div>
  );
}

export function ListingAction({
  href,
  children,
  variant = "default",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline";
  className?: string;
}) {
  return (
    <Button
      asChild
      size="sm"
      variant={variant}
      className={cn(
        variant === "default" &&
          "border-forest-mid bg-forest-mid text-card-warm hover:bg-forest",
        "text-[13px]",
        className,
      )}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}

function HeaderToggleCount({
  count,
  active,
}: {
  count: number;
  active: boolean;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-5 rounded-full px-1.5 text-[11px]",
        active
          ? "bg-forest-mid text-card-warm"
          : "bg-surface-deep text-subtle",
      )}
    >
      {count}
    </Badge>
  );
}

export function ListingPage<TRow>({
  title,
  subtitle,
  primaryAction,
  secondaryActions,
  hideHeader,
  belowHeader,
  savedViews,
  activeView,
  onViewChange,
  kpis,
  headerExtra,
  searchPlaceholder = "Search...",
  statusSegments,
  activeSegment,
  onSegmentChange,
  columns,
  getRowId,
  onRowClick,
  rowActions,
  rows,
  total,
  isLoading,
  isFetching,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  hidePagination,
  page,
  pageSize,
  pageCount,
  searchInput,
  sort = "",
  direction = "desc",
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  onSortChange,
}: ListingPageProps<TRow>) {
  function handleSort(col: ListingColumn<TRow>) {
    if (!col.sortKey || !onSortChange) return;
    if (sort === col.sortKey) {
      onSortChange(col.sortKey, direction === "asc" ? "desc" : "asc");
    } else {
      onSortChange(col.sortKey, "desc");
    }
  }

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const isEmpty = !isLoading && rows.length === 0 && !searchInput.trim();
  const activeSavedView = activeView ?? savedViews?.[0]?.id ?? "";
  const activeStatusSegment = activeSegment ?? statusSegments?.[0]?.value ?? "";

  return (
    <div className="flex flex-col">
      {!hideHeader ? (
        <div className="mb-0 flex flex-col gap-3 pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <h1 className="m-0 text-[22px] font-medium leading-tight tracking-normal text-ink">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 mb-0 text-[13px] text-subtle">
                {subtitle}
              </p>
            ) : null}
          </div>
          {(secondaryActions || primaryAction) && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {secondaryActions}
              {primaryAction}
            </div>
          )}
        </div>
      ) : null}
      {belowHeader}

      {savedViews && savedViews.length > 0 ? (
        <ToggleGroup
          type="single"
          value={activeSavedView}
          onValueChange={value => {
            if (value) onViewChange?.(value);
          }}
          className="mb-0 w-full justify-start rounded-none border-b border-border-default"
          variant="default"
          size="sm"
        >
          {savedViews.map(view => {
            const isActive = activeSavedView === view.id;
            return (
              <ToggleGroupItem
                key={view.id}
                value={view.id}
                className={cn(
                  "-mb-px h-auto rounded-none border-b-2 border-transparent px-3.5 py-2.5 text-[13px] font-normal text-subtle hover:bg-transparent hover:text-ink data-[state=on]:border-forest-mid data-[state=on]:bg-transparent data-[state=on]:font-semibold data-[state=on]:text-ink",
                )}
              >
                {view.label}
                {view.count !== undefined ? (
                  <HeaderToggleCount count={view.count} active={isActive} />
                ) : null}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      ) : null}

      {kpis && kpis.length > 0 ? (
        <div
          className="my-4 grid overflow-hidden rounded-md border border-border-default bg-surface-deep"
          style={{
            gridTemplateColumns: `repeat(${kpis.length}, minmax(0, 1fr))`,
            gap: 1,
          }}
        >
          {kpis.map((kpi, i) => (
            <div key={i} className="bg-card px-4.5 py-3.5">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.05em] text-subtle">
                {kpi.label}
              </div>
              <div className="font-mono text-[22px] font-semibold leading-tight text-ink">
                {kpi.value}
              </div>
              {kpi.sub ? (
                <div className="mt-0.5 text-[11px] text-subtle">
                  {kpi.sub}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {headerExtra ? <div className="mb-4">{headerExtra}</div> : null}

      <Card className="mt-4 gap-0 overflow-hidden rounded-[10px] border border-border-default bg-card py-0 text-ink shadow-none ring-0">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-divider px-4 py-3">
          <InputGroup className="h-8 max-w-80 flex-[1_1_180px] border-border-default bg-divider shadow-none">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              value={searchInput}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="text-[13px]"
            />
            {searchInput ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Clear search"
                  onClick={() => onSearchChange("")}
                >
                  <X className="size-3.5" />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>

          {statusSegments && statusSegments.length > 0 ? (
            <ToggleGroup
              type="single"
              value={activeStatusSegment}
              onValueChange={value => {
                if (value) onSegmentChange?.(value);
              }}
              spacing={1}
              className="rounded-md bg-divider p-0.5"
              variant="default"
              size="sm"
            >
              {statusSegments.map(seg => (
                <ToggleGroupItem
                  key={seg.value}
                  value={seg.value}
                  className="h-7 rounded px-2.5 text-xs font-normal text-subtle shadow-none hover:bg-transparent hover:text-ink data-[state=on]:border data-[state=on]:border-border-default data-[state=on]:bg-card data-[state=on]:font-medium data-[state=on]:text-ink data-[state=on]:shadow-xs"
                >
                  {seg.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          <div className="ml-auto whitespace-nowrap text-xs text-subtle">
            {isLoading
              ? "Loading..."
              : total > 0
                ? `${total.toLocaleString()} record${total === 1 ? "" : "s"}`
                : ""}
          </div>
        </div>

        <div className="relative">
          {isFetching && !isLoading ? <LoadingBar /> : null}

          {isLoading ? (
            <div className="px-6 py-12 text-center text-[13px] text-subtle">
              <div className="mx-auto flex max-w-xl flex-col items-center gap-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-3.5 rounded-sm bg-divider"
                    style={{ width: `${60 + (i % 3) * 15}%`, opacity: 1 - i * 0.1 }}
                  />
                ))}
              </div>
            </div>
          ) : isEmpty ? (
            <div className="px-6 py-16 text-center">
              <div className="mb-1.5 text-sm font-medium text-ink">
                {emptyTitle}
              </div>
              {emptyDescription ? (
                <div className="mb-4 text-[13px] text-subtle">
                  {emptyDescription}
                </div>
              ) : null}
              {emptyAction}
            </div>
          ) : (
            <div
              className={cn(
                "transition-opacity",
                isFetching && "opacity-60",
              )}
            >
              <Table className="text-[13px] text-ink-warm">
                <TableHeader>
                  <TableRow className="border-divider hover:bg-transparent">
                    {columns.map(col => (
                      <TableHead
                        key={col.key}
                        style={{ width: col.width }}
                        onClick={() => col.sortKey && handleSort(col)}
                        className={cn(
                          "h-auto select-none bg-divider px-4 py-2.5 text-xs font-medium text-subtle",
                          col.sortKey && "cursor-pointer",
                          col.align === "right" && "text-right",
                          col.align === "center" && "text-center",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex items-center gap-1",
                            col.align === "right" && "justify-end",
                            col.align === "center" && "justify-center",
                          )}
                        >
                          {col.header}
                          {col.sortKey ? (
                            <SortIcon active={sort === col.sortKey} direction={direction} />
                          ) : null}
                        </span>
                      </TableHead>
                    ))}
                    {rowActions && rowActions.length > 0 ? (
                      <TableHead className="h-auto w-px bg-divider px-4 py-2.5" />
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length + (rowActions ? 1 : 0)}
                        className="px-6 py-8 text-center text-[13px] text-subtle"
                      >
                        No results match your search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row, idx) => {
                      const rowId = getRowId ? getRowId(row) : String(idx);
                      const visibleRowActions =
                        rowActions?.filter(action => action.isVisible?.(row) ?? true) ??
                        [];
                      return (
                        <TableRow
                          key={rowId}
                          onClick={onRowClick ? () => onRowClick(row) : undefined}
                          className={cn(
                            "group/row border-divider hover:bg-divider",
                            onRowClick && "cursor-pointer",
                          )}
                        >
                          {columns.map(col => {
                            const value = col.render(row);
                            return (
                              <TableCell
                                key={col.key}
                                className={cn(
                                  "px-4 py-2.5 align-middle whitespace-normal",
                                  col.align === "right" && "text-right",
                                  col.align === "center" && "text-center",
                                )}
                              >
                                {isTwoLine(value) ? (
                                  <div>
                                    <div>{value.primary}</div>
                                    {value.secondary !== undefined ? (
                                      <div className="mt-px text-[11px] text-subtle">
                                        {value.secondary}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  value
                                )}
                              </TableCell>
                            );
                          })}
                          {rowActions && rowActions.length > 0 ? (
                            <TableCell className="px-4 py-2.5 whitespace-nowrap opacity-100 transition-opacity sm:opacity-0 sm:group-hover/row:opacity-100 sm:group-focus-within/row:opacity-100">
                              <div className="flex items-center justify-end gap-1">
                                {visibleRowActions.map((action, aIdx) => {
                                  const href = action.href?.(row);
                                  const isDestructive =
                                    action.variant === "destructive";
                                  if (href) {
                                    return (
                                      <Button
                                        key={aIdx}
                                        asChild
                                        variant="outline"
                                        size="xs"
                                        className={cn(
                                          "border-border-default bg-card text-xs text-ink-warm hover:bg-divider",
                                          isDestructive &&
                                            "text-destructive hover:text-destructive",
                                        )}
                                      >
                                        <Link
                                          href={href}
                                          onClick={e => e.stopPropagation()}
                                        >
                                          {action.label}
                                        </Link>
                                      </Button>
                                    );
                                  }
                                  return (
                                    <Button
                                      key={aIdx}
                                      type="button"
                                      variant="outline"
                                      size="xs"
                                      className={cn(
                                        "border-border-default bg-card text-xs text-ink-warm hover:bg-divider",
                                        isDestructive &&
                                          "text-destructive hover:text-destructive",
                                      )}
                                      onClick={e => {
                                        e.stopPropagation();
                                        action.onClick?.(row);
                                      }}
                                    >
                                      {action.label}
                                    </Button>
                                  );
                                })}
                              </div>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {!hidePagination && !isLoading && !isEmpty ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-4 py-2.5">
            <div className="flex items-center gap-1.5 text-xs text-subtle">
              <span>Rows</span>
              <Select
                value={String(pageSize)}
                onValueChange={value => onPageSizeChange(Number(value))}
              >
                <SelectTrigger
                  size="sm"
                  className="h-7 w-[72px] border-border-default bg-card px-2 text-xs text-ink-warm shadow-none"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map(n => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-subtle">
              {total > 0 ? `${start}-${end} of ${total.toLocaleString()}` : "0 records"}
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                aria-label="Previous"
                disabled={page <= 1}
                className="size-7 border-border-default bg-card text-ink-warm shadow-none disabled:bg-divider"
                onClick={() => onPageChange(page - 1)}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="px-1.5 text-xs text-subtle">
                {page} / {pageCount || 1}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                aria-label="Next"
                disabled={page >= pageCount}
                className="size-7 border-border-default bg-card text-ink-warm shadow-none disabled:bg-divider"
                onClick={() => onPageChange(page + 1)}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export function StatusPill({
  label,
  bg,
  color,
  dot = true,
}: {
  label: string;
  bg: string;
  color: string;
  dot?: boolean;
}) {
  return (
    <Badge
      variant="secondary"
      className="h-auto rounded-full border-0 px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: bg, color }}
    >
      {dot ? (
        <span className="size-1.5 shrink-0 rounded-full bg-current" />
      ) : null}
      {label}
    </Badge>
  );
}

export function MonoText({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-xs tabular-nums">
      {children}
    </span>
  );
}
