"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  endpoints,
  type InventoryItem,
  type Lot,
  type PriceChartData,
  type Product,
  type SalesOrder,
} from "@/lib/api";
import { formatMoney } from "@/lib/utils/currency";
import { inventoryStatusLabel } from "@/lib/utils/status-labels";

export default function Inventory() {
  const queryClient = useQueryClient();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [editRowId, setEditRowId] = useState<number | null>(null);
  const [editCases, setEditCases] = useState<string>("");
  const [editWeight, setEditWeight] = useState<string>("");
  const [newSpecies, setNewSpecies] = useState<string>("");
  const [newProductId, setNewProductId] = useState<string>("");
  const [newLotId, setNewLotId] = useState<string>("");
  const [newUnitType, setNewUnitType] = useState<"catch_weight" | "packet" | "case">("catch_weight");
  const [newCases, setNewCases] = useState<string>("1");
  const [newPerUnitWeight, setNewPerUnitWeight] = useState<string>("");
  /** For catch weight only: one weight (lbs) per case. Length = number of cases. */
  const [newCaseWeights, setNewCaseWeights] = useState<string[]>([""]);
  const [speciesFilter, setSpeciesFilter] = useState<string>("");
  const [inventorySearch, setInventorySearch] = useState("");
  const { data: allItems, isLoading, error } = useQuery({
    queryKey: ["inventory", "all"],
    queryFn: () => api.get<InventoryItem[]>(endpoints.inventory.list(), { all: "1" }),
  });
  /** Use same list for table so we show in_stock + picked + shipped (e.g. "5 lbs from BOX-123" visible). */
  const items = allItems ?? [];

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>(endpoints.products.list()),
  });

  const { data: lots } = useQuery({
    queryKey: ["lots"],
    queryFn: () => api.get<Lot[]>(endpoints.lots.list()),
  });

  const { data: salesOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["salesOrders"],
    queryFn: () => api.get<SalesOrder[]>(endpoints.salesOrders.list()),
  });

  const { data: priceChartData } = useQuery({
    queryKey: ["price-chart"],
    queryFn: () => api.get<PriceChartData>(endpoints.priceChart.get()),
  });

  const speciesOptions = useMemo(
    () => Array.from(new Set((products ?? []).map((p) => p.species))).sort(),
    [products],
  );

  const productMap = useMemo(() => {
    const m: Record<number, Product> = {};
    (products ?? []).forEach((p) => {
      m[p.id] = p;
    });
    return m;
  }, [products]);

  /** Default lot for a product: first lot (FEFO order) from a supplier that has this product in price chart; else first lot overall. */
  const getDefaultLotIdForProduct = useMemo(() => {
    return (productId: number): string => {
      if (!lots?.length) return "";
      const chartProduct = priceChartData?.products?.find((p) => p.id === productId);
      const supplierIds = new Set<number>();
      if (chartProduct) {
        chartProduct.costs_by_supplier?.forEach((c) => supplierIds.add(c.supplier_id));
        chartProduct.costs_from_invoices?.forEach((c) => supplierIds.add(c.supplier_id));
      }
      const candidateLots = supplierIds.size > 0
        ? lots.filter((l) => supplierIds.has(l.supplier_id))
        : lots;
      const first = candidateLots[0];
      return first ? String(first.id) : "";
    };
  }, [lots, priceChartData?.products]);

  const vendorCostForAdd = useMemo(() => {
    if (!newProductId || !newLotId || !lots?.length) return null;
    const productId = parseInt(newProductId, 10);
    const lotId = parseInt(newLotId, 10);
    const lot = lots.find((l) => l.id === lotId);
    if (!lot) return null;
    const supplierId = lot.supplier_id;
    const supplierName = lot.supplier_name || `Vendor #${supplierId}`;
    if (!priceChartData?.products) return { cost_per_lb: null, supplier_name: supplierName, source: null as string | null };
    const chartProduct = priceChartData.products.find((p) => p.id === productId);
    if (!chartProduct) return { cost_per_lb: null, supplier_name: supplierName, source: null as string | null };
    const fromStored = chartProduct.costs_by_supplier?.find((c) => c.supplier_id === supplierId);
    if (fromStored) return { cost_per_lb: fromStored.cost_per_lb, supplier_name: fromStored.supplier_name || supplierName, source: "price chart" };
    const fromInvoice = chartProduct.costs_from_invoices?.find((c) => c.supplier_id === supplierId);
    if (fromInvoice) return { cost_per_lb: fromInvoice.cost_per_lb, supplier_name: fromInvoice.supplier_name || supplierName, source: "last invoice" };
    return { cost_per_lb: null, supplier_name: supplierName, source: null as string | null };
  }, [newProductId, newLotId, priceChartData, lots]);

  const itemsByCategory = useMemo(() => {
    const list = (items ?? []).filter((i) => {
      const w = parseFloat(String(i.exact_weight_lbs));
      const isZeroWeight = !Number.isFinite(w) || w === 0;
      const isPartialCases = (i.cases ?? 0) === 0;
      // Hide confusing ghost rows: no weight and no cases (purely allocated markers).
      return !(isZeroWeight && isPartialCases);
    });
    const byCat = new Map<string, InventoryItem[]>();
    for (const i of list) {
      const rawSpecies = productMap[i.product_id]?.species ?? "";
      const key = rawSpecies.trim() || "Uncategorized";
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(i);
    }
    return Array.from(byCat.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items, productMap]);

  /** Groups items by (product_id, lot_id), but partial boxes (cases === 0) get their own row by barcode. */
  type InventoryGroup = { key: string; product_id: number; lot_id: number; items: InventoryItem[] };
  const groupsByCategory = useMemo(() => {
    const group = (arr: InventoryItem[]): InventoryGroup[] => {
      const byKey = new Map<string, InventoryItem[]>();
      for (const i of arr) {
        const key =
          i.cases === 0
            ? `${i.product_id}-${i.lot_id}-${i.barcode_id}` // dedicated row for partial box
            : `${i.product_id}-${i.lot_id}`;                // grouped row for full boxes
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key)!.push(i);
      }
      return Array.from(byKey.entries()).map(([key, items]) => ({
        key,
        product_id: items[0].product_id,
        lot_id: items[0].lot_id,
        items,
      }));
    };
    return itemsByCategory.map(([category, arr]) => ({
      category,
      groups: group(arr),
    }));
  }, [itemsByCategory]);

  const filteredGroupsByCategory = useMemo(() => {
    const searchLower = inventorySearch.trim().toLowerCase();
    return groupsByCategory
      .filter(({ category }) => !speciesFilter || category === speciesFilter)
      .map(({ category, groups }) => ({
        category,
        groups: searchLower
          ? groups.filter((grp) => {
              const p = productMap[grp.product_id];
              if (!p) return false;
              const sku = (p.sku ?? "").toLowerCase();
              const name = (p.name ?? "").toLowerCase();
              return sku.includes(searchLower) || name.includes(searchLower);
            })
          : groups,
      }))
      .filter(({ groups }) => groups.length > 0);
  }, [groupsByCategory, productMap, speciesFilter, inventorySearch]);

  const defaultWeightForProduct = (productId: string): string => {
    if (!productId) return "";
    const p = productMap[parseInt(productId, 10)];
    if (!p) return "";
    return p.species === "Chicken" ? "40" : "";
  };

  const casesNumForForm = Math.max(1, parseInt(newCases, 10) || 0);

  const syncCaseWeightsToCount = (count: number, fillWith?: string) => {
    setNewCaseWeights((prev) => {
      const next = prev.slice(0, count);
      while (next.length < count) {
        next.push(fillWith ?? defaultWeightForProduct(newProductId) ?? prev[prev.length - 1] ?? "");
      }
      return next;
    });
  };

  const deleteItem = useMutation({
    mutationFn: (itemId: number) => api.delete(endpoints.inventory.delete(itemId)),
    onSuccess: () => {
      setDeleteError(null);
      queryClient.refetchQueries({ queryKey: ["inventory"] });
    },
    onError: (err: Error) => {
      setDeleteError(err.message);
    },
  });

  const deleteSelected = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map((id) => api.delete(endpoints.inventory.delete(id))));
    },
    onSuccess: () => {
      setDeleteError(null);
      setSelected({});
      queryClient.refetchQueries({ queryKey: ["inventory"] });
    },
    onError: (err: Error) => {
      setDeleteError(err.message);
    },
  });

  const deleteAll = useMutation({
    mutationFn: () => api.delete(endpoints.inventory.deleteAll()),
    onSuccess: () => {
      setDeleteError(null);
      queryClient.refetchQueries({ queryKey: ["inventory"] });
    },
    onError: (err: Error) => {
      setDeleteError(err.message);
    },
  });

  const createItem = useMutation({
    mutationFn: (body: { product_id: number; lot_id: number; cases: number; exact_weight_lbs: string }) =>
      api.post<InventoryItem>(endpoints.inventory.create(), body),
    onSuccess: () => {
      setCreateError(null);
      queryClient.refetchQueries({ queryKey: ["inventory"] });
    },
    onError: (err: Error) => {
      setCreateError(err.message);
    },
  });

  const updateItem = useMutation({
    mutationFn: (input: { id: number; cases?: number; exact_weight_lbs?: string }) =>
      api.patch<InventoryItem>(endpoints.inventory.update(input.id), {
        ...(input.cases != null ? { cases: input.cases } : {}),
        ...(input.exact_weight_lbs != null ? { exact_weight_lbs: input.exact_weight_lbs } : {}),
      }),
    onSuccess: () => {
      setUpdateError(null);
      setEditRowId(null);
      queryClient.refetchQueries({ queryKey: ["inventory"] });
    },
    onError: (err: Error) => {
      setUpdateError(err.message);
    },
  });

  const handleDeleteOne = (item: InventoryItem) => {
    if (!window.confirm(`Remove this item from inventory? (Product ID: ${item.product_id}, Lot ID: ${item.lot_id})`)) return;
    deleteItem.mutate(item.id);
  };

  const handleDeleteAll = () => {
    if (!window.confirm("Delete ALL inventory items? This cannot be undone.")) return;
    deleteAll.mutate();
  };

  const handleDeleteSelected = () => {
    const ids = Object.keys(selected)
      .filter((id) => selected[Number(id)])
      .map(Number);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected inventory item${ids.length > 1 ? "s" : ""}?`)) return;
    deleteSelected.mutate(ids);
  };

  const startEdit = (item: InventoryItem) => {
    setEditRowId(item.id);
    setEditCases(String(item.cases ?? ""));
    setEditWeight(item.exact_weight_lbs ?? "");
  };

  const cancelEdit = () => {
    setEditRowId(null);
    setEditCases("");
    setEditWeight("");
    setUpdateError(null);
  };

  const handleSave = (item: InventoryItem) => {
    const body: { id: number; cases?: number; exact_weight_lbs?: string } = { id: item.id };
    const casesNum = parseInt(editCases, 10);
    if (!Number.isNaN(casesNum) && casesNum > 0 && casesNum !== item.cases) {
      body.cases = casesNum;
    }
    const weightTrim = editWeight.trim();
    if (weightTrim && weightTrim !== item.exact_weight_lbs) {
      body.exact_weight_lbs = weightTrim;
    }
    if (body.cases == null && body.exact_weight_lbs == null) {
      setEditRowId(null);
      return;
    }
    updateItem.mutate(body);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const pid = parseInt(newProductId, 10);
    const lid = parseInt(newLotId, 10);
    const cases = Math.max(1, parseInt(newCases, 10) || 0);
    if (!pid || Number.isNaN(pid)) {
      setCreateError("Choose a product.");
      return;
    }
    if (!lid || Number.isNaN(lid)) {
      setCreateError("Choose a lot.");
      return;
    }
    if (!cases || Number.isNaN(cases) || cases <= 0) {
      setCreateError("Enter how many cases or packets you are adding.");
      return;
    }
    let exactWeightStr: string;
    if (newUnitType === "catch_weight") {
      const weights = newCaseWeights.slice(0, cases);
      let sum = 0;
      for (let i = 0; i < weights.length; i++) {
        const w = parseFloat(weights[i]);
        if (Number.isNaN(w) || w <= 0) {
          setCreateError(`Enter weight (lbs) for case ${i + 1}.`);
          return;
        }
        sum += w;
      }
      exactWeightStr = sum.toFixed(2);
    } else {
      const per = parseFloat(newPerUnitWeight);
      if (!per || per <= 0 || Number.isNaN(per)) {
        setCreateError("Enter weight (lbs) for one case/packet.");
        return;
      }
      exactWeightStr = (cases * per).toFixed(2);
    }
    try {
      await createItem.mutateAsync({
        product_id: pid,
        lot_id: lid,
        cases,
        exact_weight_lbs: exactWeightStr,
      });
      setNewProductId("");
      setNewLotId("");
      setNewCases("1");
      setNewUnitType("catch_weight");
      setNewPerUnitWeight("");
      setNewCaseWeights([""]);
    } catch {
      // createItem onError already sets createError
    }
  };

  const caseTotals = useMemo(() => {
    const list = items;
    // Total = all full cases we have (in_stock + picked + shipped) so available doesn't go negative after shipping.
    let total = 0;
    for (const i of list) {
      const c = i.cases ?? 0;
      if (c > 0) total += c;
    }
    // Allocated = only orders that are still active (sales_order or invoice), not cancelled.
    let allocated = 0;
    const orders = salesOrders ?? [];
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      for (const line of o.lines ?? []) {
        allocated += line.expected_cases ?? 0;
      }
    }
    const available = total - allocated;
    return { total, allocated, available };
  }, [items, salesOrders]);

  const productCaseTotals = useMemo(() => {
    const list = items;
    const map: Record<
      number,
      { total: number; allocated: number; available: number }
    > = {};
    // Total = all full cases for this product (any status) so available doesn't go negative after shipping.
    for (const i of list) {
      const c = i.cases ?? 0;
      if (c <= 0) continue;
      const pid = i.product_id;
      if (!map[pid]) {
        map[pid] = { total: 0, allocated: 0, available: 0 };
      }
      map[pid].total += c;
    }
    // Allocated = only non-cancelled orders.
    const orders = salesOrders ?? [];
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      for (const line of o.lines ?? []) {
        const pid = line.product_id;
        if (!map[pid]) {
          map[pid] = { total: 0, allocated: 0, available: 0 };
        }
        map[pid].allocated += line.expected_cases ?? 0;
      }
    }
    for (const pid of Object.keys(map)) {
      const p = Number(pid);
      map[p].available = map[p].total - map[p].allocated;
    }
    return map;
  }, [items, salesOrders]);

  const productsShort = useMemo(() => {
    const list: { productId: number; casesShort: number }[] = [];
    Object.entries(productCaseTotals).forEach(([pid, v]) => {
      if (v.available < 0) {
        list.push({ productId: Number(pid), casesShort: -v.available });
      }
    });
    return list.sort((a, b) => b.casesShort - a.casesShort);
  }, [productCaseTotals]);

  const selectedIds = Object.keys(selected)
    .filter((id) => selected[Number(id)])
    .map(Number);

  if (isLoading || ordersLoading) return <div className="loading">Loading inventory…</div>;
  if (error) return <div className="error">Failed to load: {(error as Error).message}</div>;

  return (
    <>
      <h1>Inventory</h1>
      <p className="weight-label">
        Rows are grouped by product + lot. Catch weight shows total and, in small text, each box’s weight (lbs). For chicken, 40 lbs per box is the default when adding. Use Delete to remove stock.
      </p>
      <p style={{ marginBottom: "0.75rem", fontWeight: 500 }} title="Total cases = all full cases in warehouse. Cases on orders = sum on active sales orders/invoices. Available = Total − Cases on orders.">
        Total cases: {caseTotals.total} · Cases on orders/invoices: {caseTotals.allocated} · Available cases: {caseTotals.available}
      </p>
      {productsShort.length > 0 && (
        <button
          type="button"
          onClick={() => document.getElementById("inventory-short")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          style={{ display: "inline-block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--error, #dc2626)", background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", textDecoration: "underline" }}
        >
          Short: {productsShort.length} product{productsShort.length === 1 ? "" : "s"} →
        </button>
      )}
      {caseTotals.available < 0 && (
        <div id="inventory-short" className="error inventory-short-alert" style={{ marginBottom: "0.75rem", padding: "0.75rem 1rem" }} role="alert">
          <p style={{ margin: "0 0 0.5rem 0" }}>
            Inventory short: <strong>{-caseTotals.available} cases</strong> need to be ordered.
          </p>
          <p style={{ margin: 0, fontWeight: 600 }}>Products short:</p>
          <ul style={{ margin: "0.25rem 0 0 1.25rem", padding: 0 }}>
            {productsShort.map(({ productId, casesShort }) => (
              <li key={productId}>
                {productMap[productId] ? `${productMap[productId].sku} — ${productMap[productId].name}` : `Product #${productId}`}
                {" "}<strong>({casesShort} case{casesShort === 1 ? "" : "s"} short)</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Manually add inventory item */}
      <section className="card form-card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Add inventory item</h2>
        <form onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="inv-species">Species</label>
              <select
                id="inv-species"
                value={newSpecies}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewSpecies(value);
                  setNewProductId("");
                  setNewPerUnitWeight("");
                }}
              >
                <option value="">All species…</option>
                {speciesOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="inv-product">Product</label>
              <select
                id="inv-product"
                value={newProductId}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewProductId(value);
                  setNewPerUnitWeight(defaultWeightForProduct(value));
                  const pid = parseInt(value, 10);
                  if (Number.isFinite(pid)) setNewLotId(getDefaultLotIdForProduct(pid));
                  else setNewLotId("");
                }}
              >
                <option value="">Select product…</option>
                {(products ?? [])
                  .filter((p) => !newSpecies || p.species === newSpecies)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="inv-lot">Lot (Vendor)</label>
              <select
                id="inv-lot"
                value={newLotId}
                onChange={(e) => setNewLotId(e.target.value)}
              >
                <option value="">Select lot (vendor)…</option>
                {(lots ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.lot_number}
                    {l.supplier_name ? ` — ${l.supplier_name}` : ""}
                  </option>
                ))}
              </select>
            </div>
            {newProductId && newLotId && vendorCostForAdd && (
              <div className="form-group" style={{ alignSelf: "flex-end", marginBottom: 0 }}>
                {vendorCostForAdd.cost_per_lb != null ? (
                  <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>
                    Cost ({vendorCostForAdd.source === "last invoice" ? "from last invoice" : "price chart"}): {formatMoney(vendorCostForAdd.cost_per_lb)}/lb
                    {vendorCostForAdd.supplier_name && (
                      <span style={{ color: "var(--muted)", fontWeight: 400 }}> — {vendorCostForAdd.supplier_name}</span>
                    )}
                  </span>
                ) : (
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                    No cost for this product + vendor (set in price chart or add a supplier invoice)
                  </span>
                )}
              </div>
            )}
            <div className="form-group">
              <label htmlFor="inv-unit">Unit</label>
              <select
                id="inv-unit"
                value={newUnitType}
                onChange={(e) => {
                  const value = e.target.value as "catch_weight" | "packet" | "case";
                  setNewUnitType(value);
                  if (value === "catch_weight") {
                    const n = Math.max(1, parseInt(newCases, 10) || 0);
                    syncCaseWeightsToCount(n, defaultWeightForProduct(newProductId) || undefined);
                  }
                }}
              >
                <option value="catch_weight">Catch weight (lbs per case)</option>
                <option value="packet">Packet</option>
                <option value="case">Case</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="inv-cases">{newUnitType === "catch_weight" ? "Cases" : "Qty"}</label>
              <input
                id="inv-cases"
                type="number"
                min={1}
                value={newCases}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewCases(value);
                  if (newUnitType === "catch_weight") {
                    const n = Math.max(1, parseInt(value, 10) || 0);
                    syncCaseWeightsToCount(n);
                  }
                }}
                placeholder="e.g. 10"
              />
            </div>
            {newUnitType === "catch_weight" ? (
              <div className="form-group" style={{ flex: "1 1 100%" }}>
                <label>Weight per case (lbs) — one per case</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                  {Array.from({ length: casesNumForForm }, (_, i) => (
                    <input
                      key={i}
                      type="text"
                      inputMode="decimal"
                      aria-label={`Weight case ${i + 1} (lbs)`}
                      value={newCaseWeights[i] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setNewCaseWeights((prev) => {
                          const next = [...prev];
                          while (next.length <= i) next.push("");
                          next[i] = v;
                          return next;
                        });
                      }}
                      placeholder={`Case ${i + 1}`}
                      style={{ width: "5rem" }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="inv-weight">
                  {newUnitType === "packet" ? "Weight per packet (lbs)" : "Weight per case (lbs)"}
                </label>
                <input
                  id="inv-weight"
                  type="text"
                  inputMode="decimal"
                  value={newPerUnitWeight}
                  onChange={(e) => setNewPerUnitWeight(e.target.value)}
                  placeholder="e.g. 10"
                  style={{ width: "6rem" }}
                />
              </div>
            )}
          </div>
          {createError && (
            <p className="error" style={{ marginTop: "0.5rem" }}>
              {createError.includes("Database unavailable")
                ? "The box was added, but the app showed an old database error message. Try refreshing the page; your inventory is up to date."
                : createError}
            </p>
          )}
          <button type="submit" className="btn primary" disabled={createItem.isPending} style={{ marginTop: "0.5rem" }}>
            {createItem.isPending ? "Adding…" : "Add inventory item"}
          </button>
        </form>
      </section>
      {deleteError && <p className="error" style={{ marginBottom: "0.5rem" }}>{deleteError}</p>}
      {updateError && <p className="error" style={{ marginBottom: "0.5rem" }}>{updateError}</p>}
      <div style={{ marginBottom: "1rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          Species
          <select
            value={speciesFilter}
            onChange={(e) => setSpeciesFilter(e.target.value)}
            style={{ padding: "0.25rem 0.5rem", minWidth: "10rem" }}
            aria-label="Filter by species"
          >
            <option value="">All</option>
            {speciesOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          Search
          <input
            type="search"
            placeholder="SKU or product name"
            value={inventorySearch}
            onChange={(e) => setInventorySearch(e.target.value)}
            style={{ padding: "0.25rem 0.5rem", minWidth: "12rem" }}
            aria-label="Search by SKU or product name"
          />
        </label>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleDeleteSelected}
          disabled={
            deleteSelected.isPending || (items?.length ?? 0) === 0 || selectedIds.length === 0
          }
          title="Delete selected inventory items"
        >
          {deleteSelected.isPending
            ? "Deleting…"
            : selectedIds.length > 0
              ? `Delete selected (${selectedIds.length})`
              : "Delete selected"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleDeleteAll}
          disabled={deleteAll.isPending || (items?.length ?? 0) === 0}
          title="Remove all items from inventory"
        >
          {deleteAll.isPending ? "Deleting…" : "Delete all inventory"}
        </button>
      </div>
      {filteredGroupsByCategory.map(({ category, groups }) => {
        const categoryItems = groups.flatMap((g) => g.items);
        const title = (category || "Uncategorized").charAt(0).toUpperCase() + (category || "Uncategorized").slice(1);
        return (
          <section key={category} className="inventory-section" style={{ marginBottom: "1.5rem" }}>
            <h2 className="inventory-section-title" style={{ fontSize: "1.15rem", marginBottom: "0.5rem" }}>
              {title} <span className="inventory-section-count">({categoryItems.length} items)</span>
            </h2>
            <div className="table-wrap inventory-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label={`Select all ${title} items`}
                        checked={
                          categoryItems.length > 0 &&
                          categoryItems.every((i) => selected[i.id])
                        }
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelected((prev) => {
                            const next = { ...prev };
                            categoryItems.forEach((i) => {
                              if (checked) next[i.id] = true;
                              else delete next[i.id];
                            });
                            return next;
                          });
                        }}
                      />
                    </th>
                    <th>Product</th>
                    <th>Box IDs</th>
                    <th>Species</th>
                    <th>Lot</th>
                    <th>Vendor</th>
                    <th title="Total full cases for this product (all statuses)">Total cases</th>
                    <th title="Cases on active sales orders and invoices">Cases on orders</th>
                    <th title="Total cases minus cases on orders (available to promise)">Available cases</th>
                    <th>Weight (lbs)</th>
                    <th>Sales order</th>
                    <th>Status</th>
                    <th style={{ minWidth: "6rem", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                {groups.map((grp: InventoryGroup) => {
                    const first = grp.items[0];
                    // Full in-stock cases for this row (matches Cases column).
                    const fullInStockCases = grp.items
                      .filter((i: InventoryItem) => i.status === "in_stock")
                      .reduce((s: number, i: InventoryItem) => s + (i.cases ?? 0), 0);
                    // For the weight display, only show IN_STOCK items so partial/allocated
                    // boxes don't keep contributing their sold weight to the main row.
                    const inStockItems = grp.items.filter((i: InventoryItem) => i.status === "in_stock");
                    const totalLbs = inStockItems.reduce(
                      (s: number, i: InventoryItem) => s + (parseFloat(String(i.exact_weight_lbs)) || 0),
                      0
                    );
                    // Hide ghost rows that have no cases and no weight at all.
                    if (fullInStockCases === 0 && totalLbs === 0) {
                      return null;
                    }
                    const weightsList = inStockItems
                      .map((i) => {
                        const w = parseFloat(String(i.exact_weight_lbs));
                        return Number.isFinite(w) ? w.toFixed(2) : String(i.exact_weight_lbs ?? "");
                      })
                      .join(", ");
                    const allSelected = grp.items.every((i) => selected[i.id]);
                    const singleItem = grp.items.length === 1 ? grp.items[0] : null;
                    return (
                      <tr key={grp.key}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select group ${grp.key}`}
                            checked={allSelected}
                            disabled={grp.items.some((i) => i.status !== "in_stock")}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSelected((prev) => {
                                const next = { ...prev };
                                grp.items.forEach((i) => {
                                  if (checked) next[i.id] = true;
                                  else delete next[i.id];
                                });
                                return next;
                              });
                            }}
                            title={grp.items.some((i) => i.status !== "in_stock") ? "Group includes allocated boxes" : undefined}
                          />
                        </td>
                        <td>
                          {(() => {
                            const baseName = productMap[first.product_id]
                              ? `${productMap[first.product_id].sku} — ${productMap[first.product_id].name}`
                              : `Product #${first.product_id}`;
                            const isPartialGroup = grp.items.some((i) => (i.cases ?? 0) === 0);
                            return isPartialGroup ? `${baseName} (partial)` : baseName;
                          })()}
                        </td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                            {(() => {
                              // Group all items in this row by base box barcode (strip -REM).
                              const byBase = new Map<string, InventoryItem[]>();
                              for (const i of grp.items) {
                                const base = i.barcode_id.endsWith("-REM")
                                  ? i.barcode_id.replace(/-REM$/, "")
                                  : i.barcode_id;
                                if (!byBase.has(base)) byBase.set(base, []);
                                byBase.get(base)!.push(i);
                              }
                              const chips: { key: string; el: React.ReactNode }[] = [];
                              for (const [baseBarcode, boxItems] of byBase.entries()) {
                                const weights = boxItems.map((i) => parseFloat(String(i.exact_weight_lbs)) || 0);
                                const original = weights.reduce((s, w) => s + w, 0);
                                const inStockItems = boxItems.filter((i) => i.status === "in_stock");
                                const remainder = inStockItems
                                  .map((i) => parseFloat(String(i.exact_weight_lbs)) || 0)
                                  .reduce((s, w) => s + w, 0);
                                const takenItems = boxItems.filter((i) => i.status !== "in_stock");
                                const takenWeights = takenItems
                                  .map((i) => parseFloat(String(i.exact_weight_lbs)) || 0)
                                  .filter((w) => w > 0);
                                const isSplit = takenWeights.length > 0 && remainder > 0;

                                // If there is no weight left in stock for this base box (fully sold),
                                // skip rendering a chip for it. The remaining physical piece, if any,
                                // will appear under its own barcode (e.g. INV-2-L27-1-REM 15.10 lbs).
                                if (remainder <= 0 && takenWeights.length > 0) {
                                  continue;
                                }

                                let mathText: string;
                                if (isSplit) {
                                  mathText = `${original.toFixed(2)} − ${takenWeights
                                    .map((w) => w.toFixed(2))
                                    .join(" − ")} rem ${remainder.toFixed(2)} lbs`;
                                } else {
                                  mathText = `${remainder.toFixed(2)} lbs`;
                                }

                                chips.push({
                                  key: baseBarcode,
                                  el: (
                                    <span
                                      className={
                                        "inventory-box-chip " +
                                        (isSplit
                                          ? "inventory-box-chip--split"
                                          : takenItems.length > 0
                                            ? "inventory-box-chip--allocated"
                                            : "")
                                      }
                                      style={{ fontVariantNumeric: "tabular-nums" }}
                                    >
                                      <span className="inventory-box-id">{baseBarcode}</span>
                                      <span className={isSplit ? "inventory-box-math" : "inventory-box-weight"}>
                                        {mathText}
                                      </span>
                                    </span>
                                  ),
                                });
                              }
                              return chips.map((c) => <span key={c.key}>{c.el}</span>);
                            })()}
                          </div>
                        </td>
                        <td>{productMap[first.product_id]?.species ?? "—"}</td>
                        <td>{first.lot_number ?? first.lot_id}</td>
                        <td>{first.supplier_name ?? "—"}</td>
                        <td>
                          {singleItem && editRowId === singleItem.id ? (
                            <input
                              type="number"
                              min={1}
                              value={editCases}
                              onChange={(e) => setEditCases(e.target.value)}
                              style={{ width: "4rem" }}
                            />
                          ) : (
                            (() => {
                              // Only count full cases that are still in stock for this row.
                              const fullCases = grp.items
                                .filter((i: InventoryItem) => i.status === "in_stock")
                                .reduce((s: number, i: InventoryItem) => s + (i.cases ?? 0), 0);
                              const hasPartial = grp.items.some(
                                (i: InventoryItem) => (i.cases ?? 0) === 0,
                              );
                              if (hasPartial) {
                                return "—";
                              }
                              return fullCases;
                            })()
                          )}
                        </td>
                        <td>
                          {(() => {
                            const hasPartial = grp.items.some(
                              (i: InventoryItem) => (i.cases ?? 0) === 0,
                            );
                            if (hasPartial) return "—";
                            return productCaseTotals[first.product_id]?.allocated ?? 0;
                          })()}
                        </td>
                        <td>
                          {(() => {
                            const hasPartial = grp.items.some(
                              (i: InventoryItem) => (i.cases ?? 0) === 0,
                            );
                            if (hasPartial) return "—";
                            const av = productCaseTotals[first.product_id]?.available ?? 0;
                            return av < 0 ? (
                              <span title={`${-av} cases need to be ordered for this product`}>
                                {av} <span className="error-inline">(need to order {-av})</span>
                              </span>
                            ) : (
                              av
                            );
                          })()}
                        </td>
                        <td className="catch-weight">
                          {singleItem && editRowId === singleItem.id ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editWeight}
                              onChange={(e) => setEditWeight(e.target.value)}
                              style={{ width: "5.5rem" }}
                            />
                          ) : (
                            <span className="catch-weight">
                              {fullInStockCases} cases · {totalLbs.toFixed(2)} lbs
                              {grp.items.length > 1 && (
                                <span style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                                  {weightsList} lbs
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                        <td>
                          {first.sales_order_id
                            ? first.sales_order_number || `Order #${first.sales_order_id}`
                            : "—"}
                        </td>
                        <td>
                          {(() => {
                            const statuses = [...new Set(grp.items.map((i) => i.status))];
                            return statuses.length > 1 ? statuses.map(inventoryStatusLabel).join(", ") : inventoryStatusLabel(first.status ?? "");
                          })()}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {singleItem && editRowId === singleItem.id ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => handleSave(singleItem)}
                                disabled={updateItem.isPending}
                              >
                                {updateItem.isPending ? "Saving…" : "Save"}
                              </button>{" "}
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={cancelEdit}
                                disabled={updateItem.isPending}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              {singleItem && singleItem.status === "in_stock" && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => startEdit(singleItem)}
                                  disabled={updateItem.isPending}
                                  style={{ marginRight: "0.25rem" }}
                                >
                                  Edit
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => {
                                  if (grp.items.length > 1) {
                                    if (!window.confirm(`Remove ${grp.items.length} items (this product + lot) from inventory?`)) return;
                                    deleteSelected.mutate(grp.items.map((i) => i.id));
                                  } else {
                                    handleDeleteOne(grp.items[0]);
                                  }
                                }}
                                disabled={deleteItem.isPending || deleteSelected.isPending || grp.items.some((i) => i.status !== "in_stock")}
                                title={grp.items.some((i) => i.status !== "in_stock") ? "Cannot delete: some boxes are allocated to an order" : (grp.items.length > 1 ? "Remove all boxes in this group" : "Remove this item from inventory")}
                              >
                                {deleteItem.isPending && singleItem && deleteItem.variables === singleItem.id
                                  ? "…"
                                  : deleteSelected.isPending
                                    ? "…"
                                    : "Delete"}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
}
