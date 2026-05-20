"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getOpenBillsForLinkingAction,
  getOpenSalesInvoicesForLinkingAction,
  linkTransactionToBillAction,
  linkTransactionToSalesInvoiceAction,
} from "../actions";
import type { ActivityTransaction } from "../services/bank-activity";

// ── Design tokens ──────────────────────────────────────────────────────────

const C = {
  ink: "var(--color-ink)",
  ink2: "var(--color-ink-warm)",
  muted: "var(--color-subtle)",
  surface: "var(--color-card)",
  line: "var(--color-border-default)",
  line2: "var(--color-divider)",
  good: "var(--color-success-fg)",
  goodSoft: "var(--color-success-bg)",
  goodBorder: "oklch(85% 0.08 155)",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

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
  // AR path). The sheet branches its action calls + labels accordingly.
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
    // Pre-load all counts
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
          toast.success(
            "Transaction linked. Payment recorded against the invoice.",
          );
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

  if (!open) return null;

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

  const methodLabel = (txn.paymentMethod ?? txn.paymentChannel).toUpperCase().replace("_", " ");
  const isCheck = txn.paymentMethod === "check";
  const isZelle = txn.paymentMethod === "zelle";

  return (
    // Backdrop
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Sheet */}
      <div
        style={{
          background: C.surface, borderRadius: "16px 16px 0 0", width: "100%",
          maxWidth: 640, maxHeight: "85vh", display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>
              {isInflow
                ? "Link this deposit to an invoice"
                : "Link this payment to a bill"}
            </span>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 18, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>
            {isInflow
              ? "Choose which open invoice this bank deposit pays. We'll record an AR payment and update the invoice's balance."
              : "Choose which open bill this bank transaction paid."}
          </div>
        </div>

        {/* Transaction context */}
        <div style={{ padding: "12px 22px", background: C.line2, borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {txn.merchantName ?? txn.rawDescription.substring(0, 36)}
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1, display: "flex", gap: 6 }}>
                <span style={{ background: C.line, padding: "1px 6px", borderRadius: 4, fontFamily: C.mono }}>
                  {methodLabel}
                </span>
                <span>{txn.accountName}{txn.accountMask ? ` ···${txn.accountMask}` : ""}</span>
                <span>{new Date(txn.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
              {(isCheck || isZelle) && (
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontStyle: "italic" }}>
                  {isCheck
                    ? "Banks don't include payee info on check transactions — link manually."
                    : "Zelle transactions often omit payee — confirm the correct bill below."}
                </div>
              )}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: C.mono, color: C.ink }}>
              {fmt(transactionAmount)}
            </div>
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ padding: "10px 22px", borderBottom: `1px solid ${C.line}`, display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.muted, marginRight: 4 }}>
            {isInflow ? "Show invoices within:" : "Show bills within:"}
          </span>
          {([
            { key: "exact", label: "Exact match" },
            { key: "5pct", label: "±5%" },
            { key: "15pct", label: "±15%" },
            { key: "all", label: "All open" },
          ] as { key: Proximity; label: string }[]).map(({ key, label }) => {
            const active = proximity === key;
            return (
              <button
                key={key}
                onClick={() => handleProximityChange(key)}
                style={{
                  padding: "3px 10px", borderRadius: 100, fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  border: `1px solid ${active ? C.ink : C.line}`,
                  background: active ? C.ink : C.surface,
                  color: active ? "var(--color-card)" : C.ink2,
                  cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 5,
                }}
              >
                {label}
                <span style={{ fontSize: 10, opacity: 0.75 }}>{counts[key] ?? "…"}</span>
              </button>
            );
          })}
        </div>

        {/* Bill list */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ padding: "28px 22px", textAlign: "center", color: C.muted, fontSize: 13 }}>
              Loading…
            </div>
          ) : bills.length === 0 ? (
            <div style={{ padding: "28px 22px", textAlign: "center", color: C.muted, fontSize: 13 }}>
              {isInflow ? "No invoices in this range." : "No bills in this range."}{" "}
              <button
                onClick={() => handleProximityChange("all")}
                style={{ color: "var(--color-forest-mid)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}
              >
                {isInflow ? "Show all open invoices →" : "Show all open bills →"}
              </button>
            </div>
          ) : (
            bills.map((bill, i) => {
              const isExact = Math.abs(bill.delta) < transactionAmount * 0.001;
              return (
                <div
                  key={bill.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    padding: "12px 22px",
                    borderBottom: i < bills.length - 1 ? `1px solid ${C.line2}` : "none",
                    background: isExact ? C.goodSoft : C.surface,
                    borderLeft: isExact ? `3px solid ${C.good}` : "3px solid transparent",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      {bill.supplierName ?? (isInflow ? "Unknown customer" : "Unknown supplier")}
                      {isExact && (
                        <span style={{ fontSize: 10.5, background: C.good, color: "var(--color-card)", padding: "1px 6px", borderRadius: 4 }}>
                          exact match
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1, display: "flex", gap: 6 }}>
                      <span style={{ fontFamily: C.mono }}>{bill.invoiceNumber}</span>
                      {bill.lineCount > 0 ? (
                        <>
                          <span>·</span>
                          <span>{bill.lineCount} line{bill.lineCount !== 1 ? "s" : ""}</span>
                        </>
                      ) : null}
                      <span>·</span>
                      <span>{isInflow ? "issued" : "due"} {new Date(bill.invoiceDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: C.mono }}>
                      {fmt(bill.totalAmount)}
                    </div>
                    {!isExact && (
                      <div style={{ fontSize: 10.5, color: C.muted, fontFamily: C.mono }}>
                        {bill.delta > 0 ? "+" : ""}{fmt(bill.delta)} · {Math.abs(bill.deltaPct).toFixed(1)}% off
                      </div>
                    )}
                    <button
                      disabled={linking}
                      onClick={() => handleLink(bill.id)}
                      style={{
                        marginTop: 6, padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        border: "none", cursor: linking ? "not-allowed" : "pointer",
                        background: isExact ? C.good : C.ink, color: "var(--color-card)",
                        fontFamily: "inherit",
                      }}
                    >
                      Link →
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 22px", borderTop: `1px solid ${C.line}`, display: "flex", gap: 12, alignItems: "center" }}>
          <a
            href={isInflow ? "/invoices?status=sent" : "/supplier-invoices?status=open"}
            style={{ fontSize: 12, color: "var(--color-forest-mid)", textDecoration: "none" }}
          >
            {isInflow ? "Browse all open invoices →" : "Browse all open bills →"}
          </a>
          <span style={{ color: C.line, fontSize: 14 }}>|</span>
          <button
            onClick={() => {
              startLink(async () => {
                try {
                  await markAsNonBillExpense(txn.id);
                  toast.info("Marked as non-bill expense.");
                  onClose();
                  router.refresh();
                } catch {
                  toast.error("Failed to mark.");
                }
              });
            }}
            style={{ fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            Mark as non-bill expense
          </button>
        </div>
      </div>
    </div>
  );
}

// The footer non-bill expense is a client-side action so import it
async function markAsNonBillExpense(txnId: string) {
  const { markAsNonBillExpenseAction } = await import("../actions");
  return markAsNonBillExpenseAction(txnId);
}
