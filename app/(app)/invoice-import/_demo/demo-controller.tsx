"use client";

import { ChevronLeft, ChevronRight, RotateCcw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { useDemo } from "./state";
import { DEMO_STEPS } from "./types";
import type { DemoStep } from "./types";

const ORDER: DemoStep[] = ["inventory", "upload", "scanning", "queue", "review", "saving", "saved"];

export function DemoController() {
  const { state, dispatch, selectedInvoice } = useDemo();
  const idx = ORDER.indexOf(state.step);
  const meta = DEMO_STEPS.find((s) => s.id === state.step) ?? DEMO_STEPS[0];
  const canPrev = idx > 0;
  const canNext = idx < ORDER.length - 1 && canAdvance(state.step, selectedInvoice != null, state.files.length > 0);

  function next() {
    if (!canNext) return;
    const target = ORDER[idx + 1];
    // From queue → review: also select the first invoice if not selected
    if (target === "review" && !selectedInvoice && state.invoices.length > 0) {
      dispatch({ type: "SELECT_INVOICE", invoiceId: state.invoices[0].id });
    }
    // From saving → saved (skipping animation): make sure commit ran so the
    // inventory post-state shows the banner and recently-updated indicators.
    if (state.step === "saving" && target === "saved" && selectedInvoice && !state.saveSummary) {
      dispatch({ type: "COMMIT_INVOICE", invoiceId: selectedInvoice.id });
    }
    dispatch({ type: "SET_STEP", step: target });
  }

  function prev() {
    if (!canPrev) return;
    dispatch({ type: "SET_STEP", step: ORDER[idx - 1] });
  }

  return (
    <div
      className={cn(
        "fixed right-4 bottom-4 z-50",
        "flex items-center gap-2 rounded-full",
        "border border-border-default bg-card-warm shadow-lg",
        "pl-3 pr-1 py-1",
      )}
      data-demo-controller
    >
      <div className="flex items-center gap-2 pr-1">
        <Sparkles className="size-3.5 text-forest-mid" aria-hidden />
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
          Demo
        </span>
        <span className="text-xs text-ink-warm">
          Step {meta.index} of {meta.total}
        </span>
        <span className="text-xs text-subtle">— {meta.label}</span>
      </div>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={prev}
              disabled={!canPrev}
              aria-label="Previous step"
            >
              <ChevronLeft />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous step</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={next}
              disabled={!canNext}
              aria-label="Next step"
            >
              <ChevronRight />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {canNext ? "Next step" : guardedHint(state.step)}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => dispatch({ type: "RESTART" })}
              aria-label="Restart demo"
            >
              <RotateCcw />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Restart demo</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function canAdvance(step: DemoStep, hasInvoice: boolean, hasFiles: boolean): boolean {
  switch (step) {
    case "inventory":
      return true;
    case "upload":
      return hasFiles;
    case "scanning":
      return true;
    case "queue":
      return hasInvoice;
    case "review":
      return hasInvoice;
    case "saving":
      return true;
    case "saved":
      return false;
  }
}

function guardedHint(step: DemoStep): string {
  switch (step) {
    case "upload":
      return "Add a file to continue";
    case "queue":
      return "Open an invoice to continue";
    default:
      return "End of demo";
  }
}
