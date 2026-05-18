"use client";

import { Plus, Sparkles } from "lucide-react";

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
}) {
  return (
    <div className="border-b border-stone-line bg-stone-surface px-[22px] py-4">
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-stone-ink">Invoice header</h2>
        <FieldChip confidence={parsed.total.confidence} sourceHint="extracted by AI" />
      </div>

      <div className="grid grid-cols-2 gap-3.5">
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
            defaultValue={parsed.invoiceNumber.value}
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
            defaultValue={parsed.invoiceDate.value}
            className="block h-[34px] w-full rounded-lg border border-stone-line bg-stone-surface px-3 text-[13px] outline-none focus:border-[var(--input-focus)] focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--input-focus)_12%,transparent)]"
            style={{ ["--input-focus" as never]: REVIEW_COLORS.accent }}
          />
        </ParsedField>

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
            defaultValue={parsed.receiveDate.value}
            className="block h-[34px] w-full rounded-lg border border-stone-line bg-stone-surface px-3 text-[13px] outline-none focus:border-[var(--input-focus)] focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--input-focus)_12%,transparent)]"
            style={{ ["--input-focus" as never]: REVIEW_COLORS.accent }}
          />
        </ParsedField>

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
    </div>
  );
}
