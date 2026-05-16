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
};

/**
 * Warning banner shown above the line-items list when the parsed invoice
 * number already exists in `supplier_invoices` for the same supplier.
 * Vendors do resend invoices; receivers do re-upload PDFs. Catching it
 * pre-submit is much cheaper than discovering the double-post later.
 *
 * The banner is informational rather than blocking — the user might
 * legitimately want a second copy on file (e.g. a re-issued invoice with
 * the same number after a correction). We surface the existing bill(s)
 * with a click-through so they can compare.
 */
export function DuplicateInvoiceBanner({
  matches,
}: {
  matches: DuplicateMatch[];
}) {
  if (matches.length === 0) return null;

  // One match is the common case; pluralize gracefully for the rare
  // multi-hit scenario (e.g. an invoice number that's been reused across
  // years — uncommon but seen in the wild).
  const isOne = matches.length === 1;

  return (
    <div
      className="shrink-0 border-b border-stone-line"
      style={{
        background: `color-mix(in oklch, ${REVIEW_COLORS.danger} 8%, transparent)`,
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
            {isOne
              ? "Already posted for this supplier"
              : `${matches.length} existing bills with this invoice number`}
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
