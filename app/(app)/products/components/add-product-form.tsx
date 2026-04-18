"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, endpoints, type Product, type UnitOfMeasure } from "@/lib/api";
import { generateSku } from "./product-sku-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const emptyForm = {
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
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

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
      setForm(emptyForm);
      setError(null);
      router.push("/products");
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    let { sku, name, species } = form;
    name = name.trim();
    species = species.trim();
    if (!name || !species) {
      setError("Please enter name and category.");
      return;
    }
    if (!sku.trim()) {
      sku = generateSku(name, species, products);
      setForm(f => ({ ...f, sku }));
    }
    const payload: {
      sku: string;
      name: string;
      species: string;
      stock_unit_id?: number | null;
      purchase_unit_id?: number | null;
      sales_unit_id?: number | null;
    } = { sku: sku.trim(), name, species };
    if (form.stockUnitId)
      payload.stock_unit_id = parseInt(form.stockUnitId, 10);
    if (form.purchaseUnitId)
      payload.purchase_unit_id = parseInt(form.purchaseUnitId, 10);
    if (form.salesUnitId)
      payload.sales_unit_id = parseInt(form.salesUnitId, 10);
    createProduct.mutate(payload);
  };

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
        <form id="form-add-product" onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="product-sku" className="text-sm font-medium">SKU</label>
              <div className="flex flex-col gap-2">
                <Input
                  id="product-sku"
                  value={form.sku}
                  onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  placeholder="e.g. BEEF-RIB-01"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!form.name.trim() || !form.species.trim()) {
                      setError("Enter name and category before generating a SKU.");
                      return;
                    }
                    const sku = generateSku(form.name, form.species, products);
                    setForm(f => ({ ...f, sku }));
                    setError(null);
                  }}
                >
                  Auto-generate SKU
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="product-name" className="text-sm font-medium">Name *</label>
              <Input
                id="product-name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Beef Ribeye"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="product-species" className="text-sm font-medium">Category *</label>
            <Input
              id="product-species"
              value={form.species}
              onChange={e => setForm(f => ({ ...f, species: e.target.value }))}
              placeholder="e.g. Chicken, Beef, Seafood..."
              required
              list="product-category-suggestions"
            />
            <datalist id="product-category-suggestions">
              {categoryOptions.map(cat => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="add-stock-uom" className="text-sm font-medium">Stock UOM</label>
              <Select value={form.stockUnitId} onValueChange={v => setForm(f => ({ ...f, stockUnitId: v }))}>
                <SelectTrigger id="add-stock-uom">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {activeUoms.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {formatUomOption(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="add-purchase-uom" className="text-sm font-medium">Purchase UOM</label>
              <Select value={form.purchaseUnitId} onValueChange={v => setForm(f => ({ ...f, purchaseUnitId: v }))}>
                <SelectTrigger id="add-purchase-uom">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {activeUoms.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {formatUomOption(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="add-sales-uom" className="text-sm font-medium">Sales UOM</label>
              <Select value={form.salesUnitId} onValueChange={v => setForm(f => ({ ...f, salesUnitId: v }))}>
                <SelectTrigger id="add-sales-uom">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {activeUoms.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {formatUomOption(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Manage the unit list under{" "}
            <Link href="/units-of-measure" className="text-primary underline underline-offset-4 hover:text-primary/80">
              Units of measure
            </Link>. Optional — helps match QuickBooks-style item setup.
          </p>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
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
          {createProduct.isPending ? "Adding..." : "Add Product"}
        </Button>
      </CardFooter>
    </Card>
  );
}
