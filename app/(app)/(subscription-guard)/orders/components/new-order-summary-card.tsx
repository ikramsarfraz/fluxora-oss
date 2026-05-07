"use client";

import { useMemo, useState } from "react";
import { Controller, useWatch, type Control } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCustomers } from "@/hooks/use-customers";
import { useProducts } from "@/hooks/use-products";
import { formatMoney } from "@/lib/utils/currency";
import type { ProductListItem } from "@/services/products";

import { calculateLineTotal } from "./new-order-line-utils";
import type { NewOrderFormValues } from "./new-order-form.schema";

const C = {
  ink: "#0c0a09",
  ink2: "#44403c",
  muted: "#78716c",
  surface: "#ffffff",
  line: "#e7e5e4",
  line2: "#f5f5f4",
  accent: "oklch(48% 0.16 265)",
  radius: "10px",
  radiusSm: "6px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

interface NewOrderSummaryCardProps {
  control: Control<NewOrderFormValues>;
  showDiscountInput?: boolean;
}

export function NewOrderSummaryCard({
  control,
  showDiscountInput = true,
}: NewOrderSummaryCardProps) {
  const [discountOpen, setDiscountOpen] = useState(false);

  const { data: customers } = useCustomers();
  const { data: products } = useProducts();

  const customerId = useWatch({ control, name: "customerId" });
  const lines = useWatch({ control, name: "lines" });
  const addFuelSurcharge = useWatch({ control, name: "addFuelSurcharge" });
  const discountInput = useWatch({ control, name: "discountAmount" });

  const customer = useMemo(
    () => customers?.find(c => c.id === customerId) ?? null,
    [customers, customerId],
  );

  const productsById = useMemo(() => {
    const map = new Map<string, ProductListItem>();
    for (const p of products ?? []) map.set(p.id, p);
    return map;
  }, [products]);

  const subtotal = useMemo(() => {
    let total = 0;
    for (const line of lines ?? []) {
      total += calculateLineTotal(line, productsById.get(line.productId)) ?? 0;
    }
    return total;
  }, [lines, productsById]);

  const fuelSurchargeAmt = useMemo(() => {
    if (!addFuelSurcharge) return 0;
    const raw = customer?.fuelSurchargeAmount;
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  }, [addFuelSurcharge, customer]);

  const fuelPct = useMemo(() => {
    if (!customer?.fuelSurchargeAmount) return null;
    const n = Number(customer.fuelSurchargeAmount);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }, [customer]);

  const discount = useMemo(() => {
    const n = Number(discountInput);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [discountInput]);

  const total = Math.max(0, subtotal + fuelSurchargeAmt - discount);

  return (
    <Card className="gap-0 rounded-[10px] border-stone-line bg-stone-surface px-5 py-[18px] shadow-none ring-0">
      <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "4px", color: C.ink }}>
        Estimate
      </div>
      <div style={{ fontSize: "12px", color: C.muted, marginBottom: "14px" }}>
        Final amounts confirmed at fulfillment.
      </div>

      {/* Rows */}
      <SumRow label="Subtotal" value={formatMoney(subtotal)} muted={subtotal === 0} />
      <SumRow
        label={
          <>
            Fuel surcharge{" "}
            {fuelPct !== null && (
              <span style={{ fontSize: "11px" }}>${fuelPct.toFixed(2)}</span>
            )}
          </>
        }
        value={fuelSurchargeAmt > 0 ? formatMoney(fuelSurchargeAmt) : "—"}
        muted={fuelSurchargeAmt === 0}
      />
      <SumRow
        label="Discount"
        value={discount > 0 ? `−${formatMoney(discount)}` : "—"}
        muted={discount === 0}
      />

      {/* Grand total */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "12px 0 5px",
          marginTop: "8px",
          borderTop: `1px solid ${C.line2}`,
          fontSize: "16px",
          fontWeight: 600,
          color: C.ink,
        }}
      >
        <span>Estimated total</span>
        <span style={{ fontFamily: C.mono }}>{formatMoney(total)}</span>
      </div>

      {/* Fuel toggle */}
      <Controller
        control={control}
        name="addFuelSurcharge"
        render={({ field }) => (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 0",
              fontSize: "13px",
              borderTop: `1px solid ${C.line2}`,
              marginTop: "10px",
              color: C.ink2,
            }}
          >
            <span>Apply fuel surcharge</span>
            <Button
              type="button"
              role="switch"
              aria-checked={field.value}
              onClick={() => field.onChange(!field.value)}
              variant="ghost"
              className={`relative h-5 w-[34px] shrink-0 rounded-full p-0 ${
                field.value
                  ? "bg-stone-ink hover:bg-stone-ink/90"
                  : "bg-stone-line hover:bg-stone-line"
              }`}
            >
              <span
                className={`absolute top-0.5 size-4 rounded-full bg-white transition-[left] ${
                  field.value ? "left-4" : "left-0.5"
                }`}
              />
            </Button>
          </div>
        )}
      />

      {/* Discount toggle/input */}
      {showDiscountInput && <div style={{ borderTop: `1px solid ${C.line2}`, paddingTop: "10px" }}>
        {!discountOpen ? (
          <Button
            type="button"
            onClick={() => setDiscountOpen(true)}
            variant="link"
            className="h-auto p-0 text-[13px] font-medium text-primary"
          >
            + Add discount
          </Button>
        ) : (
          <Controller
            control={control}
            name="discountAmount"
            render={({ field, fieldState }) => (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", color: C.muted, fontWeight: 500 }}>
                  Discount amount
                </label>
                <Input
                  {...field}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="border-stone-line bg-stone-surface font-mono text-[13px] text-stone-ink shadow-none"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError className="text-xs">{fieldState.error?.message}</FieldError>
                )}
              </div>
            )}
          />
        )}
      </div>}
    </Card>
  );
}

function SumRow({
  label,
  value,
  muted,
}: {
  label: React.ReactNode;
  value: string;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "5px 0",
        fontSize: "13px",
        color: muted ? C.muted : C.ink2,
      }}
    >
      <span>{label}</span>
      <span style={{ fontFamily: C.mono }}>{value}</span>
    </div>
  );
}
