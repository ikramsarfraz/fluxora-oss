"use client";

import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowRight, ChevronRight, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

import { formatCurrency, formatDate } from "../mock-data";
import { computeInvoiceIssues } from "../lib/issues";
import { useDemo } from "../state";
import type { ImportedInvoice } from "../types";

type Row = ImportedInvoice & { errors: number; warnings: number };

export function QueueStep() {
  const { state, dispatch } = useDemo();

  const rows = useMemo<Row[]>(() => {
    return state.invoices.map((inv) => {
      const summary = computeInvoiceIssues(inv, state.products, state.suppliers, state.invoices);
      return { ...inv, errors: summary.errors, warnings: summary.warnings };
    });
  }, [state.invoices, state.products, state.suppliers]);

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: "supplierName",
        header: "Supplier",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <FileText className="size-3.5 shrink-0 text-subtle" />
            <span className="font-medium text-ink">{row.original.supplierName}</span>
          </div>
        ),
      },
      {
        accessorKey: "invoiceNumber",
        header: "Invoice #",
        cell: ({ row }) => (
          <span className="font-mono text-[12px] text-ink-warm" data-mono>
            {row.original.invoiceNumber}
          </span>
        ),
      },
      {
        accessorKey: "invoiceDate",
        header: "Date",
        cell: ({ row }) => (
          <span className="text-sm text-ink-warm tabular-nums">
            {formatDate(row.original.invoiceDate)}
          </span>
        ),
      },
      {
        accessorKey: "declaredTotal",
        header: () => <div className="text-right">Total</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums" data-financial>
            {formatCurrency(row.original.declaredTotal, row.original.currency)}
          </div>
        ),
        meta: { className: "text-right" },
      },
      {
        id: "lines",
        header: () => <div className="text-right">Lines</div>,
        cell: ({ row }) => (
          <div className="text-right text-sm text-ink-warm tabular-nums">
            {row.original.lines.length}
          </div>
        ),
        meta: { className: "text-right" },
      },
      {
        id: "issues",
        header: "Issues",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            {row.original.errors === 0 && row.original.warnings === 0 ? (
              <span className="text-xs text-subtle">None</span>
            ) : (
              <>
                {row.original.errors > 0 && (
                  <Badge variant="destructive">
                    {row.original.errors} error{row.original.errors === 1 ? "" : "s"}
                  </Badge>
                )}
                {row.original.warnings > 0 && (
                  <Badge variant="warning">
                    {row.original.warnings} warning{row.original.warnings === 1 ? "" : "s"}
                  </Badge>
                )}
              </>
            )}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.status === "saved" ? "success" : "muted"}>
            {row.original.status === "saved" ? "Saved" : "Awaiting review"}
          </Badge>
        ),
      },
      {
        id: "open",
        header: "",
        cell: () => (
          <div className="flex justify-end pr-1 text-subtle">
            <ChevronRight className="size-3.5" />
          </div>
        ),
        meta: { className: "w-[40px] text-right" },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  function open(invoiceId: string) {
    dispatch({ type: "SELECT_INVOICE", invoiceId });
    dispatch({ type: "SET_STEP", step: "review" });
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Imports awaiting review"
        description={`${rows.length} invoice${rows.length === 1 ? "" : "s"} extracted. Open one to confirm matches and resolve issues.`}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch({ type: "SET_STEP", step: "upload" })}
        >
          Import more
          <ArrowRight className="size-3.5" />
        </Button>
      </PageHeader>

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
                className="cursor-pointer border-t border-border-soft hover:bg-forest-tint/30"
                onClick={() => open(row.original.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      "py-3",
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
