"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { formatCurrency } from "../mock-data";
import { useDemo } from "../state";

export function SaveStep() {
  const { state, dispatch, selectedInvoice } = useDemo();
  const alreadyCommitted = state.saveSummary != null;
  const [phase, setPhase] = useState<"committing" | "summary">(
    alreadyCommitted ? "summary" : "committing",
  );

  useEffect(() => {
    if (!selectedInvoice) return;
    if (alreadyCommitted) return;
    const t = setTimeout(() => {
      dispatch({ type: "COMMIT_INVOICE", invoiceId: selectedInvoice.id });
      setPhase("summary");
    }, 1100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function viewInventory() {
    if (state.saveSummary) {
      toast.success(
        `Invoice ${state.saveSummary.invoiceNumber} imported.`,
        {
          description: `${state.saveSummary.productsCreated} product${state.saveSummary.productsCreated === 1 ? "" : "s"} added, ${state.saveSummary.productsUpdated} updated.`,
        },
      );
    }
    dispatch({ type: "SET_STEP", step: "saved" });
  }

  const isCommitting = phase === "committing";

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className={cn(
          "w-full max-w-[440px] rounded-lg border bg-card-warm p-7 shadow-sm",
          isCommitting ? "border-border-default" : "border-success-border",
        )}
      >
        <div
          className={cn(
            "mb-4 flex size-12 items-center justify-center rounded-full",
            isCommitting
              ? "bg-forest-tint text-forest-mid"
              : "bg-success-bg text-success-fg",
          )}
        >
          {isCommitting ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Check className="size-5" />
          )}
        </div>
        <h1 className="font-serif text-[22px] font-medium tracking-tight text-ink">
          {isCommitting ? "Saving invoice…" : "Invoice imported"}
        </h1>
        <p className="mt-1 text-sm text-subtle">
          {isCommitting
            ? "Posting line items, updating stock, and persisting aliases."
            : "Stock and costs are updated. Aliases are saved for future imports."}
        </p>

        {!isCommitting && state.saveSummary && (
          <div className="mt-5 rounded-md border border-border-default bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm">
              <FileText className="size-3.5 text-subtle" />
              <span className="font-mono text-[12px] text-ink-warm" data-mono>
                {state.saveSummary.invoiceNumber}
              </span>
              <span className="text-subtle">·</span>
              <span className="text-ink-warm">{state.saveSummary.supplierName}</span>
              <span className="ml-auto tabular-nums" data-financial>
                {formatCurrency(state.saveSummary.totalAmount)}
              </span>
            </div>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <SummaryStat
                value={state.saveSummary.productsCreated}
                label="products created"
              />
              <SummaryStat
                value={state.saveSummary.productsUpdated}
                label="products updated"
              />
              <SummaryStat
                value={state.saveSummary.aliasesAdded}
                label="aliases added"
              />
              <SummaryStat
                value={state.saveSummary.nonInventoryPosted}
                label="charges posted"
              />
            </ul>
          </div>
        )}

        {!isCommitting && (
          <div className="mt-5 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatch({ type: "SET_STEP", step: "queue" })}
            >
              Back to queue
            </Button>
            <Button size="sm" onClick={viewInventory}>
              View inventory
              <ArrowRight className="size-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryStat({ value, label }: { value: number; label: string }) {
  return (
    <li className="flex items-baseline gap-2">
      <span className="font-serif text-[20px] tabular-nums text-ink">
        {value}
      </span>
      <span className="text-xs text-subtle">{label}</span>
    </li>
  );
}
