"use client";

import { Plus, Sparkles, TriangleAlert } from "lucide-react";

import { FieldChip } from "./field-chip";
import { ParsedField } from "./parsed-field";
import { REVIEW_COLORS } from "./tokens";
import type { ParsedHeader, SupplierCandidate } from "./types";

export function HeaderCard({
  parsed,
  supplierValue,
  onSupplierChange,
  onSupplierCandidate,
}: {
  parsed: ParsedHeader;
  supplierValue: string;
  onSupplierChange: (value: string) => void;
  onSupplierCandidate?: (candidate: SupplierCandidate) => void;
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
              className="inline-flex items-center gap-1 text-[11px] font-medium"
              style={{ color: REVIEW_COLORS.accent }}
            >
              <Plus className="size-[12px]" strokeWidth={1.8} />
              Create supplier
            </button>
          }
        >
          <div className="relative">
            <input
              value={supplierValue}
              onChange={e => onSupplierChange(e.target.value)}
              className="block h-[34px] w-full rounded-lg pl-3 pr-9 text-[13px] outline-none transition-shadow focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--input-focus)_12%,transparent)]"
              style={{
                border: `1px solid ${REVIEW_COLORS.warn}`,
                background: "#fffdf8",
                ["--input-focus" as never]: REVIEW_COLORS.accent,
              }}
            />
            <TriangleAlert
              className="pointer-events-none absolute right-2.5 top-1/2 size-[14px] -translate-y-1/2"
              strokeWidth={1.6}
              style={{ color: REVIEW_COLORS.warn }}
            />
          </div>
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
      </div>
    </div>
  );
}
