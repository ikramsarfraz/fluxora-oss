"use client";

import { ArrowLeftRight, MoreHorizontal, Plus, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { formatCurrency, lineSubtotal } from "../mock-data";
import { useDemo } from "../state";
import type { ImportedInvoice, LineItem, NonInventoryCategory } from "../types";

const CATEGORY_LABEL: Record<NonInventoryCategory, string> = {
  shipping: "Shipping",
  fees: "Fees",
  tax: "Tax",
  other: "Other",
};

const CATEGORY_ACCOUNTS: Record<NonInventoryCategory, string[]> = {
  shipping: ["5210 — Freight in", "5212 — Inbound logistics", "5215 — Fuel surcharges"],
  fees: ["5215 — Fuel surcharges", "5220 — Handling fees", "5240 — Card processing"],
  tax: ["2120 — Sales tax payable", "2125 — VAT payable"],
  other: ["1810 — Deposits held", "5290 — Other operating", "5295 — Miscellaneous"],
};

export function NonInventorySection({ invoice }: { invoice: ImportedInvoice }) {
  const { dispatch } = useDemo();
  const lines = invoice.lines.filter((l) => l.kind === "non-inventory");
  const subtotal = lines.reduce((s, l) => s + lineSubtotal(l), 0);

  return (
    <section
      data-section="non-inventory"
      className="rounded-md border border-border-default bg-card"
    >
      <header className="flex items-center justify-between border-b border-border-soft px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Receipt className="size-3.5 text-forest-mid/70" />
          <h2 className="text-sm font-medium text-ink">Non-inventory charges</h2>
          <span className="text-xs text-subtle">
            {lines.length} charge{lines.length === 1 ? "" : "s"}
          </span>
        </div>
        <span className="text-[10.5px] text-subtle">
          Posted to expense — no stock movement.
        </span>
      </header>

      {lines.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-subtle">
          No non-inventory charges. Use a line action to move freight, fees, or
          taxes here.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[24px_1.4fr_1fr_1.2fr_120px_28px] items-center gap-3 border-b border-border-soft px-3 py-2 text-[10.5px] font-medium uppercase tracking-[0.06em] text-subtle">
            <div></div>
            <div>Description</div>
            <div>Category</div>
            <div>Expense account</div>
            <div className="text-right">Amount</div>
            <div></div>
          </div>
          <ul className="divide-y divide-border-soft">
            {lines.map((line) => (
              <NonInventoryRow key={line.id} line={line} />
            ))}
          </ul>
        </>
      )}

      <footer className="flex items-center justify-between gap-6 border-t border-border-soft bg-surface/40 px-4 py-2.5 text-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // Add a blank non-inventory row
            const id = `line_misc_${Date.now()}`;
            dispatch({
              type: "UPDATE_HEADER",
              patch: {},
            });
            dispatch({
              type: "SET_LINE_KIND",
              lineId: id,
              kind: "non-inventory",
            });
          }}
          disabled
        >
          <Plus className="size-3" />
          Add charge
        </Button>
        <div className="flex items-center gap-6">
          <span className="text-subtle">Charges subtotal</span>
          <span className="tabular-nums" data-financial>
            {formatCurrency(subtotal, invoice.currency)}
          </span>
        </div>
      </footer>
    </section>
  );
}

function NonInventoryRow({ line }: { line: LineItem }) {
  const { state, dispatch } = useDemo();
  const isHighlighted = state.highlightedLineId === line.id;
  const category = line.nonInventoryCategory ?? "other";
  const accountOptions = CATEGORY_ACCOUNTS[category];

  return (
    <li
      onMouseEnter={() => dispatch({ type: "SET_HIGHLIGHT", lineId: line.id })}
      onMouseLeave={() => dispatch({ type: "SET_HIGHLIGHT", lineId: null })}
      className={cn(
        "transition-colors",
        isHighlighted && "bg-amber-100/30",
      )}
    >
      <div className="grid grid-cols-[24px_1.4fr_1fr_1.2fr_120px_28px] items-center gap-3 px-3 py-2.5">
        <div className="flex items-center">
          <span className="size-1.5 rounded-full bg-forest-mid/60" aria-hidden />
        </div>

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

        <Select
          value={category}
          onValueChange={(v) => {
            const cat = v as NonInventoryCategory;
            dispatch({
              type: "SET_NON_INVENTORY",
              lineId: line.id,
              category: cat,
              expenseAccount: CATEGORY_ACCOUNTS[cat][0],
            });
          }}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CATEGORY_LABEL) as NonInventoryCategory[]).map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={line.expenseAccount ?? accountOptions[0]}
          onValueChange={(v) =>
            dispatch({
              type: "SET_NON_INVENTORY",
              lineId: line.id,
              category,
              expenseAccount: v,
            })
          }
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accountOptions.map((a) => (
              <SelectItem key={a} value={a}>
                <span className="font-mono text-[11px]" data-mono>
                  {a}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          step="0.01"
          value={line.unitCost ?? 0}
          onChange={(e) => {
            const v = Number(e.target.value) || 0;
            dispatch({
              type: "UPDATE_LINE",
              lineId: line.id,
              patch: { unitCost: v, total: Number((v * line.qty).toFixed(2)) },
            });
          }}
          className="h-8 text-right tabular-nums"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label="Charge actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() =>
                dispatch({
                  type: "SET_LINE_KIND",
                  lineId: line.id,
                  kind: "inventory",
                })
              }
            >
              <ArrowLeftRight className="size-3.5" />
              Move to inventory line
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
