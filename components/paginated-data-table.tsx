"use client";

import { useMemo, useState } from "react";

import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  SortingState,
  type Updater,
  useReactTable,
} from "@tanstack/react-table";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SortDirection } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "@/components/data-table-pagination";

interface PaginatedDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  getRowId?: (row: TData) => string;
  searchPlaceholder?: string;
  searchColumnId?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  page?: number;
  pageSize?: number;
  total?: number;
  pageCount?: number;
  sort?: string;
  direction?: SortDirection;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onSortChange?: (sort: string, direction: SortDirection) => void;
  isFetching?: boolean;
}

export function PaginatedDataTable<TData, TValue>({
  columns,
  data,
  getRowId,
  searchPlaceholder,
  searchColumnId,
  searchValue,
  onSearchChange,
  page,
  pageSize,
  total,
  pageCount,
  sort,
  direction,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  isFetching,
}: PaginatedDataTableProps<TData, TValue>) {
  const isManualMode =
    page !== undefined &&
    pageSize !== undefined &&
    total !== undefined &&
    pageCount !== undefined &&
    onPageChange !== undefined &&
    onPageSizeChange !== undefined;
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const manualSorting = useMemo<SortingState>(() => {
    if (!isManualMode || !sort) {
      return [];
    }

    return [{ id: sort, desc: direction === "desc" }];
  }, [direction, isManualMode, sort]);
  const paginationState = useMemo<PaginationState | undefined>(() => {
    if (!isManualMode) {
      return undefined;
    }

    return {
      pageIndex: Math.max(0, (page ?? 1) - 1),
      pageSize: pageSize ?? 10,
    };
  }, [isManualMode, page, pageSize]);

  const table = useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    ...(isManualMode
      ? {
          manualPagination: true,
          manualSorting: true,
          onPaginationChange: (updater: Updater<PaginationState>) => {
            const nextPagination =
              typeof updater === "function"
                ? updater(
                    paginationState ?? {
                      pageIndex: 0,
                      pageSize: 10,
                    },
                  )
                : updater;

            if (nextPagination.pageSize !== (pageSize ?? 10)) {
              onPageSizeChange?.(nextPagination.pageSize);
              return;
            }

            onPageChange?.(nextPagination.pageIndex + 1);
          },
          onSortingChange: (updater: Updater<SortingState>) => {
            const nextSorting =
              typeof updater === "function"
                ? updater(manualSorting)
                : updater;

            const next = nextSorting[0];
            if (!next) {
              return;
            }

            onSortChange?.(next.id, next.desc ? "desc" : "asc");
          },
          rowCount: total,
          pageCount,
        }
      : {
          getFilteredRowModel: getFilteredRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
          onSortingChange: setSorting,
          onColumnFiltersChange: setColumnFilters,
          onGlobalFilterChange: setGlobalFilter,
          getSortedRowModel: getSortedRowModel(),
        }),
    globalFilterFn: "includesString",
    state: {
      sorting: isManualMode ? manualSorting : sorting,
      columnFilters: isManualMode ? [] : columnFilters,
      globalFilter:
        isManualMode && searchColumnId === undefined
          ? (searchValue ?? "")
          : globalFilter,
      pagination: paginationState,
    },
  });

  const resolvedSearchValue = isManualMode
    ? (searchValue ?? "")
    : searchColumnId
      ? ((table.getColumn(searchColumnId)?.getFilterValue() as string) ?? "")
      : globalFilter;

  const handleSearchChange = (value: string) => {
    if (isManualMode) {
      onSearchChange?.(value);
      return;
    }

    if (searchColumnId) {
      table.getColumn(searchColumnId)?.setFilterValue(value);
      return;
    }

    setGlobalFilter(value);
  };

  return (
    <div className="flex flex-col gap-4">
      {searchPlaceholder ? (
        <Input
          value={resolvedSearchValue}
          onChange={event => handleSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="max-w-sm"
        />
      ) : null}
      <div className="relative overflow-x-auto rounded-md border">
        {isFetching ? (
          <div className="absolute inset-x-0 top-0 z-10 h-1 overflow-hidden bg-muted">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/50" />
          </div>
        ) : null}
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const meta = header.column.columnDef.meta as
                    | { className?: string }
                    | undefined;
                  return (
                    <TableHead key={header.id} className={cn(meta?.className)}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className={cn(isFetching && "opacity-60 transition-opacity")}>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map(cell => {
                    const meta = cell.column.columnDef.meta as
                      | { className?: string }
                      | undefined;
                    return (
                      <TableCell key={cell.id} className={cn(meta?.className)}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} totalRows={total} />
    </div>
  );
}
