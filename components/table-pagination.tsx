"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClientPaginationState } from "@/hooks/use-client-pagination";

/**
 * Pagination control bar for inline detail-page tables. Visual treatment
 * mirrors the pagination footer in `<ListingPage>` (rows-per-page select on
 * the left, range indicator in the middle, prev/next on the right) so the
 * two surfaces feel like the same component to operators.
 *
 * Driven by `useClientPagination()`. Hides itself when there's only one
 * page of data — no need to take up screen real estate for a five-row
 * allocations list.
 */
export function TablePagination<T>({
  state,
  pageSizeOptions = [10, 25, 50, 100],
  className,
}: {
  state: ClientPaginationState<T>;
  pageSizeOptions?: number[];
  className?: string;
}) {
  const { page, pageSize, pageCount, total, start, end, setPage, setPageSize } =
    state;

  // Don't render the bar at all when the data comfortably fits on one
  // page AND can't be paginated bigger — keeps narrow tables clean.
  if (total <= pageSize && pageCount <= 1) return null;

  return (
    <div
      className={
        "flex flex-wrap items-center justify-between gap-3 border-t border-divider px-4 py-2.5 " +
        (className ?? "")
      }
    >
      <div className="flex items-center gap-1.5 text-xs text-subtle">
        <span>Rows</span>
        <Select
          value={String(pageSize)}
          onValueChange={value => setPageSize(Number(value))}
        >
          <SelectTrigger
            size="sm"
            className="h-7 w-[72px] border-border-default bg-card px-2 text-xs text-ink-warm shadow-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map(n => (
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
          onClick={() => setPage(page - 1)}
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
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
