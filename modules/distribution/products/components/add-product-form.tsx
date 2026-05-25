"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  HelpCircle,
  Info,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { buildSkuBase } from "../utils/sku";
import { SubscriptionUpgradeMessage } from "@/modules/core/billing/components/subscription/subscription-upgrade-message";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormActionFooter } from "@/components/forms/form-action-footer";
import { FormErrorAlert } from "@/components/forms/form-error-alert";

import {
  addProductFormSchema,
  type AddProductFormValues,
} from "./add-product-form.schema";
import { useCategories } from "@/modules/distribution/categories/hooks/use-categories";
import type { ProductCategory, ProductDetail } from "../services/products";
import { createProductAction, updateProductAction } from "@/modules/distribution/products/actions";
import { createCategoryAction } from "@/modules/distribution/categories/actions";
import { invalidateSetupChecklistQuery } from "@/lib/query/invalidate-setup-checklist";
import { queryKeys } from "@/lib/query/keys";
import { useProductSkuPreview } from "../hooks/use-products";
import {
  isLimitReachedMessage,
  stripSubscriptionEnforcementPrefix,
} from "@/lib/subscription-enforcement";
import { useUnitsOfMeasure } from "@/modules/distribution/units-of-measure/hooks/use-units-of-measure";
import type { UnitOfMeasureListItem } from "@/modules/distribution/units-of-measure/services/units-of-measure";

// ---------------------------------------------------------------------------
// Helpful examples shown on the form. Tight, concrete recipes so a user
// looking at the new base-UOM + sales-unit setup can pattern-match to
// their product type instead of guessing. Edit this list when adding
// support for a new vertical (e.g. produce by weight + box).
// ---------------------------------------------------------------------------

const PRICING_EXAMPLES: Array<{
  title: string;
  baseUnit: string;
  defaultPriceFormat: string;
  salesUnits: string[];
  notes: string;
}> = [
  {
    title: "Meat by the pound",
    baseUnit: "lb",
    defaultPriceFormat: "$ 8.99 / lb",
    salesUnits: ["lb (default)", "cs — 40 lb per case"],
    notes:
      "Catch-weight items priced per pound. Add a case sales unit so staff can also quote whole-case orders.",
  },
  {
    title: "Beverages by case",
    baseUnit: "ea",
    defaultPriceFormat: "$ 1.25 / ea",
    salesUnits: ["ea (default)", "cs — 12 ea per case"],
    notes:
      "Canned drinks, water bottles, snacks. The base is the individual unit so pricing math always works.",
  },
  {
    title: "Liquids by the gallon",
    baseUnit: "gal",
    defaultPriceFormat: "$ 4.50 / gal",
    salesUnits: ["gal (default)", "cs — 4 gal per case"],
    notes:
      "Milk, syrups, sauces. Picking gal as the base lets the form derive case prices from per-gallon math.",
  },
];

function PricingExamplesPanel() {
  const [open, setOpen] = useState(false);
  return (
    <Alert className="border-dashed">
      <Info className="size-4 text-info-fg" />
      <AlertTitle>Picking the right units</AlertTitle>
      <AlertDescription>
        <p className="text-xs text-subtle">
          The <strong>base unit</strong> is what pricing, costs, and inventory
          math are tracked in. <strong>Sales units</strong> are the unit options
          staff can pick when quoting an order — each has a conversion back to
          the base.
        </p>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          className="mt-2 h-auto gap-1 p-0 text-xs font-medium text-info-fg hover:text-info-fg/80"
        >
          <ChevronDown
            className={cn(
              "size-3 transition-transform",
              open ? "rotate-180" : "",
            )}
          />
          {open ? "Hide examples" : "Show common setups"}
        </Button>
        {open ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {PRICING_EXAMPLES.map(ex => (
              <div
                key={ex.title}
                className="rounded-md border border-border-default bg-card p-3 text-xs flex flex-col gap-1.5"
              >
                <div className="font-medium text-ink text-[12px]">
                  {ex.title}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-subtle/80 text-[10.5px] uppercase tracking-wide font-semibold">
                    Base
                  </span>
                  <span className="font-mono tabular-nums text-ink">
                    {ex.baseUnit}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-subtle/80 text-[10.5px] uppercase tracking-wide font-semibold">
                    Price
                  </span>
                  <span className="font-mono tabular-nums text-ink">
                    {ex.defaultPriceFormat}
                  </span>
                </div>
                <div>
                  <span className="text-subtle/80 text-[10.5px] uppercase tracking-wide font-semibold block mb-1">
                    Sales units
                  </span>
                  <ul className="ml-3 list-disc text-ink space-y-0.5">
                    {ex.salesUnits.map(u => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                </div>
                <div className="text-[11px] text-subtle leading-snug pt-1 border-t border-border-default/60">
                  {ex.notes}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Small "?" affordance next to a label. Renders an accessible tooltip
 * trigger with a tight 1-2 sentence explanation; kept compact so the
 * form labels stay scannable for repeat users.
 */
function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex size-4 items-center justify-center text-subtle/70 hover:text-subtle"
            aria-label="More info"
          >
            <HelpCircle className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] text-xs leading-snug">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// UOM family rendering — drives grouping in the picker and downstream
// reports. Kept in this file (not in the schema module) because it's UI
// metadata, not validation truth.
// ---------------------------------------------------------------------------

const UOM_FAMILY_ORDER = ["weight", "count", "volume", "length", "other"] as const;

const UOM_FAMILY_LABEL: Record<(typeof UOM_FAMILY_ORDER)[number], string> = {
  weight: "Weight",
  count: "Count / Packaging",
  volume: "Volume",
  length: "Length",
  other: "Other",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find a UOM by abbreviation (case-insensitive). Used by `buildDefaultForm`
 * to pick a sensible base UOM for brand-new products (defaults to `lb`,
 * the historical baseline; user can change to `ea`, `gal`, etc.).
 */
function findUomByAbbreviation(
  uoms: UnitOfMeasureListItem[],
  abbreviation: string,
): UnitOfMeasureListItem | undefined {
  return uoms.find(
    u => u.abbreviation?.toLowerCase() === abbreviation.toLowerCase(),
  );
}

function buildDefaultForm(
  product: ProductDetail | undefined,
  uoms: UnitOfMeasureListItem[],
  initialName?: string,
): AddProductFormValues {
  if (!product) {
    // Brand-new product: default to lb-base + one lb sales row marked default.
    // The user can swap base UOM and add more sales rows before submitting.
    const lbUom = findUomByAbbreviation(uoms, "lb");
    return {
      sku: "",
      name: initialName ?? "",
      categoryIds: [],
      baseUnitId: lbUom?.id ?? "",
      defaultPrice: "",
      salesUnits: lbUom
        ? [
            {
              unitId: lbUom.id,
              conversionToBase: "1",
              isDefault: true,
              allowsFractional: true,
            },
          ]
        : [],
    };
  }

  const salesRows = (product.productUnits ?? [])
    .filter(u => u.purpose === "sales")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(u => ({
      unitId: u.unitId,
      conversionToBase: u.conversionToBase,
      isDefault: u.isDefault,
      allowsFractional: u.allowsFractional,
    }));

  // If a product has no explicit sales rows (legacy data), seed one
  // entry matching its baseUnit at conversion 1 so the form has
  // something to render.
  if (salesRows.length === 0 && product.baseUnitId) {
    salesRows.push({
      unitId: product.baseUnitId,
      conversionToBase: "1",
      isDefault: true,
      allowsFractional: true,
    });
  }

  // Guarantee exactly one default — pick the first row if none was flagged.
  if (!salesRows.some(r => r.isDefault) && salesRows.length > 0) {
    salesRows[0].isDefault = true;
  }

  return {
    sku: product.sku,
    name: product.name,
    categoryIds: (product.productCategories ?? []).map(pc => pc.categoryId),
    baseUnitId: product.baseUnitId ?? "",
    defaultPrice: product.defaultPricePerLb ?? "",
    salesUnits: salesRows,
  };
}

type UnitPayload = NonNullable<
  Parameters<typeof createProductAction>[0]["units"]
>[number];

/**
 * Flatten the form's salesUnits array into the action-payload shape.
 * Every row becomes one `product_units` entry with purpose='sales' and
 * the conversion factor the user entered. The form enforces uniqueness
 * and exactly-one-default; we just snapshot what the user picked.
 */
function buildUnitsPayload(data: AddProductFormValues): UnitPayload[] {
  return data.salesUnits.map((row, i) => ({
    unitId: row.unitId,
    purpose: "sales" as const,
    conversionToBase: row.conversionToBase,
    isDefault: row.isDefault,
    allowsFractional: row.allowsFractional,
    sortOrder: i,
  }));
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

/**
 * Static line below the Name field. In create mode shows what SKU the
 * product will get (resolved against the live catalog so two simultaneous
 * creates can't pick the same `-NN`). In edit mode shows the locked SKU.
 * Stays silent until the user has typed a name AND picked a category, so
 * the form doesn't show a half-formed "OTH-XYZ-…" preview that would only
 * confuse non-meat tenants.
 */
function SkuPreviewLine(props: {
  mode: "create" | "edit";
  editingProduct: ProductDetail | undefined;
  name: string;
  firstCategorySelected: boolean;
  previewValue: string | null;
  isLoading: boolean;
}) {
  if (props.mode === "edit" && props.editingProduct) {
    return (
      <FieldDescription>
        <span className="text-subtle">SKU:</span>{" "}
        <code className="font-mono text-[11px] text-ink">
          {props.editingProduct.sku}
        </code>{" "}
        <span className="text-subtle">(locked)</span>
      </FieldDescription>
    );
  }
  if (props.mode !== "create") return null;
  if (!props.name.trim() || !props.firstCategorySelected) {
    return (
      <FieldDescription>
        SKU is generated from the name + first category once both are set.
      </FieldDescription>
    );
  }
  return (
    <FieldDescription>
      <span className="text-subtle">SKU preview:</span>{" "}
      {props.isLoading || !props.previewValue ? (
        <span className="text-subtle">resolving…</span>
      ) : (
        <code className="font-mono text-[11px] text-ink">
          {props.previewValue}
        </code>
      )}
    </FieldDescription>
  );
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------
export function AddProductForm(props?: {
  mode?: "create" | "edit";
  product?: ProductDetail;
  /** Prefill the name field — used by inline create-from-review surfaces. */
  initialName?: string;
  /**
   * When provided, called with the created/updated product instead of
   * navigating away. Enables embedding the form in a modal where the
   * caller handles post-save behaviour (closing the modal, resolving a
   * row, etc.).
   */
  onCreated?: (result: { id: string }) => void;
  /** When provided, the Cancel button calls this instead of routing back. */
  onCancel?: () => void;
  /**
   * Pin the save/cancel bar to the viewport bottom. Pass `true` from route
   * pages so the actions stay reachable on long forms; leave off inside
   * modals where the dialog already manages footer placement.
   */
  stickyFooter?: boolean;
}) {
  const mode = props?.mode ?? "create";
  const product = props?.product;
  const initialName = props?.initialName;
  const stickyFooter = props?.stickyFooter ?? false;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);

  const { data: productCategories } = useCategories();
  const { data: unitsOfMeasure } = useUnitsOfMeasure();

  // Memoize so the form only resets when the underlying data actually
  // changes — not on every parent re-render — otherwise the user's edits
  // get clobbered while UoM data is still loading.
  const initialFormValues = useMemo(
    () => buildDefaultForm(product, unitsOfMeasure ?? [], initialName),
    [product, unitsOfMeasure, initialName],
  );

  const form = useForm<AddProductFormValues>({
    resolver: zodResolver(addProductFormSchema),
    defaultValues: initialFormValues,
  });

  // The form's default values depend on the UoM list (so we can resolve
  // "lb" as the new-product baseline). When UoMs load AFTER mount, reset
  // the form once — but only if the user hasn't started editing yet,
  // so we don't clobber in-flight changes.
  const hasResetRef = useRef(false);
  useEffect(() => {
    if (hasResetRef.current) return;
    if (!(unitsOfMeasure && unitsOfMeasure.length > 0)) return;
    if (form.formState.isDirty) return;
    hasResetRef.current = true;
    form.reset(initialFormValues);
  }, [form, initialFormValues, unitsOfMeasure]);

  const { fields: salesUnitFields, append: appendSalesUnit, remove: removeSalesUnit } =
    useFieldArray({
      control: form.control,
      name: "salesUnits",
    });

  const baseUnitId = useWatch({ control: form.control, name: "baseUnitId" });
  const salesUnits = useWatch({ control: form.control, name: "salesUnits" });
  const watchedName = useWatch({ control: form.control, name: "name" });
  const watchedCategoryIds = useWatch({
    control: form.control,
    name: "categoryIds",
  });
  const firstCategoryName =
    (productCategories ?? []).find(c => c.id === watchedCategoryIds?.[0])
      ?.name ?? null;
  const baseUnit = (unitsOfMeasure ?? []).find(u => u.id === baseUnitId);
  const baseUnitAbbreviation = baseUnit?.abbreviation ?? "";

  // Server-driven SKU preview — only in create mode, since edit keeps the
  // existing SKU. The hook gates on a non-empty name internally.
  const skuPreviewQuery = useProductSkuPreview(
    mode === "create" ? (watchedName ?? "") : "",
    firstCategoryName,
  );

  async function onSubmit(data: AddProductFormValues) {
    setMutationError(null);
    try {
      // Edit keeps the existing SKU; create uses the most recent server
      // preview — and on the off-chance the preview hasn't resolved yet,
      // submits a starter SKU that the service will retry against the
      // unique index if it collides.
      let sku: string;
      if (mode === "edit" && product) {
        sku = product.sku;
      } else {
        const firstCat = productCategories?.find(
          c => c.id === data.categoryIds[0],
        );
        sku =
          skuPreviewQuery.data ??
          `${buildSkuBase(data.name, firstCat?.name ?? null)}-01`;
      }
      const payload = {
        sku,
        name: data.name,
        categoryIds: data.categoryIds,
        baseUnitId: data.baseUnitId || null,
        // The DB column is still called default_price_per_lb (legacy
        // name); semantically it stores "price per base unit". The form
        // field is `defaultPrice` and the value flows verbatim — empty
        // string degrades to 0 in the service.
        defaultPricePerLb: data.defaultPrice || "0",
        units: buildUnitsPayload(data),
      };
      const result =
        mode === "edit" && product
          ? await updateProductAction({ id: product.id, ...payload })
          : await createProductAction(payload);
      // IMPORTANT — order matters. Navigate (or hand off via onCreated)
      // BEFORE invalidating any queries. Invalidating `["products"]` here
      // matches `useProductSkuPreview`'s key by prefix; the still-mounted
      // hook would re-fire `previewProductSkuAction` against the form's
      // current path (`/products/new`). Next.js 16 piggybacks each server
      // action's response with the page tree for the URL it was POSTed to;
      // when that response lands AFTER router.push has started, the client
      // router rolls the URL back to `/products/new`. Net effect users saw:
      // submit → flash of /products/<id> → bounce back to /products/new.
      toast.success(mode === "edit" ? "Product updated." : "Product created.");
      if (props?.onCreated) {
        props.onCreated({ id: result.id });
      } else {
        router.push(`/products/${result.id}`);
      }
      // Now that the form is unmounting, invalidate. Use the more specific
      // `["products", "list"]` prefix so the sku-preview branch is never
      // matched even if a future component re-mounts it before this fires.
      queryClient.invalidateQueries({ queryKey: ["products", "list"] });
      if (mode === "edit" && product) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.products.detail(product.id),
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.priceChart.all });
      invalidateSetupChecklistQuery(queryClient);
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

  const footer = (
    <FormActionFooter
      formId="form-add-product"
      isPending={isPending}
      onCancel={() => {
        if (props?.onCancel) {
          props.onCancel();
        } else {
          router.push(
            mode === "edit" && product
              ? `/products/${product.id}`
              : "/products",
          );
        }
      }}
      pendingLabel={mode === "edit" ? "Saving…" : "Creating…"}
      submitLabel={mode === "edit" ? "Save changes" : "Create product"}
      sticky={stickyFooter}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <Card className="w-full">
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
                  <SkuPreviewLine
                    mode={mode}
                    editingProduct={product}
                    name={watchedName ?? ""}
                    firstCategorySelected={Boolean(watchedCategoryIds?.length)}
                    previewValue={skuPreviewQuery.data ?? null}
                    isLoading={skuPreviewQuery.isFetching}
                  />
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
                        nativeButton={false}
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
                    {productCategories && productCategories.length === 0 ? (
                      // First-time tenants land here with no categories at
                      // all — the combobox renders blank and looks broken.
                      // Point them at the inline "New category" button so
                      // the empty state has a next step rather than dead
                      // air.
                      <FieldDescription>
                        No categories yet — use{" "}
                        <strong>New category</strong> above to add your
                        first one.
                      </FieldDescription>
                    ) : null}
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                );
              }}
            />

            {/* Quick-orientation guide for users new to the unit model.
                Collapsed by default so it doesn't clutter the form for
                repeat users. */}
            <PricingExamplesPanel />

            {/* Base unit — the atomic unit pricing + inventory math is recorded in.
                Once a product has dependent records (orders, prices, bills), the
                base unit is locked to avoid silently changing the meaning of
                stored prices and costs. */}
            <Controller
              name="baseUnitId"
              control={form.control}
              render={({ field, fieldState }) => {
                // Lock the base unit once ANY dependent record exists — not
                // just bills. Sales-order lines, sales-invoice lines,
                // customer-specific prices, and supplier-cost snapshots all
                // store amounts/quantities in the product's base unit; if we
                // swap it out from under them, history reinterprets silently.
                const baseUnitLocked = Boolean(
                  product && (product._dependentRecordCount ?? 0) > 0,
                );
                return (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel
                      htmlFor="form-product-base-unit"
                      className="inline-flex items-center gap-1"
                    >
                      Base unit *
                      <FieldHint>
                        The smallest unit you price and count in. Pick{" "}
                        <strong>lb</strong> for catch-weight meat,{" "}
                        <strong>ea</strong> for cans and packaged items,{" "}
                        <strong>gal</strong> or <strong>L</strong> for liquids.
                        Every cost and customer-specific price stores in this
                        unit.
                      </FieldHint>
                    </FieldLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={baseUnitLocked}
                    >
                      <SelectTrigger
                        id="form-product-base-unit"
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue placeholder="Select a base unit…" />
                      </SelectTrigger>
                      <SelectContent>
                        {UOM_FAMILY_ORDER.map(family => {
                          const inFamily = (unitsOfMeasure ?? []).filter(
                            u => u.family === family && u.isActive,
                          );
                          if (inFamily.length === 0) return null;
                          return (
                            <SelectGroup key={family}>
                              <SelectLabel>{UOM_FAMILY_LABEL[family]}</SelectLabel>
                              {inFamily.map(u => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.name}
                                  {u.abbreviation ? ` (${u.abbreviation})` : ""}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {baseUnitLocked
                        ? "Locked — this product has orders, invoices, prices, or bills referencing it. Changing the base unit would reinterpret stored amounts."
                        : "Prices, costs, and inventory totals are tracked in this unit. Sales units below convert to this base."}
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                );
              }}
            />

            {/* Default price (per base unit). The suffix mirrors whatever the
                user picked as the base UOM. */}
            <Controller
              name="defaultPrice"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel
                    htmlFor="form-product-default-price"
                    className="inline-flex items-center gap-1"
                  >
                    Default price
                    {baseUnitAbbreviation ? ` per ${baseUnitAbbreviation}` : ""}
                    <FieldHint>
                      The starting price the order form suggests when a customer
                      doesn&rsquo;t have a contracted price for this product.
                      Always stored in the base unit{baseUnitAbbreviation
                        ? ` (${baseUnitAbbreviation})`
                        : ""}{" "}
                      — case prices are derived from the conversion factor
                      below.
                    </FieldHint>
                  </FieldLabel>
                  <div className="relative max-w-48">
                    <span
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none"
                      aria-hidden
                    >
                      $
                    </span>
                    <Input
                      {...field}
                      id="form-product-default-price"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="pl-7 pr-12"
                      aria-invalid={fieldState.invalid}
                    />
                    {baseUnitAbbreviation ? (
                      <span
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none"
                        aria-hidden
                      >
                        /{baseUnitAbbreviation}
                      </span>
                    ) : null}
                  </div>
                  <FieldDescription>
                    The starting price the order form suggests. Customers may have
                    their own overrides on the price chart.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* Sales units — repeating list. Each row is a UOM the product
                can be SOLD in, with a conversion to the base unit. The user
                marks exactly one as default (preselected on new orders). */}
            <Field>
              <FieldLabel className="inline-flex items-center gap-1">
                Sales units *
                <FieldHint>
                  The unit options staff can pick when adding this product to an
                  order. Most products only need one row matching the base unit.
                  Add a second row (e.g. case) so staff can quote a whole-case
                  price without doing the math.
                </FieldHint>
              </FieldLabel>
              <div className="flex flex-col gap-3">
                {salesUnitFields.map((field, index) => {
                  const row = salesUnits?.[index];
                  const rowUnit = (unitsOfMeasure ?? []).find(
                    u => u.id === row?.unitId,
                  );
                  const rowUnitAbbrev = rowUnit?.abbreviation ?? "unit";
                  const isBase = row?.unitId === baseUnitId;
                  return (
                    <div
                      key={field.id}
                      className="rounded-md border p-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3"
                    >
                      <Controller
                        name={`salesUnits.${index}.unitId`}
                        control={form.control}
                        render={({ field: f, fieldState }) => (
                          <Field
                            data-invalid={fieldState.invalid}
                            className="flex-1 min-w-0"
                          >
                            <FieldLabel>Unit</FieldLabel>
                            <Select value={f.value} onValueChange={f.onChange}>
                              <SelectTrigger aria-invalid={fieldState.invalid}>
                                <SelectValue placeholder="Select a unit…" />
                              </SelectTrigger>
                              <SelectContent>
                                {UOM_FAMILY_ORDER.map(family => {
                                  const inFamily = (unitsOfMeasure ?? []).filter(
                                    u => u.family === family && u.isActive,
                                  );
                                  if (inFamily.length === 0) return null;
                                  return (
                                    <SelectGroup key={family}>
                                      <SelectLabel>
                                        {UOM_FAMILY_LABEL[family]}
                                      </SelectLabel>
                                      {inFamily.map(u => (
                                        <SelectItem key={u.id} value={u.id}>
                                          {u.name}
                                          {u.abbreviation ? ` (${u.abbreviation})` : ""}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </Field>
                        )}
                      />
                      <Controller
                        name={`salesUnits.${index}.conversionToBase`}
                        control={form.control}
                        render={({ field: f, fieldState }) => (
                          <Field
                            data-invalid={fieldState.invalid}
                            className="w-full sm:max-w-44"
                          >
                            <FieldLabel>
                              {isBase
                                ? `Per ${baseUnitAbbreviation || "base"}`
                                : `${baseUnitAbbreviation || "base"} per ${rowUnitAbbrev}`}
                            </FieldLabel>
                            <Input
                              {...f}
                              type="text"
                              inputMode="decimal"
                              placeholder={isBase ? "1" : "e.g. 12"}
                              disabled={isBase}
                              aria-invalid={fieldState.invalid}
                            />
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </Field>
                        )}
                      />
                      <div className="flex items-center gap-3 sm:pb-2">
                        <Controller
                          name={`salesUnits.${index}.isDefault`}
                          control={form.control}
                          render={({ field: f }) => (
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap">
                              <Checkbox
                                checked={f.value}
                                onCheckedChange={v => {
                                  // Mark this row as default + unmark every
                                  // other row so the form always has exactly
                                  // one default.
                                  if (v) {
                                    salesUnits?.forEach((_, j) => {
                                      form.setValue(
                                        `salesUnits.${j}.isDefault`,
                                        j === index,
                                      );
                                    });
                                  } else {
                                    f.onChange(false);
                                  }
                                }}
                              />
                              Default
                              <FieldHint>
                                Preselected when staff add this product to a new
                                order. Pick the unit you most often quote in.
                              </FieldHint>
                            </label>
                          )}
                        />
                        <Controller
                          name={`salesUnits.${index}.allowsFractional`}
                          control={form.control}
                          render={({ field: f }) => (
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap">
                              <Checkbox
                                checked={f.value}
                                onCheckedChange={f.onChange}
                              />
                              Fractional
                              <FieldHint>
                                Allow decimal quantities (e.g. 2.5 lb). Turn this
                                OFF for fixed packs like cases or boxes where a
                                &ldquo;half case&rdquo; doesn&rsquo;t make sense.
                              </FieldHint>
                            </label>
                          )}
                        />
                        {salesUnitFields.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSalesUnit(index)}
                            aria-label="Remove sales unit"
                            className="text-muted-foreground"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {form.formState.errors.salesUnits?.root?.message ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.salesUnits.root.message}
                  </p>
                ) : form.formState.errors.salesUnits?.message ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.salesUnits.message}
                  </p>
                ) : null}
                {(() => {
                  // Disable when there are no UOMs left to pick — appending an
                  // empty row only produces an immediate validation error.
                  const usedIds = new Set(
                    (salesUnits ?? []).map(u => u.unitId),
                  );
                  const nextUom = (unitsOfMeasure ?? []).find(
                    u => u.isActive && !usedIds.has(u.id),
                  );
                  const noUomsAvailable = !nextUom;
                  const noUomsLoaded =
                    !unitsOfMeasure || unitsOfMeasure.length === 0;
                  return (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={noUomsAvailable}
                      title={
                        noUomsLoaded
                          ? "Add a unit of measure first."
                          : noUomsAvailable
                            ? "All units of measure are already used."
                            : undefined
                      }
                      onClick={() => {
                        if (!nextUom) return;
                        appendSalesUnit({
                          unitId: nextUom.id,
                          conversionToBase: "1",
                          isDefault: false,
                          allowsFractional: true,
                        });
                      }}
                      className="self-start"
                    >
                      <Plus className="size-3.5 mr-1" />
                      Add sales unit
                    </Button>
                  );
                })()}
              </div>
              <FieldDescription>
                {baseUnitAbbreviation ? (
                  <>
                    <strong>Conversion</strong> is how many{" "}
                    <code className="px-1 rounded bg-divider text-[11px]">
                      {baseUnitAbbreviation}
                    </code>{" "}
                    are in one of that sales unit. Example: a case of 12 cans
                    converts at <code className="px-1 rounded bg-divider text-[11px]">12</code>;
                    a 40-lb case converts at{" "}
                    <code className="px-1 rounded bg-divider text-[11px]">40</code>.
                    The default row is preselected on new orders.{" "}
                  </>
                ) : (
                  <>
                    The default row is preselected on new orders. Other rows let
                    staff price by case, by bag, etc. with the conversion applied
                    to the base unit.{" "}
                  </>
                )}
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
        {!stickyFooter ? footer : null}
      </Card>
      {stickyFooter ? footer : null}
    </div>
  );
}
