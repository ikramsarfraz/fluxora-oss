"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  confirmPaymentMatch,
  rejectPaymentMatch,
  syncAllConnectionsAction,
} from "../actions";
import { LinkToBillSheet } from "./link-to-bill-sheet";
import type { getBankActivity } from "../services/bank-activity";

type Data = Awaited<ReturnType<typeof getBankActivity>>;
type Transaction = Data["transactions"][number];

const C = {
  ink: "var(--color-ink)",
  ink2: "var(--color-ink-warm)",
  muted: "var(--color-subtle)",
  surface: "var(--color-card)",
  line: "var(--color-border-default)",
  line2: "var(--color-divider)",
  good: "var(--color-success-fg)",
  goodSoft: "var(--color-success-bg)",
  warn: "var(--color-warning-fg)",
  warnSoft: "var(--color-warning-bg)",
  info: "var(--color-info-fg)",
  infoSoft: "var(--color-info-bg)",
  radius: "10px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

type Filter = "all" | "matched" | "pending_review" | "unmatched" | "pending" | "mystery";

export function BankActivityShell({ data }: { data: Data }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [searchText, setSearchText] = useState("");
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();
  const [syncing, startSync] = useTransition();

  const handleSync = () => {
    startSync(async () => {
      try {
        const result = await syncAllConnectionsAction();
        if (result.synced === 0 && result.failed === 0) {
          toast.info("No active bank connections to sync.");
        } else if (result.failed > 0) {
          toast.warning(
            `Synced ${result.synced} bank${result.synced === 1 ? "" : "s"}, ${result.failed} failed. Check connection status.`,
          );
        } else {
          const totalChanges = result.totalAdded + result.totalModified + result.totalRemoved;
          toast.success(
            totalChanges > 0
              ? `Synced ${result.synced} bank${result.synced === 1 ? "" : "s"}: ${result.totalAdded} new, ${result.totalModified} updated.`
              : `Synced ${result.synced} bank${result.synced === 1 ? "" : "s"}. No new transactions.`,
          );
        }
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Sync failed.");
      }
    });
  };

  // Re-auth banner: dedupe by institutionName so two accounts at the same
  // bank don't render two banners.
  const needsReauthInstitutions = Array.from(
    new Map(
      data.accounts
        .filter(a => a.connectionStatus === "requires_reauth")
        .map(a => [a.institutionName ?? "Bank", a]),
    ).values(),
  );

  const accountFiltered = accountFilter
    ? data.transactions.filter(t => t.accountId === accountFilter)
    : data.transactions;

  const stateFiltered = filter === "all"
    ? accountFiltered
    : filter === "pending"
      ? accountFiltered.filter(t => t.pending)
      : filter === "mystery"
        ? accountFiltered.filter(t => t.isMysteryOutflow && !t.pending)
        : accountFiltered.filter(t => t.state === filter);

  const q = searchText.trim().toLowerCase();
  const visible = q === ""
    ? stateFiltered
    : stateFiltered.filter(t => {
        const merchant = (t.merchantName ?? "").toLowerCase();
        const desc = (t.rawDescription ?? "").toLowerCase();
        const invoiceNum = (t.match?.invoice.invoiceNumber ?? "").toLowerCase();
        return merchant.includes(q) || desc.includes(q) || invoiceNum.includes(q);
      });

  const lastSync = data.lastSyncAt
    ? timeSince(new Date(data.lastSyncAt))
    : "never";

  const totalBalance = data.accounts.reduce((s, a) => s + a.currentBalance, 0);
  const noConnections = data.accounts.length === 0;

  if (noConnections) {
    return (
      <div style={{ fontFamily: "'Geist', system-ui, sans-serif", color: C.ink, lineHeight: "1.5" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Bank activity</h1>
        </div>
        <div
          style={{
            border: `1px dashed ${C.line}`,
            borderRadius: C.radius,
            padding: "48px 32px",
            textAlign: "center",
            background: C.surface,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
            Connect your bank to get started
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, maxWidth: 420, margin: "0 auto 20px" }}>
            Once linked, we&apos;ll sync 90 days of transactions and start
            matching outflows against your open bills automatically.
          </div>
          <Link href="/settings/integrations/banks">
            <Button size="sm" className="h-9 px-4 text-[13px]">
              Connect a bank
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Geist', system-ui, sans-serif", color: C.ink, lineHeight: "1.5" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Bank activity</h1>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
            Synced {lastSync}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="h-8 px-3 text-[13px]"
          >
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
          <Link href="/settings/integrations/banks">
            <Button variant="outline" size="sm" className="h-8 px-3 text-[13px]">
              Manage banks
            </Button>
          </Link>
        </div>
      </div>

      {/* Re-auth banner — one row per institution that needs reconnecting */}
      {needsReauthInstitutions.length > 0 && (
        <div
          style={{
            border: `1px solid ${C.warn}`,
            background: C.warnSoft,
            borderRadius: C.radius,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.5 }}>
            <strong style={{ color: C.warn }}>Reconnect required:</strong>{" "}
            {needsReauthInstitutions.map(a => a.institutionName ?? "Bank").join(", ")}
            {" — "}new transactions won&apos;t sync until you sign in again.
          </div>
          <Link href="/settings/integrations/banks">
            <Button size="sm" className="h-8 px-3 text-[13px]">
              Reconnect
            </Button>
          </Link>
        </div>
      )}

      {/* Accounts strip — tiles are click-to-filter */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto", marginBottom: 24, paddingBottom: 4 }}>
        {/* Total cash card — also clears the account filter */}
        <button
          type="button"
          onClick={() => setAccountFilter(null)}
          aria-pressed={accountFilter === null}
          title={accountFilter ? "Clear account filter" : undefined}
          style={{
            flexShrink: 0,
            background: "#1c1917",
            border: accountFilter === null ? "2px solid var(--color-success-fg)" : "2px solid transparent",
            borderRadius: C.radius,
            padding: "14px 18px",
            minWidth: 160,
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "inherit",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
            Total cash
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-card)", fontFamily: C.mono }}>
            ${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 4 }}>
            {data.accounts.length} account{data.accounts.length !== 1 ? "s" : ""}
          </div>
        </button>

        {data.accounts.map(account => {
          const health = accountHealth(account.connectionStatus, account.lastSyncAt);
          const active = accountFilter === account.id;
          return (
          <button
            key={account.id}
            type="button"
            onClick={() => setAccountFilter(active ? null : account.id)}
            aria-pressed={active}
            title={active ? "Click to clear filter" : "Click to filter to this account"}
            style={{
              flexShrink: 0,
              border: active ? `2px solid var(--color-success-fg)` : `2px solid ${C.line}`,
              borderRadius: C.radius,
              padding: "14px 18px",
              background: C.surface,
              minWidth: 150,
              cursor: "pointer",
              textAlign: "left",
              fontFamily: "inherit",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: C.muted,
                fontWeight: 500,
                marginBottom: 4,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                aria-hidden
                title={health.tooltip}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: health.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {account.institutionName ?? "Bank"}
              </span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, fontFamily: C.mono, color: C.ink }}>
              ${account.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {account.name}
              {account.mask ? ` ···${account.mask}` : ""}
            </div>
          </button>
        );
        })}

        <Link href="/settings/integrations/banks" style={{ textDecoration: "none" }}>
          <div
            style={{
              flexShrink: 0,
              border: `1px dashed ${C.line}`,
              borderRadius: C.radius,
              padding: "14px 18px",
              background: C.surface,
              minWidth: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.muted,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            + Add another
          </div>
        </Link>
      </div>

      {/* Filter chips + search */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(
          [
            { key: "all", label: "All", count: data.transactions.length },
            { key: "matched", label: "Matched", count: data.counts.matched },
            { key: "pending_review", label: "Pending review", count: data.counts.pending_review },
            { key: "unmatched", label: "Unmatched", count: data.counts.unmatched },
            { key: "pending", label: "Pending settlement", count: data.counts.pending },
            { key: "mystery", label: "Mystery", count: data.counts.mystery },
          ] as const
        ).map(({ key, label, count }) => {
          const isActive = filter === key;
          const isPending = key === "pending_review" && count > 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              style={{
                padding: "5px 12px",
                borderRadius: 100,
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                border: `1px solid ${isActive ? (isPending ? C.warn : C.ink) : C.line}`,
                background: isActive
                  ? isPending ? C.warnSoft : C.ink
                  : C.surface,
                color: isActive
                  ? isPending ? C.warn : "var(--color-card)"
                  : isPending ? C.warn : C.ink2,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {label}
              <span
                style={{
                  fontSize: 11,
                  background: isActive
                    ? "rgba(255,255,255,0.2)"
                    : isPending ? C.warn + "22" : C.line2,
                  padding: "1px 6px",
                  borderRadius: 100,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
        </div>
        <input
          type="search"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="Search merchant, description, invoice…"
          aria-label="Filter transactions"
          style={{
            fontSize: 13,
            padding: "6px 12px",
            border: `1px solid ${C.line}`,
            borderRadius: 6,
            background: C.surface,
            color: C.ink,
            minWidth: 260,
            outline: "none",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Transaction list */}
      {visible.length === 0 ? (
        <div
          style={{
            border: `1px dashed ${C.line}`,
            borderRadius: C.radius,
            padding: "40px",
            textAlign: "center",
            color: C.muted,
            fontSize: 13,
          }}
        >
          {q !== ""
            ? `No transactions match "${searchText}".`
            : "No transactions in this view."}
        </div>
      ) : (
        <div
          style={{
            border: `1px solid ${C.line}`,
            borderRadius: C.radius,
            overflow: "hidden",
          }}
        >
          {visible.map((txn, i) => (
            <TransactionRow
              key={txn.id}
              txn={txn}
              isLast={i === visible.length - 1}
              expanded={expandedId === txn.id}
              onToggle={() => setExpandedId(expandedId === txn.id ? null : txn.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TransactionRow({
  txn,
  isLast,
  expanded,
  onToggle,
}: {
  txn: Transaction;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [confirming, startConfirm] = useTransition();
  const [rejecting, startReject] = useTransition();
  const [linkSheetOpen, setLinkSheetOpen] = useState(false);
  const router = useRouter();

  const isOutflow = txn.amount > 0;
  const amountStr = `${isOutflow ? "-" : "+"}$${Math.abs(txn.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const isPendingReview = txn.state === "pending_review" && txn.match;
  const isUnmatched = txn.state === "unmatched" && isOutflow && !txn.pending;

  const handleConfirm = () => {
    if (!txn.match) return;
    startConfirm(async () => {
      try {
        await confirmPaymentMatch(txn.match!.id);
        toast.success("Match confirmed. Bill marked as paid.");
        router.refresh();
      } catch {
        toast.error("Failed to confirm match.");
      }
    });
  };

  const handleReject = () => {
    if (!txn.match) return;
    startReject(async () => {
      try {
        await rejectPaymentMatch(txn.match!.id);
        toast.success("Match dismissed.");
        router.refresh();
      } catch {
        toast.error("Failed to dismiss match.");
      }
    });
  };

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "28px 1fr auto auto auto",
          gap: 12,
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: isLast && !expanded ? "none" : `1px solid ${C.line2}`,
          background: expanded ? "var(--color-page)" : C.surface,
          cursor: isPendingReview ? "pointer" : undefined,
        }}
        onClick={isPendingReview ? onToggle : undefined}
      >
        {/* Status icon */}
        <StateIcon state={txn.state} pending={txn.pending} />

        {/* Payee + meta */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {txn.merchantName ?? txn.rawDescription.substring(0, 40)}
            </span>
            {txn.pending && (
              <span style={{ fontSize: 11, color: C.muted, background: C.line2, padding: "1px 6px", borderRadius: 100 }}>
                Pending settlement
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 1, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <span>{txn.rawDescription.substring(0, 40)}{txn.rawDescription.length > 40 ? "…" : ""}</span>
            <span>·</span>
            <span>{txn.accountName}{txn.accountMask ? ` ···${txn.accountMask}` : ""}</span>
            <span>·</span>
            <span style={{ fontWeight: 600, textTransform: "uppercase" }}>{txn.paymentMethod}</span>
            {txn.isMysteryOutflow && (
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-danger-fg)", background: "var(--color-danger-bg)", padding: "1px 5px", borderRadius: 4 }}>
                Mystery
              </span>
            )}
          </div>
        </div>

        {/* Match reference / channel note */}
        <div style={{ textAlign: "right", minWidth: 140 }}>
          {txn.match ? (
            <div>
              <Link
                href={`/supplier-invoices/${txn.match.invoice.id}`}
                style={{ fontSize: 12, color: C.info, textDecoration: "none", fontFamily: C.mono }}
                onClick={e => e.stopPropagation()}
              >
                {txn.match.invoice.invoiceNumber}
              </Link>
              <div style={{ fontSize: 11, marginTop: 1 }}>
                <ConfidenceBadge
                  confidence={txn.match.confidence}
                  autoApplied={txn.match.autoApplied}
                  paymentMethod={txn.paymentMethod}
                />
              </div>
            </div>
          ) : isUnmatched ? (
            <span style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
              {txn.paymentMethod === "check"
                ? "Banks don't include payee info on check transactions."
                : txn.paymentMethod === "zelle"
                  ? "No payee in Zelle record."
                  : "No match found."}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: C.muted }}>—</span>
          )}
        </div>

        {/* Amount */}
        <div
          style={{
            fontFamily: C.mono,
            fontSize: 13,
            fontWeight: 600,
            color: isOutflow ? C.ink : C.good,
            whiteSpace: "nowrap",
          }}
        >
          {amountStr}
        </div>

        {/* Action */}
        <div style={{ minWidth: 96, textAlign: "right" }} onClick={e => e.stopPropagation()}>
          {isPendingReview ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11, color: C.warn }}>
                {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: C.warn,
                  border: `1px solid ${C.warn}`,
                  borderRadius: 100,
                  padding: "2px 8px",
                  fontWeight: 500,
                }}
              >
                Review
              </span>
            </div>
          ) : txn.match ? (
            <Link href={`/supplier-invoices/${txn.match.invoice.id}`}>
              <span style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 3 }}>
                <ExternalLink size={11} />
                View
              </span>
            </Link>
          ) : isUnmatched ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
              <button
                type="button"
                onClick={() => setLinkSheetOpen(true)}
                style={{
                  padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: C.ink, color: "var(--color-card)", border: "none", cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Link to bill
              </button>
              <Link
                href={`/expenses/new?${new URLSearchParams({
                  date: txn.date,
                  amount: Math.abs(txn.amount).toFixed(2),
                  note: (txn.merchantName ?? txn.rawDescription).slice(0, 200),
                }).toString()}`}
                style={{ fontSize: 11, color: C.muted, textDecoration: "underline", textUnderlineOffset: "2px" }}
              >
                Mark as expense
              </Link>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: C.muted }}>—</span>
          )}
        </div>
      </div>

      {/* Expanded match detail */}
      {expanded && txn.match && (
        <MatchDetailBlock
          txn={txn}
          onConfirm={handleConfirm}
          onReject={handleReject}
          confirming={confirming}
          rejecting={rejecting}
        />
      )}

      {/* Link-to-bill sheet */}
      <LinkToBillSheet
        txn={txn}
        open={linkSheetOpen}
        onClose={() => setLinkSheetOpen(false)}
      />
    </>
  );
}

function MatchDetailBlock({
  txn,
  onConfirm,
  onReject,
  confirming,
  rejecting,
}: {
  txn: Transaction;
  onConfirm: () => void;
  onReject: () => void;
  confirming: boolean;
  rejecting: boolean;
}) {
  const match = txn.match!;
  const factors = [
    {
      label: "Amount",
      score: match.amountScore,
      detail: match.amountScore >= 0.99 ? "Exact match" : match.amountScore >= 0.9 ? "Near match (fees)" : "Approximate",
      icon: match.amountScore >= 0.9 ? "✓" : "⚠",
      good: match.amountScore >= 0.9,
    },
    {
      label: "Payee",
      score: match.payeeScore,
      detail: match.payeeScore >= 0.95 ? "Known alias" : match.payeeScore >= 0.8 ? "Likely match" : "Fuzzy match",
      icon: match.payeeScore >= 0.8 ? "✓" : "⚠",
      good: match.payeeScore >= 0.8,
    },
    {
      label: "Timing",
      score: match.timingScore,
      detail: match.timingScore >= 0.95
        ? "On due date"
        : match.timingScore >= 0.6
          ? "Within 30 days"
          : "Late payment",
      icon: match.timingScore >= 0.6 ? "✓" : "⚠",
      good: match.timingScore >= 0.6,
    },
  ];

  return (
    <div
      style={{
        background: C.warnSoft,
        borderBottom: `1px solid ${C.line}`,
        padding: "16px 20px 20px",
      }}
    >
      {/* Factor grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
        {factors.map(f => (
          <div
            key={f.label}
            style={{
              background: C.surface,
              border: `1px solid ${C.line}`,
              borderRadius: 8,
              padding: "10px 12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {f.label}
              </span>
              <span style={{ fontSize: 13, color: f.good ? C.good : C.warn }}>
                {f.icon}
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{f.detail}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              Score: {(f.score * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>

      {/* Copy */}
      <div
        style={{
          fontSize: 12,
          color: C.ink2,
          background: C.surface,
          border: `1px solid ${C.line}`,
          borderRadius: 8,
          padding: "10px 12px",
          marginBottom: 14,
          lineHeight: 1.6,
        }}
      >
        Confirming will mark <strong>{match.invoice.invoiceNumber}</strong> as paid
        {match.invoice.supplierName
          ? ` and remember "${txn.rawDescription.substring(0, 30)}${txn.rawDescription.length > 30 ? "…" : ""}" as an alias for ${match.invoice.supplierName} — next time we'll auto-apply.`
          : "."}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          type="button"
          size="sm"
          onClick={onConfirm}
          disabled={confirming}
          className="h-8 bg-forest-mid px-4 text-[13px] text-white hover:bg-forest"
        >
          {confirming ? "Confirming…" : "Confirm match"}
        </Button>
        <Link href={`/supplier-invoices/${match.invoice.id}`}>
          <Button variant="outline" size="sm" className="h-8 px-3 text-[13px]">
            Link to different bill
          </Button>
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReject}
          disabled={rejecting}
          className="h-8 px-3 text-[13px] text-subtle"
        >
          {rejecting ? "…" : "Not a bill payment"}
        </Button>
      </div>
    </div>
  );
}

function StateIcon({ state, pending }: { state: string; pending: boolean }) {
  if (pending) {
    return (
      <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #a8a29e", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-muted)" }} />
      </div>
    );
  }
  if (state === "matched") {
    return (
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: C.good, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2.5 2.5 4-4" stroke="var(--color-card)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (state === "pending_review") {
    return (
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: C.warn, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--color-card)", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>?</span>
      </div>
    );
  }
  return (
    <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.line }} />
    </div>
  );
}

function ConfidenceBadge({ confidence, autoApplied, paymentMethod }: { confidence: number; autoApplied: boolean; paymentMethod?: string }) {
  const pct = Math.round(confidence * 100);
  const color = confidence >= 0.95 ? C.good : confidence >= 0.6 ? C.warn : C.muted;
  const noPayeeLabel = paymentMethod === "check"
    ? " · no payee"
    : paymentMethod === "zelle"
      ? " · amount only"
      : "";
  return (
    <span style={{ fontSize: 11, color, fontWeight: 500 }}>
      {pct}%{noPayeeLabel} · {autoApplied ? "auto-applied" : "needs review"}
    </span>
  );
}

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function accountHealth(
  connectionStatus: string,
  lastSyncAt: Date | null,
): { color: string; tooltip: string } {
  if (connectionStatus === "requires_reauth") {
    return { color: "var(--color-danger-fg)", tooltip: "Reconnect required" };
  }
  if (!lastSyncAt) {
    return { color: "var(--color-warning-fg)", tooltip: "Never synced" };
  }
  const hoursOld = (Date.now() - lastSyncAt.getTime()) / 3_600_000;
  if (hoursOld <= 24) {
    return { color: "var(--color-success-fg)", tooltip: `Synced ${timeSince(lastSyncAt)}` };
  }
  return { color: "var(--color-warning-fg)", tooltip: `Synced ${timeSince(lastSyncAt)} — stale` };
}
