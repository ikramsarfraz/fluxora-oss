"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";

import { REVIEW_COLORS } from "./tokens";

export type DuplicateMatch = {
  id: string;
  referenceNumber: string;
  invoiceNumber: string | null;
  invoiceDate: string;
  totalAmount: string;
  status: string;
  /**
   * How the duplicate was detected. `invoice_number` is the strong signal
   * — vendors don't reuse numbers. `date_and_total` is the soft fallback
   * for parses that didn't capture an invoice number.
   */
  matchedBy?: "invoice_number" | "date_and_total";
};

/**
 * Warning banner shown above the line-items list when the parsed invoice
 * matches an existing bill in `supplier_invoices` for the same supplier.
 * Vendors do resend invoices; receivers do re-upload PDFs. Catching it
 * pre-submit is much cheaper than discovering the double-post later.
 *
 * Posted (non-draft) duplicates render the "I want to post this anyway"
 * checkbox — the host disables the submit button until that's checked.
 * This is the block-on-duplicate affordance: informational for drafts,
 * actively gating for already-posted bills.
 */
export function DuplicateInvoiceBanner({
  matches,
  acknowledged,
  onAcknowledgedChange,
}: {
  matches: DuplicateMatch[];
  /** When provided, renders the ack checkbox for posted-duplicate matches. */
  acknowledged?: boolean;
  onAcknowledgedChange?: (value: boolean) => void;
}) {
  if (matches.length === 0) return null;

  // Soft matches (date + total) get a less alarming tone — the user might
  // legitimately have two same-date same-amount bills from one supplier.
  const allSoft = matches.every(m => m.matchedBy === "date_and_total");
  const isOne = matches.length === 1;
  const hasPostedDuplicate = matches.some(m => m.status !== "draft");
  const showAck = hasPostedDuplicate && onAcknowledgedChange !== undefined;

  const headline = allSoft
    ? isOne
      ? "Possible duplicate (same date + amount)"
      : `${matches.length} possible duplicates (same date + amount)`
    : isOne
      ? "Already posted for this supplier"
      : `${matches.length} existing bills with this invoice number`;

  return (
    <div
      className="shrink-0 border-b border-stone-line"
      style={{
        background: allSoft
          ? `color-mix(in oklch, ${REVIEW_COLORS.danger} 4%, transparent)`
          : `color-mix(in oklch, ${REVIEW_COLORS.danger} 8%, transparent)`,
      }}
    >
      <div className="flex items-start gap-2.5 px-[22px] py-2.5">
        <AlertTriangle
          className="mt-0.5 size-[16px] shrink-0"
          strokeWidth={2}
          style={{ color: REVIEW_COLORS.danger }}
        />
        <div className="min-w-0 flex-1">
          <div
            className="text-[13px] font-semibold"
            style={{ color: REVIEW_COLORS.danger }}
          >
            {headline}
          </div>
          <ul className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-stone-muted">
            {matches.map(m => (
              <li key={m.id} className="inline-flex items-center gap-1.5">
                <a
                  href={`/supplier-invoices/${m.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "inline-flex items-center gap-1 font-mono text-stone-ink underline decoration-stone-line underline-offset-2 transition-colors",
                    "hover:decoration-stone-ink",
                  )}
                >
                  {m.referenceNumber}
                  <ExternalLink className="size-[10px]" strokeWidth={2} />
                </a>
                <span className="tabular-nums">
                  {m.invoiceDate} · ${Number(m.totalAmount).toFixed(2)}
                </span>
                <StatusPill status={m.status} />
              </li>
            ))}
          </ul>
          {showAck && (
            <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-stone-ink">
              <input
                type="checkbox"
                checked={acknowledged ?? false}
                onChange={e => onAcknowledgedChange?.(e.target.checked)}
                className="size-[13px] cursor-pointer accent-stone-ink"
              />
              I&apos;ve compared the bills — post this anyway
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  // Posted / paid invoices get the strong "already in inventory" tone;
  // drafts get a milder tone since the user could legitimately want to
  // delete the draft + replace it with this one.
  const isFinalized = status !== "draft";
  return (
    <span
      className="rounded px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-[0.04em]"
      style={{
        background: isFinalized
          ? `color-mix(in oklch, ${REVIEW_COLORS.danger} 12%, transparent)`
          : "var(--stone-line2)",
        color: isFinalized ? REVIEW_COLORS.danger : "var(--stone-muted)",
      }}
    >
      {status}
    </span>
  );
}
