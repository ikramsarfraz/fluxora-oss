"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Sparkles } from "lucide-react";

import { FieldChip } from "./field-chip";
import type { SupplierLookup } from "./map-pipeline-to-review-data";
import { ParsedField } from "./parsed-field";
import { SupplierPicker } from "./supplier-picker";
import { REVIEW_COLORS } from "./tokens";
import type {
  ParsedHeader,
  PaymentMethod,
  SupplierCandidate,
} from "./types";

const PAYMENT_METHOD_OPTIONS: Array<{
  value: PaymentMethod | "";
  label: string;
}> = [
  { value: "", label: "Not specified" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "ach", label: "ACH" },
  { value: "zelle", label: "Zelle" },
  { value: "credit_card", label: "Credit card" },
];

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  check: "Check",
  ach: "ACH",
  zelle: "Zelle",
  credit_card: "Credit card",
};

export function HeaderCard({
  parsed,
  supplierValue,
  suppliers,
  supplierSelectedId,
  onSupplierSelect,
  onSupplierTypedNameChange,
  onSupplierCandidate,
  onCreateSupplier,
  paymentMethod,
  onPaymentMethodChange,
  notes,
  onNotesChange,
  invoiceNumber,
  onInvoiceNumberChange,
  invoiceDate,
  onInvoiceDateChange,
  receiveDate,
  onReceiveDateChange,
  collapsed,
  onToggleCollapse,
}: {
  parsed: ParsedHeader;
  supplierValue: string;
  suppliers: SupplierLookup[];
  supplierSelectedId: string | null;
  onSupplierSelect: (supplier: SupplierLookup | null) => void;
  onSupplierTypedNameChange?: (name: string) => void;
  onSupplierCandidate?: (candidate: SupplierCandidate) => void;
  onCreateSupplier?: () => void;
  /**
   * Current payment-method override, controlled by the parent. Null means
   * "not specified" — same as the manual form's blank state.
   */
  paymentMethod: PaymentMethod | null;
  onPaymentMethodChange: (value: PaymentMethod | null) => void;
  /**
   * Bill-level notes textarea — initialized by the parent from the
   * parser's prefill so any notes the AI extracted from the PDF show up
   * as the default. Empty string is sent to the server as null on submit.
   */
  notes: string;
  onNotesChange: (value: string) => void;
  /**
   * Header text fields, now fully controlled. Previously these were
   * `defaultValue` inputs so user edits silently dropped on submit;
   * lifting to the parent (which seeds from the parser's prefill) means
   * every keystroke flows into the createSupplierInvoiceAction payload.
   */
  invoiceNumber: string;
  onInvoiceNumberChange: (value: string) => void;
  invoiceDate: string;
  onInvoiceDateChange: (value: string) => void;
  receiveDate: string;
  onReceiveDateChange: (value: string) => void;
  /**
   * When true, the header card renders as a thin one-line summary strip
   * (supplier · invoice # · date · total · payment method) with a
   * chevron to expand. Used by the review screen to claw back vertical
   * space for the line items list once the reviewer starts working.
   */
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  if (collapsed) {
    return (
      <CollapsedHeaderStrip
        parsed={parsed}
        supplierValue={supplierValue}
        supplierSelected={supplierSelectedId != null}
        paymentMethod={paymentMethod}
        onToggleCollapse={onToggleCollapse}
      />
    );
  }

  // Trim padding when expanded so the header card eats fewer pixels —
  // every row we save flows directly into line items real estate.
  // Compare overrides (not the parser's prefill) so a manual edit
  // that re-syncs the two dates re-collapses the receive-date row.
  const receiveDateSameAsInvoice = receiveDate === invoiceDate;

  return (
    <div className="border-b border-stone-line bg-stone-surface px-4 py-3">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-stone-ink">Invoice header</h2>
        <div className="flex items-center gap-2">
          <FieldChip
            confidence={parsed.total.confidence}
            sourceHint="extracted by AI"
          />
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Collapse header to a summary strip"
            className="flex size-7 items-center justify-center rounded-md text-stone-muted transition-colors hover:bg-stone-line2 hover:text-stone-ink"
          >
            <ChevronUp className="size-[14px]" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <ParsedField
          label="Supplier"
          required
          chip={
            <FieldChip
              confidence={parsed.supplier.confidence}
              status="warn"
              sourceHint="no exact match"
            />
          }
          action={
            <button
              type="button"
              onClick={onCreateSupplier}
              disabled={!onCreateSupplier}
              className="inline-flex items-center gap-1 text-[11px] font-medium disabled:opacity-50"
              style={{ color: REVIEW_COLORS.accent }}
            >
              <Plus className="size-[12px]" strokeWidth={1.8} />
              Create supplier
            </button>
          }
        >
          <SupplierPicker
            suppliers={suppliers}
            value={supplierValue}
            selectedId={supplierSelectedId}
            onValueChange={onSupplierSelect}
            onTypedNameChange={onSupplierTypedNameChange}
            needsAttention={!supplierSelectedId}
          />
          {parsed.supplier.candidates.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {parsed.supplier.candidates.map((candidate, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSupplierCandidate?.(candidate)}
                  className="inline-flex items-center gap-2 rounded-lg border border-stone-line bg-stone-surface py-1 pl-2.5 pr-1.5 text-[12px] text-stone-ink transition-colors hover:bg-stone-line2"
                >
                  <Sparkles
                    className="size-[12px]"
                    strokeWidth={1.6}
                    style={{ color: REVIEW_COLORS.accent }}
                  />
                  <span className="font-medium">{candidate.name}</span>
                  <span className="rounded bg-stone-line2 px-1.5 py-px font-mono text-[10.5px] tabular-nums text-stone-muted">
                    {candidate.score}%
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </ParsedField>

        <ParsedField
          label="Invoice number"
          chip={<FieldChip confidence={parsed.invoiceNumber.confidence} />}
        >
          <input
            value={invoiceNumber}
            onChange={e => onInvoiceNumberChange(e.target.value)}
            maxLength={128}
            className="block h-[34px] w-full rounded-lg border border-stone-line bg-stone-surface px-3 font-mono text-[13px] tabular-nums outline-none focus:border-[var(--input-focus)] focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--input-focus)_12%,transparent)]"
            style={{ ["--input-focus" as never]: REVIEW_COLORS.accent }}
          />
        </ParsedField>

        <ParsedField
          label="Invoice date"
          chip={<FieldChip confidence={parsed.invoiceDate.confidence} />}
        >
          <input
            type="date"
            value={invoiceDate}
            onChange={e => onInvoiceDateChange(e.target.value)}
            className="block h-[34px] w-full rounded-lg border border-stone-line bg-stone-surface px-3 text-[13px] outline-none focus:border-[var(--input-focus)] focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--input-focus)_12%,transparent)]"
            style={{ ["--input-focus" as never]: REVIEW_COLORS.accent }}
          />
        </ParsedField>

        {receiveDateSameAsInvoice ? (
          <ReceiveDateSameStub
            value={receiveDate}
            onChange={onReceiveDateChange}
          />
        ) : (
          <ParsedField
            label="Receive date"
            chip={
              <FieldChip
                confidence={parsed.receiveDate.confidence}
                sourceHint={parsed.receiveDate.note}
              />
            }
          >
            <input
              type="date"
              value={receiveDate}
              onChange={e => onReceiveDateChange(e.target.value)}
              className="block h-[34px] w-full rounded-lg border border-stone-line bg-stone-surface px-3 text-[13px] outline-none focus:border-[var(--input-focus)] focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--input-focus)_12%,transparent)]"
              style={{ ["--input-focus" as never]: REVIEW_COLORS.accent }}
            />
          </ParsedField>
        )}

        <ParsedField label="Payment method">
          <select
            value={paymentMethod ?? ""}
            onChange={e =>
              onPaymentMethodChange(
                e.target.value === ""
                  ? null
                  : (e.target.value as PaymentMethod),
              )
            }
            className="block h-[34px] w-full rounded-lg border border-stone-line bg-stone-surface px-3 text-[13px] outline-none focus:border-[var(--input-focus)] focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--input-focus)_12%,transparent)]"
            style={{ ["--input-focus" as never]: REVIEW_COLORS.accent }}
          >
            {PAYMENT_METHOD_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </ParsedField>
      </div>

      {/* Notes — full-width textarea below the grid. Seeded from the
          parser's prefill (e.g. PO #, special instructions found on the
          invoice). Empty string maps to null at submit. */}
      <div className="mt-2.5">
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-muted">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Optional notes for this bill (PO #, special instructions, etc.)"
          className="block w-full resize-y rounded-lg border border-stone-line bg-stone-surface px-3 py-2 text-[13px] outline-none focus:border-[var(--input-focus)] focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--input-focus)_12%,transparent)]"
          style={{ ["--input-focus" as never]: REVIEW_COLORS.accent }}
        />
      </div>
    </div>
  );
}

/**
 * Thin one-line strip rendered in place of the full header card once the
 * reviewer starts working on lines. Surfaces the four things they'd want
 * to glance at without scrolling back up — supplier name (or a warning
 * chip when unmatched), invoice #, invoice date, bill total — plus a
 * chevron to re-expand. Compact: ~32px tall vs ~210px for the full card.
 */
function CollapsedHeaderStrip({
  parsed,
  supplierValue,
  supplierSelected,
  paymentMethod,
  onToggleCollapse,
}: {
  parsed: ParsedHeader;
  supplierValue: string;
  supplierSelected: boolean;
  paymentMethod: PaymentMethod | null;
  onToggleCollapse: () => void;
}) {
  const fmtMoney = (n: number) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const fmtDate = (iso: string) => {
    if (!iso) return "—";
    // YYYY-MM-DD → "Apr 20" — short for the strip.
    const [, m, d] = iso.split("-");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthIdx = Number(m) - 1;
    if (!Number.isInteger(monthIdx) || !months[monthIdx]) return iso;
    return `${months[monthIdx]} ${Number(d)}`;
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-stone-line bg-stone-surface px-4 py-2 text-[12px]">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className={
            supplierSelected
              ? "min-w-0 max-w-[280px] truncate text-[13px] font-semibold text-stone-ink"
              : "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-semibold"
          }
          style={
            supplierSelected
              ? undefined
              : {
                  background: "oklch(95% 0.05 60 / 0.6)",
                  color: "oklch(60% 0.16 35)",
                }
          }
        >
          {supplierSelected
            ? supplierValue || parsed.supplier.value || "—"
            : "Supplier missing"}
        </span>
        <span className="text-stone-muted">·</span>
        <span className="font-mono text-stone-muted">
          {parsed.invoiceNumber.value
            ? `#${parsed.invoiceNumber.value}`
            : "no invoice #"}
        </span>
        <span className="text-stone-muted">·</span>
        <span className="font-mono text-stone-muted">
          {fmtDate(parsed.invoiceDate.value)}
        </span>
        <span className="text-stone-muted">·</span>
        <span className="font-mono font-semibold tabular-nums text-stone-ink">
          ${fmtMoney(parsed.total.value)}
        </span>
        {paymentMethod ? (
          <>
            <span className="text-stone-muted">·</span>
            <span className="text-stone-muted">
              {PAYMENT_METHOD_LABEL[paymentMethod]}
            </span>
          </>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onToggleCollapse}
        title="Expand header to edit"
        className="inline-flex items-center gap-1 rounded-md border border-stone-line bg-stone-surface px-2 py-0.5 text-[11px] font-medium text-stone-muted hover:text-stone-ink"
      >
        Edit
        <ChevronDown className="size-[12px]" strokeWidth={1.8} />
      </button>
    </div>
  );
}

/**
 * Compact stub shown in place of the receive-date ParsedField when the
 * receive date already equals the invoice date (the common parser
 * default). Click "Edit" reveals a real controlled date input that
 * posts the new value through `onChange`.
 */
function ReceiveDateSameStub({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <ParsedField label="Receive date">
        <input
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="block h-[34px] w-full rounded-lg border border-stone-line bg-stone-surface px-3 text-[13px] outline-none focus:border-[var(--input-focus)] focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--input-focus)_12%,transparent)]"
          style={{ ["--input-focus" as never]: REVIEW_COLORS.accent }}
        />
      </ParsedField>
    );
  }
  return (
    <div className="flex items-end pb-1.5 text-[11.5px] text-stone-muted">
      Receive date: same as invoice ·{" "}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="ml-1 font-medium text-stone-ink underline-offset-2 hover:underline"
      >
        Edit
      </button>
    </div>
  );
}
