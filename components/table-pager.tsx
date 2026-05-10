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

type TablePagerProps = {
  total: number;
  perPage: number;
  page: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  perPageOptions?: number[];
};

export function TablePager({
  total,
  perPage,
  page,
  onPageChange,
  onPerPageChange,
  perPageOptions = [10, 25, 50, 100],
}: TablePagerProps) {
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-line2 px-4 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-stone-muted">
        <span>Rows</span>
        <Select
          value={String(perPage)}
          onValueChange={v => onPerPageChange(Number(v))}
        >
          <SelectTrigger
            size="sm"
            className="h-7 w-18 border-stone-line bg-stone-surface px-2 text-xs text-stone-ink2 shadow-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {perPageOptions.map(opt => (
              <SelectItem key={opt} value={String(opt)}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-stone-muted">
        {total > 0 ? `${start}–${end} of ${total.toLocaleString()}` : "0 records"}
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          aria-label="Previous page"
          disabled={page <= 1}
          className="size-7 border-stone-line bg-stone-surface text-stone-ink2 shadow-none disabled:bg-stone-line2"
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <span className="px-1.5 text-xs text-stone-muted">
          {page} / {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          aria-label="Next page"
          disabled={page >= pageCount}
          className="size-7 border-stone-line bg-stone-surface text-stone-ink2 shadow-none disabled:bg-stone-line2"
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
