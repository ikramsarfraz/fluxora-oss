"use client";

import { Controller, useWatch, type Control } from "react-hook-form";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { useCustomers } from "@/hooks/use-customers";
import type { CustomerListItem } from "@/services/customers";

import type { NewOrderFormValues } from "./new-order-form.schema";

const C = {
  ink: "#0c0a09",
  ink2: "#44403c",
  muted: "#78716c",
  surface: "#ffffff",
  line: "#e7e5e4",
  line2: "#f5f5f4",
  good: "oklch(58% 0.13 155)",
  goodSoft: "oklch(96% 0.04 155)",
  info: "oklch(60% 0.15 240)",
  infoSoft: "oklch(96% 0.03 240)",
  radius: "10px",
  radiusSm: "6px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

interface NewOrderCustomerCardProps {
  control: Control<NewOrderFormValues>;
}

export function NewOrderCustomerCard({ control }: NewOrderCustomerCardProps) {
  const { data: customers, isLoading } = useCustomers();
  const customerId = useWatch({ control, name: "customerId" });
  const selected = customers?.find(c => c.id === customerId) ?? null;
  const isStep1Done = !!selected;

  const defaultAddress = selected
    ? (selected.addresses?.find(a => a.isDefault) ?? selected.addresses?.[0])
    : null;

  const metaLine = [
    selected?.phoneNumber,
    defaultAddress ? [defaultAddress.city, defaultAddress.state].filter(Boolean).join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const avatarText = selected
    ? selected.name
        .split(" ")
        .map(s => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.line}`,
        borderRadius: C.radius,
        padding: "20px 22px",
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "13px",
          fontWeight: 600,
          marginBottom: "14px",
          color: C.ink,
        }}
      >
        <span
          style={{
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            background: isStep1Done ? C.good : C.ink,
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: "10px",
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {isStep1Done ? "✓" : "1"}
        </span>
        Customer
      </div>

      {/* Customer selector or chip */}
      <Controller
        control={control}
        name="customerId"
        render={({ field, fieldState }) => (
          <div>
            {!selected ? (
              <div>
                <Combobox
                  items={customers ?? []}
                  itemToStringValue={(c: CustomerListItem) => c.name}
                  value={null}
                  onValueChange={(c: CustomerListItem | null) =>
                    field.onChange(c?.id ?? "")
                  }
                >
                  <ComboboxTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        aria-invalid={fieldState.invalid}
                        style={{
                          width: "100%",
                          justifyContent: "flex-start",
                          fontWeight: "normal",
                          padding: "11px 14px",
                          borderRadius: C.radiusSm,
                          border: `1px solid ${fieldState.invalid ? "oklch(55% 0.22 25)" : C.line}`,
                          background: C.surface,
                          height: "auto",
                          color: C.muted,
                          fontSize: "14px",
                        }}
                        disabled={isLoading}
                      >
                        <ComboboxValue>
                          {isLoading
                            ? "Loading customers…"
                            : "Search customers by name, ID, or phone…"}
                        </ComboboxValue>
                      </Button>
                    }
                  />
                  <ComboboxContent>
                    <ComboboxInput showTrigger={false} placeholder="Search customers…" />
                    <ComboboxEmpty>No customers found.</ComboboxEmpty>
                    <ComboboxList>
                      {(c: CustomerListItem) => {
                        const addr =
                          c.addresses?.find(a => a.isDefault) ?? c.addresses?.[0];
                        const loc = addr
                          ? [addr.city, addr.state].filter(Boolean).join(", ")
                          : null;
                        return (
                          <ComboboxItem key={c.id} value={c}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                width: "100%",
                                gap: "10px",
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 500 }}>{c.name}</div>
                                <div style={{ fontSize: "12px", color: C.muted }}>
                                  {[c.phoneNumber, loc].filter(Boolean).join(" · ") || "No contact info"}
                                </div>
                              </div>
                            </div>
                          </ComboboxItem>
                        );
                      }}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {fieldState.invalid && (
                  <span style={{ fontSize: "12px", color: "oklch(55% 0.22 25)", marginTop: "4px", display: "block" }}>
                    {fieldState.error?.message}
                  </span>
                )}
              </div>
            ) : (
              <div>
                {/* Selected customer chip */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "12px 14px",
                    background: C.goodSoft,
                    border: `1px solid color-mix(in oklch, ${C.good} 30%, transparent)`,
                    borderRadius: C.radiusSm,
                  }}
                >
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "50%",
                      background: C.ink,
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 600,
                      fontSize: "13px",
                      flexShrink: 0,
                    }}
                  >
                    {avatarText}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: C.ink }}>{selected.name}</div>
                    {metaLine && (
                      <div style={{ fontSize: "12px", color: C.muted }}>{metaLine}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => field.onChange("")}
                    style={{
                      background: "none",
                      border: 0,
                      color: C.muted,
                      padding: "4px 8px",
                      fontSize: "12px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      flexShrink: 0,
                    }}
                  >
                    Change
                  </button>
                </div>

                {/* Info chips */}
                {(selected.fuelSurchargeAmount ||
                  selected.invoicePrefix) && (
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                      marginTop: "10px",
                    }}
                  >
                    {selected.fuelSurchargeAmount &&
                      Number(selected.fuelSurchargeAmount) > 0 && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 10px",
                            borderRadius: "100px",
                            fontSize: "12px",
                            background: C.infoSoft,
                            color: C.info,
                          }}
                        >
                          <b style={{ fontWeight: 500 }}>Fuel surcharge</b> ·{" "}
                          ${Number(selected.fuelSurchargeAmount).toFixed(2)}
                        </span>
                      )}
                    {selected.invoicePrefix && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 10px",
                          borderRadius: "100px",
                          fontSize: "12px",
                          background: C.line2,
                          color: C.ink2,
                        }}
                      >
                        <b style={{ fontWeight: 500 }}>Invoice prefix</b> ·{" "}
                        <span style={{ fontFamily: C.mono }}>{selected.invoicePrefix}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      />

      {/* Date row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "14px",
          marginTop: "14px",
        }}
      >
        <Controller
          control={control}
          name="orderDate"
          render={({ field, fieldState }) => (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label
                htmlFor="new-order-order-date"
                style={{ fontSize: "12px", color: C.muted, fontWeight: 500 }}
              >
                Order date
              </label>
              <input
                {...field}
                id="new-order-order-date"
                type="date"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: `1px solid ${fieldState.invalid ? "oklch(55% 0.22 25)" : C.line}`,
                  borderRadius: C.radiusSm,
                  background: C.surface,
                  fontFamily: C.mono,
                  fontSize: "13px",
                  color: C.ink,
                  outline: "none",
                }}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && (
                <span style={{ fontSize: "12px", color: "oklch(55% 0.22 25)" }}>
                  {fieldState.error?.message}
                </span>
              )}
            </div>
          )}
        />
        <Controller
          control={control}
          name="deliveryDate"
          render={({ field, fieldState }) => (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label
                htmlFor="new-order-delivery-date"
                style={{ fontSize: "12px", color: C.muted, fontWeight: 500 }}
              >
                Delivery date
              </label>
              <input
                {...field}
                id="new-order-delivery-date"
                type="date"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: `1px solid ${fieldState.invalid ? "oklch(55% 0.22 25)" : C.line}`,
                  borderRadius: C.radiusSm,
                  background: C.surface,
                  fontFamily: C.mono,
                  fontSize: "13px",
                  color: C.ink,
                  outline: "none",
                }}
                aria-invalid={fieldState.invalid}
              />
            </div>
          )}
        />
      </div>
    </div>
  );
}
