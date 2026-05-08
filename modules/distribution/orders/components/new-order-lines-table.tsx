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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead className="h-auto w-[40%] px-2.5 pt-0 pb-2 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-stone-muted">
                Product
              </TableHead>
              <TableHead className="h-auto w-[16%] px-2.5 pt-0 pb-2 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-stone-muted">
                Unit
              </TableHead>
              <TableHead className="h-auto w-[12%] px-2.5 pt-0 pb-2 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-stone-muted">
                Qty
              </TableHead>
              <TableHead className="h-auto w-[14%] px-2.5 pt-0 pb-2 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-stone-muted">
                Price
              </TableHead>
              <TableHead className="h-auto w-[14%] px-2.5 pt-0 pb-2 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-stone-muted">
                Total
              </TableHead>
              <TableHead className="h-auto w-[30px] px-2.5 pt-0 pb-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
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
          </TableBody>
        </Table>
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
        <Button
          type="button"
          onClick={() => append(newLineDefaults())}
          variant="outline"
          className="h-8 border-dashed border-stone-line bg-transparent px-3.5 text-[13px] text-stone-muted shadow-none hover:bg-stone-line2 hover:text-stone-ink"
        >
          + Add product
        </Button>
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
          <Button
            type="button"
            onClick={() => setNotesOpen(true)}
            variant="link"
            className="h-auto p-0 text-[13px] font-medium text-primary"
          >
            + Add note
          </Button>
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
                  <Textarea
                    {...field}
                    placeholder="Delivery instructions, packing requests…"
                    rows={2}
                    className="min-h-[60px] resize-y border-stone-line bg-stone-surface px-3 py-2.5 text-[13px] text-stone-ink shadow-none"
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
                  <Textarea
                    {...field}
                    placeholder="Notes for warehouse and office staff…"
                    rows={2}
                    className="min-h-[60px] resize-y border-stone-line bg-stone-surface px-3 py-2.5 text-[13px] text-stone-ink shadow-none"
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
  const lineTotal = row ? calculateLineTotal(row, product) : null;

  const availableProducts = products.filter(
    p => p.id === row?.productId || !takenProductIds.has(p.id),
  );

  const cellClassName = "border-t border-stone-line2 px-2.5 py-1.5 align-top";
  const inputClassName =
    "h-auto border-transparent bg-stone-line2 px-2.5 py-2 text-[13px] text-stone-ink shadow-none";

  return (
    <TableRow className="border-0 hover:bg-transparent">
      {/* Product */}
      <TableCell className={cellClassName}>
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
                      className="h-auto w-full justify-start border-transparent bg-stone-line2 px-2.5 py-2 text-[13px] font-normal text-stone-ink shadow-none hover:bg-stone-line2 data-[placeholder=true]:text-stone-muted"
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
      </TableCell>

      {/* Unit */}
      <TableCell className={cellClassName}>
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
                className="h-auto border-transparent bg-stone-line2 px-2.5 py-2 text-[13px] text-stone-ink shadow-none"
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
      </TableCell>

      {/* Qty */}
      <TableCell className={`${cellClassName} text-right`}>
        <Controller
          control={control}
          name={`lines.${index}.quantity`}
          render={({ field, fieldState }) => (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
              <Input
                {...field}
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                placeholder="0"
                aria-invalid={fieldState.invalid}
                className={`${inputClassName} text-right font-mono`}
              />
              {fieldState.invalid && (
                <span style={{ fontSize: "11px", color: "oklch(55% 0.22 25)" }}>
                  {fieldState.error?.message}
                </span>
              )}
            </div>
          )}
        />
      </TableCell>

      {/* Price */}
      <TableCell className={`${cellClassName} text-right`}>
        <Controller
          control={control}
          name={`lines.${index}.pricePerLb`}
          render={({ field, fieldState }) => (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
              <Input
                {...field}
                type="number"
                min="0"
                step="0.0001"
                inputMode="decimal"
                placeholder="0.00"
                aria-invalid={fieldState.invalid}
                className={`${inputClassName} text-right font-mono`}
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
      </TableCell>

      {/* Total */}
      <TableCell
        className={`${cellClassName} whitespace-nowrap text-right font-mono text-[13px] ${
          lineTotal !== null ? "font-medium text-stone-ink" : "font-normal text-stone-muted"
        }`}
      >
        {lineTotal !== null ? formatMoney(lineTotal) : "—"}
      </TableCell>

      {/* Delete */}
      <TableCell className={`${cellClassName} text-center`}>
        <Button
          type="button"
          onClick={onRemove}
          aria-label={`Remove line ${index + 1}`}
          variant="ghost"
          size="icon-xs"
          className="size-7 text-stone-muted hover:bg-stone-line2 hover:text-stone-ink"
        >
          ✕
        </Button>
      </TableCell>
    </TableRow>
  );
}
