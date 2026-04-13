"use client";

import Link from "next/link";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, endpoints, type Product, type UnitOfMeasure } from "@/lib/api";
import { generateSku } from "./product-sku-utils";

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

  return (
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
        <div className="form-row" style={{ marginTop: "0.75rem" }}>
          <UomSelect
            label="Stock UOM (inventory)"
            id="add-stock-uom"
            value={form.stockUnitId}
            onChange={v => setForm(f => ({ ...f, stockUnitId: v }))}
          />
          <UomSelect
            label="Purchase UOM"
            id="add-purchase-uom"
            value={form.purchaseUnitId}
            onChange={v => setForm(f => ({ ...f, purchaseUnitId: v }))}
          />
          <UomSelect
            label="Sales UOM"
            id="add-sales-uom"
            value={form.salesUnitId}
            onChange={v => setForm(f => ({ ...f, salesUnitId: v }))}
          />
        </div>
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
  );
}
