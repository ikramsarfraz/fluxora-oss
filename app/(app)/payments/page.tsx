"use client";

import Link from "next/link";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, endpoints, type Product, type UnitOfMeasure } from "@/lib/api";
import { formatMoney } from "@/lib/utils/currency";

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

function productUomSummary(p: Product): string {
  const parts: string[] = [];
  if (p.stock_unit_label) parts.push(`Stk: ${p.stock_unit_label}`);
  if (p.purchase_unit_label) parts.push(`Buy: ${p.purchase_unit_label}`);
  if (p.sales_unit_label) parts.push(`Sell: ${p.sales_unit_label}`);
  return parts.length ? parts.join(" · ") : "—";
}

/** Normalize category/species text for display (first letter uppercased). */
function normalizeCategoryDisplay(species: string): string {
  const trimmed = (species ?? "").trim();
  if (!trimmed) return "Uncategorized";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function normalizeSpeciesForSku(species: string): string {
  const s = (species ?? "").toLowerCase();
  if (s.startsWith("chicken")) return "CHK";
  if (s.startsWith("beef")) return "BEF";
  if (s.startsWith("pork")) return "PRK";
  if (s.startsWith("lamb")) return "LAM";
  if (s.startsWith("seafood") || s.startsWith("fish")) return "SEA";
  return "OTH";
}

function slugFromName(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "ITEM";
  const parts = trimmed
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "ITEM";
  const word = parts[0];
  // Take up to first 4 characters of first word, e.g. "RIBEYE" -> "RIBE"
  return word.slice(0, 4);
}

/** Generate a compact SKU like CHK-RIBE-01 based on category + name + existing products. */
function generateSku(
  name: string,
  species: string,
  products: Product[] | undefined,
): string {
  const prefix = normalizeSpeciesForSku(species);
  const nameSlug = slugFromName(name);
  const base = `${prefix}-${nameSlug}`;
  const existing = (products ?? [])
    .map(p => p.sku)
    .filter(
      sku =>
        typeof sku === "string" &&
        sku.toUpperCase().startsWith(base.toUpperCase()),
    );

  let maxSuffix = 0;
  for (const sku of existing) {
    const m = sku.match(/-(\d{2,})$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > maxSuffix) maxSuffix = n;
    }
  }
  const next = (maxSuffix + 1).toString().padStart(2, "0");
  return `${base}-${next}`;
}

export default function Products() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const {
    data: products,
    isLoading,
    error: loadError,
  } = useQuery({
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
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateProduct = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: Record<string, string | number | null | undefined>;
    }) => api.patch<Product>(endpoints.products.update(id), body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["price-chart"] });
      queryClient.refetchQueries({ queryKey: ["price-chart"] });
      setEditingId(null);
      setEditForm(emptyForm);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteProduct = useMutation({
    mutationFn: (id: number) => api.delete(endpoints.products.delete(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["price-chart"] });
      queryClient.refetchQueries({ queryKey: ["price-chart"] });
      setDeleteConfirm(null);
      setError(null);
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

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditForm({
      sku: p.sku,
      name: p.name,
      species: p.species,
      stockUnitId: p.stock_unit_id != null ? String(p.stock_unit_id) : "",
      purchaseUnitId:
        p.purchase_unit_id != null ? String(p.purchase_unit_id) : "",
      salesUnitId: p.sales_unit_id != null ? String(p.sales_unit_id) : "",
    });
    setError(null);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId == null) return;
    setError(null);
    const body: Record<string, string | number | null> = {};
    const original = (products ?? []).find(p => p.id === editingId);
    const nextName = editForm.name.trim();
    const nextSpecies = editForm.species.trim();

    if (nextName) body.name = nextName;
    if (nextSpecies) body.species = nextSpecies;

    // Auto-regenerate SKU when name or category changes
    if (
      original &&
      (nextName !== original.name || nextSpecies !== original.species)
    ) {
      body.sku = generateSku(
        nextName || original.name,
        nextSpecies || original.species,
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
    if (original) {
      if (su !== original.stock_unit_id) body.stock_unit_id = su;
      if (pu !== original.purchase_unit_id) body.purchase_unit_id = pu;
      if (sa !== original.sales_unit_id) body.sales_unit_id = sa;
    }

    if (Object.keys(body).length === 0) {
      setError("Change at least one field to update.");
      return;
    }
    updateProduct.mutate({ id: editingId, body });
  };

  const UomSelect = ({
    label,
    value,
    onChange,
    id,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    id: string;
  }) => (
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

  const productsByCategory = useMemo(() => {
    const list = products ?? [];
    const byCat = new Map<string, Product[]>();
    for (const p of list) {
      const key = (p.species ?? "").trim() || "Uncategorized";
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(p);
    }
    return Array.from(byCat.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  const renderProductRow = (p: Product) => (
    <tr key={p.id}>
      {editingId === p.id ? (
        <>
          <td>{p.sku}</td>
          <td colSpan={5}>
            <form
              onSubmit={handleUpdate}
              className="inline-edit-form"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  alignItems: "flex-end",
                }}
              >
                <input
                  value={editForm.name}
                  onChange={e =>
                    setEditForm(f => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Name"
                  aria-label="Name"
                />
                <input
                  value={editForm.species}
                  onChange={e =>
                    setEditForm(f => ({ ...f, species: e.target.value }))
                  }
                  placeholder="Species"
                  aria-label="Species"
                />
                <UomSelect
                  label="Stock UOM"
                  id={`edit-stock-uom-${p.id}`}
                  value={editForm.stockUnitId}
                  onChange={v => setEditForm(f => ({ ...f, stockUnitId: v }))}
                />
                <UomSelect
                  label="Purchase UOM"
                  id={`edit-purchase-uom-${p.id}`}
                  value={editForm.purchaseUnitId}
                  onChange={v =>
                    setEditForm(f => ({ ...f, purchaseUnitId: v }))
                  }
                />
                <UomSelect
                  label="Sales UOM"
                  id={`edit-sales-uom-${p.id}`}
                  value={editForm.salesUnitId}
                  onChange={v => setEditForm(f => ({ ...f, salesUnitId: v }))}
                />
              </div>
              <div>
                <button type="submit" className="btn primary">
                  Save
                </button>{" "}
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setEditingId(null);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </td>
        </>
      ) : (
        <>
          <td>{p.sku}</td>
          <td>{p.name}</td>
          <td className="catch-weight">
            {formatMoney(p.default_price_per_lb)}/lb
          </td>
          <td>{p.species}</td>
          <td style={{ fontSize: "0.8125rem", maxWidth: "14rem" }}>
            {productUomSummary(p)}
          </td>
          <td>
            <button type="button" className="btn" onClick={() => startEdit(p)}>
              Edit
            </button>
            {deleteConfirm === p.id ? (
              <span className="delete-confirm">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => deleteProduct.mutate(p.id)}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setDeleteConfirm(null)}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn"
                onClick={() => setDeleteConfirm(p.id)}
              >
                Delete
              </button>
            )}
          </td>
        </>
      )}
    </tr>
  );

  if (isLoading) return <div className="loading">Loading products…</div>;
  if (loadError)
    return (
      <div className="error">
        Failed to load: {(loadError as Error).message}
      </div>
    );

  return (
    <>
      <h1>Products</h1>
      <p className="weight-label">
        Add and manage SKUs. Set prices per customer in each customer profile.
      </p>

      {/* Add product form */}
      <section className="card form-card" aria-labelledby="add-product-heading">
        <h2
          id="add-product-heading"
          style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}
        >
          Add product
        </h2>
        <form onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="product-sku">SKU *</label>
              <input
                id="product-sku"
                value={form.sku}
                onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                placeholder="e.g. BEEF-RIB-01"
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: "0.35rem" }}
                onClick={() => {
                  if (!form.name.trim() || !form.species.trim()) {
                    setError(
                      "Enter name and category before generating a SKU.",
                    );
                    return;
                  }
                  const sku = generateSku(form.name, form.species, products);
                  setForm(f => ({ ...f, sku }));
                  setError(null);
                }}
              >
                Auto-generate SKU
              </button>
            </div>
            <div className="form-group">
              <label htmlFor="product-name">Name *</label>
              <input
                id="product-name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Beef Ribeye"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="product-species">Category *</label>
              <input
                id="product-species"
                value={form.species}
                onChange={e =>
                  setForm(f => ({ ...f, species: e.target.value }))
                }
                placeholder="e.g. Chicken, Beef, Seafood…"
                required
                list="product-category-suggestions"
              />
            </div>
          </div>
          {/* Category suggestions from existing products */}
          <datalist id="product-category-suggestions">
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
          {/* <div className="form-row" style={{ marginTop: "0.75rem" }}>
            <UomSelect
              label="Stock UOM (inventory)"
              id="add-stock-uom"
              value={form.stockUnitId}
              onChange={(v) => setForm((f) => ({ ...f, stockUnitId: v }))}
            />
            <UomSelect
              label="Purchase UOM"
              id="add-purchase-uom"
              value={form.purchaseUnitId}
              onChange={(v) => setForm((f) => ({ ...f, purchaseUnitId: v }))}
            />
            <UomSelect
              label="Sales UOM"
              id="add-sales-uom"
              value={form.salesUnitId}
              onChange={(v) => setForm((f) => ({ ...f, salesUnitId: v }))}
            />
          </div> */}
          <p
            className="muted"
            style={{ fontSize: "0.8125rem", margin: "0.5rem 0 0" }}
          >
            Manage the unit list under{" "}
            <Link href="/units-of-measure">Units of measure</Link>. Optional —
            helps match QuickBooks-style item setup.
          </p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="btn primary"
            disabled={createProduct.isPending}
          >
            {createProduct.isPending ? "Adding…" : "Add product"}
          </button>
        </form>
      </section>

      {/* Product list by dynamic category */}
      {productsByCategory.map(([rawCategory, categoryProducts]) => {
        const title = normalizeCategoryDisplay(rawCategory);
        const sectionId = `products-${rawCategory || "uncategorized"}`;
        return (
          <section
            key={sectionId}
            className="table-section products-category-section"
            aria-labelledby={sectionId}
            style={{ marginBottom: "1.5rem" }}
          >
            <h2
              id={sectionId}
              style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}
            >
              {title}{" "}
              <span className="products-category-count">
                ({categoryProducts.length})
              </span>
            </h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Price/lb</th>
                    <th>Species</th>
                    <th>U of M</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>{categoryProducts.map(renderProductRow)}</tbody>
              </table>
            </div>
            {categoryProducts.length === 0 && (
              <p className="empty-state muted">No products in this category.</p>
            )}
          </section>
        );
      })}
      {(products ?? []).length === 0 && (
        <p className="empty-state">No products yet. Add one above.</p>
      )}
    </>
  );
}
