"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { generateSku } from "./product-sku-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
  addProductFormSchema,
  productUnitPurposeValues,
  type AddProductFormValues,
  type ProductUnitFormValue,
} from "./add-product-form.schema";
import { useCategories } from "@/hooks/use-categories";
import type { ProductCategory } from "@/services/products";
import { createProductAction } from "@/actions/products";
import { createCategoryAction } from "@/actions/categories";
import { invalidateSetupChecklistQuery } from "@/lib/query/invalidate-setup-checklist";
import { queryKeys } from "@/lib/query/keys";
import { useProducts } from "@/hooks/use-products";
import { useUnitsOfMeasure } from "@/hooks/use-units-of-measure";
import { UnitOfMeasureListItem } from "@/services/units-of-measure";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PURPOSE_LABELS: Record<
  (typeof productUnitPurposeValues)[number],
  string
> = {
  stock: "Stock",
  purchase: "Purchase",
  sales: "Sales",
  pricing: "Pricing",
  display: "Display",
};

const defaultUnit: ProductUnitFormValue = {
  unitId: "",
  purpose: "stock",
  conversionToBase: "1",
  isDefault: true,
  allowsFractional: true,
};

const defaultForm: AddProductFormValues = {
  sku: "",
  name: "",
  categoryIds: [],
  baseUnitId: "",
  units: [],
};

function formatUomOption(u: UnitOfMeasureListItem): string {
  return u.abbreviation ? `${u.name} (${u.abbreviation})` : u.name;
}

// ---------------------------------------------------------------------------
// New-category dialog
// ---------------------------------------------------------------------------
function NewCategoryDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const category = await createCategoryAction({ name: trimmed });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.categories.all,
      });
      invalidateSetupChecklistQuery(queryClient);
      onCreated(category.id);
      toast.success(`Category "${category.name}" created.`);
      setName("");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create category.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus className="h-3.5 w-3.5 mr-1" />
          New category
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <Input
            id="new-category-name"
            placeholder="e.g. Beef, Seafood, Poultry…"
            value={name}
            onChange={e => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={pending}>
            {pending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------
export function AddProductForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);

  const form = useForm<AddProductFormValues>({
    resolver: zodResolver(addProductFormSchema),
    defaultValues: defaultForm,
  });

  const {
    fields: unitFields,
    append: appendUnit,
    remove: removeUnit,
  } = useFieldArray({ control: form.control, name: "units" });

  const { data: productCategories } = useCategories();
  const { data: products } = useProducts();

  const { data: unitsOfMeasure } = useUnitsOfMeasure();

  async function onSubmit(data: AddProductFormValues) {
    setMutationError(null);
    try {
      let sku = data.sku.trim();
      if (!sku) {
        const firstCat = productCategories?.find(
          c => c.id === data.categoryIds[0],
        );
        sku = generateSku(data.name, firstCat?.name ?? "", products);
        form.setValue("sku", sku);
      }
      await createProductAction({
        sku,
        name: data.name,
        categoryIds: data.categoryIds,
        baseUnitId: data.baseUnitId || null,
        units: data.units?.length ? data.units : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["price-chart"] });
      invalidateSetupChecklistQuery(queryClient);
      form.reset(defaultForm);
      router.push("/products");
    } catch (e) {
      setMutationError(
        e instanceof Error ? e.message : "Failed to add product.",
      );
    }
  }

  const isPending = form.formState.isSubmitting;

  return (
    <Card className="w-full max-w-xl">
      <CardContent className="pt-6">
        <form id="form-add-product" onSubmit={form.handleSubmit(onSubmit)}>
          {mutationError ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle />
              <AlertTitle>Add product failed</AlertTitle>
              <AlertDescription>{mutationError}</AlertDescription>
            </Alert>
          ) : null}
          <FieldGroup>
            {/* SKU + Name */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="sku"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="form-add-product-sku">SKU</FieldLabel>
                    <div className="flex flex-col gap-2">
                      <Input
                        {...field}
                        id="form-add-product-sku"
                        aria-invalid={fieldState.invalid}
                        placeholder="e.g. BEEF-RIB-01"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const name = form.getValues("name").trim();
                          const ids = form.getValues("categoryIds");
                          const firstCat = productCategories?.find(
                            c => c.id === ids[0],
                          );
                          if (!name || !firstCat) {
                            form.setError("sku", {
                              type: "manual",
                              message:
                                "Enter name and select a category before generating a SKU.",
                            });
                            return;
                          }
                          form.clearErrors("sku");
                          form.setValue(
                            "sku",
                            generateSku(name, firstCat.name, products),
                          );
                        }}
                      >
                        Auto-generate SKU
                      </Button>
                    </div>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="form-add-product-name">
                      Name *
                    </FieldLabel>
                    <Input
                      {...field}
                      id="form-add-product-name"
                      aria-invalid={fieldState.invalid}
                      placeholder="e.g. Beef Ribeye"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>

            {/* Categories */}
            <Controller
              name="categoryIds"
              control={form.control}
              render={({ field, fieldState }) => {
                const selectedCats = (productCategories ?? []).filter(c =>
                  field.value.includes(c.id),
                );
                return (
                  <Field data-invalid={fieldState.invalid}>
                    <div className="flex items-center justify-between gap-2">
                      <FieldLabel>Categories *</FieldLabel>
                      <NewCategoryDialog
                        onCreated={id => field.onChange([...field.value, id])}
                      />
                    </div>
                    <Combobox
                      multiple
                      items={productCategories ?? []}
                      value={selectedCats}
                      onValueChange={(cats: ProductCategory[]) =>
                        field.onChange(cats.map(c => c.id))
                      }
                    >
                      <ComboboxTrigger
                        render={
                          <ComboboxChips>
                            <ComboboxValue>
                              {selectedCats.map(item => (
                                <ComboboxChip key={item.id}>
                                  {item.name}
                                </ComboboxChip>
                              ))}
                            </ComboboxValue>
                            <ComboboxChipsInput placeholder="Add category" />
                          </ComboboxChips>
                        }
                      />
                      <ComboboxContent>
                        <ComboboxInput
                          showTrigger={false}
                          placeholder="Search categories…"
                        />
                        <ComboboxEmpty>No categories found.</ComboboxEmpty>
                        <ComboboxList>
                          {(item: ProductCategory) => (
                            <ComboboxItem key={item.id} value={item}>
                              {item.name}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                );
              }}
            />

            {/* Base unit */}
            <Controller
              name="baseUnitId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-product-base-unit">
                    Base unit
                  </FieldLabel>
                  <Combobox
                    items={unitsOfMeasure ?? []}
                    itemToStringValue={u => u.name}
                    value={
                      unitsOfMeasure?.find(u => u.id === field.value) ?? null
                    }
                    onValueChange={u => field.onChange(u?.id || "")}
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
                            {unitsOfMeasure?.find(u => u.id === field.value)
                              ? formatUomOption(
                                  unitsOfMeasure.find(
                                    u => u.id === field.value,
                                  )!,
                                )
                              : "None"}
                          </ComboboxValue>
                        </Button>
                      }
                    />
                    <ComboboxContent>
                      <ComboboxInput
                        showTrigger={false}
                        placeholder="Search units…"
                      />
                      <ComboboxEmpty>No units found.</ComboboxEmpty>
                      <ComboboxList>
                        {u => (
                          <ComboboxItem key={u.id} value={u}>
                            {formatUomOption(u)}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  <FieldDescription>
                    The fundamental unit all conversions are relative to (e.g.
                    lb, kg).
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* Product units */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <FieldLabel>Units</FieldLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    appendUnit({
                      ...defaultUnit,
                      isDefault: unitFields.length === 0,
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add unit
                </Button>
              </div>

              {unitFields.length > 0 && (
                <div className="flex flex-col gap-3">
                  {unitFields.map((uf, index) => (
                    <div
                      key={uf.id}
                      className="rounded-md border p-4 flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                          Unit {index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeUnit(index)}
                          aria-label={`Remove unit ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {/* UOM */}
                        <Controller
                          name={`units.${index}.unitId`}
                          control={form.control}
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                              <FieldLabel htmlFor={`units-${index}-unit`}>
                                Unit *
                              </FieldLabel>
                              <Select
                                value={field.value || "__none__"}
                                onValueChange={v =>
                                  field.onChange(v === "__none__" ? "" : v)
                                }
                              >
                                <SelectTrigger
                                  id={`units-${index}-unit`}
                                  aria-invalid={fieldState.invalid}
                                >
                                  <SelectValue placeholder="Select…" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">
                                    Select…
                                  </SelectItem>
                                  {unitsOfMeasure?.map(u => (
                                    <SelectItem key={u.id} value={String(u.id)}>
                                      {formatUomOption(u)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                              )}
                            </Field>
                          )}
                        />

                        {/* Purpose */}
                        <Controller
                          name={`units.${index}.purpose`}
                          control={form.control}
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                              <FieldLabel htmlFor={`units-${index}-purpose`}>
                                Purpose *
                              </FieldLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger
                                  id={`units-${index}-purpose`}
                                  aria-invalid={fieldState.invalid}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {productUnitPurposeValues.map(p => (
                                    <SelectItem key={p} value={p}>
                                      {PURPOSE_LABELS[p]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                              )}
                            </Field>
                          )}
                        />
                      </div>

                      {/* Conversion to base */}
                      <Controller
                        name={`units.${index}.conversionToBase`}
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={`units-${index}-conversion`}>
                              Conversion to base *
                            </FieldLabel>
                            <Input
                              {...field}
                              id={`units-${index}-conversion`}
                              type="number"
                              min="0.0001"
                              step="any"
                              aria-invalid={fieldState.invalid}
                              placeholder="e.g. 1 or 0.453592"
                            />
                            <FieldDescription>
                              How many base units equal 1 of this unit (e.g. 1
                              lb = 1, 1 case = 40).
                            </FieldDescription>
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </Field>
                        )}
                      />

                      {/* Flags */}
                      <div className="flex flex-wrap gap-4">
                        <Controller
                          name={`units.${index}.isDefault`}
                          control={form.control}
                          render={({ field }) => (
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <Checkbox
                                checked={field.value ?? false}
                                onCheckedChange={field.onChange}
                              />
                              Default unit
                            </label>
                          )}
                        />
                        <Controller
                          name={`units.${index}.allowsFractional`}
                          control={form.control}
                          render={({ field }) => (
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <Checkbox
                                checked={field.value ?? true}
                                onCheckedChange={field.onChange}
                              />
                              Allows fractional quantities
                            </label>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {unitFields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No units added yet. Units define how this product is
                  purchased, stocked, and sold.
                </p>
              )}
            </div>

            <FieldDescription>
              Manage the unit list under{" "}
              <Link
                href="/units-of-measure"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Units of measure
              </Link>
              .
            </FieldDescription>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2 border-t pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/products")}
        >
          Cancel
        </Button>
        <Button type="submit" form="form-add-product" disabled={isPending}>
          {isPending ? "Adding…" : "Add product"}
        </Button>
      </CardFooter>
    </Card>
  );
}
