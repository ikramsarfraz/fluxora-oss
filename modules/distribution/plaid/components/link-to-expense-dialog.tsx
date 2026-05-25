"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
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
  getOpenExpensesForLinkingAction,
  linkTransactionToExpenseAction,
} from "../actions";
import type { ActivityTransaction } from "../services/bank-activity";

// ── Types ──────────────────────────────────────────────────────────────────

type Proximity = "exact" | "5pct" | "15pct" | "all";

type ExpenseCandidate = {
  id: string;
  expenseDate: string;
  category: string;
  amount: number;
  note: string | null;
  paymentMethod: string | null;
  createdByName: string | null;
  delta: number;
  deltaPct: number;
};

const PROXIMITY_OPTIONS: { key: Proximity; label: string }[] = [
  { key: "exact", label: "Exact" },
  { key: "5pct", label: "±5%" },
  { key: "15pct", label: "±15%" },
  { key: "all", label: "All recent" },
];

// ── Component ──────────────────────────────────────────────────────────────

interface LinkToExpenseDialogProps {
  txn: ActivityTransaction;
  open: boolean;
  onClose: () => void;
}

export function LinkToExpenseDialog({ txn, open, onClose }: LinkToExpenseDialogProps) {
  const router = useRouter();
  const [proximity, setProximity] = useState<Proximity>("exact");
  const [candidates, setCandidates] = useState<ExpenseCandidate[]>([]);
  const [transactionAmount, setTransactionAmount] = useState(Math.abs(txn.amount));
  const [counts, setCounts] = useState<Record<Proximity, number>>({ exact: 0, "5pct": 0, "15pct": 0, all: 0 });
  const [loading, setLoading] = useState(false);
  const [linking, startLink] = useTransition();

  useEffect(() => {
    if (!open) return;
    loadCandidates("exact");
    const loadCounts = async () => {
      const results = await Promise.all(
        (["exact", "5pct", "15pct", "all"] as Proximity[]).map(p =>
          getOpenExpensesForLinkingAction(txn.id, p).then(
            r => [p, r.expenses.length] as const,
          ),
        ),
      );
      setCounts(Object.fromEntries(results) as Record<Proximity, number>);
    };
    loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, txn.id]);

  async function loadCandidates(p: Proximity) {
    setLoading(true);
    try {
      const result = await getOpenExpensesForLinkingAction(txn.id, p);
      setCandidates(result.expenses);
      setTransactionAmount(result.transactionAmount);
    } catch {
      toast.error("Failed to load expenses.");
    } finally {
      setLoading(false);
    }
  }

  function handleProximityChange(p: Proximity) {
    setProximity(p);
    loadCandidates(p);
  }

  function handleLink(expenseId: string) {
    startLink(async () => {
      try {
        await linkTransactionToExpenseAction(txn.id, expenseId);
        toast.success("Transaction linked to expense.");
        onClose();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to link.");
      }
    });
  }

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  const methodLabel = (txn.paymentMethod ?? txn.paymentChannel).toUpperCase().replace("_", " ");

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle className="text-base">Link this payment to an expense</DialogTitle>
          <DialogDescription>
            Pick an expense you already recorded. Voided expenses and
            expenses already linked to another bank transaction are
            hidden.
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
          </div>
          <div className="shrink-0 font-mono text-lg font-bold tabular-nums text-ink">
            {fmt(transactionAmount)}
          </div>
        </div>

        {/* Proximity chips — matches the bank-activity filter tabs + link-to-bill */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <span className="text-[11px] text-subtle">Show expenses within</span>
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

        {/* Candidate list */}
        <div className="flex-1 overflow-y-auto border-t border-divider">
          {loading ? (
            <div className="px-5 py-10 text-center text-[13px] text-subtle">Loading…</div>
          ) : candidates.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
              <div className="text-[13px] text-subtle">
                No matching expenses in this range.
              </div>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-[13px]"
                onClick={() => handleProximityChange("all")}
              >
                Show all recent expenses →
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-divider">
              {candidates.map(c => {
                const isExact = Math.abs(c.delta) < transactionAmount * 0.001;
                return (
                  <li
                    key={c.id}
                    className={`grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 ${
                      isExact
                        ? "border-l-[3px] border-l-success-fg bg-success-bg/40"
                        : "border-l-[3px] border-l-transparent"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                        <span className="truncate">{c.note ?? c.category}</span>
                        {isExact && (
                          <span className="shrink-0 rounded bg-success-fg px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-card">
                            exact match
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-subtle">
                        <span>{c.category}</span>
                        {c.paymentMethod ? (
                          <>
                            <span>·</span>
                            <span className="font-mono uppercase">{c.paymentMethod}</span>
                          </>
                        ) : null}
                        <span>·</span>
                        <span>
                          {new Date(c.expenseDate + "T00:00:00").toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        {c.createdByName ? (
                          <>
                            <span>·</span>
                            <span>by {c.createdByName}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="font-mono text-sm font-bold tabular-nums text-ink">
                        {fmt(c.amount)}
                      </div>
                      {!isExact && (
                        <div className="font-mono text-[10.5px] tabular-nums text-subtle">
                          {c.delta > 0 ? "+" : ""}
                          {fmt(c.delta)} · {Math.abs(c.deltaPct).toFixed(1)}% off
                        </div>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        disabled={linking}
                        onClick={() => handleLink(c.id)}
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
            <Link href="/expenses">Browse all expenses →</Link>
          </Button>
          <span />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
