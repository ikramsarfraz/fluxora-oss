"use client";

import { Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * One row in the editable charges panel. Mirrors the manual form's
 * `ChargeRow` shape but flattened for the review surface (no react-hook-
 * form coupling). `id` is a client-only stable key so React's
 * reconciler can track rows across add/remove without re-mounting
 * inputs.
 */
export type ChargeDraft = {
  id: string;
  description: string;
  chargeType: SupplierInvoiceChargeType;
  /** Only meaningful when chargeType === "tax"; otherwise the input is disabled. */
  rate: string;
  amount: string;
  includeInInventoryCost: boolean;
};

export type SupplierInvoiceChargeType =
  | "freight"
  | "fuel"
  | "tax"
  | "discount"
  // Meat-supplier categories the AI extractor classifies — keep this
  // dropdown in sync with the prompt's taxonomy in ai-prompts.ts, the
  // server Zod enum, and the DB CHECK constraint.
  | "processing"
  | "inspection"
  | "cod"
  | "refrigeration"
  | "other";

const CHARGE_TYPE_OPTIONS: Array<{
  value: SupplierInvoiceChargeType;
  label: string;
}> = [
  { value: "freight", label: "Freight" },
  { value: "fuel", label: "Fuel" },
  { value: "tax", label: "Tax" },
  { value: "discount", label: "Discount" },
  { value: "processing", label: "Processing" },
  { value: "inspection", label: "Inspection" },
  { value: "cod", label: "COD" },
  { value: "refrigeration", label: "Refrigeration" },
  { value: "other", label: "Other" },
];

export function emptyChargeDraft(): ChargeDraft {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `charge-${Math.random().toString(36).slice(2)}`,
    description: "",
    chargeType: "other",
    rate: "",
    amount: "",
    includeInInventoryCost: false,
  };
}

/**
 * Editable per-line list of non-inventory charges (freight, fuel, tax,
 * discount, etc.) — seeded from the parser's `detectedFees` and fully
 * editable. Replaces the silent submit-time charge construction that
 * stamped every detected fee as `chargeType: "other"`.
 */
export function ChargesPanel({
  charges,
  onChange,
}: {
  charges: ChargeDraft[];
  onChange: (next: ChargeDraft[]) => void;
}) {
  const updateRow = (id: string, patch: Partial<ChargeDraft>) => {
    onChange(charges.map(c => (c.id === id ? { ...c, ...patch } : c)));
  };
  const removeRow = (id: string) => {
    onChange(charges.filter(c => c.id !== id));
  };
  const addRow = () => {
    onChange([...charges, emptyChargeDraft()]);
  };

  const inInventoryTotal = charges
    .filter(c => c.includeInInventoryCost)
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const otherTotal = charges
    .filter(c => !c.includeInInventoryCost)
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  return (
    <div className="border-t border-border-default bg-card">
      <div className="flex items-center justify-between border-b border-border-default bg-divider px-[22px] py-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[13px] font-medium text-ink">
            Non-inventory charges
          </h2>
          <span className="font-mono text-[11px] text-subtle">
            {charges.length}
          </span>
        </div>
        <div className="flex items-baseline gap-3 text-[11px] text-subtle">
          {inInventoryTotal > 0 ? (
            <span>
              ${inInventoryTotal.toFixed(2)}{" "}
              <span className="text-subtle/70">in COGS</span>
            </span>
          ) : null}
          {otherTotal > 0 ? (
            <span>
              ${otherTotal.toFixed(2)}{" "}
              <span className="text-subtle/70">off-cost</span>
            </span>
          ) : null}
        </div>
      </div>

      {charges.length === 0 ? (
        <div className="px-[22px] py-6 text-center text-[12px] text-subtle">
          No charges on this bill. Add freight, fuel, tax, or other
          non-inventory amounts here.
        </div>
      ) : (
        <div className="divide-y divide-border-default">
          {charges.map(charge => (
            <ChargeRow
              key={charge.id}
              charge={charge}
              onChange={patch => updateRow(charge.id, patch)}
              onRemove={() => removeRow(charge.id)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border-default bg-page px-[22px] py-2.5">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-[7px] border border-dashed border-border-default bg-card px-2.5 py-1 text-[12px] text-subtle transition-colors hover:text-ink"
        >
          <Plus className="size-[12px]" strokeWidth={1.8} />
          Add charge
        </button>
      </div>
    </div>
  );
}

function ChargeRow({
  charge,
  onChange,
  onRemove,
}: {
  charge: ChargeDraft;
  onChange: (patch: Partial<ChargeDraft>) => void;
  onRemove: () => void;
}) {
  const isTax = charge.chargeType === "tax";

  return (
    <div className="grid items-center gap-2 px-[22px] py-2.5 text-[12px]"
      style={{
        gridTemplateColumns:
          "minmax(180px, 1fr) 110px 70px 110px auto 28px",
      }}
    >
      <input
        type="text"
        value={charge.description}
        onChange={e => onChange({ description: e.target.value })}
        placeholder="Description (e.g. Freight)"
        maxLength={256}
        className="h-8 rounded-md border border-border-default bg-card px-2.5 text-[12px] outline-none focus:border-forest-mid"
      />
      <select
        value={charge.chargeType}
        onChange={e =>
          onChange({
            chargeType: e.target.value as SupplierInvoiceChargeType,
            // Clear `rate` when leaving tax — it's only meaningful there.
            rate:
              (e.target.value as SupplierInvoiceChargeType) === "tax"
                ? charge.rate
                : "",
          })
        }
        className="h-8 rounded-md border border-border-default bg-card px-2.5 text-[12px] outline-none focus:border-forest-mid"
      >
        {CHARGE_TYPE_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={0}
        step="0.01"
        value={charge.rate}
        onChange={e => onChange({ rate: e.target.value })}
        placeholder="%"
        disabled={!isTax}
        title={isTax ? "Tax rate %" : "Rate is only used for Tax"}
        className={cn(
          "h-8 rounded-md border border-border-default bg-card px-2 text-right font-mono text-[12px] tabular-nums outline-none focus:border-forest-mid",
          !isTax && "opacity-40",
        )}
      />
      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-subtle">
          $
        </span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={charge.amount}
          onChange={e => onChange({ amount: e.target.value })}
          placeholder="0.00"
          className="h-8 w-full rounded-md border border-border-default bg-card pl-5 pr-2 text-right font-mono text-[12px] tabular-nums outline-none focus:border-forest-mid"
        />
      </div>
      <label
        className={cn(
          "inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
          charge.includeInInventoryCost
            ? "border-forest-mid bg-forest-mid/5 text-ink"
            : "border-border-default text-subtle hover:text-ink",
        )}
        title="When on, this charge is capitalized into product costs."
      >
        <input
          type="checkbox"
          checked={charge.includeInInventoryCost}
          onChange={e =>
            onChange({ includeInInventoryCost: e.target.checked })
          }
          className="size-[12px] cursor-pointer"
        />
        In COGS
      </label>
      <button
        type="button"
        onClick={onRemove}
        title="Remove charge"
        className="flex size-7 items-center justify-center rounded-md text-subtle transition-colors hover:bg-divider hover:text-ink"
      >
        <Trash2 className="size-[14px]" strokeWidth={1.6} />
      </button>
    </div>
  );
}

/**
 * Convert the editor's draft array to the submit payload shape, dropping
 * any rows with no description AND no amount (treated as empty rows the
 * user added then ignored).
 */
export function resolveChargesSubmit(charges: ChargeDraft[]) {
  return charges
    .map(c => ({
      description: c.description.trim(),
      chargeType: c.chargeType,
      rate: c.chargeType === "tax" && c.rate.trim() ? c.rate.trim() : null,
      includeInInventoryCost: c.includeInInventoryCost,
      amount: c.amount.trim(),
    }))
    .filter(c => c.description.length > 0 && c.amount.length > 0);
}
