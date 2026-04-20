"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
  addProductFormSchema,
  type AddProductFormValues,
} from "./add-product-form.schema";

const defaultForm: AddProductFormValues = {
  sku: "",
  name: "",
  species: "",
  stockUnitId: "",
  purchaseUnitId: "",
  salesUnitId: "",
};

function formatUomOption(u: UnitOfMeasure): string {
  return u.abbreviation ? `${u.name} (${u.abbreviation})` : u.name;
}

export function AddProductForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);
  /** Keeps Select on "Other…" while the category text is still empty. */
  const [speciesEntryMode, setSpeciesEntryMode] = useState<"list" | "custom">(
    "list",
  );

  const form = useForm<AddProductFormValues>({
    resolver: zodResolver(addProductFormSchema),
    defaultValues: defaultForm,
  });

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

  const createProduct = useMutation({
    mutationFn: (body: {
      sku: string;
      name: string;
      species: string;
      stock_unit_id?: number | null;
      purchase_unit_id?: number | null;
      sales_unit_id?: number | null;
    }) => api.post<Product>(endpoints.products.create(), body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["price-chart"] });
      queryClient.refetchQueries({ queryKey: ["price-chart"] });
      form.reset(defaultForm);
      setSpeciesEntryMode("list");
      setMutationError(null);
      router.push("/products");
    },
    onError: (e: Error) => setMutationError(e.message),
  });

  function onSubmit(data: AddProductFormValues) {
    setMutationError(null);
    let sku = data.sku.trim();
    const name = data.name.trim();
    const species = data.species.trim();
    if (!sku) {
      sku = generateSku(name, species, products);
      form.setValue("sku", sku);
    }
    const payload: {
      sku: string;
      name: string;
      species: string;
      stock_unit_id?: number | null;
      purchase_unit_id?: number | null;
      sales_unit_id?: number | null;
    } = { sku, name, species };
    if (data.stockUnitId)
      payload.stock_unit_id = parseInt(data.stockUnitId, 10);
    if (data.purchaseUnitId)
      payload.purchase_unit_id = parseInt(data.purchaseUnitId, 10);
    if (data.salesUnitId)
      payload.sales_unit_id = parseInt(data.salesUnitId, 10);
    createProduct.mutate(payload);
  }

  const categoryOptions = useMemo(() => {
    return Array.from(
      new Set(
        (products ?? [])
          .map(p => (p.species ?? "").trim())
          .filter(s => s.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [products]);

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
                          const species = form.getValues("species").trim();
                          if (!name || !species) {
                            form.setError("sku", {
                              type: "manual",
                              message:
                                "Enter name and category before generating a SKU.",
                            });
                            return;
                          }
                          form.clearErrors("sku");
                          form.setValue(
                            "sku",
                            generateSku(name, species, products),
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

            <Controller
              name="species"
              control={form.control}
              render={({ field, fieldState }) => {
                const inList = categoryOptions.includes(field.value);
                const selectValue =
                  field.value === "" && speciesEntryMode === "custom"
                    ? "__custom__"
                    : field.value === ""
                      ? "__none__"
                      : inList
                        ? field.value
                        : "__custom__";
                const showCustomCategoryInput =
                  categoryOptions.length > 0 &&
                  (!inList ||
                    (speciesEntryMode === "custom" && field.value === ""));

                return (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="form-add-product-species">
                      Category *
                    </FieldLabel>
                    {categoryOptions.length === 0 ? (
                      <Input
                        {...field}
                        id="form-add-product-species"
                        aria-invalid={fieldState.invalid}
                        placeholder="e.g. Chicken, Beef, Seafood..."
                      />
                    ) : (
                      <>
                        <Select
                          value={selectValue}
                          onValueChange={v => {
                            if (v === "__none__") {
                              setSpeciesEntryMode("list");
                              field.onChange("");
                            } else if (v === "__custom__") {
                              setSpeciesEntryMode("custom");
                              field.onChange("");
                            } else {
                              setSpeciesEntryMode("list");
                              field.onChange(v);
                            }
                          }}
                        >
                          <SelectTrigger
                            id="form-add-product-species"
                            aria-invalid={fieldState.invalid}
                            className="w-full"
                          >
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              Select category…
                            </SelectItem>
                            {categoryOptions.map(cat => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                            <SelectItem value="__custom__">Other…</SelectItem>
                          </SelectContent>
                        </Select>
                        {showCustomCategoryInput ? (
                          <Input
                            id="form-add-product-species-custom"
                            aria-invalid={fieldState.invalid}
                            placeholder="e.g. Chicken, Beef, Seafood..."
                            value={field.value}
                            onChange={e => {
                              const v = e.target.value;
                              field.onChange(v);
                              if (categoryOptions.includes(v))
                                setSpeciesEntryMode("list");
                            }}
                          />
                        ) : null}
                      </>
                    )}
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
        <Button
          type="submit"
          form="form-add-product"
          disabled={createProduct.isPending}
        >
          {createProduct.isPending ? "Adding…" : "Add product"}
        </Button>
      </CardFooter>
    </Card>
  );
}
