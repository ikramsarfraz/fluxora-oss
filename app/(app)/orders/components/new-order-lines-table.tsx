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

import type {
  LineUnitType,
  NewOrderFormValues,
} from "./new-order-form.schema";

interface NewOrderLinesTableProps {
  control: Control<NewOrderFormValues>;
  setValue: UseFormSetValue<NewOrderFormValues>;
}

const UNIT_TYPE_LABELS: Record<LineUnitType, string> = {
  catch_weight: "Catch weight",
  fixed_case: "Fixed case",
};

function newLineDefaults(): NewOrderFormValues["lines"][number] {
  return {
    key:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: "",
    unitType: "catch_weight",
    expectedCases: "",
    pricePerLb: "",
    estLbsPerCase: "",
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
    for (const p of products ?? []) map.set(p.id, p);
    return map;
  }, [products]);

  const takenProductIds = useMemo(
    () => new Set((lines ?? []).map(l => l.productId).filter(Boolean)),
    [lines],
  );

  function resolvePricePerLb(productId: string): string {
    if (!productId) return "";
    const contract = customer?.productPrices?.find(
      p => p.productId === productId,
    );
    if (contract?.pricePerLb) return contract.pricePerLb;
    const product = productsById.get(productId);
    return product?.defaultPricePerLb ?? "";
  }

  function handleProductSelected(index: number, product: ProductListItem) {
    setValue(`lines.${index}.productId`, product.id, { shouldValidate: true });
    const price = resolvePricePerLb(product.id);
    if (price) {
      setValue(`lines.${index}.pricePerLb`, price, { shouldValidate: true });
    }
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
          Add products and expected cases. Prices auto-fill from the customer
          contract (or the product default) and remain editable.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[32%] min-w-64">Product</TableHead>
                <TableHead className="w-36">Unit</TableHead>
                <TableHead className="w-28 text-right">Cases</TableHead>
                <TableHead className="w-32 text-right">Est. lbs/case</TableHead>
                <TableHead className="w-32 text-right">$ / lb</TableHead>
                <TableHead className="w-32 text-right">Est. total</TableHead>
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
                    No products yet. Click "Add product" to get started.
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
                    onProductSelected={p => handleProductSelected(index, p)}
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
            Final case weights are captured during fulfillment.
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
  const cases = Number(row?.expectedCases ?? "");
  const price = Number(row?.pricePerLb ?? "");
  const estLbs = Number(row?.estLbsPerCase ?? "");
  const hasEstimate =
    Number.isFinite(cases) &&
    cases > 0 &&
    Number.isFinite(price) &&
    price > 0 &&
    Number.isFinite(estLbs) &&
    estLbs > 0;
  const lineTotal = hasEstimate ? cases * estLbs * price : null;

  const availableProducts = products.filter(
    p => p.id === row?.productId || !takenProductIds.has(p.id),
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
                    {(p: ProductListItem) => (
                      <ComboboxItem key={p.id} value={p}>
                        <div className="flex w-full items-center justify-between gap-3">
                          <div className="flex flex-col">
                            <span>{p.name}</span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {p.sku}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatMoney(p.defaultPricePerLb)}/lb
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
          name={`lines.${index}.unitType`}
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <Select
                value={field.value}
                onValueChange={(v: LineUnitType) => field.onChange(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="catch_weight">
                    {UNIT_TYPE_LABELS.catch_weight}
                  </SelectItem>
                  <SelectItem value="fixed_case">
                    {UNIT_TYPE_LABELS.fixed_case}
                  </SelectItem>
                </SelectContent>
              </Select>
              {field.value === "catch_weight" ? (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Info className="h-3 w-3" />
                  Weight captured at fulfillment
                </span>
              ) : null}
            </div>
          )}
        />
      </TableCell>

      <TableCell className="py-3 text-right">
        <Controller
          control={control}
          name={`lines.${index}.expectedCases`}
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

      <TableCell className="py-3 text-right">
        <Controller
          control={control}
          name={`lines.${index}.estLbsPerCase`}
          render={({ field, fieldState }) => (
            <div className="flex flex-col items-end gap-1">
              <Input
                {...field}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                aria-invalid={fieldState.invalid}
                placeholder="—"
                className="text-right text-muted-foreground"
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
              ) : null}
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
