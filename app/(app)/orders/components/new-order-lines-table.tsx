"use client";

import { useMemo } from "react";
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type UseFormSetValue,
} from "react-hook-form";
import { Info, Plus, Scale, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCustomers } from "@/hooks/use-customers";
import { useProducts } from "@/hooks/use-products";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/utils/currency";
import type { CustomerListItem } from "@/services/customers";
import type { ProductListItem } from "@/services/products";

import type { NewOrderFormValues } from "./new-order-form.schema";
import {
  calculateLineTotal,
  formatSalesUnitLabel,
  formatSalesUnitShortLabel,
  getDefaultSalesUnit,
  getLinePriceLabel,
  getSalesUnits,
  getSelectedSalesUnit,
  getUnitTypeDisplayLabel,
  inferLineUnitType,
} from "./new-order-line-utils";

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
    for (const product of products ?? []) {
      map.set(product.id, product);
    }
    return map;
  }, [products]);

  const takenProductIds = useMemo(
    () => new Set((lines ?? []).map(line => line.productId).filter(Boolean)),
    [lines],
  );

  function resolvePricePerLb(productId: string): string {
    if (!productId) return "";
    const contract = customer?.productPrices?.find(
      price => price.productId === productId,
    );
    if (contract?.pricePerLb) return contract.pricePerLb;
    const product = productsById.get(productId);
    return product?.defaultPricePerLb ?? "";
  }

  function handleProductSelected(index: number, product: ProductListItem) {
    const defaultSalesUnit = getDefaultSalesUnit(product);
    setValue(`lines.${index}.productId`, product.id, { shouldValidate: true });
    setValue(`lines.${index}.salesUnitId`, defaultSalesUnit?.id ?? "", {
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Line items</span>
          <Badge variant="outline" className="font-normal">
            {fields.length} {fields.length === 1 ? "line" : "lines"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Add products, choose from each product&apos;s allowed sales units, and
          enter the order quantity. Prices auto-fill from the customer contract
          or product default and remain editable.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[30%] min-w-64">Product</TableHead>
                <TableHead className="w-44">Sales unit</TableHead>
                <TableHead className="w-28 text-right">Quantity</TableHead>
                <TableHead className="w-40">Unit type</TableHead>
                <TableHead className="w-36 text-right">Price</TableHead>
                <TableHead className="w-32 text-right">Line total</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No products yet. Click &quot;Add product&quot; to get started.
                  </TableCell>
                </TableRow>
              ) : (
                fields.map((field, index) => (
                  <LineRow
                    key={field._fieldId}
                    index={index}
                    control={control}
                    products={products ?? []}
                    productsById={productsById}
                    takenProductIds={takenProductIds}
                    onProductSelected={product =>
                      handleProductSelected(index, product)
                    }
                    onRemove={() => remove(index)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append(newLineDefaults())}
          >
            <Plus className="h-4 w-4" />
            Add product
          </Button>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Scale className="h-3.5 w-3.5" />
            Catch-weight products capture final billed weight during
            fulfillment.
          </div>
        </div>
      </CardContent>
    </Card>
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
  const salesUnit = getSelectedSalesUnit(product, row?.salesUnitId);
  const salesUnits = getSalesUnits(product);
  const lineTotal = row ? calculateLineTotal(row, product) : null;

  const availableProducts = products.filter(
    productItem =>
      productItem.id === row?.productId || !takenProductIds.has(productItem.id),
  );

  return (
    <TableRow className="align-top">
      <TableCell className="py-3">
        <Controller
          control={control}
          name={`lines.${index}.productId`}
          render={({ fieldState }) => (
            <div className="flex flex-col gap-1">
              <Combobox
                items={availableProducts}
                itemToStringValue={(productItem: ProductListItem) =>
                  `${productItem.sku} ${productItem.name}`
                }
                value={product ?? null}
                onValueChange={(productItem: ProductListItem | null) => {
                  if (productItem) onProductSelected(productItem);
                }}
              >
                <ComboboxTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      aria-invalid={fieldState.invalid}
                      className="w-full justify-between font-normal"
                    >
                      <ComboboxValue>
                        {product ? (
                          <span className="flex items-center gap-2 truncate">
                            <span className="font-mono text-xs text-muted-foreground">
                              {product.sku}
                            </span>
                            <span className="truncate">{product.name}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Select product…
                          </span>
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
                    {(productItem: ProductListItem) => (
                      <ComboboxItem key={productItem.id} value={productItem}>
                        <div className="flex w-full items-center justify-between gap-3">
                          <div className="flex flex-col">
                            <span>{productItem.name}</span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {productItem.sku}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatMoney(productItem.defaultPricePerLb)}
                          </span>
                        </div>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {fieldState.invalid ? (
                <span className="text-xs text-destructive">
                  {fieldState.error?.message}
                </span>
              ) : product && salesUnits.length === 0 ? (
                <span className="text-[11px] text-amber-600">
                  No sales units configured for this product.
                </span>
              ) : product ? (
                <span className="font-mono text-[11px] text-muted-foreground">
                  SKU {product.sku}
                </span>
              ) : null}
            </div>
          )}
        />
      </TableCell>

      <TableCell className="py-3">
        <Controller
          control={control}
          name={`lines.${index}.salesUnitId`}
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-1">
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={!product || salesUnits.length === 0}
              >
                <SelectTrigger className="w-full" aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Select unit…" />
                </SelectTrigger>
                <SelectContent>
                  {salesUnits.map(unit => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {formatSalesUnitLabel(unit)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid ? (
                <span className="text-xs text-destructive">
                  {fieldState.error?.message}
                </span>
              ) : salesUnit ? (
                <span className="text-[11px] text-muted-foreground">
                  {salesUnit.allowsFractional
                    ? "Configured for fractional use"
                    : "Whole quantities only"}
                </span>
              ) : null}
            </div>
          )}
        />
      </TableCell>

      <TableCell className="py-3 text-right">
        <Controller
          control={control}
          name={`lines.${index}.quantity`}
          render={({ field, fieldState }) => (
            <div className="flex flex-col items-end gap-1">
              <Input
                {...field}
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                aria-invalid={fieldState.invalid}
                placeholder="0"
                className="text-right"
              />
              {fieldState.invalid ? (
                <span className="text-xs text-destructive">
                  {fieldState.error?.message}
                </span>
              ) : null}
            </div>
          )}
        />
      </TableCell>

      <TableCell className="py-3">
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="w-fit text-xs">
            {getUnitTypeDisplayLabel(row?.unitType)}
          </Badge>
          {row?.unitType === "catch_weight" ? (
            <span className="flex items-start gap-1 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Final billed weight will be captured during fulfillment.
            </span>
          ) : salesUnit ? (
            <span className="text-[11px] text-muted-foreground">
              Sold by {formatSalesUnitShortLabel(salesUnit)}.
            </span>
          ) : null}
        </div>
      </TableCell>

      <TableCell className="py-3 text-right">
        <Controller
          control={control}
          name={`lines.${index}.pricePerLb`}
          render={({ field, fieldState }) => (
            <div className="flex flex-col items-end gap-1">
              <Input
                {...field}
                type="number"
                min="0"
                step="0.0001"
                inputMode="decimal"
                aria-invalid={fieldState.invalid}
                placeholder="0.0000"
                className="text-right"
              />
              {fieldState.invalid ? (
                <span className="text-xs text-destructive">
                  {fieldState.error?.message}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  {getLinePriceLabel(row?.unitType, salesUnit)}
                </span>
              )}
            </div>
          )}
        />
      </TableCell>

      <TableCell
        className={cn(
          "py-3 text-right tabular-nums",
          lineTotal === null ? "text-muted-foreground" : "font-medium",
        )}
      >
        {lineTotal !== null ? formatMoney(lineTotal) : "—"}
      </TableCell>

      <TableCell className="py-3 text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={`Remove line ${index + 1}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
