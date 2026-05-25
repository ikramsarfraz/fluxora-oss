"use client";

import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { formatCurrency, formatDate, lineSubtotal } from "../mock-data";
import { useDemo } from "../state";
import type { ImportedInvoice } from "../types";

export function PdfPreview({ invoice }: { invoice: ImportedInvoice }) {
  const { state, dispatch } = useDemo();

  return (
    <div className="flex h-full flex-col rounded-md border border-border-default bg-surface/30">
      <div className="flex items-center gap-2 border-b border-border-soft bg-surface/60 px-3 py-2">
        <span className="font-mono text-[11px] text-subtle">{invoice.filename}</span>
        <span className="text-xs text-subtle">·</span>
        <span className="text-xs text-subtle">Page 1 of 2</span>
        <div className="ml-auto flex items-center gap-0.5">
          <Button variant="ghost" size="icon-xs" aria-label="Previous page" disabled>
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="Next page" disabled>
            <ChevronRight />
          </Button>
          <span className="mx-1 h-3 w-px bg-border-soft" />
          <Button variant="ghost" size="icon-xs" aria-label="Zoom out" disabled>
            <ZoomOut />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="Zoom in" disabled>
            <ZoomIn />
          </Button>
          <span className="mx-1 h-3 w-px bg-border-soft" />
          <Button variant="ghost" size="icon-xs" aria-label="Download" disabled>
            <Download />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-[640px] rounded-sm border border-border-soft bg-white p-8 shadow-sm font-mono text-[10.5px] leading-relaxed text-zinc-800">
          <header className="flex items-start justify-between gap-6">
            <div>
              <div className="font-serif text-[18px] font-medium tracking-tight text-zinc-900">
                Northwind Trading Co.
              </div>
              <div className="mt-1 text-[10px] text-zinc-500">
                184 Harborview Rd
                <br />
                Portland, OR 97211
                <br />
                ar@northwind-trading.example
              </div>
            </div>
            <div className="text-right">
              <div className="font-serif text-[14px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                Invoice
              </div>
              <div className="mt-1 text-[10px] text-zinc-900">
                # <span className="font-medium">{invoice.invoiceNumber}</span>
              </div>
              <div className="text-[10px] text-zinc-500">
                Issued {formatDate(invoice.invoiceDate)}
              </div>
              <div className="text-[10px] text-zinc-500">
                Due {formatDate(invoice.dueDate)}
              </div>
            </div>
          </header>

          <div className="mt-5 grid grid-cols-2 gap-4 rounded-sm border border-zinc-100 bg-zinc-50/70 p-3 text-[10px]">
            <div>
              <div className="text-[9px] uppercase tracking-[0.08em] text-zinc-400">
                Bill to
              </div>
              <div className="mt-1 text-zinc-900">Fluxora Operations</div>
              <div className="text-zinc-500">3401 Wabash Ave, Chicago, IL</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.08em] text-zinc-400">
                Terms
              </div>
              <div className="mt-1 text-zinc-900">Net 30 · {invoice.currency}</div>
              <div className="text-zinc-500">PO #4471</div>
            </div>
          </div>

          <div className="mt-5">
            <div className="grid grid-cols-[40px_1fr_60px_70px_80px] gap-2 border-b border-zinc-200 pb-1.5 text-[9px] uppercase tracking-[0.08em] text-zinc-400">
              <div>Line</div>
              <div>Description</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Unit</div>
              <div className="text-right">Amount</div>
            </div>
            <div className="divide-y divide-zinc-100">
              {invoice.lines.map((l, i) => {
                const isHighlighted = state.highlightedLineId === l.id;
                return (
                  <div
                    key={l.id}
                    onMouseEnter={() =>
                      dispatch({ type: "SET_HIGHLIGHT", lineId: l.id })
                    }
                    onMouseLeave={() =>
                      dispatch({ type: "SET_HIGHLIGHT", lineId: null })
                    }
                    className={cn(
                      "relative grid grid-cols-[40px_1fr_60px_70px_80px] gap-2 px-1 py-1.5 transition-colors",
                      isHighlighted && "bg-amber-100/60 ring-1 ring-amber-300/60",
                    )}
                  >
                    {isHighlighted && (
                      <span
                        className="absolute -left-1 top-1 bottom-1 w-0.5 rounded-full bg-amber-500"
                        aria-hidden
                      />
                    )}
                    <div className="text-zinc-400 tabular-nums">{i + 1}</div>
                    <div className="text-zinc-900">{l.description}</div>
                    <div className="text-right text-zinc-700 tabular-nums">
                      {l.qty}
                    </div>
                    <div className="text-right text-zinc-700 tabular-nums">
                      {l.unitCost == null ? "—" : formatCurrency(l.unitCost)}
                    </div>
                    <div className="text-right text-zinc-900 tabular-nums">
                      {formatCurrency(lineSubtotal(l))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 ml-auto w-1/2 space-y-1 border-t border-zinc-200 pt-2 text-[10px]">
            <div className="flex justify-between text-zinc-500">
              <span>Subtotal</span>
              <span className="tabular-nums">
                {formatCurrency(
                  invoice.lines.reduce((s, l) => s + lineSubtotal(l), 0),
                )}
              </span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>Tax</span>
              <span className="tabular-nums">{formatCurrency(0)}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-1.5 font-medium text-zinc-900">
              <span>Total due</span>
              <span className="tabular-nums">
                {formatCurrency(invoice.declaredTotal)}
              </span>
            </div>
          </div>

          <footer className="mt-8 border-t border-zinc-200 pt-2 text-center text-[9px] text-zinc-400">
            Thank you for your business. Remit by ACH to acct **** 4429 or check
            payable to Northwind Trading Co.
          </footer>
        </div>
      </div>
    </div>
  );
}
