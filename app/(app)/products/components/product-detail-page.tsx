"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, endpoints, type Product, type UnitOfMeasure } from "@/lib/api";
import { useProduct } from "@/hooks/use-product";
import { useProducts } from "@/hooks/use-products";
import { queryKeys } from "@/lib/query/keys";
import { formatMoney } from "@/lib/utils/currency";
import { DetailPageHeader } from "@/components/detail-page-header";
import { DetailSection, DetailField, DetailGrid } from "@/components/detail-section";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { generateSku } from "./product-sku-utils";

const emptyForm = {
  name: "",
  species: "",
  stockUnitId: "",
  purchaseUnitId: "",
  salesUnitId: "",
};

function formatUomOption(u: UnitOfMeasure): string {
  return u.abbreviation ? `${u.name} (${u.abbreviation})` : u.name;
}

function productUomSummary(p: Product): string {
  const parts: string[] = [];
  if (p.stock_unit_label) parts.push(`Stk: ${p.stock_unit_label}`);
  if (p.purchase_unit_label) parts.push(`Buy: ${p.purchase_unit_label}`);
  if (p.sales_unit_label) parts.push(`Sell: ${p.sales_unit_label}`);
  return parts.length ? parts.join(" · ") : "—";
}

export function ProductDetailPage({ productId }: { productId: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editForm, setEditForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const {
    data: product,
    isLoading,
    error: loadError,
    isError,
  } = useProduct(productId);

  const { data: products } = useProducts();

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

  useLayoutEffect(() => {
    if (!product) return;
    setEditForm({
      name: product.name,
      species: product.species,
      stockUnitId:
        product.stock_unit_id != null ? String(product.stock_unit_id) : "",
      purchaseUnitId:
        product.purchase_unit_id != null
          ? String(product.purchase_unit_id)
          : "",
      salesUnitId:
        product.sales_unit_id != null ? String(product.sales_unit_id) : "",
    });
    setError(null);
  }, [product]);

  const updateProduct = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: Record<string, string | number | null | undefined>;
    }) => api.patch<Product>(endpoints.products.update(id), body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.detail(productId),
      });
      queryClient.invalidateQueries({ queryKey: ["price-chart"] });
      queryClient.refetchQueries({ queryKey: ["price-chart"] });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteProduct = useMutation({
    mutationFn: (id: number) => api.delete(endpoints.products.delete(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: ["price-chart"] });
      queryClient.refetchQueries({ queryKey: ["price-chart"] });
      setDeleteConfirm(false);
      setError(null);
      router.push("/products");
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setError(null);
    const body: Record<string, string | number | null> = {};
    const nextName = editForm.name.trim();
    const nextSpecies = editForm.species.trim();

    if (nextName) body.name = nextName;
    if (nextSpecies) body.species = nextSpecies;

    if (nextName !== product.name || nextSpecies !== product.species) {
      body.sku = generateSku(
        nextName || product.name,
        nextSpecies || product.species,
        products,
      );
    }

    const su =
      editForm.stockUnitId === "" ? null : parseInt(editForm.stockUnitId, 10);
    const pu =
      editForm.purchaseUnitId === ""
        ? null
        : parseInt(editForm.purchaseUnitId, 10);
    const sa =
      editForm.salesUnitId === "" ? null : parseInt(editForm.salesUnitId, 10);
    if (su !== product.stock_unit_id) body.stock_unit_id = su;
    if (pu !== product.purchase_unit_id) body.purchase_unit_id = pu;
    if (sa !== product.sales_unit_id) body.sales_unit_id = sa;

    if (Object.keys(body).length === 0) {
      setError("Change at least one field to update.");
      return;
    }
    updateProduct.mutate({ id: productId, body });
  };

  function UomSelect({
    label,
    value,
    onChange,
    id,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    id: string;
  }) {
    return (
      <label htmlFor={id} style={{ margin: 0 }}>
        {label}
        <select id={id} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">— None —</option>
          {activeUoms.map(u => (
            <option key={u.id} value={String(u.id)}>
              {formatUomOption(u)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (isLoading) return <PageLoading message="Loading product..." />;
  if (isError || !product)
    return (
      <PageError
        message={loadError ? (loadError as Error).message : "Product not found."}
      />
    );

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        backHref="/products"
        backLabel="Products"
        title={product.name}
        description="Default price/lb is a reference; set customer-specific prices in each customer profile."
        badge={<Badge variant="secondary" className="font-mono">{product.sku}</Badge>}
      />

      {/* Product Overview */}
      <DetailSection
        title="Product Details"
        description="Current product information and settings."
      >
        <DetailGrid>
          <DetailField label="SKU">
            <span className="font-mono text-sm">{product.sku}</span>
          </DetailField>
          <DetailField label="Default Price / lb">
            {formatMoney(product.default_price_per_lb)}/lb
          </DetailField>
          <DetailField label="Category">{product.species || "—"}</DetailField>
          <DetailField label="Units of Measure">
            <span className="text-sm">{productUomSummary(product)}</span>
          </DetailField>
        </DetailGrid>
      </DetailSection>

      {/* Edit Product */}
      <DetailSection
        title="Edit Product"
        description="Update product name, category, and units of measure."
      >

        <form onSubmit={handleUpdate} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-product-name" className="text-sm font-medium">Name</label>
              <Input
                id="edit-product-name"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Name"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-product-species" className="text-sm font-medium">Category</label>
              <Input
                id="edit-product-species"
                value={editForm.species}
                onChange={e => setEditForm(f => ({ ...f, species: e.target.value }))}
                placeholder="e.g. Chicken, Beef"
                list="product-category-suggestions-detail"
              />
            </div>
          </div>
          <datalist id="product-category-suggestions-detail">
            {Array.from(
              new Set(
                (products ?? [])
                  .map(p => (p.species ?? "").trim())
                  .filter(s => s.length > 0),
              ),
            )
              .sort((a, b) => a.localeCompare(b))
              .map(cat => (
                <option key={cat} value={cat} />
              ))}
          </datalist>
          <div className="grid gap-4 sm:grid-cols-3">
            <UomSelect
              label="Stock UOM (inventory)"
              id="edit-stock-uom"
              value={editForm.stockUnitId}
              onChange={v => setEditForm(f => ({ ...f, stockUnitId: v }))}
            />
            <UomSelect
              label="Purchase UOM"
              id="edit-purchase-uom"
              value={editForm.purchaseUnitId}
              onChange={v => setEditForm(f => ({ ...f, purchaseUnitId: v }))}
            />
            <UomSelect
              label="Sales UOM"
              id="edit-sales-uom"
              value={editForm.salesUnitId}
              onChange={v => setEditForm(f => ({ ...f, salesUnitId: v }))}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Manage units under{" "}
            <Link href="/units-of-measure" className="text-primary underline underline-offset-4 hover:text-primary/80">
              Units of measure
            </Link>.
          </p>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={updateProduct.isPending}>
              {updateProduct.isPending ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/products")}>
              Cancel
            </Button>
          </div>
        </form>
      </DetailSection>

      {/* Danger Zone */}
      <DetailSection
        title="Danger Zone"
        description="Irreversible actions for this product."
        className="border-destructive/50"
      >
        {deleteConfirm ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">Delete this product?</span>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteProduct.isPending}
              onClick={() => deleteProduct.mutate(productId)}
            >
              {deleteProduct.isPending ? "Deleting..." : "Confirm Delete"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDeleteConfirm(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setDeleteConfirm(true)}>
            Delete Product
          </Button>
        )}
      </DetailSection>
    </div>
  );
}
