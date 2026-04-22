"use client";

import { Controller, useFieldArray, useWatch } from "react-hook-form";
import type { Control, UseFormRegister } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatMoney } from "@/lib/utils/currency";
import type { ProductListItem } from "@/services/products";

import {
  computeLineTotal,
  emptyLine,
  type SupplierInvoiceFormValues,
} from "./supplier-invoice-form.schema";

type Props = {
  control: Control<SupplierInvoiceFormValues>;
  register: UseFormRegister<SupplierInvoiceFormValues>;
  products: ProductListItem[];
  productsLoading: boolean;
  disabled?: boolean;
};

function LineRowTotal({
  control,
  index,
}: {
  control: Control<SupplierInvoiceFormValues>;
  index: number;
}) {
  const line = useWatch({ control, name: `lines.${index}` });
  if (!line) return <span className="tabular-nums">{formatMoney(0)}</span>;
  return (
    <span className="tabular-nums">{formatMoney(computeLineTotal(line))}</span>
  );
}

function FooterTotal({
  control,
}: {
  control: Control<SupplierInvoiceFormValues>;
}) {
  const lines = useWatch({ control, name: "lines" });
  const total = (lines ?? []).reduce(
    (acc, line) => acc + computeLineTotal(line),
    0,
  );
  return (
    <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
  );
}

export function SupplierInvoiceLinesEditor({
  control,
  register,
  products,
  productsLoading,
  disabled = false,
}: Props) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines",
  });

  const productOptions = products.map(p => ({
    id: p.id,
    label: `${p.name}`,
    sku: p.sku,
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="min-w-[220px]">Product</TableHead>
              <TableHead className="w-[120px]">SKU</TableHead>
              <TableHead className="w-[140px]">Unit type</TableHead>
              <TableHead className="w-[100px] text-right">Cases</TableHead>
              <TableHead className="w-[120px] text-right">Weight lbs</TableHead>
              <TableHead className="w-[120px] text-right">Unit price</TableHead>
              <TableHead className="w-[110px] text-right">Line total</TableHead>
              <TableHead className="w-[160px]">Lot # (optional)</TableHead>
              <TableHead className="w-[150px]">Expires (optional)</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-muted-foreground h-20 text-center text-sm"
                >
                  No lines yet. Add a product to get started.
                </TableCell>
              </TableRow>
            ) : (
              fields.map((field, index) => {
                return (
                  <LineRow
                    key={field.id}
                    control={control}
                    register={register}
                    index={index}
                    products={productOptions}
                    productsLoading={productsLoading}
                    disabled={disabled}
                    onRemove={() => remove(index)}
                    canRemove={fields.length > 1}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append(emptyLine())}
          disabled={disabled}
        >
          <Plus className="size-4" />
          Add line
        </Button>
        <div className="text-muted-foreground flex items-center gap-3 text-sm">
          <span>Invoice total</span>
          <FooterTotal control={control} />
        </div>
      </div>
    </div>
  );
}

function LineRow({
  control,
  register,
  index,
  products,
  productsLoading,
  disabled,
  onRemove,
  canRemove,
}: {
  control: Control<SupplierInvoiceFormValues>;
  register: UseFormRegister<SupplierInvoiceFormValues>;
  index: number;
  products: Array<{ id: string; label: string; sku: string }>;
  productsLoading: boolean;
  disabled: boolean;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const productId = useWatch({ control, name: `lines.${index}.productId` });
  const unitType = useWatch({ control, name: `lines.${index}.unitType` });
  const sku = products.find(p => p.id === productId)?.sku ?? "—";

  return (
    <TableRow>
      <TableCell>
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
                className="w-full"
              >
                <SelectValue
                  placeholder={
                    productsLoading ? "Loading..." : "Select product"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="font-mono text-xs">
          {sku}
        </Badge>
      </TableCell>
      <TableCell>
        <Controller
          control={control}
          name={`lines.${index}.unitType`}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="catch_weight">Catch weight</SelectItem>
                <SelectItem value="fixed_case">Fixed case</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          min={0}
          step={1}
          className="text-right tabular-nums"
          disabled={disabled}
          {...register(`lines.${index}.quantityCases`)}
        />
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          min={0}
          step="0.01"
          className="text-right tabular-nums"
          disabled={disabled || unitType === "fixed_case"}
          {...register(`lines.${index}.weightLbs`)}
        />
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          min={0}
          step="0.0001"
          className="text-right tabular-nums"
          disabled={disabled}
          {...register(`lines.${index}.unitPrice`)}
        />
      </TableCell>
      <TableCell className="text-right">
        <LineRowTotal control={control} index={index} />
      </TableCell>
      <TableCell>
        <Input
          placeholder="auto"
          disabled={disabled}
          {...register(`lines.${index}.lotNumberOverride`)}
        />
      </TableCell>
      <TableCell>
        <Input
          type="date"
          placeholder="+7d"
          disabled={disabled}
          {...register(`lines.${index}.expirationDateOverride`)}
        />
      </TableCell>
      <TableCell>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={disabled || !canRemove}
          aria-label="Remove line"
        >
          <Trash2 className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
