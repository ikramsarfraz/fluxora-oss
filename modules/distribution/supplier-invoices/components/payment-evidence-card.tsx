"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";

const C = {
  ink: "#0c0a09",
  ink2: "#44403c",
  muted: "#78716c",
  good: "oklch(58% 0.13 155)",
  goodSoft: "oklch(96% 0.04 155)",
  line: "#e7e5e4",
  line2: "#f5f5f4",
  radius: "10px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

type PaymentMatch = {
  confidence: number | string;
  autoApplied: boolean;
  status: string;
  bankTransaction: {
    date: string;
    amount: number | string;
    plaidTransactionId: string;
    paymentChannel: string | null;
    bankAccount: {
      name: string;
      mask: string | null;
      plaidConnection: {
        institutionName: string | null;
      } | null;
    } | null;
  } | null;
};

export function PaymentEvidenceCard({ match }: { match: PaymentMatch }) {
  const txn = match.bankTransaction;
  if (!txn) return null;

  const confidence = Math.round(Number(match.confidence) * 100);
  const accountLabel = txn.bankAccount
    ? [
        txn.bankAccount.plaidConnection?.institutionName,
        txn.bankAccount.name,
        txn.bankAccount.mask ? `···${txn.bankAccount.mask}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Bank account";

  const methodLabel = txn.paymentChannel?.toUpperCase() ?? "ACH";

  return (
    <Card
      className="overflow-hidden rounded-[10px] border-none py-0 shadow-none ring-0"
      style={{ background: C.goodSoft, marginBottom: 24 }}
    >
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.good}33` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="7" fill={C.good} />
            <path d="M4 7l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.good }}>
            Payment confirmed
          </span>
          <span
            style={{
              fontSize: 11,
              color: C.good,
              background: `${C.good}22`,
              borderRadius: 100,
              padding: "2px 8px",
              marginLeft: 4,
            }}
          >
            {confidence}% · {match.autoApplied ? "auto-matched" : "confirmed by user"}
          </span>
        </div>
      </div>
      <div
        style={{
          padding: "16px 20px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px 24px",
        }}
      >
        <DataItem label="Paid from" value={accountLabel} />
        <DataItem
          label="Payment date"
          value={new Date(txn.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        />
        <DataItem label="Method" value={methodLabel} />
        <DataItem
          label="Plaid transaction ID"
          value={
            <span style={{ fontFamily: C.mono, fontSize: 11 }}>
              {txn.plaidTransactionId.substring(0, 32)}…
            </span>
          }
        />
      </div>
    </Card>
  );
}

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
