"use client";

import { useEffect, useRef, useState } from "react";
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import { ChevronDown, Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  computeDraftLineWeight,
  formatEditableWeight,
  type SupplierInvoiceWeightEntryMode,
} from "@/lib/supplier-invoices/case-weights";
import { formatMoney } from "@/lib/utils/currency";
import type { ProductListItem } from "@/services/products";

import {
  computeLineTotal,
  emptyLine,
  type SupplierInvoiceFormValues,
} from "./supplier-invoice-form.schema";

// ─── Design tokens ─────────────────────────────────────────────────────────
const T = {
  surface: "#ffffff",
  surfaceAlt: "#f5f5f4",
  border: "#e7e5e4",
  borderStrong: "#d4d1c7",
  text: "#0c0a09",
  muted: "#78716c",
  mutedSoft: "#a8a29e",
  accent: "oklch(60% 0.15 240)",
  accentBorder: "oklch(60% 0.15 240 / 0.22)",
  accentSoft: "oklch(96% 0.03 240)",
  mono: "var(--font-mono)",
} as const;

const COL = "2fr 1.3fr 80px 1.5fr 1.1fr 1.1fr 36px";

function fmt2(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getPositiveInteger(value: string | undefined): number {
  const parsed = value ? Number.parseInt(value, 10) : 0;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

// ── Types ──────────────────────────────────────────────────────────────────
type Props = {
  control: Control<SupplierInvoiceFormValues>;
  register: UseFormRegister<SupplierInvoiceFormValues>;
  setValue: UseFormSetValue<SupplierInvoiceFormValues>;
  products: ProductListItem[];
  productsLoading: boolean;
  disabled?: boolean;
};

// ── Invoice total for card header (exported) ───────────────────────────────
export function LineItemsInvoiceTotal({
  control,
}: {
  control: Control<SupplierInvoiceFormValues>;
}) {
  const lines = useWatch({ control, name: "lines" });
  const total = (lines ?? []).reduce(
    (acc, line) => acc + computeLineTotal(line ?? {}),
    0,
  );
  return <>{formatMoney(total)}</>;
}

// ── Shared sub-components ──────────────────────────────────────────────────
function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div
        style={{
          fontSize: 10,
          color: T.mutedSoft,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: highlight ? 16 : 13,
          fontWeight: highlight ? 600 : 500,
          color: T.text,
          fontFamily: T.mono,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ readonly v: string; readonly l: string }>;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 7,
        padding: 2,
      }}
    >
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => !disabled && onChange(o.v)}
          style={{
            background: value === o.v ? "#0c0a09" : "transparent",
            color: value === o.v ? "#fff" : T.muted,
            border: "none",
            padding: "6px 12px",
            borderRadius: 5,
            cursor: disabled ? "default" : "pointer",
            fontSize: 12,
            fontWeight: 500,
            transition: "background 0.12s, color 0.12s",
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

const lbl: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: T.muted,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  marginBottom: 6,
};

// ── Footer stats ───────────────────────────────────────────────────────────
function FooterStats({
  control,
  lineCount,
}: {
  control: Control<SupplierInvoiceFormValues>;
  lineCount: number;
}) {
  const lines = useWatch({ control, name: "lines" });
  const arr = lines ?? [];
  const totalCases = arr.reduce(
    (s, l) => s + (getPositiveInteger(l?.quantityCases) || 0),
    0,
  );
  const totalWeight = arr.reduce(
    (s, l) => s + computeDraftLineWeight(l ?? {}),
    0,
  );
  const invoiceTotal = arr.reduce((s, l) => s + computeLineTotal(l ?? {}), 0);
  return (
    <div style={{ display: "flex", gap: 24, alignItems: "baseline" }}>
      <Stat label="Lines" value={lineCount} />
      <Stat label="Cases" value={totalCases} />
      <Stat label="Total weight" value={`${fmt2(totalWeight)} lb`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div
          style={{
            fontSize: 10,
            color: T.mutedSoft,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Invoice total
        </div>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 18,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: T.text,
          }}
        >
          {formatMoney(invoiceTotal)}
        </div>
      </div>
    </div>
  );
}

// ── Per-line total ─────────────────────────────────────────────────────────
function LineRowTotal({
  control,
  index,
}: {
  control: Control<SupplierInvoiceFormValues>;
  index: number;
}) {
  const line = useWatch({ control, name: `lines.${index}` });
  return (
    <span
      style={{ fontFamily: T.mono, fontVariantNumeric: "tabular-nums" }}
    >
      {formatMoney(computeLineTotal(line ?? {}))}
    </span>
  );
}

// ── Weight entry modes ─────────────────────────────────────────────────────
const WEIGHT_MODES = [
  { v: "manual_case_weights", l: "Each case" },
  { v: "default_case_weight", l: "Same value" },
  { v: "total_weight", l: "Total ÷ cases" },
] as const;

// ── Main component ─────────────────────────────────────────────────────────
export function SupplierInvoiceLinesEditor({
  control,
  register,
  setValue,
  products,
  productsLoading,
  disabled = false,
}: Props) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines",
  });
  const productOptions = products.map((p) => ({
    id: p.id,
    label: p.name,
    sku: p.sku,
  }));

  return (
    <div>
      {/* Column headers strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: COL,
          gap: "16px",
          padding: "11px 28px",
          background: T.surfaceAlt,
          borderBottom: `1px solid ${T.border}`,
          fontSize: 10,
          fontWeight: 600,
          color: T.mutedSoft,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <div>Product</div>
        <div>Pricing</div>
        <div style={{ textAlign: "center" }}>Cases</div>
        <div style={{ textAlign: "right" }}>Weight (lbs)</div>
        <div style={{ textAlign: "right" }}>Unit price</div>
        <div style={{ textAlign: "right" }}>Line total</div>
        <div />
      </div>

      {/* Lines */}
      {fields.length === 0 ? (
        <div
          style={{
            padding: "40px 28px",
            textAlign: "center",
            fontSize: 14,
            color: T.muted,
          }}
        >
          No lines yet — add a product below.
        </div>
      ) : (
        fields.map((field, index) => (
          <LineRow
            key={field.id}
            control={control}
            register={register}
            setValue={setValue}
            index={index}
            products={productOptions}
            productsLoading={productsLoading}
            disabled={disabled}
            onRemove={() => remove(index)}
            canRemove={fields.length > 1}
          />
        ))
      )}

      {/* Footer */}
      <div
        style={{
          padding: "16px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: T.surface,
          borderTop: `1px solid ${T.border}`,
        }}
      >
        <button
          type="button"
          onClick={() => append(emptyLine())}
          disabled={disabled}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: T.surface,
            color: T.text,
            border: `1px dashed ${T.borderStrong}`,
            padding: "9px 16px",
            borderRadius: 8,
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "inherit",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <Plus style={{ width: 14, height: 14 }} />
          Add line
        </button>
        <FooterStats control={control} lineCount={fields.length} />
      </div>
    </div>
  );
}

// ── LineRow ────────────────────────────────────────────────────────────────
function LineRow({
  control,
  register,
  setValue,
  index,
  products,
  productsLoading,
  disabled,
  onRemove,
  canRemove,
}: {
  control: Control<SupplierInvoiceFormValues>;
  register: UseFormRegister<SupplierInvoiceFormValues>;
  setValue: UseFormSetValue<SupplierInvoiceFormValues>;
  index: number;
  products: Array<{ id: string; label: string; sku: string }>;
  productsLoading: boolean;
  disabled: boolean;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const line = useWatch({ control, name: `lines.${index}` });
  const [expanded, setExpanded] = useState(false);

  const productId = line?.productId ?? "";
  const unitType = line?.unitType ?? "catch_weight";
  const weightEntryMode = (line?.weightEntryMode ??
    "total_weight") as SupplierInvoiceWeightEntryMode;
  const quantityCases = getPositiveInteger(line?.quantityCases);
  const sku = products.find((p) => p.id === productId)?.sku ?? "";
  const isCatchWeight = unitType === "catch_weight";

  // Auto-open tray when switching to catch_weight
  const prevUnitTypeRef = useRef(unitType);
  useEffect(() => {
    if (prevUnitTypeRef.current !== "catch_weight" && unitType === "catch_weight") {
      setExpanded(true);
    }
    prevUnitTypeRef.current = unitType;
  }, [unitType]);

  // Sync caseWeightEntries length with quantityCases
  useEffect(() => {
    if (unitType !== "catch_weight") return;
    const existingEntries = line?.caseWeightEntries ?? [];
    const nextEntries = Array.from(
      { length: quantityCases },
      (_, i) => existingEntries[i] ?? "",
    );
    const changed =
      nextEntries.length !== existingEntries.length ||
      nextEntries.some((v, i) => v !== existingEntries[i]);
    if (changed) {
      setValue(`lines.${index}.caseWeightEntries`, nextEntries, {
        shouldDirty: true,
      });
    }
  }, [index, line?.caseWeightEntries, quantityCases, setValue, unitType]);

  // Sync computed weight → weightLbs in detail modes
  useEffect(() => {
    if (unitType !== "catch_weight" || weightEntryMode === "total_weight") return;
    const nextWeight = computeDraftLineWeight(line ?? {});
    const nextValue = nextWeight > 0 ? nextWeight.toFixed(4) : "0";
    if ((line?.weightLbs ?? "0") !== nextValue) {
      setValue(`lines.${index}.weightLbs`, nextValue, { shouldDirty: true });
    }
  }, [index, line, setValue, unitType, weightEntryMode]);

  // Reset detail fields when switching to fixed_case
  useEffect(() => {
    if (unitType !== "catch_weight" && line?.weightEntryMode !== "total_weight") {
      setValue(`lines.${index}.weightEntryMode`, "total_weight", {
        shouldDirty: true,
      });
    }
  }, [index, line?.weightEntryMode, setValue, unitType]);

  const totalWeightLbs = isCatchWeight
    ? computeDraftLineWeight(line ?? {})
    : Number(line?.weightLbs ?? "0") || 0;

  // How many cases have weights entered (for the button indicator)
  const filled = (() => {
    if (!isCatchWeight) return quantityCases;
    if (weightEntryMode === "total_weight")
      return totalWeightLbs > 0 ? quantityCases : 0;
    if (weightEntryMode === "default_case_weight")
      return (Number(line?.defaultCaseWeightLbs ?? "") || 0) > 0
        ? quantityCases
        : 0;
    return (line?.caseWeightEntries ?? [])
      .slice(0, quantityCases)
      .filter((v) => (Number(v) || 0) > 0).length;
  })();

  const complete = filled === quantityCases && totalWeightLbs > 0;

  function handleModeChange(mode: SupplierInvoiceWeightEntryMode) {
    setValue(`lines.${index}.weightEntryMode`, mode, { shouldDirty: true });
    setExpanded(true);

    const avgWeight =
      quantityCases > 0 && totalWeightLbs > 0
        ? totalWeightLbs / quantityCases
        : 0;
    const avgText = avgWeight > 0 ? formatEditableWeight(avgWeight) : "";

    if (
      mode === "default_case_weight" &&
      !(line?.defaultCaseWeightLbs ?? "").trim() &&
      avgText
    ) {
      setValue(`lines.${index}.defaultCaseWeightLbs`, avgText, {
        shouldDirty: true,
      });
    }
    if (mode === "manual_case_weights" && quantityCases > 0) {
      const entries = line?.caseWeightEntries ?? [];
      if (entries.slice(0, quantityCases).every((v) => !v) && avgText) {
        setValue(
          `lines.${index}.caseWeightEntries`,
          Array.from({ length: quantityCases }, () => avgText),
          { shouldDirty: true },
        );
      }
    }
  }

  return (
    <div style={{ borderBottom: `1px solid ${T.border}` }}>
      {/* Main row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: COL,
          gap: "16px",
          padding: "14px 28px",
          alignItems: "start",
        }}
      >
        {/* 1. Product */}
        <div>
          <Controller
            control={control}
            name={`lines.${index}.productId`}
            render={({ field, fieldState }) => (
              <Select
                value={field.value || ""}
                onValueChange={field.onChange}
                disabled={disabled || productsLoading}
              >
                <SelectTrigger
                  aria-invalid={fieldState.invalid}
                  style={{
                    width: "100%",
                    height: 38,
                    borderRadius: 8,
                    border: `1px solid ${
                      fieldState.invalid
                        ? "oklch(0.55 0.22 25)"
                        : T.border
                    }`,
                    fontSize: 14,
                  }}
                >
                  <SelectValue
                    placeholder={
                      productsLoading ? "Loading…" : "Select product…"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {sku && (
            <div
              style={{
                fontSize: 11,
                color: T.mutedSoft,
                fontFamily: T.mono,
                marginTop: 5,
                paddingLeft: 2,
              }}
            >
              {sku}
            </div>
          )}
        </div>

        {/* 2. Pricing badge */}
        <div>
          <div
            style={{
              height: 38,
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: isCatchWeight ? T.accentSoft : T.surfaceAlt,
                color: isCatchWeight ? T.accent : T.muted,
                fontSize: 12,
                fontWeight: 500,
                padding: "5px 10px",
                borderRadius: 6,
                border: `1px solid ${isCatchWeight ? T.accentBorder : T.border}`,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  background: "currentColor",
                  borderRadius: "50%",
                  flexShrink: 0,
                }}
              />
              {isCatchWeight ? "Variable weight" : "Fixed case"}
            </div>
          </div>
          <div
            style={{
              fontSize: 11,
              color: T.mutedSoft,
              marginTop: 5,
              paddingLeft: 2,
            }}
          >
            {isCatchWeight
              ? "Priced per lb · weight per case"
              : "Priced per case · fixed weight"}
          </div>
        </div>

        {/* 3. Cases */}
        <Input
          type="number"
          min={1}
          step={1}
          disabled={disabled}
          style={{ height: 38, textAlign: "center", borderRadius: 8 }}
          {...register(`lines.${index}.quantityCases`)}
        />

        {/* 4. Weight — toggle button for catch_weight, plain input for fixed */}
        {isCatchWeight ? (
          <button
            type="button"
            onClick={() => setExpanded((o) => !o)}
            disabled={disabled}
            style={{
              width: "100%",
              height: 38,
              padding: "0 12px",
              border: `1px solid ${
                expanded ? T.accent : complete ? T.borderStrong : T.border
              }`,
              borderRadius: 8,
              background: expanded ? T.accentSoft : T.surface,
              cursor: disabled ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              color: T.text,
              fontFamily: "inherit",
            }}
          >
            <span
              style={{ fontSize: 11, color: T.mutedSoft, fontWeight: 500 }}
            >
              {filled}/{quantityCases} cases
            </span>
            <span
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  fontFamily: T.mono,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmt2(totalWeightLbs)}
              </span>
              <ChevronDown
                style={{
                  width: 14,
                  height: 14,
                  color: T.muted,
                  transform: expanded ? "rotate(180deg)" : "none",
                  transition: "transform 0.15s",
                  flexShrink: 0,
                }}
              />
            </span>
          </button>
        ) : (
          <div>
            <div style={{ position: "relative" }}>
              <Input
                type="number"
                min={0}
                step="0.01"
                disabled={disabled}
                style={{
                  height: 38,
                  textAlign: "right",
                  paddingRight: 30,
                  borderRadius: 8,
                }}
                {...register(`lines.${index}.weightLbs`)}
              />
              <span
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: T.mutedSoft,
                  fontSize: 11,
                  pointerEvents: "none",
                }}
              >
                lb
              </span>
            </div>
            <button
              type="button"
              onClick={() => setExpanded((o) => !o)}
              style={{
                marginTop: 4,
                fontSize: 11,
                color: expanded ? T.accent : T.mutedSoft,
                background: "none",
                border: "none",
                padding: "0 2px",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <ChevronDown
                style={{
                  width: 10,
                  height: 10,
                  transform: expanded ? "rotate(180deg)" : "none",
                  transition: "transform 0.15s",
                }}
              />
              Lot · expires
            </button>
          </div>
        )}

        {/* 5. Unit price */}
        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: T.mutedSoft,
              fontSize: 13,
              zIndex: 1,
              pointerEvents: "none",
            }}
          >
            $
          </span>
          <Input
            type="number"
            min={0}
            step="0.0001"
            disabled={disabled}
            style={{
              height: 38,
              textAlign: "right",
              paddingLeft: 22,
              paddingRight: 30,
              borderRadius: 8,
            }}
            {...register(`lines.${index}.unitPrice`)}
          />
          <span
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: T.mutedSoft,
              fontSize: 11,
              pointerEvents: "none",
            }}
          >
            {isCatchWeight ? "/lb" : "/cs"}
          </span>
        </div>

        {/* 6. Line total */}
        <div
          style={{
            textAlign: "right",
            fontFamily: T.mono,
            fontSize: 15,
            fontWeight: 600,
            color: T.text,
            fontVariantNumeric: "tabular-nums",
            marginTop: 8,
          }}
        >
          <LineRowTotal control={control} index={index} />
        </div>

        {/* 7. Delete */}
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled || !canRemove}
          aria-label="Remove line"
          style={{
            width: 30,
            height: 30,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            borderRadius: 6,
            color: T.mutedSoft,
            cursor: disabled || !canRemove ? "not-allowed" : "pointer",
            opacity: !canRemove ? 0.3 : 1,
            marginTop: 4,
          }}
        >
          <Trash2 style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Expanded tray */}
      {expanded ? (
        <div
          style={{
            background: T.surfaceAlt,
            padding: "20px 28px 22px",
            borderTop: `1px dashed ${T.borderStrong}`,
          }}
        >
          {isCatchWeight ? (
            <CatchWeightTray
              control={control}
              register={register}
              setValue={setValue}
              index={index}
              line={line}
              quantityCases={quantityCases}
              totalWeightLbs={totalWeightLbs}
              weightEntryMode={weightEntryMode}
              onModeChange={handleModeChange}
              disabled={disabled}
            />
          ) : (
            <LotExpiresTray
              control={control}
              register={register}
              index={index}
              disabled={disabled}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Catch-weight expanded tray ─────────────────────────────────────────────
function CatchWeightTray({
  control,
  register,
  setValue,
  index,
  line,
  quantityCases,
  totalWeightLbs,
  weightEntryMode,
  onModeChange,
  disabled,
}: {
  control: Control<SupplierInvoiceFormValues>;
  register: UseFormRegister<SupplierInvoiceFormValues>;
  setValue: UseFormSetValue<SupplierInvoiceFormValues>;
  index: number;
  line: Partial<SupplierInvoiceFormValues["lines"][number]> | undefined;
  quantityCases: number;
  totalWeightLbs: number;
  weightEntryMode: SupplierInvoiceWeightEntryMode;
  onModeChange: (mode: SupplierInvoiceWeightEntryMode) => void;
  disabled: boolean;
}) {
  const avgPerCase = quantityCases > 0 ? totalWeightLbs / quantityCases : 0;

  return (
    <>
      {/* Header: label + segmented control + helper text + stats */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{ fontSize: 12, fontWeight: 600, color: T.text }}
          >
            Per-case weights
          </div>
          <Segmented
            value={weightEntryMode}
            onChange={(v) =>
              onModeChange(v as SupplierInvoiceWeightEntryMode)
            }
            options={WEIGHT_MODES}
            disabled={disabled}
          />
          <span style={{ fontSize: 11, color: T.mutedSoft }}>
            {weightEntryMode === "manual_case_weights" &&
              "Enter each case weight individually."}
            {weightEntryMode === "default_case_weight" &&
              "Apply one weight to all cases."}
            {weightEntryMode === "total_weight" &&
              "Distribute a total evenly across cases."}
          </span>
        </div>
        <div
          style={{ display: "flex", gap: 22, alignItems: "baseline" }}
        >
          <Stat label="Cases" value={quantityCases} />
          <Stat label="Avg / case" value={`${fmt2(avgPerCase)} lb`} />
          <Stat
            label="Total"
            value={`${fmt2(totalWeightLbs)} lb`}
            highlight
          />
        </div>
      </div>

      {/* Mode body */}
      {weightEntryMode === "total_weight" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            maxWidth: 540,
          }}
        >
          <label
            style={{ fontSize: 12, color: T.muted, minWidth: 90 }}
          >
            Total weight
          </label>
          <div style={{ position: "relative", flex: 1 }}>
            <Input
              type="number"
              min={0}
              step="0.01"
              disabled={disabled}
              style={{
                height: 38,
                textAlign: "right",
                paddingRight: 36,
                borderRadius: 8,
              }}
              {...register(`lines.${index}.weightLbs`)}
            />
            <span
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: T.mutedSoft,
                fontSize: 12,
                pointerEvents: "none",
              }}
            >
              lbs
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: T.mutedSoft,
              fontFamily: T.mono,
              whiteSpace: "nowrap",
            }}
          >
            = {fmt2(avgPerCase)} lb / case
          </div>
        </div>
      )}

      {weightEntryMode === "default_case_weight" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            maxWidth: 540,
          }}
        >
          <label
            style={{ fontSize: 12, color: T.muted, minWidth: 90 }}
          >
            Each case
          </label>
          <div style={{ position: "relative", flex: 1 }}>
            <Input
              type="number"
              min={0}
              step="0.01"
              disabled={disabled}
              style={{
                height: 38,
                textAlign: "right",
                paddingRight: 36,
                borderRadius: 8,
              }}
              {...register(`lines.${index}.defaultCaseWeightLbs`)}
            />
            <span
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: T.mutedSoft,
                fontSize: 12,
                pointerEvents: "none",
              }}
            >
              lbs
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: T.mutedSoft,
              fontFamily: T.mono,
              whiteSpace: "nowrap",
            }}
          >
            × {quantityCases} = {fmt2(totalWeightLbs)} lb total
          </div>
        </div>
      )}

      {weightEntryMode === "manual_case_weights" &&
        (quantityCases > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 8,
            }}
          >
            {Array.from({ length: quantityCases }, (_, i) => (
              <div key={i} style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: T.mutedSoft,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    zIndex: 1,
                    pointerEvents: "none",
                  }}
                >
                  #{i + 1}
                </span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  disabled={disabled}
                  style={{
                    height: 38,
                    textAlign: "right",
                    paddingLeft: 38,
                    paddingRight: 32,
                    borderRadius: 8,
                  }}
                  {...register(
                    `lines.${index}.caseWeightEntries.${i}`,
                  )}
                />
                <span
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: T.mutedSoft,
                    fontSize: 11,
                    pointerEvents: "none",
                  }}
                >
                  lb
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: T.muted }}>
            Enter a case count to see per-case weight inputs.
          </div>
        ))}

      {/* Lot + Expires + Pricing type */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 18,
          paddingTop: 16,
          borderTop: `1px dashed ${T.borderStrong}`,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 180, maxWidth: 260 }}>
          <label style={lbl}>
            Lot #{" "}
            <span
              style={{
                color: T.mutedSoft,
                fontWeight: 400,
                textTransform: "none",
                letterSpacing: 0,
              }}
            >
              (optional)
            </span>
          </label>
          <Input
            placeholder="auto-generated"
            disabled={disabled}
            style={{
              height: 38,
              borderRadius: 8,
              fontFamily: T.mono,
              fontSize: 13,
            }}
            {...register(`lines.${index}.lotNumberOverride`)}
          />
        </div>
        <div style={{ flex: 1, minWidth: 180, maxWidth: 260 }}>
          <label style={lbl}>
            Expires{" "}
            <span
              style={{
                color: T.mutedSoft,
                fontWeight: 400,
                textTransform: "none",
                letterSpacing: 0,
              }}
            >
              (optional)
            </span>
          </label>
          <Input
            type="date"
            disabled={disabled}
            style={{ height: 38, borderRadius: 8, fontSize: 13 }}
            {...register(`lines.${index}.expirationDateOverride`)}
          />
        </div>
        <div style={{ flex: 1, minWidth: 160, maxWidth: 220 }}>
          <label style={lbl}>Pricing type</label>
          <Controller
            control={control}
            name={`lines.${index}.unitType`}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={disabled}
              >
                <SelectTrigger
                  style={{ height: 38, borderRadius: 8, fontSize: 13 }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="catch_weight">
                    Variable weight
                  </SelectItem>
                  <SelectItem value="fixed_case">Fixed case</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
    </>
  );
}

// ── Fixed-case tray (lot / expires / type) ─────────────────────────────────
function LotExpiresTray({
  control,
  register,
  index,
  disabled,
}: {
  control: Control<SupplierInvoiceFormValues>;
  register: UseFormRegister<SupplierInvoiceFormValues>;
  index: number;
  disabled: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 180, maxWidth: 260 }}>
        <label style={lbl}>
          Lot #{" "}
          <span
            style={{
              color: T.mutedSoft,
              fontWeight: 400,
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            (optional)
          </span>
        </label>
        <Input
          placeholder="auto-generated"
          disabled={disabled}
          style={{
            height: 38,
            borderRadius: 8,
            fontFamily: T.mono,
            fontSize: 13,
          }}
          {...register(`lines.${index}.lotNumberOverride`)}
        />
      </div>
      <div style={{ flex: 1, minWidth: 180, maxWidth: 260 }}>
        <label style={lbl}>
          Expires{" "}
          <span
            style={{
              color: T.mutedSoft,
              fontWeight: 400,
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            (optional)
          </span>
        </label>
        <Input
          type="date"
          disabled={disabled}
          style={{ height: 38, borderRadius: 8, fontSize: 13 }}
          {...register(`lines.${index}.expirationDateOverride`)}
        />
      </div>
      <div style={{ flex: 1, minWidth: 160, maxWidth: 220 }}>
        <label style={lbl}>Pricing type</label>
        <Controller
          control={control}
          name={`lines.${index}.unitType`}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
            >
              <SelectTrigger
                style={{ height: 38, borderRadius: 8, fontSize: 13 }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="catch_weight">Variable weight</SelectItem>
                <SelectItem value="fixed_case">Fixed case</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
    </div>
  );
}
