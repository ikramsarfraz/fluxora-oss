"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, FileText, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

import { formatCurrency } from "../mock-data";
import { useDemo } from "../state";
import type { Product } from "../types";

export function InventoryStep() {
  const { state, dispatch } = useDemo();
  const isPostState = state.step === "saved";
  const [filter, setFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return state.products;
    return state.products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [state.products, filter]);

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        accessorKey: "sku",
        header: ({ column }) => (
          <SortHeader column={column} label="SKU" align="left" />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-[12px] text-ink-warm" data-mono>
            {row.original.sku}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <SortHeader column={column} label="Product" align="left" />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink">{row.original.name}</span>
            {row.original.recentlyUpdated && (
              <span
                aria-label="Recently updated"
                title="Updated by invoice import"
                className="size-1.5 rounded-full bg-forest-mid"
              />
            )}
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <span className="text-sm text-subtle">{row.original.category}</span>
        ),
      },
      {
        accessorKey: "unit",
        header: "Unit",
        cell: ({ row }) => (
          <span className="text-xs text-subtle uppercase tracking-wide">
            {row.original.unit}
          </span>
        ),
      },
      {
        accessorKey: "currentStock",
        header: ({ column }) => (
          <SortHeader column={column} label="On hand" align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-right">
            <span className="tabular-nums text-ink">
              {row.original.currentStock.toLocaleString()}
            </span>
          </div>
        ),
        meta: { className: "text-right" },
      },
      {
        accessorKey: "lastCost",
        header: ({ column }) => (
          <SortHeader column={column} label="Last cost" align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums" data-financial>
            {formatCurrency(row.original.lastCost)}
          </div>
        ),
        meta: { className: "text-right" },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Inventory"
        description={
          isPostState
            ? "Catalog after import. Newly affected rows are marked."
            : "Catalog, stock levels, and last recorded cost across the warehouse."
        }
      >
        <Button variant="secondary" size="sm">
          <Plus className="size-3.5" />
          Add item
        </Button>
        <Button
          size="sm"
          onClick={() => dispatch({ type: "SET_STEP", step: "upload" })}
        >
          <FileText className="size-3.5" />
          Import invoice
        </Button>
      </PageHeader>

      {isPostState && state.saveSummary && (
        <div className="flex items-center gap-3 rounded-md border border-success-border bg-success-bg/60 px-4 py-2.5 text-sm text-success-fg">
          <span className="size-1.5 rounded-full bg-success-fg" aria-hidden />
          <span>
            <span className="font-medium">{state.saveSummary.invoiceNumber}</span> imported from{" "}
            <span className="font-medium">{state.saveSummary.supplierName}</span>.{" "}
            {state.saveSummary.productsCreated > 0 && (
              <>
                {state.saveSummary.productsCreated} product
                {state.saveSummary.productsCreated === 1 ? "" : "s"} added,{" "}
              </>
            )}
            {state.saveSummary.productsUpdated} updated.
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_STEP", step: "upload" })}
            className="ml-auto text-xs font-medium underline-offset-2 hover:underline"
          >
            Import another
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="relative w-72 max-w-full">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search SKU, name, category"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-subtle">
          <KPI label="Products" value={state.products.length.toLocaleString()} />
          <KPI
            label="On hand"
            value={state.products
              .reduce((s, p) => s + p.currentStock, 0)
              .toLocaleString()}
          />
          <KPI
            label="Stock value"
            value={formatCurrency(
              state.products.reduce((s, p) => s + p.currentStock * p.lastCost, 0),
            )}
          />
          {isPostState && state.saveSummary && (
            <Badge variant="success">
              {state.saveSummary.productsCreated + state.saveSummary.productsUpdated} affected
            </Badge>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border-default bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-surface/40 hover:bg-surface/40">
                {hg.headers.map((h) => (
                  <TableHead
                    key={h.id}
                    className={cn(
                      "text-[11px] font-medium uppercase tracking-[0.06em] text-subtle",
                      (h.column.columnDef.meta as { className?: string } | undefined)?.className,
                    )}
                  >
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  "border-t border-border-soft",
                  row.original.recentlyUpdated &&
                    "bg-forest-tint/35 hover:bg-forest-tint/55",
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      "py-2.5",
                      (cell.column.columnDef.meta as { className?: string } | undefined)
                        ?.className,
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SortHeader({
  column,
  label,
  align = "left",
}: {
  column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" };
  label: string;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-subtle hover:text-ink-warm",
        align === "right" && "w-full justify-end",
      )}
    >
      {label}
      <ArrowUpDown className="size-3" />
    </button>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-subtle">{label}</span>
      <span className="font-medium tabular-nums text-ink">{value}</span>
    </span>
  );
}
