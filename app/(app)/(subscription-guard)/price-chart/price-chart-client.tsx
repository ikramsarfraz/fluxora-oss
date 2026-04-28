"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  endpoints,
  type CustomerPrice,
  type PriceChartData,
  type PriceChartProduct,
  type Supplier,
} from "@/lib/api";

/** Format cost/price for display: exactly 2 decimal places (e.g. 0.95 not 0.9500). */
function formatChartNumber(raw: string | undefined | null): string {
  if (raw === undefined || raw === null || raw === "") return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw);
  return n.toFixed(2);
}

function formatPriceString(raw: string | undefined | null): string {
  if (!raw) return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toFixed(2);
}

function priceKey(customerId: number, productId: number) {
  return `${customerId}:${productId}`;
}

export function PriceChartClient() {
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [fuelSurchargeDraft, setFuelSurchargeDraft] = useState<Record<number, string>>({});
  const [applyingMarkupCustomerId, setApplyingMarkupCustomerId] = useState<number | null>(null);
  const [expandedCostProductId, setExpandedCostProductId] = useState<number | null>(null);
  const [newVendorCost, setNewVendorCost] = useState<Record<number, { supplierId: string; cost: string }>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ["price-chart"],
    queryFn: () => api.get<PriceChartData>(endpoints.priceChart.get()),
  });
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.get<Supplier[]>(endpoints.suppliers.list()),
  });

  const priceMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!data?.prices) return map;
    for (const p of data.prices) {
      map.set(priceKey(p.customer_id, p.product_id), formatPriceString(p.price_per_lb));
    }
    return map;
  }, [data?.prices]);

  const costKey = (productId: number) => `cost:${productId}`;

  const setPrice = useMutation({
    mutationFn: (input: { customerId: number; productId: number; price: string }) =>
      api.post<CustomerPrice>(endpoints.customers.setPrice(input.customerId), {
        product_id: input.productId,
        price_per_lb: input.price,
      }),
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.refetchQueries({ queryKey: ["price-chart"] });
    },
    onError: (e: Error) => setErrorMsg(e.message),
  });

  const deletePrice = useMutation({
    mutationFn: (input: { customerId: number; productId: number }) =>
      api.delete(endpoints.customers.deletePrice(input.customerId, input.productId)),
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.refetchQueries({ queryKey: ["price-chart"] });
    },
    onError: (e: Error) => setErrorMsg(e.message),
  });

  const updateCustomerFuelSurcharge = useMutation({
    mutationFn: (input: { customerId: number; fuel_surcharge_amount: string | null }) =>
      api.patch(endpoints.customers.update(input.customerId), {
        fuel_surcharge_amount: input.fuel_surcharge_amount,
      }),
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.refetchQueries({ queryKey: ["price-chart"] });
    },
    onError: (e: Error) => setErrorMsg(e.message),
  });

  const setCost = useMutation({
    mutationFn: (input: { productId: number; price: string }) =>
      api.patch(endpoints.products.update(input.productId), {
        default_price_per_lb: input.price,
      }),
    onSuccess: (_, variables) => {
      setErrorMsg(null);
      const productId = variables.productId;
      if (productId == null || typeof productId !== "number" || productId < 1) {
        queryClient.refetchQueries({ queryKey: ["price-chart"] });
        return;
      }
      const costNum = parseFloat(variables.price);
      const markupPrice =
        Number.isFinite(costNum) && costNum >= 0 ? (costNum * 1.07).toFixed(2) : null;
      const cached = queryClient.getQueryData<PriceChartData>(["price-chart"]);
      const customers = cached?.customers ?? [];
      if (!markupPrice || customers.length === 0) {
        queryClient.refetchQueries({ queryKey: ["price-chart"] });
        return;
      }
      (async () => {
        try {
          for (const c of customers) {
            await api.post<CustomerPrice>(endpoints.customers.setPrice(c.id), {
              product_id: productId,
              price_per_lb: markupPrice,
            });
          }
          await queryClient.refetchQueries({ queryKey: ["price-chart"] });
        } catch (e) {
          setErrorMsg(e instanceof Error ? e.message : "Failed to apply 7% markup to customers");
          queryClient.refetchQueries({ queryKey: ["price-chart"] });
        }
      })();
    },
    onError: (e: Error) => setErrorMsg(e.message),
  });

  const setProductSupplierCost = useMutation({
    mutationFn: (input: { productId: number; supplierId: number; costPerLb: string }) =>
      api.patch(endpoints.priceChart.setProductSupplierCost(input.productId), {
        supplier_id: input.supplierId,
        cost_per_lb: input.costPerLb,
      }),
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.refetchQueries({ queryKey: ["price-chart"] });
    },
    onError: (e: Error) => setErrorMsg(e.message),
  });

  const deleteProductSupplierCost = useMutation({
    mutationFn: (input: { productId: number; supplierId: number }) =>
      api.delete(endpoints.priceChart.deleteProductSupplierCost(input.productId, input.supplierId)),
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.refetchQueries({ queryKey: ["price-chart"] });
    },
    onError: (e: Error) => setErrorMsg(e.message),
  });

  const vendorCostDraftKey = (productId: number, supplierId: number) => `vendor:${productId}:${supplierId}`;
  const [vendorCostDraft, setVendorCostDraft] = useState<Record<string, string>>({});

  const getValue = (customerId: number, productId: number) => {
    const key = priceKey(customerId, productId);
    if (draft[key] !== undefined) return draft[key];
    return priceMap.get(key) ?? "";
  };

  const getCostValue = (productId: number, products: PriceChartProduct[]) => {
    const key = costKey(productId);
    if (draft[key] !== undefined) return draft[key];
    const prod = products.find(p => p.id === productId);
    return formatPriceString(prod?.cost);
  };

  const isSavingCell = (customerId: number, productId: number) => {
    const sp = setPrice.variables as { customerId: number; productId: number } | undefined;
    const dp = deletePrice.variables as { customerId: number; productId: number } | undefined;
    return (
      (setPrice.isPending && sp && sp.customerId === customerId && sp.productId === productId) ||
      (deletePrice.isPending && dp && dp.customerId === customerId && dp.productId === productId)
    );
  };

  const handleSaveCell = (customerId: number, productId: number) => {
    if (productId == null || typeof productId !== "number" || productId < 1) return;
    const raw = getValue(customerId, productId).trim();
    if (!raw) {
      deletePrice.mutate({ customerId, productId });
      return;
    }
    setPrice.mutate({ customerId, productId, price: raw });
  };

  const products = Array.isArray(data?.products) ? data.products : [];
  const customers = Array.isArray(data?.customers) ? data.customers : [];

  const apply7PercentMarkup = async (customerId: number) => {
    setErrorMsg(null);
    setApplyingMarkupCustomerId(customerId);
    const list = Array.isArray(products) ? products : [];
    try {
      for (const prod of list) {
        const pid = prod?.id;
        if (pid == null || typeof pid !== "number" || pid < 1) continue;
        const cost = parseFloat(prod.cost);
        if (!Number.isFinite(cost) || cost < 0) continue;
        const price = (cost * 1.07).toFixed(2);
        await api.post<CustomerPrice>(endpoints.customers.setPrice(customerId), {
          product_id: pid,
          price_per_lb: price,
        });
      }
      await queryClient.refetchQueries({ queryKey: ["price-chart"] });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to apply 7% markup");
    } finally {
      setApplyingMarkupCustomerId(null);
    }
  };

  const productsBySpecies = useMemo(() => {
    const map = new Map<string, PriceChartProduct[]>();
    const list = Array.isArray(products) ? products : [];
    for (const p of list) {
      if (!p || typeof p !== "object" || p.id == null) continue;
      const species = (p && "species" in p ? p.species : undefined)?.trim() || "Other";
      if (!map.has(species)) map.set(species, []);
      map.get(species)?.push(p as PriceChartProduct);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  if (isLoading) return <div className="loading">Loading price chart…</div>;
  if (error) return <div className="error">Failed to load: {(error as Error).message}</div>;

  return (
    <>
      <p className="weight-label">
        Cost is your default price per lb. Each column shows that customer&apos;s
        price per lb for the product (editable; clear to remove price). Cost can vary
        by vendor,use &quot;By vendor&quot; to add or edit. Grouped by species.
      </p>
      {errorMsg ? (
        <p className="error" style={{ marginBottom: "1rem" }}>
          {errorMsg}
        </p>
      ) : null}
      <div className="table-wrap" style={{ overflowX: "auto", maxHeight: "70vh" }}>
        <table style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th
                style={{
                  minWidth: "8rem",
                  textAlign: "left",
                  position: "sticky",
                  left: 0,
                  top: 0,
                  background: "#0f172a",
                  color: "#f9fafb",
                  zIndex: 3,
                }}
              >
                Product
              </th>
              <th
                style={{
                  minWidth: "5rem",
                  position: "sticky",
                  top: 0,
                  background: "#0f172a",
                  color: "#f9fafb",
                  zIndex: 2,
                }}
              >
                Cost ($/lb)
              </th>
              {customers.map(c => (
                <th
                  key={c.id}
                  style={{
                    minWidth: "5rem",
                    position: "sticky",
                    top: 0,
                    background: "#0f172a",
                    color: "#f9fafb",
                    zIndex: 2,
                  }}
                  title={c.name}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                      alignItems: "flex-start",
                    }}
                  >
                    <span>{c.name}</span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem" }}
                      onClick={() => apply7PercentMarkup(c.id)}
                      disabled={applyingMarkupCustomerId === c.id || products.length === 0}
                      title="Set all product prices for this customer to cost + 7%"
                    >
                      {applyingMarkupCustomerId === c.id ? "…" : "7% from cost"}
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: "#f8fafc", fontWeight: 500 }}>
              <td
                style={{
                  verticalAlign: "middle",
                  position: "sticky",
                  left: 0,
                  background: "#f8fafc",
                  zIndex: 1,
                }}
              >
                Fuel surcharge ($/order)
              </td>
              <td colSpan={1} style={{ color: "#64748b", fontSize: "0.8rem" }}>
                —
              </td>
              {customers.map(c => {
                const current =
                  c.fuel_surcharge_amount != null
                    ? formatChartNumber(String(c.fuel_surcharge_amount))
                    : "";
                const value =
                  fuelSurchargeDraft[c.id] !== undefined
                    ? fuelSurchargeDraft[c.id]
                    : current;
                return (
                  <td key={c.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={value}
                        onChange={e =>
                          setFuelSurchargeDraft(prev => ({
                            ...prev,
                            [c.id]: e.target.value,
                          }))
                        }
                        placeholder="0"
                        style={{ width: "4.5rem" }}
                        title={`Fuel surcharge per order for ${c.name}`}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          const v = (fuelSurchargeDraft[c.id] ?? value).trim();
                          const amt = v === "" || Number.isNaN(parseFloat(v)) ? null : v;
                          updateCustomerFuelSurcharge.mutate({
                            customerId: c.id,
                            fuel_surcharge_amount: amt,
                          });
                          setFuelSurchargeDraft(prev => {
                            const next = { ...prev };
                            delete next[c.id];
                            return next;
                          });
                        }}
                        disabled={updateCustomerFuelSurcharge.isPending}
                        title="Save fuel surcharge for this customer"
                      >
                        {updateCustomerFuelSurcharge.isPending ? "…" : "Save"}
                      </button>
                    </div>
                  </td>
                );
              })}
            </tr>
            {productsBySpecies.map(([species, prods]) => (
              <React.Fragment key={species}>
                <tr style={{ background: "#f1f5f9", fontWeight: 600 }}>
                  <td
                    colSpan={2 + customers.length}
                    style={{
                      padding: "0.5rem 0.75rem",
                      position: "sticky",
                      left: 0,
                      background: "#f1f5f9",
                      zIndex: 1,
                    }}
                  >
                    {species}
                  </td>
                </tr>
                {prods.map(prod => (
                  <tr key={prod.id}>
                    <td
                      style={{
                        whiteSpace: "nowrap",
                        position: "sticky",
                        left: 0,
                        background: "#ffffff",
                        zIndex: 1,
                      }}
                    >
                      <strong>{prod.sku}</strong> {prod.name}
                    </td>
                    <td style={{ verticalAlign: "top" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <input
                            type="number"
                            step="0.01"
                            value={getCostValue(prod.id, products)}
                            onChange={e => {
                              const v = e.target.value;
                              const key = costKey(prod.id);
                              setDraft(prev => ({ ...prev, [key]: v }));
                            }}
                            style={{ width: "4.5rem" }}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              const raw = getCostValue(prod.id, products).trim();
                              if (!raw) return;
                              setCost.mutate({ productId: prod.id, price: raw });
                            }}
                            disabled={setCost.isPending}
                            title="Save default cost for this product"
                          >
                            {setCost.isPending ? "…" : "Save"}
                          </button>
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          {prod.costs_by_supplier && prod.costs_by_supplier.length > 0 ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize: "0.7rem", padding: "0.15rem 0.35rem" }}
                                onClick={() =>
                                  setExpandedCostProductId(id => (id === prod.id ? null : prod.id))
                                }
                              >
                                By vendor ({prod.costs_by_supplier.length}){" "}
                                {expandedCostProductId === prod.id ? "▼" : "▶"}
                              </button>
                              {expandedCostProductId === prod.id ? (
                                <div
                                  style={{
                                    marginTop: "0.35rem",
                                    padding: "0.35rem",
                                    background: "#f8fafc",
                                    borderRadius: 4,
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      fontSize: "0.7rem",
                                      marginBottom: "0.25rem",
                                      color: "var(--muted)",
                                    }}
                                  >
                                    Option 1: Stored (date & edit)
                                  </div>
                                  {prod.costs_by_supplier.map(vc => {
                                    const dk = vendorCostDraftKey(prod.id, vc.supplier_id);
                                    const editVal =
                                      vendorCostDraft[dk] !== undefined
                                        ? vendorCostDraft[dk]
                                        : formatChartNumber(vc.cost_per_lb);
                                    const dateStr = vc.updated_at
                                      ? new Date(vc.updated_at).toLocaleDateString(undefined, {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        })
                                      : null;
                                    return (
                                      <div
                                        key={vc.supplier_id}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "0.35rem",
                                          marginBottom: "0.35rem",
                                          flexWrap: "wrap",
                                        }}
                                      >
                                        <span style={{ minWidth: "5rem", fontSize: "0.75rem" }}>
                                          {vc.supplier_name}:
                                        </span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={editVal}
                                          onChange={e =>
                                            setVendorCostDraft(prev => ({
                                              ...prev,
                                              [dk]: e.target.value,
                                            }))
                                          }
                                          style={{ width: "4rem", fontSize: "0.75rem" }}
                                          placeholder="Cost"
                                        />
                                        <button
                                          type="button"
                                          className="btn btn-secondary"
                                          style={{ fontSize: "0.7rem", padding: "0.2rem 0.4rem" }}
                                          disabled={setProductSupplierCost.isPending}
                                          onClick={() => {
                                            const v = (vendorCostDraft[dk] ?? editVal).trim();
                                            if (v && Number.isFinite(parseFloat(v))) {
                                              setProductSupplierCost.mutate({
                                                productId: prod.id,
                                                supplierId: vc.supplier_id,
                                                costPerLb: v,
                                              });
                                            }
                                          }}
                                        >
                                          Save
                                        </button>
                                        {dateStr ? (
                                          <span
                                            style={{ fontSize: "0.7rem", color: "var(--muted)" }}
                                          >
                                            Updated {dateStr}
                                          </span>
                                        ) : null}
                                        <button
                                          type="button"
                                          className="btn"
                                          style={{
                                            fontSize: "0.7rem",
                                            padding: "0.2rem 0.4rem",
                                            marginLeft: "auto",
                                          }}
                                          disabled={deleteProductSupplierCost.isPending}
                                          onClick={() => {
                                            if (
                                              typeof prod?.id !== "number" ||
                                              prod.id < 1 ||
                                              typeof vc?.supplier_id !== "number"
                                            ) {
                                              return;
                                            }
                                            if (
                                              window.confirm(
                                                `Remove cost for ${vc.supplier_name}?`,
                                              )
                                            ) {
                                              deleteProductSupplierCost.mutate({
                                                productId: prod.id,
                                                supplierId: vc.supplier_id,
                                              });
                                            }
                                          }}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    );
                                  })}
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.25rem",
                                      marginTop: "0.35rem",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <select
                                      value={newVendorCost[prod.id]?.supplierId ?? ""}
                                      onChange={e =>
                                        setNewVendorCost(prev => ({
                                          ...prev,
                                          [prod.id]: {
                                            ...prev[prod.id],
                                            supplierId: e.target.value,
                                            cost: prev[prod.id]?.cost ?? "",
                                          },
                                        }))
                                      }
                                      style={{ width: "8rem", fontSize: "0.75rem" }}
                                    >
                                      <option value="">Add vendor…</option>
                                      {(suppliers ?? []).map(s => (
                                        <option key={s.id} value={s.id}>
                                          {s.name}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder="Cost"
                                      value={newVendorCost[prod.id]?.cost ?? ""}
                                      onChange={e =>
                                        setNewVendorCost(prev => ({
                                          ...prev,
                                          [prod.id]: {
                                            ...prev[prod.id],
                                            supplierId: prev[prod.id]?.supplierId ?? "",
                                            cost: e.target.value,
                                          },
                                        }))
                                      }
                                      style={{ width: "4rem" }}
                                    />
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      style={{ fontSize: "0.7rem" }}
                                      disabled={
                                        !newVendorCost[prod.id]?.supplierId ||
                                        !newVendorCost[prod.id]?.cost ||
                                        setProductSupplierCost.isPending
                                      }
                                      onClick={() => {
                                        const n = newVendorCost[prod.id];
                                        if (!n?.supplierId || !n?.cost) return;
                                        setProductSupplierCost.mutate({
                                          productId: prod.id,
                                          supplierId: parseInt(n.supplierId, 10),
                                          costPerLb: n.cost,
                                        });
                                        setNewVendorCost(prev => ({
                                          ...prev,
                                          [prod.id]: { supplierId: "", cost: "" },
                                        }));
                                      }}
                                    >
                                      Add
                                    </button>
                                  </div>
                                  {prod.costs_from_invoices && prod.costs_from_invoices.length > 0 ? (
                                    <div
                                      style={{
                                        marginTop: "0.5rem",
                                        paddingTop: "0.35rem",
                                        borderTop: "1px solid #e2e8f0",
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontWeight: 600,
                                          fontSize: "0.7rem",
                                          marginBottom: "0.2rem",
                                          color: "var(--muted)",
                                        }}
                                      >
                                        Option 2: From last invoice
                                      </div>
                                      {prod.costs_from_invoices.map(inv => (
                                        <div
                                          key={`${inv.supplier_id}-${inv.invoice_date}`}
                                          style={{
                                            fontSize: "0.75rem",
                                            display: "flex",
                                            gap: "0.5rem",
                                          }}
                                        >
                                          <span style={{ minWidth: "5rem" }}>
                                            {inv.supplier_name}:
                                          </span>
                                          <span>${formatChartNumber(inv.cost_per_lb)}/lb</span>
                                          {inv.invoice_date ? (
                                            <span style={{ color: "var(--muted)" }}>
                                              {inv.invoice_date}
                                            </span>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ fontSize: "0.7rem", padding: "0.15rem 0.35rem" }}
                              onClick={() =>
                                setExpandedCostProductId(id => (id === prod.id ? null : prod.id))
                              }
                            >
                              By vendor (0) {expandedCostProductId === prod.id ? "▼" : "▶"}
                            </button>
                          )}
                          {expandedCostProductId === prod.id &&
                          (!prod.costs_by_supplier ||
                            prod.costs_by_supplier.length === 0) ? (
                            <div
                              style={{
                                marginTop: "0.35rem",
                                padding: "0.35rem",
                                background: "#f8fafc",
                                borderRadius: 4,
                              }}
                            >
                              <div style={{ fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                                Add cost per vendor (same product can have different costs):
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.25rem",
                                  flexWrap: "wrap",
                                }}
                              >
                                <select
                                  value={newVendorCost[prod.id]?.supplierId ?? ""}
                                  onChange={e =>
                                    setNewVendorCost(prev => ({
                                      ...prev,
                                      [prod.id]: {
                                        ...prev[prod.id],
                                        supplierId: e.target.value,
                                        cost: prev[prod.id]?.cost ?? "",
                                      },
                                    }))
                                  }
                                  style={{ width: "8rem", fontSize: "0.75rem" }}
                                >
                                  <option value="">Select vendor…</option>
                                  {(suppliers ?? []).map(s => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="Cost $/lb"
                                  value={newVendorCost[prod.id]?.cost ?? ""}
                                  onChange={e =>
                                    setNewVendorCost(prev => ({
                                      ...prev,
                                      [prod.id]: {
                                        ...prev[prod.id],
                                        supplierId: prev[prod.id]?.supplierId ?? "",
                                        cost: e.target.value,
                                      },
                                    }))
                                  }
                                  style={{ width: "4rem" }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ fontSize: "0.7rem" }}
                                  disabled={
                                    !newVendorCost[prod.id]?.supplierId ||
                                    !newVendorCost[prod.id]?.cost ||
                                    setProductSupplierCost.isPending
                                  }
                                  onClick={() => {
                                    const n = newVendorCost[prod.id];
                                    if (!n?.supplierId || !n?.cost) return;
                                    setProductSupplierCost.mutate({
                                      productId: prod.id,
                                      supplierId: parseInt(n.supplierId, 10),
                                      costPerLb: n.cost,
                                    });
                                    setNewVendorCost(prev => ({
                                      ...prev,
                                      [prod.id]: { supplierId: "", cost: "" },
                                    }));
                                  }}
                                >
                                  Add
                                </button>
                              </div>
                              {prod.costs_from_invoices && prod.costs_from_invoices.length > 0 ? (
                                <div
                                  style={{
                                    marginTop: "0.5rem",
                                    paddingTop: "0.35rem",
                                    borderTop: "1px solid #e2e8f0",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      fontSize: "0.7rem",
                                      marginBottom: "0.2rem",
                                      color: "var(--muted)",
                                    }}
                                  >
                                    Option 2: From last invoice
                                  </div>
                                  {prod.costs_from_invoices.map(inv => (
                                    <div
                                      key={`${inv.supplier_id}-${inv.invoice_date}`}
                                      style={{
                                        fontSize: "0.75rem",
                                        display: "flex",
                                        gap: "0.5rem",
                                      }}
                                    >
                                      <span style={{ minWidth: "5rem" }}>
                                        {inv.supplier_name}:
                                      </span>
                                      <span>${formatChartNumber(inv.cost_per_lb)}/lb</span>
                                      {inv.invoice_date ? (
                                        <span style={{ color: "var(--muted)" }}>
                                          {inv.invoice_date}
                                        </span>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    {customers.map(c => {
                      const key = priceKey(c.id, prod.id);
                      const value = getValue(c.id, prod.id);
                      return (
                        <td key={c.id}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <input
                              type="number"
                              step="0.01"
                              value={value}
                              onChange={e => {
                                const v = e.target.value;
                                setDraft(prev => ({ ...prev, [key]: v }));
                              }}
                              style={{ width: "4.5rem" }}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => handleSaveCell(c.id, prod.id)}
                              disabled={isSavingCell(c.id, prod.id)}
                              title="Save price for this customer and product"
                            >
                              {isSavingCell(c.id, prod.id) ? "…" : "Save"}
                            </button>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => {
                                if (
                                  typeof c?.id === "number" &&
                                  typeof prod?.id === "number" &&
                                  prod.id >= 1
                                ) {
                                  deletePrice.mutate({
                                    customerId: c.id,
                                    productId: prod.id,
                                  });
                                }
                              }}
                              disabled={isSavingCell(c.id, prod.id)}
                              title="Clear customer price (use default cost)"
                            >
                              Clear
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {products.length === 0 ? (
        <p style={{ marginTop: "1rem", color: "var(--muted)" }}>
          No products yet. Add products and customers to see the chart.
        </p>
      ) : null}
    </>
  );
}
