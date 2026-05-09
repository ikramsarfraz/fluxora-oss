"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { generateSku } from "./product-sku-utils";
import { SubscriptionUpgradeMessage } from "@/components/subscription/subscription-upgrade-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
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
import { FormActionFooter } from "@/components/forms/form-action-footer";
import { FormErrorAlert } from "@/components/forms/form-error-alert";

import {
  addProductFormSchema,
  type AddProductFormValues,
} from "./add-product-form.schema";
import { useCategories } from "@/hooks/use-categories";
import type { ProductCategory, ProductDetail } from "../services/products";
import { createProductAction, updateProductAction } from "@/actions/products";
import { createCategoryAction } from "@/actions/categories";
import { invalidateSetupChecklistQuery } from "@/lib/query/invalidate-setup-checklist";
import { queryKeys } from "@/lib/query/keys";
import { useProducts } from "../hooks/use-products";
import {
  isLimitReachedMessage,
  stripSubscriptionEnforcementPrefix,
} from "@/lib/subscription-enforcement";
import { useUnitsOfMeasure } from "@/hooks/use-units-of-measure";
import type { UnitOfMeasureListItem } from "@/modules/distribution/units-of-measure/services/units-of-measure";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDefaultForm(product?: ProductDetail): AddProductFormValues {
  if (!product) {
    return {
      sku: "",
      name: "",
      categoryIds: [],
      sellingType: "by_weight",
      defaultPrice: "",
      sellByPound: true,
      sellByEach: true,
      sellInCases: false,
      caseQuantity: "",
    };
  }

  const salesUnits = (product.productUnits ?? []).filter(
    u => u.purpose === "sales",
  );
  const baseAbbrev = product.baseUnit?.abbreviation?.toLowerCase() ?? "";
  const isWeightBased = baseAbbrev === "lb" || baseAbbrev === "kg";

  const hasPoundUnit = salesUnits.some(
    u => u.unit?.abbreviation?.toLowerCase() === "lb",
  );
  const caseUnit = salesUnits.find(
    u => u.unit?.abbreviation?.toLowerCase() === "cs",
  );
  const hasEachUnit = salesUnits.some(
    u => u.unit?.abbreviation?.toLowerCase() === "ea",
  );

  return {
    sku: product.sku,
    name: product.name,
    categoryIds: (product.productCategories ?? []).map(pc => pc.categoryId),
    sellingType: isWeightBased ? "by_weight" : "by_unit",
    defaultPrice: product.defaultPricePerLb ?? "",
    sellByPound: hasPoundUnit || (isWeightBased && !caseUnit),
    sellByEach: !isWeightBased ? hasEachUnit || !caseUnit : false,
    sellInCases: !!caseUnit,
    caseQuantity: caseUnit?.conversionToBase ?? "",
  };
}

type UnitPayload = NonNullable<
  Parameters<typeof createProductAction>[0]["units"]
>[number];

function buildUnitsPayload(
  data: AddProductFormValues,
  uoms: UnitOfMeasureListItem[],
): UnitPayload[] {
  const byAbbr = (abbr: string) => uoms.find(u => u.abbreviation === abbr);
  const lbUom = byAbbr("lb");
  const eaUom = byAbbr("ea");
  const csUom = byAbbr("cs");

  const units: UnitPayload[] = [];

  if (data.sellingType === "by_weight") {
    if (data.sellByPound && lbUom) {
      units.push({
        unitId: lbUom.id,
        purpose: "sales",
        conversionToBase: "1",
        isDefault: !data.sellInCases,
        allowsFractional: true,
        sortOrder: 1,
      });
    }
    if (data.sellInCases && csUom && data.caseQuantity) {
      units.push({
        unitId: csUom.id,
        purpose: "sales",
        conversionToBase: data.caseQuantity,
        isDefault: true,
        allowsFractional: false,
        sortOrder: 0,
      });
    }
  } else {
    if (data.sellByEach && eaUom) {
      units.push({
        unitId: eaUom.id,
        purpose: "sales",
        conversionToBase: "1",
        isDefault: !data.sellInCases,
        allowsFractional: false,
        sortOrder: 1,
      });
    }
    if (data.sellInCases && csUom && data.caseQuantity) {
      units.push({
        unitId: csUom.id,
        purpose: "sales",
        conversionToBase: data.caseQuantity,
        isDefault: true,
        allowsFractional: false,
        sortOrder: 0,
      });
    }
  }

  return units;
}

function getBaseUnitId(
  data: AddProductFormValues,
  uoms: UnitOfMeasureListItem[],
): string | null {
  const byAbbr = (abbr: string) => uoms.find(u => u.abbreviation === abbr)?.id ?? null;
  // Base unit is always the atomic pricing unit: lb for weight, ea for unit-based.
  // Case prices are derived as conversionToBase × defaultPrice, so base is never "cs".
  if (data.sellingType === "by_weight") return byAbbr("lb");
  return byAbbr("ea");
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
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {pending ? "Creating…" : "Create category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------
export function AddProductForm(props?: {
  mode?: "create" | "edit";
  product?: ProductDetail;
}) {
  const mode = props?.mode ?? "create";
  const product = props?.product;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);

  const form = useForm<AddProductFormValues>({
    resolver: zodResolver(addProductFormSchema),
    defaultValues: buildDefaultForm(product),
  });

  const { data: productCategories } = useCategories();
  const { data: products } = useProducts();
  const { data: unitsOfMeasure } = useUnitsOfMeasure();

  const sellingType = useWatch({ control: form.control, name: "sellingType" });
  const sellInCases = useWatch({ control: form.control, name: "sellInCases" });

  async function onSubmit(data: AddProductFormValues) {
    setMutationError(null);
    try {
      // Edit keeps the existing SKU; create always auto-generates.
      let sku: string;
      if (mode === "edit" && product) {
        sku = product.sku;
      } else {
        const firstCat = productCategories?.find(
          c => c.id === data.categoryIds[0],
        );
        sku = generateSku(data.name, firstCat?.name ?? "", products);
      }
      const uoms = unitsOfMeasure ?? [];
      const payload = {
        sku,
        name: data.name,
        categoryIds: data.categoryIds,
        defaultPricePerLb: data.defaultPrice,
        baseUnitId: getBaseUnitId(data, uoms),
        units: buildUnitsPayload(data, uoms),
      };
      const result =
        mode === "edit" && product
          ? await updateProductAction({ id: product.id, ...payload })
          : await createProductAction(payload);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["price-chart"] });
      invalidateSetupChecklistQuery(queryClient);
      router.push(`/products/${result.id}`);
      toast.success(mode === "edit" ? "Product updated." : "Product created.");
    } catch (e) {
      setMutationError(
        e instanceof Error
          ? e.message
          : mode === "edit"
            ? "Failed to update product."
            : "Failed to add product.",
      );
    }
  }

  const isPending = form.formState.isSubmitting;

  return (
    <Card className="w-full max-w-xl">
      <CardContent className="pt-6">
        <form id="form-add-product" onSubmit={form.handleSubmit(onSubmit)}>
          {mutationError ? (
            <FormErrorAlert
              title={
                mode === "edit"
                  ? "We couldn't save your changes."
                  : "We couldn't create the product."
              }
            >
              {isLimitReachedMessage(mutationError, "maxProducts") ? (
                <SubscriptionUpgradeMessage message="Your current plan has reached the product limit." />
              ) : (
                stripSubscriptionEnforcementPrefix(mutationError)
              )}
            </FormErrorAlert>
          ) : null}

          <FieldGroup>
            {/* Name */}
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-product-name">Name *</FieldLabel>
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

            {/* Default price */}
            <Controller
              name="defaultPrice"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-add-product-price">
                    {sellingType === "by_weight"
                      ? "Default price per lb *"
                      : "Default price per unit (each) *"}
                  </FieldLabel>
                  <div className="flex items-center gap-2 max-w-48">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input
                      {...field}
                      id="form-add-product-price"
                      type="number"
                      min="0"
                      step="0.0001"
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-invalid={fieldState.invalid}
                    />
                  </div>
                  <FieldDescription>
                    {sellingType === "by_weight"
                      ? "Case totals are estimated from this rate × lbs per case."
                      : "Case totals are calculated from this rate × units per case."}
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

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

            {/* Selling method */}
            <Controller
              name="sellingType"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Selling method *</FieldLabel>
                  <div className="flex flex-col gap-2">
                    {(
                      [
                        {
                          value: "by_weight",
                          label: "By weight — price per pound",
                          description: "Meat, fish, deli — invoice uses actual weight",
                        },
                        {
                          value: "by_unit",
                          label: "By unit — flat price per item",
                          description: "Beverages, dry goods, packaged items",
                        },
                      ] as const
                    ).map(opt => (
                      <label
                        key={opt.value}
                        className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                          field.value === opt.value
                            ? "border-primary bg-accent/30"
                            : "hover:bg-muted/40"
                        }`}
                      >
                        <input
                          type="radio"
                          value={opt.value}
                          checked={field.value === opt.value}
                          onChange={() => {
                            field.onChange(opt.value);
                            if (opt.value === "by_weight") {
                              form.setValue("sellByPound", true);
                              form.setValue("sellByEach", false);
                            } else {
                              form.setValue("sellByPound", false);
                              form.setValue("sellByEach", true);
                            }
                          }}
                          className="mt-0.5 accent-current"
                        />
                        <div>
                          <div className="text-sm font-medium">{opt.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {opt.description}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </Field>
              )}
            />

            {/* Selling units */}
            <Field>
              <FieldLabel>Selling units *</FieldLabel>
              <div className="rounded-md border p-4 flex flex-col gap-4">
                {sellingType === "by_weight" ? (
                  <>
                    {/* Sell by pound */}
                    <Controller
                      name="sellByPound"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <div className="flex flex-col gap-1">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                            Sell by the pound (lb)
                          </label>
                          {fieldState.invalid && (
                            <p className="text-xs text-destructive">
                              {fieldState.error?.message}
                            </p>
                          )}
                        </div>
                      )}
                    />

                    {/* Sell by case */}
                    <div className="flex flex-col gap-3">
                      <Controller
                        name="sellInCases"
                        control={form.control}
                        render={({ field }) => (
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={v => {
                                field.onChange(v);
                                if (!v) form.setValue("caseQuantity", "");
                              }}
                            />
                            Sell by the case (cs)
                          </label>
                        )}
                      />
                      {sellInCases && (
                        <Controller
                          name="caseQuantity"
                          control={form.control}
                          render={({ field, fieldState }) => (
                            <Field
                              data-invalid={fieldState.invalid}
                              className="ml-6"
                            >
                              <FieldLabel htmlFor="case-quantity">
                                Estimated lbs per case *
                              </FieldLabel>
                              <Input
                                {...field}
                                id="case-quantity"
                                type="number"
                                min="0.001"
                                step="any"
                                placeholder="e.g. 40"
                                className="max-w-40"
                                aria-invalid={fieldState.invalid}
                              />
                              <FieldDescription>
                                Used for order total estimates only. Actual case
                                weights are recorded at fulfillment.
                              </FieldDescription>
                              {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                              )}
                            </Field>
                          )}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Sell by each */}
                    <Controller
                      name="sellByEach"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <div className="flex flex-col gap-1">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                            Sell by the unit — each (ea)
                          </label>
                          {fieldState.invalid && (
                            <p className="text-xs text-destructive">
                              {fieldState.error?.message}
                            </p>
                          )}
                        </div>
                      )}
                    />

                    {/* Sell by case */}
                    <div className="flex flex-col gap-3">
                      <Controller
                        name="sellInCases"
                        control={form.control}
                        render={({ field }) => (
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={v => {
                                field.onChange(v);
                                if (!v) form.setValue("caseQuantity", "");
                              }}
                            />
                            Sell by the case (cs)
                          </label>
                        )}
                      />
                      {sellInCases && (
                        <Controller
                          name="caseQuantity"
                          control={form.control}
                          render={({ field, fieldState }) => (
                            <Field
                              data-invalid={fieldState.invalid}
                              className="ml-6"
                            >
                              <FieldLabel htmlFor="case-quantity">
                                Units per case *
                              </FieldLabel>
                              <Input
                                {...field}
                                id="case-quantity"
                                type="number"
                                min="1"
                                step="1"
                                placeholder="e.g. 24"
                                className="max-w-40"
                                aria-invalid={fieldState.invalid}
                              />
                              {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                              )}
                            </Field>
                          )}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
              <FieldDescription>
                Need a different unit?{" "}
                <Link
                  href="/units-of-measure"
                  className="text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  Manage units of measure
                </Link>
                .
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
      <FormActionFooter
        formId="form-add-product"
        isPending={isPending}
        onCancel={() =>
          router.push(
            mode === "edit" && product
              ? `/products/${product.id}`
              : "/products",
          )
        }
        pendingLabel={mode === "edit" ? "Saving…" : "Creating…"}
        submitLabel={mode === "edit" ? "Save changes" : "Create product"}
      />
    </Card>
  );
}
