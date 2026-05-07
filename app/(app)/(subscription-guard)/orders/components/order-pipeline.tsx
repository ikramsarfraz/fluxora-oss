"use client";

import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type OrderPipelineStep =
  | "draft"
  | "confirmed"
  | "fulfilled"
  | "invoiced"
  | "paid";

export interface OrderPipelineProps {
  status: string;
  hasInvoice: boolean;
  isPaid: boolean;
  readyToInvoice?: boolean;
}

const STEPS: Array<{ id: OrderPipelineStep; label: string }> = [
  { id: "draft", label: "Draft" },
  { id: "confirmed", label: "Confirmed" },
  { id: "fulfilled", label: "Fulfilled" },
  { id: "invoiced", label: "Invoiced" },
  { id: "paid", label: "Paid" },
];

export function getCurrentStep({
  status,
  hasInvoice,
  isPaid,
  readyToInvoice,
}: OrderPipelineProps): OrderPipelineStep {
  if (isPaid) return "paid";
  if (hasInvoice) return "invoiced";
  if (readyToInvoice || status === "fulfilled") return "fulfilled";
  if (status === "confirmed") return "confirmed";
  return "draft";
}

export function OrderPipeline({
  status,
  hasInvoice,
  isPaid,
  readyToInvoice,
}: OrderPipelineProps) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <X className="h-3 w-3" />
        </span>
        <span className="font-medium text-destructive">Order cancelled</span>
        <span className="text-muted-foreground">
          — allocated inventory has been released.
        </span>
      </div>
    );
  }

  const current = getCurrentStep({ status, hasInvoice, isPaid, readyToInvoice });
  const currentIdx = STEPS.findIndex(s => s.id === current);

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isLast = idx === STEPS.length - 1;
        return (
          <div key={step.id} className="flex items-center gap-1">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium",
                  isCompleted &&
                    "border-primary bg-primary text-primary-foreground",
                  isCurrent &&
                    "border-primary bg-primary/10 text-primary ring-2 ring-primary/20",
                  !isCompleted &&
                    !isCurrent &&
                    "border-border bg-background text-muted-foreground",
                )}
              >
                {isCompleted ? <Check className="h-3 w-3" /> : idx + 1}
              </span>
              <span
                className={cn(
                  "text-sm",
                  isCurrent && "font-semibold text-foreground",
                  isCompleted && "text-foreground",
                  !isCompleted && !isCurrent && "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <span
                className={cn(
                  "mx-2 h-px w-8 sm:w-12",
                  isCompleted ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
