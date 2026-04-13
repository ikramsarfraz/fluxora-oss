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

  if (isLoading) return <div className="loading">Loading product…</div>;
  if (isError || !product)
    return (
      <div className="error">
        {loadError
          ? `Failed to load: ${(loadError as Error).message}`
          : "Product not found."}{" "}
        <Link href="/products">Back to products</Link>
      </div>
    );

  return (
    <>
      <section className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{product.name}</h1>

        <p className="weight-label text-muted-foreground">
          Default price/lb is a reference; set customer-specific prices in each
          customer profile.
        </p>
      </section>

      <section
        className="card form-card mt-4"
        aria-labelledby="product-detail-heading"
      >
        <h2
          id="product-detail-heading"
          style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}
        >
          Edit product
        </h2>
        <dl className="mb-4 grid gap-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">SKU</dt>
            <dd className="font-mono">{product.sku}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Default price / lb</dt>
            <dd className="catch-weight">
              {formatMoney(product.default_price_per_lb)}/lb
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Units of measure</dt>
            <dd style={{ fontSize: "0.8125rem" }}>
              {productUomSummary(product)}
            </dd>
          </div>
        </dl>

        <form onSubmit={handleUpdate}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="edit-product-name">Name</label>
              <input
                id="edit-product-name"
                value={editForm.name}
                onChange={e =>
                  setEditForm(f => ({ ...f, name: e.target.value }))
                }
                placeholder="Name"
                aria-label="Name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="edit-product-species">Category</label>
              <input
                id="edit-product-species"
                value={editForm.species}
                onChange={e =>
                  setEditForm(f => ({ ...f, species: e.target.value }))
                }
                placeholder="e.g. Chicken, Beef"
                aria-label="Category"
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
          <div className="form-row" style={{ marginTop: "0.75rem" }}>
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
          <p
            className="muted"
            style={{ fontSize: "0.8125rem", margin: "0.5rem 0 0" }}
          >
            Manage units under{" "}
            <Link href="/units-of-measure">Units of measure</Link>.
          </p>
          {error && (
            <div
              className="error"
              role="alert"
              style={{ marginTop: "0.75rem" }}
            >
              {error}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              className="btn primary"
              disabled={updateProduct.isPending}
            >
              {updateProduct.isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => router.push("/products")}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6" aria-labelledby="product-detail-danger">
        <h2 id="product-detail-danger" className="sr-only">
          Delete product
        </h2>
        {deleteConfirm ? (
          <span className="delete-confirm flex flex-wrap items-center gap-2">
            <span className="text-sm">Delete this product?</span>
            <button
              type="button"
              className="btn primary"
              disabled={deleteProduct.isPending}
              onClick={() => deleteProduct.mutate(productId)}
            >
              {deleteProduct.isPending ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setDeleteConfirm(false)}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={() => setDeleteConfirm(true)}
          >
            Delete product
          </button>
        )}
      </section>
    </>
  );
}
