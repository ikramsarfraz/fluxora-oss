"use client";

import { useRef } from "react";
import {
  AlertTriangle,
  CircleAlert,
  Move,
  MoreHorizontal,
  Receipt,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { formatCurrency, lineSubtotal } from "../mock-data";
import { useDemo } from "../state";
import {
  computeInvoiceIssues,
  getLineIssues,
  type InvoiceIssueSummary,
} from "../lib/issues";
import type { ImportedInvoice, LineItem } from "../types";

import { CreateProductForm } from "./create-product-form";
import { ProductPicker } from "./product-picker";

type Props = {
  invoice: ImportedInvoice;
  summary: InvoiceIssueSummary;
  registerRow: (lineId: string, el: HTMLElement | null) => void;
};

export function LineItemsTable({ invoice, summary, registerRow }: Props) {
  const lines = invoice.lines.filter((l) => l.kind === "inventory");
  const subtotal = lines.reduce((s, l) => s + lineSubtotal(l), 0);

  return (
    <section
      data-section="lines"
      className="rounded-md border border-border-default bg-card"
    >
      <header className="flex items-center justify-between border-b border-border-soft px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-ink">Inventory line items</h2>
          <span className="text-xs text-subtle">
            {lines.length} line{lines.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-subtle">
          <Sparkles className="size-3 text-forest-mid/60" />
          <span>{Math.round(avgConfidence(lines) * 100)}% avg confidence</span>
        </div>
      </header>

      <div className="grid grid-cols-[24px_1.6fr_1fr_72px_96px_96px_28px] items-center gap-3 border-b border-border-soft px-3 py-2 text-[10.5px] font-medium uppercase tracking-[0.06em] text-subtle">
        <div></div>
        <div>Extracted</div>
        <div>Matched product</div>
        <div className="text-right">Qty</div>
        <div className="text-right">Unit cost</div>
        <div className="text-right">Total</div>
        <div></div>
      </div>

      <ul className="divide-y divide-border-soft">
        {lines.map((line) => (
          <LineRow
            key={line.id}
            line={line}
            summary={summary}
            registerRow={registerRow}
          />
        ))}
      </ul>

      <footer className="flex items-center justify-end gap-6 border-t border-border-soft bg-surface/40 px-4 py-2.5 text-sm">
        <span className="text-subtle">Inventory subtotal</span>
        <span className="tabular-nums" data-financial>
          {formatCurrency(subtotal, invoice.currency)}
        </span>
      </footer>
    </section>
  );
}

function avgConfidence(lines: LineItem[]): number {
  if (lines.length === 0) return 1;
  return lines.reduce((s, l) => s + l.confidence, 0) / lines.length;
}

function LineRow({
  line,
  summary,
  registerRow,
}: {
  line: LineItem;
  summary: InvoiceIssueSummary;
  registerRow: (lineId: string, el: HTMLElement | null) => void;
}) {
  const { state, dispatch } = useDemo();
  const issues = getLineIssues(summary, line);
  const hasError = issues.some((i) => i.type === "error");
  const hasWarning = !hasError && issues.some((i) => i.type === "warning");
  const isHighlighted = state.highlightedLineId === line.id;
  const rowRef = useRef<HTMLLIElement>(null);

  return (
    <li
      ref={(el) => {
        rowRef.current = el;
        registerRow(line.id, el);
      }}
      onMouseEnter={() => dispatch({ type: "SET_HIGHLIGHT", lineId: line.id })}
      onMouseLeave={() => dispatch({ type: "SET_HIGHLIGHT", lineId: null })}
      className={cn(
        "transition-colors",
        hasError && "bg-danger-bg/15",
        hasWarning && !hasError && "bg-warning-bg/15",
        isHighlighted && "bg-amber-100/30",
        isHighlighted && "ring-1 ring-amber-300/40 ring-inset",
      )}
    >
      <div className="grid grid-cols-[24px_1.6fr_1fr_72px_96px_96px_28px] items-start gap-3 px-3 py-3">
        <div className="flex items-center pt-1">
          {hasError ? (
            <CircleAlert className="size-3.5 text-danger-fg" />
          ) : hasWarning ? (
            <AlertTriangle className="size-3.5 text-warning-fg" />
          ) : (
            <span className="size-1.5 rounded-full bg-success-fg/70" aria-hidden />
          )}
        </div>

        <div className="min-w-0">
          <Input
            value={line.description}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_LINE",
                lineId: line.id,
                patch: { description: e.target.value },
              })
            }
            className="h-8 border-transparent bg-transparent px-1 text-sm shadow-none hover:border-border-soft focus-visible:border-border-default"
          />
          <div className="mt-0.5 flex items-center gap-1.5 px-1 text-[10.5px] text-subtle">
            <span>L{line.pdfRowIndex + 1}</span>
            <span>·</span>
            <ConfidencePill confidence={line.confidence} />
          </div>
        </div>

        <div className="min-w-0">
          <ProductPicker line={line} />
          {line.matchState === "unmatched" && line.newProductDraft && (
            <CreateProductForm line={line} />
          )}
        </div>

        <Input
          type="number"
          value={line.qty}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_LINE",
              lineId: line.id,
              patch: { qty: Number(e.target.value) || 0 },
            })
          }
          className="h-8 text-right tabular-nums"
        />

        <Input
          type="number"
          step="0.01"
          value={line.unitCost ?? ""}
          placeholder={line.unitCost == null ? "—" : ""}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_LINE",
              lineId: line.id,
              patch: {
                unitCost: e.target.value === "" ? null : Number(e.target.value),
              },
            })
          }
          className={cn(
            "h-8 text-right tabular-nums",
            line.unitCost == null && "border-danger-border/70 bg-danger-bg/30",
          )}
        />

        <div className="flex h-8 items-center justify-end pr-1 tabular-nums" data-financial>
          {formatCurrency(lineSubtotal(line))}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Line item actions"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() =>
                dispatch({
                  type: "SET_LINE_KIND",
                  lineId: line.id,
                  kind: "non-inventory",
                })
              }
            >
              <Receipt className="size-3.5" />
              Move to non-inventory
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                dispatch({
                  type: "UPDATE_LINE",
                  lineId: line.id,
                  patch: {
                    newProductDraft: line.newProductDraft ?? {
                      name: line.description,
                      sku: "",
                      category: "Uncategorized",
                      unit: "each",
                      cost: line.unitCost ?? 0,
                    },
                    matchState: "unmatched",
                  },
                })
              }
            >
              <Sparkles className="size-3.5" />
              Create new product…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                dispatch({
                  type: "UPDATE_LINE",
                  lineId: line.id,
                  patch: {
                    matchedProductId: null,
                    matchState: line.suggestions.length > 0 ? "suggested" : "unmatched",
                    aliasAdded: false,
                  },
                })
              }
            >
              <Move className="size-3.5" />
              Unlink match
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {issues.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-12 pb-3">
          {issues.map((i, idx) => (
            <span
              key={idx}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px]",
                i.type === "error"
                  ? "border-danger-border bg-danger-bg/70 text-danger-fg"
                  : "border-warning-border bg-warning-bg/70 text-warning-fg",
              )}
            >
              {i.type === "error" ? (
                <CircleAlert className="size-2.5" />
              ) : (
                <AlertTriangle className="size-2.5" />
              )}
              <span className="font-medium">{i.message}</span>
              {i.detail && <span className="opacity-80">· {i.detail}</span>}
            </span>
          ))}
        </div>
      )}

      {line.aliasAdded && (
        <div className="flex items-center gap-1.5 border-t border-border-soft bg-forest-tint/30 px-12 py-1.5 text-[10.5px] text-forest">
          <Sparkles className="size-3" />
          Added{" "}
          <span className="font-medium px-0.5">{`"${line.description}"`}</span>{" "}
          as an alias on the matched product. Future invoices will match
          automatically.
        </div>
      )}
    </li>
  );
}

function ConfidencePill({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  let color = "text-subtle";
  if (pct >= 85) color = "text-success-fg";
  else if (pct >= 65) color = "text-warning-fg";
  else color = "text-danger-fg";
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", color)}>
      <span className="size-1 rounded-full bg-current opacity-70" />
      {pct}% confidence
    </span>
  );
}

export function useInvoiceIssues(invoice: ImportedInvoice): InvoiceIssueSummary {
  const { state } = useDemo();
  return computeInvoiceIssues(invoice, state.products, state.suppliers, state.invoices);
}
