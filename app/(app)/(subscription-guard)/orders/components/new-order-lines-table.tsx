"use client";

import { useMemo, useState } from "react";
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type UseFormSetValue,
} from "react-hook-form";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/use-products";
import { useCustomers } from "@/hooks/use-customers";
import { formatMoney } from "@/lib/utils/currency";
import type { CustomerListItem } from "@/services/customers";
import type { ProductListItem } from "@/services/products";

import type { NewOrderFormValues } from "./new-order-form.schema";
import {
  calculateLineTotal,
  formatSalesUnitLabel,
  getDefaultSalesUnit,
  getSalesUnits,
  getSelectedSalesUnit,
  inferLineUnitType,
} from "./new-order-line-utils";

const C = {
  ink: "#0c0a09",
  ink2: "#44403c",
  muted: "#78716c",
  surface: "#ffffff",
  line: "#e7e5e4",
  line2: "#f5f5f4",
  accent: "oklch(48% 0.16 265)",
  good: "oklch(58% 0.13 155)",
  radius: "10px",
  radiusSm: "6px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

interface NewOrderLinesTableProps {
  control: Control<NewOrderFormValues>;
  setValue: UseFormSetValue<NewOrderFormValues>;
}

function newLineDefaults(): NewOrderFormValues["lines"][number] {
  return {
    key:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: "",
    salesUnitId: "",
    unitType: "catch_weight",
    quantity: "",
    pricePerLb: "",
  };
}

export function NewOrderLinesTable({
  control,
  setValue,
}: NewOrderLinesTableProps) {
  const [notesOpen, setNotesOpen] = useState(false);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines",
    keyName: "_fieldId",
  });

  const customerId = useWatch({ control, name: "customerId" });
  const lines = useWatch({ control, name: "lines" });

  const { data: products } = useProducts();
  const { data: customers } = useCustomers();

  const customer: CustomerListItem | null = useMemo(
    () => customers?.find(c => c.id === customerId) ?? null,
    [customers, customerId],
  );

  const productsById = useMemo(() => {
    const map = new Map<string, ProductListItem>();
    for (const product of products ?? []) map.set(product.id, product);
    return map;
  }, [products]);

  const takenProductIds = useMemo(
    () => new Set((lines ?? []).map(l => l.productId).filter(Boolean)),
    [lines],
  );

  const filledCount = (lines ?? []).filter(l => l.productId).length;
  const isStep2Done = filledCount > 0;

  function resolvePricePerLb(productId: string): string {
    if (!productId) return "";
    const contract = customer?.productPrices?.find(p => p.productId === productId);
    if (contract?.pricePerLb) return contract.pricePerLb;
    return productsById.get(productId)?.defaultPricePerLb ?? "";
  }

  function handleProductSelected(index: number, product: ProductListItem) {
    const defaultSalesUnit = getDefaultSalesUnit(product);
    setValue(`lines.${index}.productId`, product.id, { shouldValidate: true });
    setValue(`lines.${index}.salesUnitId`, defaultSalesUnit?.unitId ?? "", {
      shouldValidate: true,
    });
    setValue(`lines.${index}.unitType`, inferLineUnitType(product), {
      shouldValidate: true,
    });
    setValue(`lines.${index}.pricePerLb`, resolvePricePerLb(product.id), {
      shouldValidate: true,
    });
  }

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
          justifyContent: "space-between",
          marginBottom: "14px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            fontWeight: 600,
            color: C.ink,
          }}
        >
          <span
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: isStep2Done ? C.good : C.line,
              color: isStep2Done ? "#fff" : C.muted,
              display: "grid",
              placeItems: "center",
              fontSize: "10px",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {isStep2Done ? "✓" : "2"}
          </span>
          Products
        </div>
        <span style={{ fontSize: "12px", color: C.muted }}>
          {filledCount === 0
            ? "No items"
            : `${filledCount} ${filledCount === 1 ? "item" : "items"}`}
        </span>
      </div>

      {/* Line items table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: C.muted,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "0 10px 8px",
                  width: "40%",
                }}
              >
                Product
              </th>
              <th
                style={{
                  textAlign: "left",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: C.muted,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "0 10px 8px",
                  width: "16%",
                }}
              >
                Unit
              </th>
              <th
                style={{
                  textAlign: "right",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: C.muted,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "0 10px 8px",
                  width: "12%",
                }}
              >
                Qty
              </th>
              <th
                style={{
                  textAlign: "right",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: C.muted,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "0 10px 8px",
                  width: "14%",
                }}
              >
                Price
              </th>
              <th
                style={{
                  textAlign: "right",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: C.muted,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "0 10px 8px",
                  width: "14%",
                }}
              >
                Total
              </th>
              <th style={{ width: "30px" }} />
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <LineRow
                key={field._fieldId}
                index={index}
                control={control}
                products={products ?? []}
                productsById={productsById}
                takenProductIds={takenProductIds}
                onProductSelected={product => handleProductSelected(index, product)}
                onRemove={() => remove(index)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Table footer */}
      <div
        style={{
          paddingTop: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          marginTop: fields.length > 0 ? "4px" : "0",
        }}
      >
        <button
          type="button"
          onClick={() => append(newLineDefaults())}
          style={{
            padding: "8px 14px",
            borderRadius: C.radiusSm,
            border: `1px dashed ${C.line}`,
            background: "none",
            color: C.muted,
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          + Add product
        </button>
        <span style={{ fontSize: "12px", color: C.muted }}>
          ⚖ Totals for weight-based items are estimates — actual weights are recorded at fulfillment
        </span>
      </div>

      {/* Notes toggle + row */}
      <div
        style={{
          paddingTop: "12px",
          borderTop: `1px solid ${C.line2}`,
          marginTop: "14px",
        }}
      >
        {!notesOpen ? (
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            style={{
              background: "none",
              border: 0,
              color: C.accent,
              fontSize: "13px",
              fontWeight: 500,
              padding: 0,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            + Add note
          </button>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <Controller
              control={control}
              name="customerNotes"
              render={({ field }) => (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", color: C.muted, fontWeight: 500 }}>
                    Customer note{" "}
                    <span style={{ color: C.muted, fontWeight: 400 }}>
                      — shown on invoice
                    </span>
                  </label>
                  <textarea
                    {...field}
                    placeholder="Delivery instructions, packing requests…"
                    rows={2}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: `1px solid ${C.line}`,
                      borderRadius: C.radiusSm,
                      background: C.surface,
                      resize: "vertical",
                      fontSize: "13px",
                      minHeight: "60px",
                      fontFamily: "inherit",
                      color: C.ink,
                      outline: "none",
                    }}
                  />
                </div>
              )}
            />
            <Controller
              control={control}
              name="internalNotes"
              render={({ field }) => (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", color: C.muted, fontWeight: 500 }}>
                    Internal note{" "}
                    <span style={{ color: C.muted, fontWeight: 400 }}>
                      — staff only
                    </span>
                  </label>
                  <textarea
                    {...field}
                    placeholder="Notes for warehouse and office staff…"
                    rows={2}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: `1px solid ${C.line}`,
                      borderRadius: C.radiusSm,
                      background: C.surface,
                      resize: "vertical",
                      fontSize: "13px",
                      minHeight: "60px",
                      fontFamily: "inherit",
                      color: C.ink,
                      outline: "none",
                    }}
                  />
                </div>
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface LineRowProps {
  index: number;
  control: Control<NewOrderFormValues>;
  products: ProductListItem[];
  productsById: Map<string, ProductListItem>;
  takenProductIds: Set<string>;
  onProductSelected: (product: ProductListItem) => void;
  onRemove: () => void;
}

function LineRow({
  index,
  control,
  products,
  productsById,
  takenProductIds,
  onProductSelected,
  onRemove,
}: LineRowProps) {
  const row = useWatch({ control, name: `lines.${index}` });

  const product = row?.productId ? productsById.get(row.productId) : undefined;
  const salesUnits = getSalesUnits(product);
  const salesUnit = getSelectedSalesUnit(product, row?.salesUnitId);
  const lineTotal = row ? calculateLineTotal(row, product) : null;

  const availableProducts = products.filter(
    p => p.id === row?.productId || !takenProductIds.has(p.id),
  );

  const tdBase: React.CSSProperties = {
    padding: "6px 10px",
    borderTop: `1px solid ${C.line2}`,
    verticalAlign: "top",
  };

  const inputBase: React.CSSProperties = {
    width: "100%",
    padding: "9px 10px",
    border: "1px solid transparent",
    borderRadius: C.radiusSm,
    background: C.line2,
    fontSize: "13px",
    fontFamily: "inherit",
    color: C.ink,
    outline: "none",
  };

  return (
    <tr>
      {/* Product */}
      <td style={tdBase}>
        <Controller
          control={control}
          name={`lines.${index}.productId`}
          render={({ fieldState }) => (
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <Combobox
                items={availableProducts}
                itemToStringValue={(p: ProductListItem) => `${p.sku} ${p.name}`}
                value={product ?? null}
                onValueChange={(p: ProductListItem | null) => {
                  if (p) onProductSelected(p);
                }}
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
                        padding: "8px 10px",
                        border: "1px solid transparent",
                        background: C.line2,
                        height: "auto",
                        color: product ? C.ink : C.muted,
                        fontSize: "13px",
                        borderRadius: C.radiusSm,
                      }}
                    >
                      <ComboboxValue>
                        {product ? (
                          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontFamily: C.mono, fontSize: "11px", color: C.muted }}>
                              {product.sku}
                            </span>
                            <span>{product.name}</span>
                          </span>
                        ) : (
                          "Search product…"
                        )}
                      </ComboboxValue>
                    </Button>
                  }
                />
                <ComboboxContent>
                  <ComboboxInput showTrigger={false} placeholder="Search by SKU or name…" />
                  <ComboboxEmpty>No products found.</ComboboxEmpty>
                  <ComboboxList>
                    {(p: ProductListItem) => (
                      <ComboboxItem key={p.id} value={p}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%",
                            gap: "8px",
                          }}
                        >
                          <div>
                            <div>{p.name}</div>
                            <div style={{ fontFamily: C.mono, fontSize: "11px", color: C.muted }}>
                              {p.sku}
                            </div>
                          </div>
                          <span style={{ fontSize: "12px", color: C.muted }}>
                            {formatMoney(p.defaultPricePerLb)}
                          </span>
                        </div>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {fieldState.invalid && (
                <span style={{ fontSize: "11px", color: "oklch(55% 0.22 25)" }}>
                  {fieldState.error?.message}
                </span>
              )}
            </div>
          )}
        />
      </td>

      {/* Unit */}
      <td style={tdBase}>
        <Controller
          control={control}
          name={`lines.${index}.salesUnitId`}
          render={({ field, fieldState }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={!product || salesUnits.length === 0}
            >
              <SelectTrigger
                style={{
                  border: "1px solid transparent",
                  background: C.line2,
                  fontSize: "13px",
                  height: "auto",
                  padding: "8px 10px",
                  borderRadius: C.radiusSm,
                  color: field.value ? C.ink : C.muted,
                }}
                aria-invalid={fieldState.invalid}
              >
                <SelectValue placeholder="Unit…" />
              </SelectTrigger>
              <SelectContent>
                {salesUnits.map(unit => (
                  <SelectItem key={unit.id} value={unit.unitId}>
                    {formatSalesUnitLabel(unit)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </td>

      {/* Qty */}
      <td style={{ ...tdBase, textAlign: "right" }}>
        <Controller
          control={control}
          name={`lines.${index}.quantity`}
          render={({ field, fieldState }) => (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
              <input
                {...field}
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                placeholder="0"
                aria-invalid={fieldState.invalid}
                style={{
                  ...inputBase,
                  textAlign: "right",
                  fontFamily: C.mono,
                  border: fieldState.invalid ? "1px solid oklch(55% 0.22 25)" : "1px solid transparent",
                }}
              />
              {fieldState.invalid && (
                <span style={{ fontSize: "11px", color: "oklch(55% 0.22 25)" }}>
                  {fieldState.error?.message}
                </span>
              )}
            </div>
          )}
        />
      </td>

      {/* Price */}
      <td style={{ ...tdBase, textAlign: "right" }}>
        <Controller
          control={control}
          name={`lines.${index}.pricePerLb`}
          render={({ field, fieldState }) => (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
              <input
                {...field}
                type="number"
                min="0"
                step="0.0001"
                inputMode="decimal"
                placeholder="0.00"
                aria-invalid={fieldState.invalid}
                style={{
                  ...inputBase,
                  textAlign: "right",
                  fontFamily: C.mono,
                  border: fieldState.invalid ? "1px solid oklch(55% 0.22 25)" : "1px solid transparent",
                }}
              />
              {product && !fieldState.invalid && (
                <span style={{ fontSize: "11px", color: C.muted }}>
                  $ / {product.baseUnit?.abbreviation || product.baseUnit?.name || "unit"}
                </span>
              )}
              {fieldState.invalid && (
                <span style={{ fontSize: "11px", color: "oklch(55% 0.22 25)" }}>
                  {fieldState.error?.message}
                </span>
              )}
            </div>
          )}
        />
      </td>

      {/* Total */}
      <td
        style={{
          ...tdBase,
          textAlign: "right",
          fontFamily: C.mono,
          fontSize: "13px",
          color: lineTotal !== null ? C.ink : C.muted,
          fontWeight: lineTotal !== null ? 500 : 400,
          whiteSpace: "nowrap",
        }}
      >
        {lineTotal !== null ? formatMoney(lineTotal) : "—"}
      </td>

      {/* Delete */}
      <td style={{ ...tdBase, textAlign: "center" }}>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove line ${index + 1}`}
          style={{
            background: "none",
            border: 0,
            color: C.muted,
            padding: "4px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "13px",
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
