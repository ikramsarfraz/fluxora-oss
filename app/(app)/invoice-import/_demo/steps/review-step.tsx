"use client";

import { useMemo, useRef } from "react";
import { ArrowLeft, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

import { computeInvoiceIssues } from "../lib/issues";
import { formatCurrency, lineSubtotal } from "../mock-data";
import { useDemo } from "../state";

import { InvoiceHeader } from "../parts/invoice-header";
import { IssueBar } from "../parts/issue-bar";
import { LineItemsTable } from "../parts/line-items-table";
import { NonInventorySection } from "../parts/non-inventory-section";
import { PdfPreview } from "../parts/pdf-preview";

export function ReviewStep() {
  const { state, dispatch, selectedInvoice } = useDemo();
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());
  const headerRef = useRef<HTMLDivElement | null>(null);

  const summary = useMemo(
    () =>
      selectedInvoice
        ? computeInvoiceIssues(
            selectedInvoice,
            state.products,
            state.suppliers,
            state.invoices,
          )
        : null,
    [selectedInvoice, state.products, state.suppliers, state.invoices],
  );

  if (!selectedInvoice || !summary) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-border-default bg-card py-16 text-center">
        <div className="text-sm text-subtle">No invoice selected.</div>
        <Button
          size="sm"
          onClick={() => dispatch({ type: "SET_STEP", step: "queue" })}
        >
          Back to queue
        </Button>
      </div>
    );
  }

  const computedTotal = selectedInvoice.lines.reduce(
    (s, l) => s + lineSubtotal(l),
    0,
  );

  function jump(target: { kind: "header" } | { kind: "line"; lineId: string }) {
    if (target.kind === "header") {
      headerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const el = rowRefs.current.get(target.lineId);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    dispatch({ type: "SET_HIGHLIGHT", lineId: target.lineId });
    setTimeout(() => dispatch({ type: "SET_HIGHLIGHT", lineId: null }), 1400);
  }

  const errors = summary.errors;

  function commit() {
    if (errors > 0) return;
    dispatch({ type: "SET_STEP", step: "saving" });
  }

  return (
    <div className="flex h-full min-h-[560px] flex-1 flex-col gap-3">
      <PageHeader
        title={`Review ${selectedInvoice.invoiceNumber}`}
        description={`${selectedInvoice.supplierName} · ${selectedInvoice.lines.length} extracted line${selectedInvoice.lines.length === 1 ? "" : "s"}`}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch({ type: "SET_STEP", step: "queue" })}
        >
          <ArrowLeft className="size-3.5" />
          Back to queue
        </Button>
        <div className="hidden items-center gap-3 px-2 text-xs text-subtle md:flex">
          <span>Computed total</span>
          <span
            className={cn(
              "tabular-nums",
              Math.abs(computedTotal - selectedInvoice.declaredTotal) > 0.05
                ? "text-danger-fg"
                : "text-ink",
            )}
            data-financial
          >
            {formatCurrency(computedTotal, selectedInvoice.currency)}
          </span>
          <span className="text-subtle">of</span>
          <span className="tabular-nums text-ink" data-financial>
            {formatCurrency(selectedInvoice.declaredTotal, selectedInvoice.currency)}
          </span>
        </div>
        <Button
          size="sm"
          data-reel="save"
          onClick={commit}
          disabled={summary.errors > 0}
        >
          <Save className="size-3.5" />
          {summary.errors > 0 ? "Resolve errors to save" : "Save invoice"}
        </Button>
      </PageHeader>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="min-h-0 lg:sticky lg:top-0">
          <PdfPreview invoice={selectedInvoice} />
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
          <IssueBar
            summary={summary}
            lines={selectedInvoice.lines}
            onJump={jump}
          />

          <div ref={headerRef}>
            <InvoiceHeader invoice={selectedInvoice} />
          </div>

          <LineItemsTable
            invoice={selectedInvoice}
            summary={summary}
            registerRow={(id, el) => {
              if (el) rowRefs.current.set(id, el);
              else rowRefs.current.delete(id);
            }}
          />

          <NonInventorySection invoice={selectedInvoice} />

          <InvoiceTotals
            invoice={selectedInvoice}
            computedTotal={computedTotal}
          />
        </div>
      </div>
    </div>
  );
}

function InvoiceTotals({
  invoice,
  computedTotal,
}: {
  invoice: { declaredTotal: number; currency: string };
  computedTotal: number;
}) {
  const delta = Number((invoice.declaredTotal - computedTotal).toFixed(2));
  const matches = Math.abs(delta) <= 0.05;

  return (
    <section className="rounded-md border border-border-default bg-card">
      <header className="border-b border-border-soft px-4 py-2.5">
        <h2 className="text-sm font-medium text-ink">Totals</h2>
      </header>
      <div className="px-4 py-3 text-sm">
        <Row label="Inventory + non-inventory">
          <span className="tabular-nums text-ink" data-financial>
            {formatCurrency(computedTotal, invoice.currency)}
          </span>
        </Row>
        <Row label="Declared on invoice">
          <span className="tabular-nums text-ink" data-financial>
            {formatCurrency(invoice.declaredTotal, invoice.currency)}
          </span>
        </Row>
        <div className="my-2 h-px bg-border-soft" />
        <Row
          label="Difference"
          accent={matches ? "ok" : "error"}
        >
          <span
            className={cn(
              "tabular-nums",
              matches ? "text-success-fg" : "text-danger-fg",
            )}
            data-financial
          >
            {matches
              ? formatCurrency(0, invoice.currency)
              : `${delta > 0 ? "+" : "−"}${formatCurrency(Math.abs(delta), invoice.currency)}`}
          </span>
        </Row>
      </div>
    </section>
  );
}

function Row({
  label,
  children,
  accent,
}: {
  label: string;
  children: React.ReactNode;
  accent?: "ok" | "error";
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span
        className={cn(
          "text-subtle",
          accent === "ok" && "text-success-fg",
          accent === "error" && "text-danger-fg font-medium",
        )}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
