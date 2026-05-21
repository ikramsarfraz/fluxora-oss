"use client";

import { Fragment, useCallback, useMemo, useEffect, useRef, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { useProducts } from "@/modules/distribution/products/hooks/use-products";
import { useCustomer } from "@/modules/distribution/customers/hooks/use-customers";
import {
  useFifoAllocation,
  useProductCasesOnHand,
} from "@/modules/distribution/inventory/hooks/use-inventory";
import { formatMoney } from "@/lib/utils/currency";
import type { CustomerDetail } from "@/modules/distribution/customers/services/customers";
import type { ProductListItem } from "@/modules/distribution/products/services/products";
import type { FifoAllocationResult } from "@/modules/distribution/inventory/services/inventory";
import { TablePager } from "@/components/table-pager";

import type { NewOrderFormValues } from "./new-order-form.schema";
import {
  calculateLineTotal,
  calculateLineTotalFromWeight,
  formatSalesUnitLabel,
  getDefaultSalesUnit,
  getSalesUnits,
  inferLineUnitType,
  isWeightSalesUnit,
} from "./new-order-line-utils";
import { NewOrderSetPriceDialog } from "./new-order-set-price-dialog";

const C = {
  ink: "var(--color-ink)",
  ink2: "var(--color-ink-warm)",
  muted: "var(--color-subtle)",
  surface: "var(--color-card)",
  line: "var(--color-border-default)",
  line2: "var(--color-divider)",
  accent: "var(--color-forest-mid)",
  good: "var(--color-success-fg)",
  info: "var(--color-info-fg)",
  infoSoft: "var(--color-info-bg)",
  radius: "10px",
  radiusSm: "6px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

// ─── Props ────────────────────────────────────────────────────────────────────

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
    inventoryItemIds: [],
    quantity: "",
    pricePerLb: "",
  };
}

// ─── Main table ───────────────────────────────────────────────────────────────

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

  // Tracks the key of a freshly-appended line so the corresponding
  // LineRow can grab focus on its product combobox on first mount.
  // Cleared once the row reports back via `onAutoFocused` so subsequent
  // re-renders don't keep stealing focus from the user.
  const [autoFocusLineKey, setAutoFocusLineKey] = useState<string | null>(null);
  const handleAddProduct = useCallback(() => {
    const defaults = newLineDefaults();
    append(defaults);
    setAutoFocusLineKey(defaults.key);
  }, [append]);

  const customerId = useWatch({ control, name: "customerId" });
  const lines = useWatch({ control, name: "lines" });

  const { data: products } = useProducts();
  const { data: customerData } = useCustomer(customerId);
  const customer: CustomerDetail | null = customerData ?? null;
  const { data: casesOnHandData } = useProductCasesOnHand();

  const productsById = useMemo(() => {
    const map = new Map<string, ProductListItem>();
    for (const product of products ?? []) map.set(product.id, product);
    return map;
  }, [products]);

  const casesOnHandMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of casesOnHandData ?? []) map.set(row.productId, row.cases);
    return map;
  }, [casesOnHandData]);

  const takenProductIds = useMemo(
    () => new Set((lines ?? []).map((l) => l.productId).filter(Boolean)),
    [lines],
  );

  // Section aside: "N items · N cs · X lb est."
  const sectionAside = useMemo(() => {
    const filled = (lines ?? []).filter((l) => l.productId);
    if (filled.length === 0) return "No items";
    const totalCases = filled.reduce(
      (s, l) => s + (Number(l.quantity) || 0),
      0,
    );
    let totalWeightEst = 0;
    for (const l of filled) {
      if (!l.productId || !l.salesUnitId) continue;
      const prod = productsById.get(l.productId);
      const unit = getSalesUnits(prod).find((u) => u.unitId === l.salesUnitId);
      const conv = Number(unit?.conversionToBase ?? 0);
      if (l.unitType === "catch_weight" && conv > 0) {
        totalWeightEst += (Number(l.quantity) || 0) * conv;
      }
    }
    const weightStr =
      totalWeightEst > 0
        ? ` · ${totalWeightEst.toLocaleString("en-US", { maximumFractionDigits: 1 })} lb est.`
        : "";
    return `${filled.length} ${filled.length === 1 ? "item" : "items"} · ${totalCases} cs${weightStr}`;
  }, [lines, productsById]);

  const isStep2Done = (lines ?? []).some((l) => l.productId);

  // Price preview the user sees in the line editor. The server re-resolves
  // at submit time with the actual lot supplier (see resolveLinePricePerLb
  // in services/orders.ts), so this is just a sensible default for the UI.
  //
  // Preference order:
  //   1. customerProductPrices(customer, product, supplierId IS NULL) —
  //      the customer's default for the product, independent of supplier.
  //   2. any other customerProductPrices row for the product — if the
  //      customer has only per-supplier prices set, show one of them so
  //      the field isn't empty.
  //   3. products.defaultPricePerLb — global fallback.
  //
  // Returns `null` (vs "") when the customer detail is still in flight —
  // LineRow's retry effect uses that to defer setting a value instead of
  // writing a product-default that would later block the contract price
  // from being picked up when the customer query lands.
  //
  // Wrapped in useCallback so LineRow's retry effect re-runs when the
  // customer arrives.
  const resolvePricePerLb = useCallback(
    (productId: string): string | null => {
      if (!productId) return "";
      // A customer was picked but their detail hasn't arrived yet. Wait
      // before falling back to the product default — otherwise the
      // retry effect's "don't overwrite a non-empty price" guard would
      // freeze us on the default once the contract data finally lands.
      if (customerId && !customer) return null;
      const contracts =
        customer?.productPrices?.filter(p => p.productId === productId) ?? [];
      const nullSupplier = contracts.find(c => c.supplierId == null);
      if (nullSupplier?.pricePerLb) return nullSupplier.pricePerLb;
      const anyContract = contracts.find(c => c.pricePerLb);
      if (anyContract?.pricePerLb) return anyContract.pricePerLb;
      return productsById.get(productId)?.defaultPricePerLb ?? "";
    },
    [customer, customerId, productsById],
  );

  function handleProductSelected(index: number, product: ProductListItem) {
    const defaultSalesUnit = getDefaultSalesUnit(product);
    setValue(`lines.${index}.productId`, product.id, { shouldValidate: true });
    setValue(`lines.${index}.salesUnitId`, defaultSalesUnit?.unitId ?? "", {
      shouldValidate: true,
    });
    setValue(`lines.${index}.unitType`, inferLineUnitType(product), {
      shouldValidate: true,
    });
    setValue(`lines.${index}.inventoryItemIds`, [], {
      shouldValidate: true,
    });
    // resolver may return `null` while the customer detail is still
    // loading — in that case leave the price field empty so the retry
    // effect can back-fill it once data arrives.
    const resolvedPrice = resolvePricePerLb(product.id) ?? "";
    setValue(`lines.${index}.pricePerLb`, resolvedPrice, {
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
              color: isStep2Done ? "var(--color-card)" : C.muted,
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
        <span style={{ fontSize: "12px", color: C.muted }}>{sectionAside}</span>
      </div>

      {/* Customer-first gate: prices, fuel surcharge, and credit limit
          all depend on the picked customer, so block product entry
          until step 1 is done. Avoids the auto-fill/contract-price
          race entirely. The gate naturally never appears in /edit
          mode because customerId is seeded from the saved order. */}
      {!customerId ? (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            border: `1px dashed ${C.line}`,
            borderRadius: C.radiusSm,
            background: C.line2,
            color: C.muted,
            fontSize: "13px",
          }}
        >
          <div style={{ color: C.ink2, fontWeight: 500, marginBottom: "4px" }}>
            Pick a customer first
          </div>
          <div>
            Contract pricing, fuel surcharge, and credit-limit checks all
            depend on the selected customer.
          </div>
        </div>
      ) : (
        <>
          {/* Line items table */}
          <div style={{ overflowX: "auto" }}>
            <Table className="text-[13px]">
              <TableHeader>
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className="h-auto w-[34%] px-2.5 pt-0 pb-2 text-left text-[11px] font-medium uppercase tracking-[0.04em] text-subtle">
                    Product
                  </TableHead>
                  <TableHead className="h-auto w-[13%] px-2.5 pt-0 pb-2 text-left text-[11px] font-medium uppercase tracking-[0.04em] text-subtle">
                    Unit
                  </TableHead>
                  <TableHead className="h-auto w-[9%] px-2.5 pt-0 pb-2 text-right text-[11px] font-medium uppercase tracking-[0.04em] text-subtle">
                    Qty
                  </TableHead>
                  <TableHead className="h-auto w-[16%] px-2.5 pt-0 pb-2 text-right text-[11px] font-medium uppercase tracking-[0.04em] text-subtle">
                    Weight (lbs)
                  </TableHead>
                  <TableHead className="h-auto w-[13%] px-2.5 pt-0 pb-2 text-right text-[11px] font-medium uppercase tracking-[0.04em] text-subtle">
                    Price
                  </TableHead>
                  <TableHead className="h-auto w-[12%] px-2.5 pt-0 pb-2 text-right text-[11px] font-medium uppercase tracking-[0.04em] text-subtle">
                    Total
                  </TableHead>
                  <TableHead className="h-auto w-7.5 px-2.5 pt-0 pb-2" />
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
                    casesOnHandMap={casesOnHandMap}
                    takenProductIds={takenProductIds}
                    setValue={setValue}
                    resolvePricePerLb={resolvePricePerLb}
                    customerId={customerId}
                    customerName={customer?.name ?? ""}
                    autoFocusOnMount={field.key === autoFocusLineKey}
                    onAutoFocused={() => setAutoFocusLineKey(null)}
                    onProductSelected={(product) =>
                      handleProductSelected(index, product)
                    }
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
              onClick={handleAddProduct}
              variant="outline"
              className="h-8 border-dashed border-border-default bg-transparent px-3.5 text-[13px] text-subtle shadow-none hover:bg-divider hover:text-ink"
            >
              + Add product
            </Button>
            <span style={{ fontSize: "12px", color: C.muted }}>
              ⚖ Catch-weight cases capture final lbs at fulfillment — estimates shown here
            </span>
      </div>

      {/* Notes */}
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
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}
          >
            <Controller
              control={control}
              name="customerNotes"
              render={({ field }) => (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "12px",
                      color: C.muted,
                      fontWeight: 500,
                    }}
                  >
                    Customer note{" "}
                    <span style={{ color: C.muted, fontWeight: 400 }}>
                      — shown on invoice
                    </span>
                  </label>
                  <Textarea
                    {...field}
                    placeholder="Delivery instructions, packing requests…"
                    rows={2}
                    className="min-h-15 resize-y border-border-default bg-card px-3 py-2.5 text-[13px] text-ink shadow-none"
                  />
                </div>
              )}
            />
            <Controller
              control={control}
              name="internalNotes"
              render={({ field }) => (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "12px",
                      color: C.muted,
                      fontWeight: 500,
                    }}
                  >
                    Internal note{" "}
                    <span style={{ color: C.muted, fontWeight: 400 }}>
                      — staff only
                    </span>
                  </label>
                  <Textarea
                    {...field}
                    placeholder="Notes for warehouse and office staff…"
                    rows={2}
                    className="min-h-15 resize-y border-border-default bg-card px-3 py-2.5 text-[13px] text-ink shadow-none"
                  />
                </div>
              )}
            />
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}

// ─── LineRow ──────────────────────────────────────────────────────────────────

interface LineRowProps {
  index: number;
  control: Control<NewOrderFormValues>;
  products: ProductListItem[];
  productsById: Map<string, ProductListItem>;
  casesOnHandMap: Map<string, number>;
  takenProductIds: Set<string>;
  setValue: UseFormSetValue<NewOrderFormValues>;
  resolvePricePerLb: (productId: string) => string | null;
  customerId: string;
  customerName: string;
  autoFocusOnMount: boolean;
  onAutoFocused: () => void;
  onProductSelected: (product: ProductListItem) => void;
  onRemove: () => void;
}

function LineRow({
  index,
  control,
  products,
  productsById,
  casesOnHandMap,
  takenProductIds,
  setValue,
  resolvePricePerLb,
  customerId,
  customerName,
  autoFocusOnMount,
  onAutoFocused,
  onProductSelected,
  onRemove,
}: LineRowProps) {
  const row = useWatch({ control, name: `lines.${index}` });

  const product = row?.productId ? productsById.get(row.productId) : undefined;
  const salesUnits = getSalesUnits(product);
  const selectedUnit =
    salesUnits.find((u) => u.unitId === row?.salesUnitId) ?? null;

  const isCW = row?.unitType === "catch_weight";
  const isWeightUnit = isWeightSalesUnit(selectedUnit);
  const caseCount = Math.max(0, parseInt(row?.quantity ?? "0") || 0);
  const quantity = Math.max(0, Number(row?.quantity ?? "") || 0);
  const avgLbsPerCase = Number(selectedUnit?.conversionToBase ?? 0);
  const selectedInventoryItemIds = useMemo(
    () => row?.inventoryItemIds ?? [],
    [row?.inventoryItemIds],
  );
  const shouldAllocateInventory =
    !!row?.productId && caseCount > 0 && !isWeightUnit;

  const casesOnHand = row?.productId
    ? casesOnHandMap.get(row.productId)
    : undefined;

  // ── FIFO allocation ──────────────────────────────────────────────────────
  const { data: fifoAlloc, isLoading: fifoLoading } = useFifoAllocation(
    shouldAllocateInventory ? (row?.productId ?? null) : null,
    caseCount,
  );

  // ── Tray expand state ────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState(false);

  // ── Inline price-setter (#4) ─────────────────────────────────────────────
  // Surfaces "+ Set price for <customer>" under the price input when the
  // user has picked a customer + product but the price field is still
  // empty (no per-customer price, no product default).
  const [setPriceOpen, setSetPriceOpen] = useState(false);

  // ── Auto-focus the product picker on freshly-added lines ─────────────────
  // Without this the user clicks "+ Add product", the new row mounts, and
  // the natural tab order leaves focus on the (now-distant) button — the
  // next Tab lands on the cases input rather than the product picker.
  const productTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (autoFocusOnMount) {
      productTriggerRef.current?.focus();
      onAutoFocused();
    }
    // Only fire once per "this row was just added" signal — the parent
    // clears the flag via onAutoFocused so the dependency stays stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocusOnMount]);

  useEffect(() => {
    if (!shouldAllocateInventory && selectedInventoryItemIds.length > 0) {
      setValue(`lines.${index}.inventoryItemIds`, [], {
        shouldDirty: true,
        shouldValidate: true,
      });
      return;
    }

    if (
      shouldAllocateInventory &&
      caseCount > 0 &&
      selectedInventoryItemIds.length > caseCount
    ) {
      setValue(
        `lines.${index}.inventoryItemIds`,
        selectedInventoryItemIds.slice(0, caseCount),
        { shouldDirty: true, shouldValidate: true },
      );
    }
  }, [
    caseCount,
    index,
    selectedInventoryItemIds,
    setValue,
    shouldAllocateInventory,
  ]);

  // Retry price resolution once customer data lands. Picking a product
  // before `useCustomer` finishes (or arriving on /edit before the
  // customer detail has refetched) leaves the price field empty; this
  // back-fills it when the customer's productPrices array arrives. The
  // existing value is preserved if the user already typed a price, so
  // a manual override is never clobbered.
  const currentPricePerLb = row?.pricePerLb ?? "";
  useEffect(() => {
    if (!row?.productId) return;
    if (currentPricePerLb && currentPricePerLb !== "") return;
    const resolved = resolvePricePerLb(row.productId);
    // `null` means "customer still loading — wait". Skipping leaves the
    // guard above ready to fire again when resolvePricePerLb's identity
    // changes after the customer query lands.
    if (resolved == null) return;
    if (resolved) {
      setValue(`lines.${index}.pricePerLb`, resolved, {
        shouldValidate: true,
      });
    }
  }, [index, row?.productId, currentPricePerLb, resolvePricePerLb, setValue]);

  // ── Effective weight for line total ──────────────────────────────────────
  const manualAllocationRows =
    selectedInventoryItemIds.length > 0
      ? (fifoAlloc?.candidates ?? []).filter(item =>
          selectedInventoryItemIds.includes(item.inventoryItemId),
        )
      : [];
  const allocationRows =
    manualAllocationRows.length > 0
      ? manualAllocationRows
      : (fifoAlloc?.rows ?? []);
  // Trust the real allocation sum only when it actually covers the
  // currently-requested cases. Otherwise (case count changed and the
  // FIFO refetch hasn't landed yet, or stock is short, or the user is
  // in manual mode with a partial selection) fall back to the
  // synthetic estimate so the displayed weight stays in lock-step with
  // the cases input and doesn't flicker through the previous request's
  // total on every keystroke.
  const allocationCoversRequest =
    caseCount > 0 && allocationRows.length === caseCount;
  const effectiveTotalWeight =
    isWeightUnit
      ? quantity * Math.max(1, avgLbsPerCase || 1)
      : allocationCoversRequest
        ? allocationRows.reduce((sum, item) => sum + item.weight, 0)
        : caseCount * avgLbsPerCase;

  // Row-level total
  const lineTotal =
    isCW && effectiveTotalWeight > 0
      ? calculateLineTotalFromWeight(effectiveTotalWeight, row?.pricePerLb)
      : calculateLineTotal(
          row ?? {
            quantity: "",
            pricePerLb: "",
            unitType: "catch_weight",
            salesUnitId: "",
          },
          product,
        );

  const availableProducts = products.filter(
    (p) => p.id === row?.productId || !takenProductIds.has(p.id),
  );

  const cellCn = "border-t border-divider px-2.5 py-1.5 align-top";
  const inputCn =
    "h-auto border-transparent bg-divider px-2.5 py-2 text-[13px] text-ink shadow-none";

  // ── Weight cell ──────────────────────────────────────────────────────────
  function renderWeightCell() {
    if (!isCW) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "9px 12px",
            color: C.muted,
            fontFamily: C.mono,
            fontSize: "13px",
          }}
        >
          —
        </div>
      );
    }

    if (isWeightUnit) {
      const requestedWeight = effectiveTotalWeight.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "9px 12px",
            color: quantity > 0 ? C.info : C.muted,
            fontFamily: C.mono,
            fontSize: "13px",
          }}
        >
          {quantity > 0 ? `${requestedWeight} lb` : "—"}
        </div>
      );
    }

    const hasCases = caseCount > 0;
    const allocatedCount = allocationRows.length;
    // Use the same lock-step rule as `effectiveTotalWeight` above so
    // the headline number doesn't flicker through the previous request's
    // allocation sum after the user bumps the cases count.
    const totalWt = allocationCoversRequest
      ? allocationRows.reduce((sum, item) => sum + item.weight, 0)
      : effectiveTotalWeight;
    const lotsUsed = new Set(allocationRows.map(item => item.lotId)).size;

    const weightLabel = totalWt.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return (
      <button
        type="button"
        onClick={() => hasCases && setExpanded((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          width: "100%",
          padding: "9px 10px",
          borderRadius: C.radiusSm,
          border: "1px solid transparent",
          background: hasCases ? C.infoSoft : C.line2,
          borderColor: hasCases
            ? "color-mix(in oklch, var(--color-info-border) 60%, transparent)"
            : "transparent",
          cursor: hasCases ? "pointer" : "default",
          minHeight: "36px",
          textAlign: "left",
          fontSize: "12px",
          color: hasCases ? C.info : C.muted,
          fontFamily: hasCases ? C.mono : "inherit",
          transition: "background 0.1s",
        }}
        disabled={!hasCases}
        aria-expanded={expanded}
      >
        {hasCases ? (
          <>
            <span style={{ flex: 1, fontSize: "11px", fontFamily: "inherit" }}>
              {allocatedCount}/{caseCount} cs
              {lotsUsed > 1 ? ` · ${lotsUsed} lots` : ""}
            </span>
            <span style={{ fontWeight: 500 }}>{weightLabel}</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              style={{
                flexShrink: 0,
                transition: "transform 0.15s",
                transform: expanded ? "rotate(180deg)" : "none",
              }}
            >
              <path
                d="M2 4l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </>
        ) : (
          <span style={{ fontSize: "11px", flex: 1, textAlign: "right" }}>
            Set cases →
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      <TableRow className="border-0 hover:bg-transparent">
        {/* Product */}
        <TableCell className={cellCn}>
          <Controller
            control={control}
            name={`lines.${index}.productId`}
            render={({ fieldState }) => (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "3px" }}
              >
                <Combobox
                  items={availableProducts}
                  itemToStringValue={(p: ProductListItem) =>
                    `${p.sku} ${p.name}`
                  }
                  value={product ?? null}
                  onValueChange={(p: ProductListItem | null) => {
                    if (p) onProductSelected(p);
                  }}
                >
                  <ComboboxTrigger
                    render={
                      <Button
                        ref={productTriggerRef}
                        type="button"
                        variant="outline"
                        aria-invalid={fieldState.invalid}
                        className="h-auto w-full justify-start border-transparent bg-divider px-2.5 py-2 text-[13px] font-normal text-ink shadow-none hover:bg-divider data-[placeholder=true]:text-subtle"
                      >
                        <ComboboxValue>
                          {product ? (
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: C.mono,
                                  fontSize: "11px",
                                  color: C.muted,
                                }}
                              >
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
                    <ComboboxInput
                      showTrigger={false}
                      placeholder="Search by SKU or name…"
                    />
                    <ComboboxEmpty>No products found.</ComboboxEmpty>
                    <ComboboxList>
                      {(p: ProductListItem) => {
                        // Show the price the customer would actually
                        // pay (contract → product default → none),
                        // not the raw product default — that read as
                        // "$0.00" for products without a base default
                        // even when a customer contract existed.
                        const resolved = resolvePricePerLb(p.id);
                        const priceLabel =
                          resolved && Number(resolved) > 0
                            ? `${formatMoney(resolved)}/lb`
                            : "—";
                        return (
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
                                <div
                                  style={{
                                    fontFamily: C.mono,
                                    fontSize: "11px",
                                    color: C.muted,
                                  }}
                                >
                                  {p.sku}
                                </div>
                              </div>
                              <span style={{ fontSize: "12px", color: C.muted }}>
                                {priceLabel}
                              </span>
                            </div>
                          </ComboboxItem>
                        );
                      }}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {fieldState.invalid && (
                  <span
                    style={{ fontSize: "11px", color: "var(--color-danger-fg)" }}
                  >
                    {fieldState.error?.message}
                  </span>
                )}
                {!fieldState.invalid && casesOnHand !== undefined && (
                  <span
                    style={{
                      fontSize: "11px",
                      color:
                        casesOnHand === 0 ? "var(--color-danger-fg)" : C.muted,
                    }}
                  >
                    {casesOnHand === 0
                      ? "No stock"
                      : `${casesOnHand} ${casesOnHand === 1 ? "case" : "cases"} on hand`}
                  </span>
                )}
              </div>
            )}
          />
        </TableCell>

        {/* Unit */}
        <TableCell className={cellCn}>
          <Controller
            control={control}
            name={`lines.${index}.salesUnitId`}
            render={({ field, fieldState }) => {
              const selectedU =
                salesUnits.find((u) => u.unitId === field.value) ?? null;
              return (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                  }}
                >
                  <Select
                    value={field.value}
                    onValueChange={value => {
                      field.onChange(value);
                      const newUnit = salesUnits.find(u => u.unitId === value) ?? null;
                      setValue(
                        `lines.${index}.unitType`,
                        isWeightSalesUnit(newUnit) ? "catch_weight" : inferLineUnitType(product),
                        { shouldDirty: true, shouldValidate: true },
                      );
                      setValue(`lines.${index}.inventoryItemIds`, [], {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    disabled={!product || salesUnits.length === 0}
                  >
                    <SelectTrigger
                      className="h-auto border-transparent bg-divider px-2.5 py-2 text-[13px] text-ink shadow-none"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue placeholder={!product ? "—" : "Unit…"} />
                    </SelectTrigger>
                    <SelectContent>
                      {salesUnits.map((unit) => (
                        <SelectItem key={unit.id} value={unit.unitId}>
                          {formatSalesUnitLabel(unit)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {product && !selectedU && salesUnits.length === 0 && (
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--color-danger-fg)",
                      }}
                    >
                      No sales units configured
                    </span>
                  )}
                </div>
              );
            }}
          />
        </TableCell>

        {/* Cases */}
        <TableCell className={`${cellCn} text-right`}>
          <Controller
            control={control}
            name={`lines.${index}.quantity`}
            render={({ field, fieldState }) => (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: "3px",
                }}
              >
                <Input
                  {...field}
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  placeholder="0"
                  aria-invalid={fieldState.invalid}
                  className={`${inputCn} text-right font-mono`}
                />
                {fieldState.invalid && (
                  <span
                    style={{ fontSize: "11px", color: "var(--color-danger-fg)" }}
                  >
                    {fieldState.error?.message}
                  </span>
                )}
                {!fieldState.invalid && selectedUnit && (
                  <span style={{ fontSize: "11px", color: C.muted }}>
                    {isWeightUnit
                      ? "lb requested"
                      : selectedUnit.unit.abbreviation || selectedUnit.unit.name}
                  </span>
                )}
              </div>
            )}
          />
        </TableCell>

        {/* Weight (lbs) */}
        <TableCell className={`${cellCn} text-right`}>
          {renderWeightCell()}
        </TableCell>

        {/* Price */}
        <TableCell className={`${cellCn} text-right`}>
          <Controller
            control={control}
            name={`lines.${index}.pricePerLb`}
            render={({ field, fieldState }) => {
              // Show the inline "Set price" affordance only when the
              // customer + product are picked and the price field is
              // still empty — once a price exists (typed manually, or
              // back-filled from the retry effect once customer data
              // loaded) the link becomes noise.
              const trimmedPrice = (field.value ?? "").toString().trim();
              const showSetPriceLink =
                !!customerId &&
                !!product &&
                (trimmedPrice === "" || Number(trimmedPrice) === 0);
              return (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: "3px",
                }}
              >
                <Input
                  {...field}
                  type="number"
                  min="0"
                  step="0.0001"
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-invalid={fieldState.invalid}
                  className={`${inputCn} text-right font-mono`}
                />
                {product && !fieldState.invalid && (
                  <span style={{ fontSize: "11px", color: C.muted }}>
                    $ /{" "}
                    {product.baseUnit?.abbreviation ||
                      product.baseUnit?.name ||
                      "unit"}
                  </span>
                )}
                {fieldState.invalid && (
                  <span
                    style={{ fontSize: "11px", color: "var(--color-danger-fg)" }}
                  >
                    {fieldState.error?.message}
                  </span>
                )}
                {showSetPriceLink && (
                  <Button
                    type="button"
                    onClick={() => setSetPriceOpen(true)}
                    variant="link"
                    size="xs"
                    className="h-auto p-0 text-[11px] font-medium text-primary"
                  >
                    + Set price for {customerName || "customer"}
                  </Button>
                )}
              </div>
              );
            }}
          />
        </TableCell>

        {/* Total */}
        <TableCell
          className={`${cellCn} whitespace-nowrap text-right text-[13px] ${
            lineTotal !== null
              ? "font-medium text-ink"
              : "font-normal text-subtle"
          }`}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "2px",
            }}
          >
            <span style={{ fontFamily: C.mono }}>
              {lineTotal !== null ? formatMoney(lineTotal) : "—"}
            </span>
            {isCW && caseCount > 0 && effectiveTotalWeight > 0 && (
              <span
                style={{
                  fontSize: "10px",
                  color: C.muted,
                  fontWeight: 400,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  fontFamily: C.mono,
                }}
              >
                est ·{" "}
                {effectiveTotalWeight.toLocaleString("en-US", {
                  maximumFractionDigits: 1,
                })}{" "}
                lb
              </span>
            )}
          </div>
        </TableCell>

        {/* Delete */}
        <TableCell className={`${cellCn} text-center`}>
          <Button
            type="button"
            onClick={onRemove}
            aria-label={`Remove line ${index + 1}`}
            variant="ghost"
            size="icon-xs"
            className="size-7 text-subtle hover:bg-divider hover:text-ink"
          >
            ✕
          </Button>
        </TableCell>
      </TableRow>

      {/* FIFO allocation tray */}
      {shouldAllocateInventory && expanded && caseCount > 0 && (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={7} className="p-0">
            <FifoAllocationTray
              rows={fifoAlloc?.rows ?? []}
              candidates={fifoAlloc?.candidates ?? []}
              selectedInventoryItemIds={selectedInventoryItemIds}
              onSelectedInventoryItemIdsChange={ids =>
                setValue(`lines.${index}.inventoryItemIds`, ids, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              requestedCases={caseCount}
              isLoading={fifoLoading}
            />
          </TableCell>
        </TableRow>
      )}

      {customerId && product ? (
        <NewOrderSetPriceDialog
          open={setPriceOpen}
          onOpenChange={setSetPriceOpen}
          customerId={customerId}
          customerName={customerName}
          productId={product.id}
          productLabel={`${product.sku} · ${product.name}`}
          onSaved={pricePerLb => {
            setValue(`lines.${index}.pricePerLb`, pricePerLb, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }}
        />
      ) : null}
    </>
  );
}

// ─── FIFO Allocation Tray ─────────────────────────────────────────────────────

const LOT_DOT_COLORS = [
  "oklch(70% 0.12 220)",
  "oklch(68% 0.13 150)",
  "oklch(72% 0.13 60)",
  "oklch(68% 0.14 320)",
  "oklch(70% 0.13 25)",
];

function ageStr(dateStr: string): string {
  if (!dateStr) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function fmt2(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface FifoAllocationTrayProps {
  rows: FifoAllocationResult["rows"];
  candidates: FifoAllocationResult["candidates"];
  selectedInventoryItemIds: string[];
  onSelectedInventoryItemIdsChange: (ids: string[]) => void;
  requestedCases: number;
  isLoading: boolean;
}

function FifoAllocationTray({
  rows,
  candidates,
  selectedInventoryItemIds,
  onSelectedInventoryItemIdsChange,
  requestedCases,
  isLoading,
}: FifoAllocationTrayProps) {
  // Manual mode is sticky inside the tray rather than derived from the
  // selection length. Otherwise unchecking the last picked case kicked
  // the user back to FIFO mid-edit, hiding the checkboxes they needed
  // to add a different one. Initialized true when there's already a
  // selection (edit-existing-draft case), false otherwise.
  const [manualMode, setManualMode] = useState(
    selectedInventoryItemIds.length > 0,
  );
  // Pagination — products with hundreds of allocated cases would
  // otherwise render every row in one giant list. Page is 1-indexed
  // to match the shared TablePager component used elsewhere in the app.
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const selectedSet = new Set(selectedInventoryItemIds);
  const selectedRows = candidates.filter(row =>
    selectedSet.has(row.inventoryItemId),
  );
  const allDisplayRows = manualMode ? candidates : rows;
  const pageCount = Math.max(1, Math.ceil(allDisplayRows.length / perPage));
  // Clamp the current page when the row set shrinks (e.g. user unchecks
  // an item, switches mode, or product changes).
  const safePage = Math.min(page, pageCount);
  const displayRows = allDisplayRows.slice(
    (safePage - 1) * perPage,
    safePage * perPage,
  );
  const allocatedRows = manualMode ? selectedRows : rows;
  const allocatedCount = allocatedRows.length;
  const totalWeight = allocatedRows.reduce((sum, row) => sum + row.weight, 0);
  const lotsUsed = new Set(allocatedRows.map(row => row.lotId)).size;
  const shortBy = Math.max(0, requestedCases - allocatedCount);
  const avg = allocatedCount > 0 ? totalWeight / allocatedCount : 0;

  function startManualSelection() {
    setManualMode(true);
    setPage(1);
    onSelectedInventoryItemIdsChange(
      rows.slice(0, requestedCases).map(row => row.inventoryItemId),
    );
  }

  function useFifo() {
    setManualMode(false);
    setPage(1);
    onSelectedInventoryItemIdsChange([]);
  }

  function toggleInventoryItem(inventoryItemId: string, checked: boolean) {
    if (checked) {
      if (selectedSet.has(inventoryItemId)) return;
      if (selectedInventoryItemIds.length >= requestedCases) return;
      onSelectedInventoryItemIdsChange([
        ...selectedInventoryItemIds,
        inventoryItemId,
      ]);
      return;
    }

    onSelectedInventoryItemIdsChange(
      selectedInventoryItemIds.filter(id => id !== inventoryItemId),
    );
  }

  return (
    <div
      style={{
        background: "#f9f8f6",
        borderTop: "1px dashed #e7e5e4",
        padding: "16px 22px 18px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "14px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              fontWeight: 600,
              color: C.ink,
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              stroke={C.info}
              strokeWidth="1.6"
              strokeLinejoin="round"
            >
              <path d="M2 5l6-3 6 3-6 3-6-3z" />
              <path d="M2 5v6l6 3 6-3V5" />
            </svg>
            Inventory allocation
          </div>
          <span style={{ fontSize: "11px", color: C.muted }}>
            {manualMode
              ? "Manual lot selection overrides oldest-first assignment."
              : "Oldest inventory is selected first."}
          </span>
        </div>
        <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
          <AllocStat
            label="Cases"
            value={
              shortBy > 0
                ? `${allocatedCount} / ${requestedCases}`
                : String(allocatedCount)
            }
          />
          <AllocStat label="Avg / case" value={`${fmt2(avg)} lb`} />
          <AllocStat label="Total weight" value={`${fmt2(totalWeight)} lb`} bold />
          {manualMode ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={useFifo}
            >
              Use FIFO
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={startManualSelection}
              disabled={rows.length === 0}
            >
              Manual pick
            </Button>
          )}
        </div>
      </div>

      {/* Short-stock warning — hoisted above the table so it's the
          first thing the user sees when the selection or available
          stock doesn't cover the requested quantity. */}
      {shortBy > 0 && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            padding: "10px 12px",
            marginBottom: "12px",
            background: "oklch(96% 0.04 70)",
            color: "oklch(40% 0.10 70)",
            border: "1px solid oklch(85% 0.10 70)",
            borderRadius: C.radiusSm,
            fontSize: "12px",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            style={{ flexShrink: 0, marginTop: "1px" }}
          >
            <path d="M8 2l6.5 11h-13L8 2z" strokeLinejoin="round" />
            <path d="M8 6.5v3.5M8 11.7v.1" strokeLinecap="round" />
          </svg>
          <div>
            <b>Short {shortBy} {shortBy === 1 ? "case" : "cases"}.</b>{" "}
            Only {allocatedCount} of {requestedCases} requested{" "}
            {requestedCases === 1 ? "case is" : "cases are"}{" "}
            {manualMode ? "selected" : "in stock"}.{" "}
            {manualMode ? "Select more inventory or reduce quantity." : "Reduce quantity or back-order."}
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            fontSize: "12px",
            color: C.muted,
          }}
        >
          Loading…
        </div>
      ) : displayRows.length === 0 ? (
        <div
          style={{
            padding: "28px 16px",
            textAlign: "center",
            color: C.muted,
            fontSize: "12px",
            background: C.surface,
            border: `1px dashed ${C.line}`,
            borderRadius: C.radiusSm,
          }}
        >
          No inventory available for this product.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: manualMode
              ? "72px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 96px"
              : "56px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 96px",
            background: C.surface,
            border: `1px solid ${C.line}`,
            borderRadius: C.radiusSm,
            overflow: "hidden",
          }}
        >
          {/* Column headers */}
          {([manualMode ? "Pick" : "Case", "Lot #", "Received", "Supplier", "Weight"] as const).map(
            (h, i) => (
              <div
                key={i}
                style={{
                  padding: "8px 12px",
                  fontSize: "10px",
                  fontWeight: 600,
                  color: C.muted,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  background: C.line2,
                  borderBottom: `1px solid ${C.line}`,
                  textAlign: i === 4 ? ("right" as const) : ("left" as const),
                }}
              >
                {h}
              </div>
            ),
          )}

          {/* Data rows — display:contents grid pattern */}
          {displayRows.map((row, i) => {
            const prev = i > 0 ? displayRows[i - 1] : null;
            const isLotBreak = !!prev && prev.lotId !== row.lotId;
            const borderTop = isLotBreak
              ? `1px solid ${C.line}`
              : i === 0
                ? "none"
                : `1px solid ${C.line2}`;
            const dotColor = LOT_DOT_COLORS[row.lotColorIdx % 5];
            const cellStyle: React.CSSProperties = {
              padding: "9px 12px",
              fontSize: "13px",
              borderTop,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            };
            const isSelected = selectedSet.has(row.inventoryItemId);
            const isDisabled =
              manualMode &&
              !isSelected &&
              selectedInventoryItemIds.length >= requestedCases;

            return (
              <Fragment key={row.inventoryItemId}>
                {/* Case # */}
                <div
                  style={{
                    ...cellStyle,
                    fontFamily: C.mono,
                    color: C.muted,
                    fontSize: "12px",
                  }}
                >
                  {manualMode ? (
                    <Checkbox
                      checked={isSelected}
                      disabled={isDisabled}
                      onCheckedChange={checked =>
                        toggleInventoryItem(row.inventoryItemId, checked === true)
                      }
                      aria-label={`Select inventory item ${row.caseIdx}`}
                    />
                  ) : (
                    `#${row.caseIdx}`
                  )}
                </div>
                {/* Lot # */}
                <div style={cellStyle}>
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: dotColor,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: C.mono,
                      fontSize: "12px",
                      color: C.ink,
                    }}
                  >
                    {row.lotNumber}
                  </span>
                </div>
                {/* Received */}
                <div style={cellStyle}>
                  <span style={{ color: C.ink2, fontSize: "12px" }}>
                    {row.receivedDate}
                  </span>
                  <span
                    style={{
                      color: C.muted,
                      fontSize: "11px",
                      marginLeft: "6px",
                    }}
                  >
                    {ageStr(row.receivedDate)}
                  </span>
                </div>
                {/* Supplier */}
                <div style={{ ...cellStyle, color: C.muted, fontSize: "12px" }}>
                  {row.supplierName}
                </div>
                {/* Weight */}
                <div
                  style={{
                    ...cellStyle,
                    justifyContent: "flex-end",
                    fontFamily: C.mono,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmt2(row.weight)} lb
                </div>
              </Fragment>
            );
          })}
        </div>
      )}

      {/* Pager — use the shared TablePager so the styling matches the
          rest of the app's tables (listing pages, etc.). */}
      {!isLoading && allDisplayRows.length > 0 && (
        <div
          style={{
            marginTop: "10px",
            background: C.surface,
            border: `1px solid ${C.line}`,
            borderRadius: C.radiusSm,
            overflow: "hidden",
          }}
        >
          <TablePager
            total={allDisplayRows.length}
            perPage={perPage}
            page={safePage}
            onPageChange={setPage}
            onPerPageChange={value => {
              setPerPage(value);
              setPage(1);
            }}
            perPageOptions={[25, 50, 100]}
          />
        </div>
      )}

      {/* Footer */}
      {allocatedCount > 0 && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            marginTop: "12px",
            fontSize: "11px",
            color: C.muted,
          }}
        >
          <span>
            Pulled from{" "}
            <b style={{ color: C.ink2, fontWeight: 500 }}>{lotsUsed}</b>{" "}
            {lotsUsed === 1 ? "lot" : "lots"}
            {manualMode ? " · manually selected." : " · oldest first."}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── AllocStat ────────────────────────────────────────────────────────────────

function AllocStat({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <span
        style={{
          fontSize: "10px",
          fontWeight: 600,
          color: C.muted,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: C.mono,
          fontSize: "13px",
          fontWeight: bold ? 600 : 500,
          color: bold ? C.ink : C.ink2,
        }}
      >
        {value}
      </span>
    </div>
  );
}
