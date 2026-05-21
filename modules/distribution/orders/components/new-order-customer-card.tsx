"use client";

import { useState } from "react";
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
import { Card } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/utils/currency";
import {
  useCustomer,
  useCustomerCreditSnapshot,
  useCustomerSearch,
} from "@/modules/distribution/customers/hooks/use-customers";
import type { CustomerSearchResult } from "@/modules/distribution/customers/services/customers";

import type { NewOrderFormValues } from "./new-order-form.schema";

const C = {
  ink: "var(--color-ink)",
  ink2: "var(--color-ink-warm)",
  muted: "var(--color-subtle)",
  surface: "var(--color-card)",
  line: "var(--color-border-default)",
  line2: "var(--color-divider)",
  good: "var(--color-success-fg)",
  goodSoft: "var(--color-success-bg)",
  info: "var(--color-info-fg)",
  infoSoft: "var(--color-info-bg)",
  radius: "10px",
  radiusSm: "6px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

interface NewOrderCustomerCardProps {
  control: Control<NewOrderFormValues>;
}

export function NewOrderCustomerCard({ control }: NewOrderCustomerCardProps) {
  const customerId = useWatch({ control, name: "customerId" });
  const [query, setQuery] = useState("");
  const { data: searchResults, isFetching } = useCustomerSearch(query);
  // When a customer is already selected (e.g. ?customerId= deep-link or
  // editing an existing order), resolve the full record by id so we can
  // render the chip without waiting for the user to type.
  const { data: selected, isLoading: selectedLoading } = useCustomer(customerId);
  const { data: credit } = useCustomerCreditSnapshot(customerId);
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
    <Card className="gap-0 rounded-[10px] border-border-default bg-card p-5 shadow-none ring-0 sm:p-[22px]">
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
            color: "var(--color-card)",
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
                  items={searchResults ?? []}
                  itemToStringValue={(c: CustomerSearchResult) => c.name}
                  inputValue={query}
                  onInputValueChange={setQuery}
                  // Server is the filter — don't run the built-in client filter
                  // on top of results, otherwise paginated results disappear.
                  filter={null}
                  value={null}
                  onValueChange={(c: CustomerSearchResult | null) =>
                    field.onChange(c?.id ?? "")
                  }
                >
                  <ComboboxTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        aria-invalid={fieldState.invalid}
                        className="h-auto w-full justify-start border-border-default bg-card px-3.5 py-2.5 text-sm font-normal text-subtle shadow-none hover:bg-divider"
                        disabled={selectedLoading}
                      >
                        <ComboboxValue>
                          {selectedLoading
                            ? "Loading customer…"
                            : "Search customers by name, phone, or email…"}
                        </ComboboxValue>
                      </Button>
                    }
                  />
                  <ComboboxContent>
                    <ComboboxInput showTrigger={false} placeholder="Search customers…" />
                    <ComboboxEmpty>
                      {isFetching ? "Searching…" : "No customers found."}
                    </ComboboxEmpty>
                    <ComboboxList>
                      {(c: CustomerSearchResult) => {
                        const loc = c.defaultAddress
                          ? [c.defaultAddress.city, c.defaultAddress.state]
                              .filter(Boolean)
                              .join(", ")
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
                                  {[c.phoneNumber, c.email, loc].filter(Boolean).join(" · ") || "No contact info"}
                                </div>
                              </div>
                            </div>
                          </ComboboxItem>
                        );
                      }}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                <FieldError className="mt-1 text-xs">{fieldState.error?.message}</FieldError>
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
                      color: "var(--color-card)",
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
                  <Button
                    type="button"
                    onClick={() => field.onChange("")}
                    variant="ghost"
                    size="xs"
                    className="shrink-0 text-xs text-subtle hover:bg-card/50 hover:text-ink"
                  >
                    Change
                  </Button>
                </div>

                {/* Info chips */}
                {(selected.fuelSurchargeAmount ||
                  selected.abbreviation ||
                  credit) && (
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                      marginTop: "10px",
                    }}
                  >
                    {credit ? (
                      <CreditExposureChip
                        balanceDue={credit.balanceDue}
                        creditLimit={credit.creditLimit}
                      />
                    ) : null}
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
                          {formatMoney(selected.fuelSurchargeAmount)}
                        </span>
                      )}
                    {selected.abbreviation && (
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
                        <span style={{ fontFamily: C.mono }}>{selected.abbreviation}</span>
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
              <Input
                {...field}
                id="new-order-order-date"
                type="date"
                className="border-border-default bg-card font-mono text-[13px] text-ink shadow-none"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && (
                <FieldError className="text-xs">{fieldState.error?.message}</FieldError>
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
              <Input
                {...field}
                id="new-order-delivery-date"
                type="date"
                className="border-border-default bg-card font-mono text-[13px] text-ink shadow-none"
                aria-invalid={fieldState.invalid}
              />
            </div>
          )}
        />
      </div>
    </Card>
  );
}

/**
 * Chip showing open AR balance against the customer's credit limit.
 * Three tones:
 *   - No limit configured     → neutral, just shows the balance.
 *   - Within 80% of limit     → neutral with "of $X limit" helper.
 *   - 80–100% of limit         → warning (amber).
 *   - Over limit               → danger (red). Server also blocks new
 *     orders in this state via assertCustomerWithinCreditLimit.
 */
function CreditExposureChip({
  balanceDue,
  creditLimit,
}: {
  balanceDue: string;
  creditLimit: string | null;
}) {
  const balance = parseFloat(balanceDue);
  const limit = creditLimit ? parseFloat(creditLimit) : null;
  if (!Number.isFinite(balance) && (limit == null || !Number.isFinite(limit))) {
    return null;
  }

  let tone: "neutral" | "warning" | "danger" = "neutral";
  let trailing: string | null = null;
  if (limit != null && Number.isFinite(limit) && limit > 0) {
    if (balance > limit) tone = "danger";
    else if (balance >= limit * 0.8) tone = "warning";
    trailing =
      tone === "danger"
        ? `over $${limit.toFixed(2)} limit`
        : `of $${limit.toFixed(2)} limit`;
  }

  const palette =
    tone === "danger"
      ? { bg: "var(--color-danger-bg)", fg: "var(--color-danger-fg)" }
      : tone === "warning"
        ? { bg: "var(--color-warning-bg)", fg: "var(--color-warning-fg)" }
        : { bg: C.line2, fg: C.ink2 };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "100px",
        fontSize: "12px",
        background: palette.bg,
        color: palette.fg,
      }}
    >
      <b style={{ fontWeight: 500 }}>
        {tone === "danger" ? "Over limit" : "Balance"}
      </b>{" "}
      · {formatMoney(balanceDue)}
      {trailing ? (
        <span style={{ opacity: 0.85 }}> {trailing}</span>
      ) : null}
    </span>
  );
}
