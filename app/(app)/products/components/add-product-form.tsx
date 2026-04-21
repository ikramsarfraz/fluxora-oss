"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";

import { api, endpoints, type Product, type UnitOfMeasure } from "@/lib/api";
import { generateSku } from "./product-sku-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
} from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
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
  type AddProductFormValues,
} from "./add-product-form.schema";
import { useProductCategories } from "@/hooks/use-product-categories";
import type { ProductCategory } from "@/services/products";
import {
  createCategoryAction,
  createProductAction,
} from "@/app/(app)/products/product.actions";
import { queryKeys } from "@/lib/query/keys";

const defaultForm: AddProductFormValues = {
  sku: "",
  name: "",
  categoryIds: [],
  stockUnitId: "",
  purchaseUnitId: "",
  salesUnitId: "",
};

function formatUomOption(u: UnitOfMeasure): string {
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
      const category = await createCategoryAction(trimmed);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.categories.all,
      });
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

  const { data: productCategories } = useProductCategories();

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>(endpoints.products.list()),
  });

  const { data: unitsOfMeasure = [] } = useQuery({
    queryKey: ["unitsOfMeasure"],
    queryFn: () => api.get<UnitOfMeasure[]>(endpoints.unitsOfMeasure.list()),
  });

  const activeUoms = useMemo(
    () =>
      unitsOfMeasure
        .filter(u => u.is_active)
        .sort(
          (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
        ),
    [unitsOfMeasure],
  );

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
        stockUnitId: data.stockUnitId || null,
        purchaseUnitId: data.purchaseUnitId || null,
        salesUnitId: data.salesUnitId || null,
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["price-chart"] });
      form.reset(defaultForm);
      setMutationError(null);
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

            {/* Categories — multi-select combobox */}
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

            <div className="grid gap-4 sm:grid-cols-3">
              <Controller
                name="stockUnitId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="form-add-product-stock-uom">
                      Stock UOM
                    </FieldLabel>
                    <Select
                      value={field.value || "__none__"}
                      onValueChange={v =>
                        field.onChange(v === "__none__" ? "" : v)
                      }
                    >
                      <SelectTrigger
                        id="form-add-product-stock-uom"
                        aria-invalid={fieldState.invalid}
                        className="w-full"
                      >
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {activeUoms.map(u => (
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
              <Controller
                name="purchaseUnitId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="form-add-product-purchase-uom">
                      Purchase UOM
                    </FieldLabel>
                    <Select
                      value={field.value || "__none__"}
                      onValueChange={v =>
                        field.onChange(v === "__none__" ? "" : v)
                      }
                    >
                      <SelectTrigger
                        id="form-add-product-purchase-uom"
                        aria-invalid={fieldState.invalid}
                        className="w-full"
                      >
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {activeUoms.map(u => (
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
              <Controller
                name="salesUnitId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="form-add-product-sales-uom">
                      Sales UOM
                    </FieldLabel>
                    <Select
                      value={field.value || "__none__"}
                      onValueChange={v =>
                        field.onChange(v === "__none__" ? "" : v)
                      }
                    >
                      <SelectTrigger
                        id="form-add-product-sales-uom"
                        aria-invalid={fieldState.invalid}
                        className="w-full"
                      >
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {activeUoms.map(u => (
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
            </div>

            <FieldDescription>
              Manage the unit list under{" "}
              <Link
                href="/units-of-measure"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Units of measure
              </Link>
              . Optional — helps match QuickBooks-style item setup.
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
