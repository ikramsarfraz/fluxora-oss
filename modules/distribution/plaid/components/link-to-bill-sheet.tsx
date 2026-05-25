"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  getOpenBillsForLinkingAction,
  getOpenSalesInvoicesForLinkingAction,
  linkTransactionToBillAction,
  linkTransactionToSalesInvoiceAction,
  markAsNonBillExpenseAction,
} from "../actions";
import type { ActivityTransaction } from "../services/bank-activity";

// ── Types ──────────────────────────────────────────────────────────────────

type Proximity = "exact" | "5pct" | "15pct" | "all";

type Bill = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  // For AP rows, the supplier name. For AR rows, the customer name.
  // Kept on the same field so the rendering loop doesn't have to branch.
  supplierName: string | null;
  // AP has lineCount; AR has none — UI hides the chip when 0.
  lineCount: number;
  delta: number;
  deltaPct: number;
};

const PROXIMITY_OPTIONS: { key: Proximity; label: string }[] = [
  { key: "exact", label: "Exact" },
  { key: "5pct", label: "±5%" },
  { key: "15pct", label: "±15%" },
  { key: "all", label: "All open" },
];

// ── Component ──────────────────────────────────────────────────────────────

interface LinkToBillSheetProps {
  txn: ActivityTransaction;
  open: boolean;
  onClose: () => void;
}

export function LinkToBillSheet({ txn, open, onClose }: LinkToBillSheetProps) {
  const router = useRouter();
  // Direction is derived from the txn amount sign. Positive = outflow
  // (we paid a bill, AP path). Negative = inflow (a customer paid us,
  // AR path). The dialog branches its action calls + labels accordingly.
  const isInflow = txn.amount < 0;
  const [proximity, setProximity] = useState<Proximity>("exact");
  const [bills, setBills] = useState<Bill[]>([]);
  const [transactionAmount, setTransactionAmount] = useState(Math.abs(txn.amount));
  const [counts, setCounts] = useState<Record<Proximity, number>>({ exact: 0, "5pct": 0, "15pct": 0, all: 0 });
  const [loading, setLoading] = useState(false);
  const [linking, startLink] = useTransition();

  useEffect(() => {
    if (!open) return;
    loadBills("exact");
    // Pre-load all counts so the toggle group can show count badges
    const loadCounts = async () => {
      const results = await Promise.all(
        (["exact", "5pct", "15pct", "all"] as Proximity[]).map(p =>
          (isInflow
            ? getOpenSalesInvoicesForLinkingAction(txn.id, p).then(r => r.invoices.length)
            : getOpenBillsForLinkingAction(txn.id, p).then(r => r.bills.length)
          ).then(n => [p, n] as const),
        ),
      );
      setCounts(Object.fromEntries(results) as Record<Proximity, number>);
    };
    loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, txn.id]);

  async function loadBills(p: Proximity) {
    setLoading(true);
    try {
      if (isInflow) {
        const result = await getOpenSalesInvoicesForLinkingAction(txn.id, p);
        setBills(
          result.invoices.map(inv => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: inv.invoiceDate,
            // For AR, "totalAmount" in the row UI represents the
            // applicable balance — what the user is matching against.
            totalAmount: inv.balanceDue,
            supplierName: inv.customerName,
            lineCount: 0,
            delta: inv.delta,
            deltaPct: inv.deltaPct,
          })),
        );
        setTransactionAmount(result.transactionAmount);
      } else {
        const result = await getOpenBillsForLinkingAction(txn.id, p);
        setBills(result.bills);
        setTransactionAmount(result.transactionAmount);
      }
    } catch {
      toast.error(isInflow ? "Failed to load invoices." : "Failed to load bills.");
    } finally {
      setLoading(false);
    }
  }

  function handleProximityChange(p: Proximity) {
    setProximity(p);
    loadBills(p);
  }

  function handleLink(rowId: string) {
    startLink(async () => {
      try {
        if (isInflow) {
          await linkTransactionToSalesInvoiceAction(txn.id, rowId);
          toast.success("Transaction linked. Payment recorded against the invoice.");
        } else {
          await linkTransactionToBillAction(txn.id, rowId);
          toast.success("Transaction linked. Bill marked as paid.");
        }
        onClose();
        router.refresh();
      } catch {
        toast.error("Failed to link transaction.");
      }
    });
  }

  function handleMarkNonBill() {
    startLink(async () => {
      try {
        await markAsNonBillExpenseAction(txn.id);
        toast.info("Marked as non-bill expense.");
        onClose();
        router.refresh();
      } catch {
        toast.error("Failed to mark.");
      }
    });
  }

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

  const methodLabel = (txn.paymentMethod ?? txn.paymentChannel).toUpperCase().replace("_", " ");
  const isCheck = txn.paymentMethod === "check";
  const isZelle = txn.paymentMethod === "zelle";

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle className="text-base">
            {isInflow
              ? "Link this deposit to an invoice"
              : "Link this payment to a bill"}
          </DialogTitle>
          <DialogDescription>
            {isInflow
              ? "Choose which open invoice this bank deposit pays. We'll record an AR payment and update the invoice's balance."
              : "Choose which open bill this bank transaction paid."}
          </DialogDescription>
        </DialogHeader>

        {/* Transaction context */}
        <div className="flex items-start justify-between gap-3 border-y border-divider bg-divider/40 px-5 py-3">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-ink">
              {txn.merchantName ?? txn.rawDescription.substring(0, 36)}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-subtle">
              <span className="rounded bg-card px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-warm">
                {methodLabel}
              </span>
              <span>{txn.accountName}{txn.accountMask ? ` ···${txn.accountMask}` : ""}</span>
              <span>·</span>
              <span>{new Date(txn.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </div>
            {(isCheck || isZelle) && (
              <div className="mt-1.5 text-[11px] italic text-subtle">
                {isCheck
                  ? "Banks don't include payee info on check transactions — link manually."
                  : "Zelle transactions often omit payee — confirm the correct bill below."}
              </div>
            )}
          </div>
          <div className="shrink-0 font-mono text-lg font-bold tabular-nums text-ink">
            {fmt(transactionAmount)}
          </div>
        </div>

        {/* Filter chips — ToggleGroup matching the bank-activity filter tabs */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <span className="text-[11px] text-subtle">
            {isInflow ? "Show invoices within" : "Show bills within"}
          </span>
          <ToggleGroup
            type="single"
            value={proximity}
            onValueChange={value => {
              if (value) handleProximityChange(value as Proximity);
            }}
            spacing={1}
            variant="default"
            size="sm"
            className="rounded-md bg-divider p-0.5"
          >
            {PROXIMITY_OPTIONS.map(({ key, label }) => (
              <ToggleGroupItem
                key={key}
                value={key}
                className="h-7 gap-1.5 rounded px-2.5 text-xs font-normal text-subtle shadow-none hover:bg-transparent hover:text-ink data-[state=on]:border data-[state=on]:border-border-default data-[state=on]:bg-card data-[state=on]:font-medium data-[state=on]:text-ink data-[state=on]:shadow-xs"
              >
                {label}
                <span className="rounded-full bg-divider/80 px-1.5 py-0.5 text-[10px] tabular-nums text-subtle">
                  {counts[key] ?? "…"}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Bill list */}
        <div className="flex-1 overflow-y-auto border-t border-divider">
          {loading ? (
            <div className="px-5 py-10 text-center text-[13px] text-subtle">
              Loading…
            </div>
          ) : bills.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
              <div className="text-[13px] text-subtle">
                {isInflow ? "No invoices in this range." : "No bills in this range."}
              </div>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-[13px]"
                onClick={() => handleProximityChange("all")}
              >
                {isInflow ? "Show all open invoices →" : "Show all open bills →"}
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-divider">
              {bills.map(bill => {
                const isExact = Math.abs(bill.delta) < transactionAmount * 0.001;
                return (
                  <li
                    key={bill.id}
                    className={`grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 ${
                      isExact
                        ? "border-l-[3px] border-l-success-fg bg-success-bg/40"
                        : "border-l-[3px] border-l-transparent"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                        <span className="truncate">
                          {bill.supplierName ?? (isInflow ? "Unknown customer" : "Unknown supplier")}
                        </span>
                        {isExact && (
                          <span className="shrink-0 rounded bg-success-fg px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-card">
                            exact match
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-subtle">
                        <span className="font-mono">{bill.invoiceNumber}</span>
                        {bill.lineCount > 0 ? (
                          <>
                            <span>·</span>
                            <span>{bill.lineCount} line{bill.lineCount !== 1 ? "s" : ""}</span>
                          </>
                        ) : null}
                        <span>·</span>
                        <span>
                          {isInflow ? "issued" : "due"}{" "}
                          {new Date(bill.invoiceDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="font-mono text-sm font-bold tabular-nums text-ink">
                        {fmt(bill.totalAmount)}
                      </div>
                      {!isExact && (
                        <div className="font-mono text-[10.5px] tabular-nums text-subtle">
                          {bill.delta > 0 ? "+" : ""}
                          {fmt(bill.delta)} · {Math.abs(bill.deltaPct).toFixed(1)}% off
                        </div>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        disabled={linking}
                        onClick={() => handleLink(bill.id)}
                        className="h-7 px-3 text-xs"
                      >
                        Link →
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-divider px-5 py-3 sm:flex-row sm:justify-between">
          <Button variant="link" asChild className="h-auto p-0 text-xs">
            <a href={isInflow ? "/invoices?status=sent" : "/supplier-invoices?status=open"}>
              {isInflow ? "Browse all open invoices →" : "Browse all open bills →"}
            </a>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleMarkNonBill}
            disabled={linking}
            className="h-7 px-3 text-xs text-subtle"
          >
            Mark as non-bill expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
