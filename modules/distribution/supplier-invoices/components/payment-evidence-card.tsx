"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";

const C = {
  ink: "var(--color-ink)",
  ink2: "var(--color-ink-warm)",
  muted: "var(--color-subtle)",
  good: "var(--color-success-fg)",
  goodSoft: "var(--color-success-bg)",
  goodBorder: "oklch(85% 0.08 155)",
  warn: "var(--color-warning-fg)",
  warnSoft: "var(--color-warning-bg)",
  warnBorder: "oklch(88% 0.08 70)",
  gray: "var(--color-subtle)",
  graySoft: "var(--color-divider)",
  grayBorder: "var(--color-border-default)",
  line: "var(--color-border-default)",
  line2: "var(--color-divider)",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

// ── Types ──────────────────────────────────────────────────────────────────

type BankTxn = {
  date: string;
  amount: number | string;
  plaidTransactionId: string;
  paymentChannel: string | null;
  paymentMethod?: string | null;
  bankAccount: {
    name: string;
    mask: string | null;
    plaidConnection: { institutionName: string | null } | null;
  } | null;
};

type NamedUser = { fullName?: string | null; firstName?: string | null; lastName?: string | null };

type PaymentMatch = {
  confidence: number | string;
  autoApplied: boolean;
  status: string;
  confirmedBy?: NamedUser | null;
  confirmedAt?: string | Date | null;
  bankTransaction: BankTxn | null;
};

type ManualPayment = {
  paymentDate: string;
  amount: number | string;
  paymentMethod: string;
  reference: string | null;
  createdBy?: NamedUser | null;
  createdAt?: string | Date | null;
};

interface PaymentEvidenceCardProps {
  match?: PaymentMatch | null;
  payment?: ManualPayment | null;
}

// ── Public component ───────────────────────────────────────────────────────

export function PaymentEvidenceCard({ match, payment }: PaymentEvidenceCardProps) {
  const txn = match?.bankTransaction ?? null;

  if (txn && match) {
    if (match.autoApplied) {
      return <AutoMatchedEvidence match={match} txn={txn} />;
    }
    return <ManuallyLinkedEvidence match={match} txn={txn} />;
  }

  if (payment) {
    return <ManuallyMarkedEvidence payment={payment} />;
  }

  return null;
}

// ── Variant 1: Auto-matched (green) ───────────────────────────────────────

function AutoMatchedEvidence({ match, txn }: { match: PaymentMatch; txn: BankTxn }) {
  const confidence = Math.round(Number(match.confidence) * 100);
  const accountLabel = buildAccountLabel(txn);
  const methodLabel = buildMethodLabel(txn);

  return (
    <Card className="overflow-hidden rounded-[10px] border-none py-0 shadow-none ring-0" style={{ background: C.goodSoft, border: `1px solid ${C.goodBorder}`, marginBottom: 24 }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.goodBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircleIcon color={C.good} />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.good }}>Paid via bank · Auto-matched</span>
          <span style={{ fontSize: 11, color: C.good, background: `${C.good}22`, borderRadius: 100, padding: "2px 8px", marginLeft: 4 }}>
            {confidence}%
          </span>
        </div>
      </div>
      <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px 20px" }}>
        <DataItem label="Paid from" value={accountLabel} />
        <DataItem label="Payment date" value={formatDate(txn.date)} />
        <DataItem label="Method" value={methodLabel} />
        <DataItem label="Transaction ID" value={<span style={{ fontFamily: C.mono, fontSize: 11 }}>{txn.plaidTransactionId.substring(0, 24)}…</span>} />
      </div>
    </Card>
  );
}

// ── Variant 2: Manually linked (amber) ────────────────────────────────────

function ManuallyLinkedEvidence({ match, txn }: { match: PaymentMatch; txn: BankTxn }) {
  const confirmedByName = buildUserName(match.confirmedBy);
  const accountLabel = buildAccountLabel(txn);
  const methodLabel = buildMethodLabel(txn);
  const isCheck = (txn.paymentMethod ?? txn.paymentChannel) === "check";

  return (
    <Card className="overflow-hidden rounded-[10px] border-none py-0 shadow-none ring-0" style={{ background: C.warnSoft, border: `1px solid ${C.warnBorder}`, marginBottom: 24 }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.warnBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <LinkIcon color={C.warn} />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.warn }}>
            Paid via {methodLabel.toLowerCase()} · Linked by {confirmedByName}
          </span>
        </div>
        {isCheck && (
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 5 }}>
            No payee on bank record · Banks don&apos;t include payee info on check transactions
          </div>
        )}
      </div>
      <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px 20px" }}>
        <DataItem label="Paid from" value={accountLabel} />
        <DataItem label="Cleared" value={formatDate(txn.date)} />
        <DataItem label="Method" value={methodLabel} />
        <DataItem label="Bank transaction" value={
          <a href="#" style={{ fontSize: 11, fontFamily: C.mono, color: "var(--color-forest-mid)", textDecoration: "none" }}>
            View bank transaction →
          </a>
        } />
      </div>
    </Card>
  );
}

// ── Variant 3: Manually marked paid (gray) ────────────────────────────────

function ManuallyMarkedEvidence({ payment }: { payment: ManualPayment }) {
  const markedByName = buildUserName(payment.createdBy);
  const methodLabel = formatPaymentMethod(payment.paymentMethod);

  return (
    <Card className="overflow-hidden rounded-[10px] border-none py-0 shadow-none ring-0" style={{ background: C.graySoft, border: `1px solid ${C.grayBorder}`, marginBottom: 24 }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.grayBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MarkIcon color={C.gray} />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.gray }}>Marked paid by {markedByName} · No bank record</span>
        </div>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 5 }}>
          No Plaid transaction attached · lowest-trust evidence
        </div>
      </div>
      <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px 20px" }}>
        <DataItem label="Payment date" value={formatDate(payment.paymentDate)} />
        <DataItem label="Method" value={methodLabel} />
        {payment.reference && <DataItem label="Reference" value={<span style={{ fontFamily: C.mono, fontSize: 12 }}>{payment.reference}</span>} />}
        <DataItem label="Bank record" value={
          <span style={{ fontSize: 11, color: C.muted }}>
            None attached ·{" "}
            <a href="#" style={{ color: "var(--color-forest-mid)", textDecoration: "none" }}>Link one if it appears →</a>
          </span>
        } />
      </div>
    </Card>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function DataItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>
        {value}
      </div>
    </div>
  );
}

function buildAccountLabel(txn: BankTxn): string {
  if (!txn.bankAccount) return "Bank account";
  return [
    txn.bankAccount.plaidConnection?.institutionName,
    txn.bankAccount.name,
    txn.bankAccount.mask ? `···${txn.bankAccount.mask}` : null,
  ].filter(Boolean).join(" · ");
}

function buildMethodLabel(txn: BankTxn): string {
  const m = txn.paymentMethod ?? txn.paymentChannel;
  if (!m || m === "other") return "ACH";
  return m.toUpperCase().replace("_", " ");
}

function buildUserName(user?: NamedUser | null): string {
  if (!user) return "user";
  if (user.fullName) return user.fullName;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "user";
}

function formatDate(d: string): string {
  return new Date(d + (d.includes("T") ? "" : "T00:00:00")).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function formatPaymentMethod(m: string): string {
  const map: Record<string, string> = {
    cash: "Cash", check: "Check", ach: "ACH", zelle: "Zelle", credit_card: "Credit card",
  };
  return map[m] ?? m;
}

// ── Mini icons ─────────────────────────────────────────────────────────────

function CheckCircleIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="7" fill={color} />
      <path d="M4 7l2 2 4-4" stroke="var(--color-card)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function MarkIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
