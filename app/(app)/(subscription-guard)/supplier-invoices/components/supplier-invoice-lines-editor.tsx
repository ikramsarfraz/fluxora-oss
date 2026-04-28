"use client";

import { useEffect, useState } from "react";
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Scale,
  Sparkles,
  Trash2,
} from "lucide-react";

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
import {
  computeDraftLineWeight,
  formatEditableWeight,
  getResolvedDraftCaseWeights,
  type SupplierInvoiceWeightEntryMode,
} from "@/lib/supplier-invoices/case-weights";
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
  setValue: UseFormSetValue<SupplierInvoiceFormValues>;
  products: ProductListItem[];
  productsLoading: boolean;
  disabled?: boolean;
};

function getPositiveInteger(value: string | undefined): number {
  const parsed = value ? Number.parseInt(value, 10) : 0;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

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
  setValue,
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
              <TableHead className="w-[160px] text-right">Weight lbs</TableHead>
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
  const productId = line?.productId;
  const unitType = line?.unitType ?? "catch_weight";
  const weightEntryMode = line?.weightEntryMode ?? "total_weight";
  const quantityCases = getPositiveInteger(line?.quantityCases);
  const sku = products.find(p => p.id === productId)?.sku ?? "—";
  // `userExpanded` only controls whether the detailed-entry panel is open
  // when the user has manually toggled it while in `total_weight` mode. The
  // effective expansion is derived below so that switching unit type or
  // weight-entry mode never needs to sync into state inside an effect.
  const [userExpanded, setUserExpanded] = useState(false);
  const expanded =
    unitType === "catch_weight" &&
    (weightEntryMode !== "total_weight" || userExpanded);

  useEffect(() => {
    if (unitType !== "catch_weight") {
      if (line?.weightEntryMode !== "total_weight") {
        setValue(`lines.${index}.weightEntryMode`, "total_weight", {
          shouldDirty: true,
        });
      }
      if ((line?.defaultCaseWeightLbs ?? "") !== "") {
        setValue(`lines.${index}.defaultCaseWeightLbs`, "", {
          shouldDirty: true,
        });
      }
      if ((line?.caseWeightEntries?.length ?? 0) > 0) {
        setValue(`lines.${index}.caseWeightEntries`, [], { shouldDirty: true });
      }
    }
  }, [
    index,
    line?.caseWeightEntries?.length,
    line?.defaultCaseWeightLbs,
    line?.weightEntryMode,
    quantityCases,
    setValue,
    unitType,
    weightEntryMode,
  ]);

  useEffect(() => {
    if (unitType !== "catch_weight") return;
    const existingEntries = line?.caseWeightEntries ?? [];
    const nextEntries = Array.from(
      { length: quantityCases },
      (_, caseIndex) => existingEntries[caseIndex] ?? "",
    );

    const entriesChanged =
      nextEntries.length !== existingEntries.length ||
      nextEntries.some((value, caseIndex) => value !== existingEntries[caseIndex]);

    if (entriesChanged) {
      setValue(`lines.${index}.caseWeightEntries`, nextEntries, {
        shouldDirty: true,
      });
    }
  }, [index, line?.caseWeightEntries, quantityCases, setValue, unitType]);

  useEffect(() => {
    if (unitType !== "catch_weight" || weightEntryMode === "total_weight") return;

    const nextWeight = computeDraftLineWeight(line ?? {});
    const nextWeightValue = nextWeight > 0 ? nextWeight.toFixed(4) : "0";

    if ((line?.weightLbs ?? "0") !== nextWeightValue) {
      setValue(`lines.${index}.weightLbs`, nextWeightValue, {
        shouldDirty: true,
      });
    }
  }, [
    index,
    line,
    line?.defaultCaseWeightLbs,
    line?.caseWeightEntries,
    line?.quantityCases,
    line?.weightEntryMode,
    line?.weightLbs,
    setValue,
    unitType,
    weightEntryMode,
  ]);

  const resolvedCaseWeights = getResolvedDraftCaseWeights(line ?? {});
  const overrideCount =
    weightEntryMode === "default_case_weight"
      ? (line?.caseWeightEntries ?? []).slice(0, quantityCases).filter(Boolean).length
      : 0;
  const totalWeightLbs =
    unitType === "catch_weight"
      ? computeDraftLineWeight(line ?? {})
      : Number(line?.weightLbs ?? "0") || 0;

  function seedDetailedMode(nextMode: SupplierInvoiceWeightEntryMode) {
    if (unitType !== "catch_weight") return;

    const currentEntries = [...(line?.caseWeightEntries ?? [])];
    const averageWeight =
      quantityCases > 0 && totalWeightLbs > 0
        ? totalWeightLbs / quantityCases
        : 0;
    const averageWeightText =
      averageWeight > 0 ? formatEditableWeight(averageWeight) : "";

    if (
      nextMode === "default_case_weight" &&
      !(line?.defaultCaseWeightLbs ?? "").trim() &&
      averageWeightText
    ) {
      setValue(`lines.${index}.defaultCaseWeightLbs`, averageWeightText, {
        shouldDirty: true,
      });
    }

    if (
      nextMode === "manual_case_weights" &&
      quantityCases > 0 &&
      currentEntries.slice(0, quantityCases).every(value => !value) &&
      averageWeightText
    ) {
      setValue(
        `lines.${index}.caseWeightEntries`,
        Array.from({ length: quantityCases }, () => averageWeightText),
        { shouldDirty: true },
      );
    }
  }

  function handleWeightModeChange(nextMode: SupplierInvoiceWeightEntryMode) {
    setValue(`lines.${index}.weightEntryMode`, nextMode, { shouldDirty: true });
    seedDetailedMode(nextMode);
  }

  function handleApplyDefaultToRemaining() {
    const defaultWeight = line?.defaultCaseWeightLbs?.trim() ?? "";
    if (!defaultWeight || quantityCases <= 0) return;

    const existingEntries = line?.caseWeightEntries ?? [];
    const nextEntries = Array.from({ length: quantityCases }, (_, caseIndex) =>
      existingEntries[caseIndex]?.trim() ? existingEntries[caseIndex] ?? "" : defaultWeight,
    );
    setValue(`lines.${index}.caseWeightEntries`, nextEntries, {
      shouldDirty: true,
    });
  }

  return (
    <>
      <TableRow className="align-top">
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
          <div className="flex flex-col items-end gap-2">
            <Input
              type="number"
              min={0}
              step="0.01"
              className="text-right tabular-nums"
              disabled={disabled || unitType === "fixed_case" || weightEntryMode !== "total_weight"}
              readOnly={unitType === "catch_weight" && weightEntryMode !== "total_weight"}
              value={
                unitType === "catch_weight" && weightEntryMode !== "total_weight"
                  ? totalWeightLbs > 0
                    ? totalWeightLbs.toFixed(4)
                    : "0"
                  : line?.weightLbs ?? "0"
              }
              {...register(`lines.${index}.weightLbs`)}
            />
            {unitType === "catch_weight" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setUserExpanded(open => !open)}
                disabled={disabled}
              >
                {expanded ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
                Case weights
              </Button>
            ) : null}
          </div>
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

      {unitType === "catch_weight" && expanded ? (
        <TableRow className="bg-muted/20">
          <TableCell colSpan={10}>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {weightEntryMode === "total_weight"
                    ? "Simple total"
                    : weightEntryMode === "default_case_weight"
                      ? "Shared default + overrides"
                      : "Manual per case"}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {quantityCases || 0} case{quantityCases === 1 ? "" : "s"}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {totalWeightLbs.toFixed(2)} lbs total
                </Badge>
                {weightEntryMode === "default_case_weight" && overrideCount > 0 ? (
                  <Badge variant="outline" className="text-xs">
                    {overrideCount} override{overrideCount === 1 ? "" : "s"}
                  </Badge>
                ) : null}
              </div>

              <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Weight entry</div>
                  <Controller
                    control={control}
                    name={`lines.${index}.weightEntryMode`}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(value: SupplierInvoiceWeightEntryMode) => {
                          field.onChange(value);
                          handleWeightModeChange(value);
                        }}
                        disabled={disabled}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="total_weight">
                            Simple total weight
                          </SelectItem>
                          <SelectItem value="default_case_weight">
                            Shared default + overrides
                          </SelectItem>
                          <SelectItem value="manual_case_weights">
                            Manual every case
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-muted-foreground text-xs">
                    Keep total-weight mode for quick entry, or expand into case
                    weights when one or more cases differ.
                  </p>
                </div>

                <div className="rounded-md border bg-background p-3">
                  {weightEntryMode === "total_weight" ? (
                    <div className="text-muted-foreground flex items-start gap-2 text-sm">
                      <Scale className="mt-0.5 size-4 shrink-0" />
                      <div>
                        Enter the total line weight in the main row. Switch to a
                        detailed mode when you want to capture case-level weights.
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {weightEntryMode === "default_case_weight" ? (
                        <div className="flex flex-col gap-3 md:flex-row md:items-end">
                          <div className="w-full max-w-xs">
                            <div className="mb-1 text-sm font-medium">
                              Default case weight
                            </div>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="text-right tabular-nums"
                              disabled={disabled}
                              {...register(`lines.${index}.defaultCaseWeightLbs`)}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleApplyDefaultToRemaining}
                            disabled={
                              disabled ||
                              quantityCases <= 0 ||
                              !(line?.defaultCaseWeightLbs ?? "").trim()
                            }
                          >
                            <Sparkles className="size-4" />
                            Apply to remaining cases
                          </Button>
                        </div>
                      ) : null}

                      {quantityCases > 0 ? (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {Array.from({ length: quantityCases }, (_, caseIndex) => {
                            const resolvedWeight = resolvedCaseWeights[caseIndex] ?? 0;
                            const explicitValue =
                              line?.caseWeightEntries?.[caseIndex] ?? "";
                            return (
                              <div
                                key={caseIndex}
                                className="rounded-md border bg-muted/20 p-3"
                              >
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <div className="text-sm font-medium">
                                    Case {caseIndex + 1}
                                  </div>
                                  {resolvedWeight > 0 ? (
                                    <div className="text-xs tabular-nums text-muted-foreground">
                                      {formatEditableWeight(resolvedWeight)} lbs
                                    </div>
                                  ) : null}
                                </div>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className="text-right tabular-nums"
                                  disabled={disabled}
                                  placeholder={
                                    weightEntryMode === "default_case_weight"
                                      ? line?.defaultCaseWeightLbs || "Use default"
                                      : "0.00"
                                  }
                                  {...register(
                                    `lines.${index}.caseWeightEntries.${caseIndex}`,
                                  )}
                                />
                                <div className="mt-2 text-[11px] text-muted-foreground">
                                  {weightEntryMode === "default_case_weight"
                                    ? explicitValue
                                      ? "Override for this case."
                                      : "Leave blank to use the default weight."
                                    : "Enter the exact weight for this case."}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          Enter the case count first to capture per-case weights.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
