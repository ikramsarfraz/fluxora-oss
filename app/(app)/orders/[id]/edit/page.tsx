"use client";

import { useParams, useRouter } from "next/navigation";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, endpoints, type Customer, type CustomerPrice, type Invoice, type InventoryItem, type Product, type SalesOrder } from "@/lib/api";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatMoney } from "@/lib/utils/currency";

function sumCaseWeights(weights: string[]): string {
  const total = weights.reduce((acc, w) => acc + (parseFloat(w) || 0), 0);
  return total.toFixed(2);
}

export default function EditOrder() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const orderId = id ? parseInt(id, 10) : NaN;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [addProductId, setAddProductId] = useState("");
  const [addUnitType, setAddUnitType] = useState<"catch_weight" | "packet" | "case">("catch_weight");
  const [addCases, setAddCases] = useState("1");
  const [addCaseWeights, setAddCaseWeights] = useState<string[]>(["0"]);
  const [addTotalWeightLbs, setAddTotalWeightLbs] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [lineEdits, setLineEdits] = useState<
    Record<number, { cases: string; weight: string; unit_type?: string; price?: string; perBox?: string; boxPicks?: { barcode_id: string; weight_lbs: string }[] }>
  >({});
  const [addUseBoxPicks, setAddUseBoxPicks] = useState(false);
  const [addBoxPicks, setAddBoxPicks] = useState<{ barcode_id: string; weight_lbs: string }[]>([]);
  const [adjustmentKind, setAdjustmentKind] = useState<"" | "discount" | "credit">("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [creditType, setCreditType] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [addFuelSurcharge, setAddFuelSurcharge] = useState(true);

  const { data: order, isLoading, error: loadError } = useQuery({
    queryKey: ["salesOrder", orderId],
    queryFn: () => api.get<SalesOrder>(endpoints.salesOrders.one(orderId)),
    enabled: Number.isInteger(orderId),
  });
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<Customer[]>(endpoints.customers.list()),
  });
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>(endpoints.products.list()),
  });
  const { data: customerPrices } = useQuery({
    queryKey: ["customerPrices", order?.customer_id],
    queryFn: () => api.get<CustomerPrice[]>(endpoints.customers.prices(order!.customer_id)),
    enabled: order?.customer_id != null,
  });
  const { data: inventoryItems } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => api.get<InventoryItem[]>(endpoints.inventory.list()),
  });
  const { data: orderInvoice } = useQuery({
    queryKey: ["invoice", orderId],
    queryFn: () => api.get<Invoice>(endpoints.salesOrders.invoice(orderId)),
    enabled: Number.isInteger(orderId),
  });

  const productMap = useMemo(() => {
    const m: Record<number, Product> = {};
    (products ?? []).forEach((p) => { m[p.id] = p; });
    return m;
  }, [products]);
  const priceMap = useMemo(() => {
    const m: Record<number, number> = {};
    (customerPrices ?? []).forEach((cp) => { m[cp.product_id] = parseFloat(cp.price_per_lb); });
    return m;
  }, [customerPrices]);

  const defaultPriceForLine = (line: { product_id: number; price_per_lb_override?: string | null }): string => {
    if (line.price_per_lb_override != null && line.price_per_lb_override !== "") return String(line.price_per_lb_override);
    const fromCustomer = priceMap[line.product_id];
    if (fromCustomer != null) return String(fromCustomer);
    const p = productMap[line.product_id];
    return p ? String(p.default_price_per_lb) : "";
  };

  const customerName = order && customers
    ? (customers.find((c) => c.id === order.customer_id)?.name ?? `Customer #${order.customer_id}`)
    : "";

  useEffect(() => {
    if (order) {
      const d = parseFloat(String(order.discount_amount ?? 0)) || 0;
      const c = parseFloat(String(order.credit_amount ?? 0)) || 0;
      if (d > 0) {
        setAdjustmentKind("discount");
        setDiscountAmount(String(order.discount_amount));
        setCreditType("");
        setCreditAmount("");
      } else if (c > 0) {
        setAdjustmentKind("credit");
        setDiscountAmount("");
        setCreditType(order.credit_type ?? "");
        setCreditAmount(String(order.credit_amount));
      } else {
        setAdjustmentKind("");
        setDiscountAmount("");
        setCreditType("");
        setCreditAmount("");
      }
      setAddFuelSurcharge(order.add_fuel_surcharge ?? true);
    }
  }, [order?.id, order?.discount_amount, order?.credit_type, order?.credit_amount, order?.add_fuel_surcharge]);

  const updateOrder = useMutation({
    mutationFn: (body: { status: string; discount_amount?: number; credit_type?: string | null; credit_amount?: number; add_fuel_surcharge?: boolean }) =>
      api.patch<SalesOrder>(endpoints.salesOrders.update(orderId), body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salesOrders"] });
      queryClient.invalidateQueries({ queryKey: ["salesOrder", orderId] });
      queryClient.invalidateQueries({ queryKey: ["invoice", orderId] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setError(null);
      router.push("/orders");
    },
    onError: (e: Error) => setError(e.message),
  });

  const addLine = useMutation({
    mutationFn: (body: {
      product_id: number;
      expected_cases: number;
      unit_type?: string;
      total_billed_weight_lbs: string;
      case_weights?: number[];
      box_allocations?: { barcode_id: string; weight_lbs: number }[];
      price_per_lb_override?: number | null;
    }) => api.post<unknown>(endpoints.salesOrders.addLine(orderId), body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salesOrder", orderId] });
      queryClient.invalidateQueries({ queryKey: ["salesOrders"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", orderId] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setAddProductId("");
      setAddUnitType("catch_weight");
      setAddCases("1");
      setAddCaseWeights(["0"]);
      setAddTotalWeightLbs("");
      setAddPrice("");
      setAddUseBoxPicks(false);
      setAddBoxPicks([]);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateLine = useMutation({
    mutationFn: (body: {
      lineId: number;
      expected_cases: number;
      unit_type?: string;
      total_billed_weight_lbs: string;
      price_per_lb_override?: number | null;
      case_weights?: number[];
      box_allocations?: { barcode_id: string; weight_lbs: number }[];
    }) =>
      api.patch<SalesOrder>(endpoints.salesOrders.updateLine(orderId, body.lineId), {
        expected_cases: body.expected_cases,
        ...(body.unit_type != null && { unit_type: body.unit_type }),
        total_billed_weight_lbs: body.total_billed_weight_lbs,
        ...(body.price_per_lb_override !== undefined && { price_per_lb_override: body.price_per_lb_override }),
        ...(body.case_weights != null && { case_weights: body.case_weights }),
        ...(body.box_allocations != null && { box_allocations: body.box_allocations }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salesOrder", orderId] });
      queryClient.invalidateQueries({ queryKey: ["salesOrders"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", orderId] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setError(null);
    const raw = (status || order.status || "").trim();
    if (!raw) {
      setError("Select a status.");
      return;
    }
    const newStatus =
      raw === "draft" || raw === "confirmed" ? "sales_order" : raw === "shipped" || raw === "invoiced" ? "invoice" : raw;
    if (newStatus !== "sales_order" && newStatus !== "invoice" && newStatus !== "cancelled") {
      setError("Status must be Sales order, Invoice, or Cancelled.");
      return;
    }
    if (newStatus === "cancelled" && !window.confirm("Cancel this order? This will release all allocated inventory back to stock.")) {
      return;
    }
    const discount = adjustmentKind === "discount" && discountAmount.trim() ? parseFloat(discountAmount) : 0;
    const credit = adjustmentKind === "credit" && creditAmount.trim() ? parseFloat(creditAmount) : 0;
    updateOrder.mutate({
      status: newStatus,
      discount_amount: adjustmentKind === "discount" && !Number.isNaN(discount) ? discount : 0,
      credit_type: adjustmentKind === "credit" ? (creditType.trim() || null) : null,
      credit_amount: adjustmentKind === "credit" && !Number.isNaN(credit) ? credit : 0,
      add_fuel_surcharge: addFuelSurcharge,
    });
  };

  const defaultWeightForProduct = (productId: number): string =>
    productMap[productId]?.species === "Chicken" ? "40" : "0";

  /** For catch weight: one weight per in-stock box (duplicates ok). Each dropdown choice removes that weight from later boxes. */
  const availableWeightsByProduct = useMemo(() => {
    const map: Record<number, string[]> = {};
    (inventoryItems ?? [])
      .filter((it) => it.status === "in_stock")
      .forEach((it) => {
        const w = parseFloat(String(it.exact_weight_lbs));
        if (!Number.isFinite(w) || w <= 0) return;
        const key = it.product_id;
        if (!map[key]) map[key] = [];
        map[key].push(w.toFixed(2));
      });
    Object.keys(map).forEach((k) => {
      map[Number(k)].sort((a, b) => parseFloat(a) - parseFloat(b));
    });
    return map;
  }, [inventoryItems]);

  const getRemainingWeightOptions = (pool: string[], chosenSoFar: string[]): string[] => {
    const remaining = pool.slice();
    for (const w of chosenSoFar) {
      const idx = remaining.indexOf(w);
      if (idx >= 0) remaining.splice(idx, 1);
    }
    return [...new Set(remaining)].sort((a, b) => parseFloat(a) - parseFloat(b));
  };

  /** In-stock boxes per product for "specify boxes" picker: barcode_id + weight. */
  const availableBoxesByProduct = useMemo(() => {
    const map: Record<number, { barcode_id: string; exact_weight_lbs: number }[]> = {};
    (inventoryItems ?? [])
      .filter((it) => it.status === "in_stock")
      .forEach((it) => {
        const w = parseFloat(String(it.exact_weight_lbs));
        if (!Number.isFinite(w) || w <= 0) return;
        const key = it.product_id;
        if (!map[key]) map[key] = [];
        map[key].push({ barcode_id: it.barcode_id, exact_weight_lbs: w });
      });
    return map;
  }, [inventoryItems]);

  const syncAddCaseWeights = (cases: number) => {
    const n = Math.max(1, cases);
    const defaultW = addProductId ? defaultWeightForProduct(parseInt(addProductId, 10)) : "0";
    setAddCaseWeights((prev) => {
      const next: string[] = [];
      for (let c = 0; c < n; c++) next.push(prev[c] ?? defaultW);
      return next;
    });
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const pid = parseInt(addProductId, 10);
    if (Number.isNaN(pid) || !addProductId) {
      setError("Select a product.");
      return;
    }
    let totalLbs: string;
    let qty: number;
    let caseWeights: number[] | undefined;
    let box_allocations: { barcode_id: string; weight_lbs: number }[] | undefined;

    if (addUnitType === "catch_weight" && addUseBoxPicks && addBoxPicks.length > 0) {
      const picks = addBoxPicks
        .map((p) => ({ barcode_id: p.barcode_id, weight_lbs: parseFloat(p.weight_lbs) || 0 }))
        .filter((p) => p.weight_lbs > 0);
      if (picks.length === 0) {
        setError("Add at least one box with weight > 0.");
        return;
      }
      box_allocations = picks;
      totalLbs = picks.reduce((s, p) => s + p.weight_lbs, 0).toFixed(2);
      // Partial box: do not contribute to ordered cases
      qty = 0;
    } else {
      qty = Math.max(1, parseInt(addCases, 10) || 0);
      totalLbs =
        addUnitType === "catch_weight"
          ? sumCaseWeights(addCaseWeights.slice(0, qty))
          : (parseFloat(addTotalWeightLbs) || 0).toFixed(2);
      caseWeights =
        addUnitType === "catch_weight"
          ? addCaseWeights.slice(0, qty).map((w) => parseFloat(w) || 0)
          : undefined;
    }
    const priceOverride = addPrice.trim() ? parseFloat(addPrice) : undefined;
    addLine.mutate({
      product_id: pid,
      expected_cases: qty,
      unit_type: addUnitType,
      total_billed_weight_lbs: totalLbs,
      case_weights: caseWeights,
      ...(box_allocations != null && { box_allocations }),
      ...(priceOverride != null && !Number.isNaN(priceOverride) ? { price_per_lb_override: priceOverride } : {}),
    });
  };

  if (!Number.isInteger(orderId)) {
    return (
      <div>
        <h1>Edit sales order</h1>
        <p className="error">Invalid order ID.</p>
        <button type="button" className="btn" onClick={() => router.push("/orders")}>Back to Orders</button>
      </div>
    );
  }

  if (isLoading || !order) {
    return <div className="loading">Loading order…</div>;
  }
  if (loadError) {
    return (
      <div>
        <h1>Edit sales order</h1>
        <p className="error">Failed to load: {(loadError as Error).message}</p>
        <button type="button" className="btn" onClick={() => router.push("/orders")}>Back to Orders</button>
      </div>
    );
  }

  const currentStatus = status || order.status;
  const addCasesNum = Math.max(1, parseInt(addCases, 10) || 0);

  return (
    <>
      <h1>Edit sales order</h1>
      <p className="weight-label">
        Order #{order.id} — {customerName} — {formatDisplayDate(order.order_date)}
        {order.order_number ? ` · Invoice: ${order.order_number}` : " (no invoice number yet)"}
      </p>
      {(orderInvoice?.cogs_total != null || orderInvoice?.gross_profit != null) && (
        <div className="totals-card" style={{ marginBottom: "0.5rem" }} title="Estimated cost and margin for this invoice">
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            COGS: {formatMoney(orderInvoice.cogs_total ?? "0")}
            {orderInvoice.gross_profit != null && <> · Gross profit: {formatMoney(orderInvoice.gross_profit)}</>}
            {orderInvoice.gross_margin_pct != null && orderInvoice.gross_margin_pct !== "" && <> · Margin: {Number(orderInvoice.gross_margin_pct).toFixed(1)}%</>}
          </p>
        </div>
      )}
      <section className="card form-card" style={{ maxWidth: "32rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Status &amp; discount / credit</h2>
        <form onSubmit={handleStatusSubmit}>
          <div className="form-group">
            <label htmlFor="edit-order-status">Status</label>
            <select
              id="edit-order-status"
              value={currentStatus === "draft" || currentStatus === "confirmed" ? "sales_order" : currentStatus === "shipped" || currentStatus === "invoiced" ? "invoice" : currentStatus}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="sales_order">Sales order</option>
              <option value="invoice">Invoice</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="form-row" style={{ flexWrap: "wrap", gap: "0.75rem", marginTop: "0.5rem" }}>
            <div className="form-group">
              <label htmlFor="edit-adjustment">Credit or discount</label>
              <select
                id="edit-adjustment"
                value={adjustmentKind}
                onChange={(e) => setAdjustmentKind((e.target.value || "") as "" | "discount" | "credit")}
                style={{ minWidth: "140px" }}
              >
                <option value="">None</option>
                <option value="discount">Discount</option>
                <option value="credit">Credit</option>
              </select>
            </div>
            {adjustmentKind === "discount" && (
              <div className="form-group">
                <label htmlFor="edit-discount">Discount amount ($)</label>
                <input
                  id="edit-discount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0"
                  style={{ width: "6rem" }}
                />
              </div>
            )}
            <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                id="edit-add-fuel-surcharge"
                type="checkbox"
                checked={addFuelSurcharge}
                onChange={(e) => setAddFuelSurcharge(e.target.checked)}
              />
              <label htmlFor="edit-add-fuel-surcharge" style={{ marginBottom: 0 }}>
                Add fuel surcharge (if customer has one)
              </label>
            </div>
            {adjustmentKind === "credit" && (
              <>
                <div className="form-group">
                  <label htmlFor="edit-credit-type">Type of credit</label>
                  <select
                    id="edit-credit-type"
                    value={creditType}
                    onChange={(e) => setCreditType(e.target.value)}
                    style={{ minWidth: "140px" }}
                  >
                    <option value="">Select type…</option>
                    <option value="early_payment">Early payment</option>
                    <option value="volume">Volume</option>
                    <option value="promotional">Promotional</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="edit-credit-amount">Credit amount ($)</label>
                  <input
                    id="edit-credit-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder="0"
                    style={{ width: "6rem" }}
                  />
                </div>
              </>
            )}
          </div>
          {error && updateOrder.isError && <p className="error">{error}</p>}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button type="submit" className="btn primary" disabled={updateOrder.isPending}>
              {updateOrder.isPending ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn" onClick={() => router.push("/orders")}>
              Back to Orders
            </button>
          </div>
        </form>
      </section>

      <section className="card form-card" style={{ marginTop: "1rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Add product to order</h2>
        <form onSubmit={handleAddProduct}>
          <div className="form-row" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
            <div className="form-group">
              <label htmlFor="add-product">Product</label>
              <select
                id="add-product"
                value={addProductId}
                onChange={(e) => {
                  const val = e.target.value;
                  setAddProductId(val);
                  if (val) {
                    syncAddCaseWeights(addCasesNum);
                    const pid = parseInt(val, 10);
                    const defaultP = priceMap[pid] ?? productMap[pid]?.default_price_per_lb;
                    setAddPrice(defaultP != null ? String(defaultP) : "");
                  } else {
                    setAddPrice("");
                  }
                }}
              >
                <option value="">Select product…</option>
                {(products ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="add-unit-type">Unit</label>
              <select
                id="add-unit-type"
                value={addUnitType}
                onChange={(e) => setAddUnitType(e.target.value as "catch_weight" | "packet" | "case")}
              >
                <option value="catch_weight">Catch weight (lbs per case)</option>
                <option value="packet">Packet</option>
                <option value="case">Case</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="add-cases">{addUnitType === "catch_weight" ? "Cases" : "Qty"}</label>
              <input
                id="add-cases"
                type="number"
                min={1}
                value={addCases}
                onChange={(e) => {
                  setAddCases(e.target.value);
                  syncAddCaseWeights(Math.max(1, parseInt(e.target.value, 10) || 0));
                }}
                className="order-input order-input--cases"
              />
            </div>
            <div className="form-group">
              <label htmlFor="add-price">Price ($/lb or $/cs/pkt)</label>
              <input
                id="add-price"
                type="text"
                inputMode="decimal"
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                placeholder={addProductId ? String(priceMap[parseInt(addProductId, 10)] ?? productMap[parseInt(addProductId, 10)]?.default_price_per_lb ?? "") : "—"}
                style={{ width: "5.5rem" }}
                title="Optional: customer default or enter special price"
              />
            </div>
          </div>
            {addUnitType === "catch_weight" ? (
            <>
            <div className="form-group" style={{ marginTop: "0.5rem" }}>
              <label>Catch weight (lbs per case) — choose from inventory per box or type</label>
              <div className="order-case-weights" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                {Array.from({ length: addCasesNum }, (_, c) => {
                  const pid = addProductId ? parseInt(addProductId, 10) : 0;
                  const pool = availableWeightsByProduct[pid] ?? [];
                  const chosenSoFar = addCaseWeights.slice(0, c).filter((w) => w !== "" && w !== "0");
                  const options = getRemainingWeightOptions(pool, chosenSoFar);
                  const current = addCaseWeights[c] ?? "";
                  return (
                    <span key={c} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <label style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>C{c + 1}</label>
                      <select
                        value={current && options.includes(current) ? current : ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) {
                            setAddCaseWeights((prev) => {
                              const next = [...prev];
                              next[c] = v;
                              return next;
                            });
                          }
                        }}
                        title={`Box ${c + 1}: chosen in previous: ${chosenSoFar.join(", ") || "none"}`}
                        style={{ fontSize: "0.8rem", padding: "0.15rem 0.3rem", width: "4.5rem" }}
                      >
                        <option value="">—</option>
                        {options.map((w) => (
                          <option key={w} value={w}>{w} lbs</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={current && !options.includes(current) ? current : ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAddCaseWeights((prev) => {
                            const next = [...prev];
                            next[c] = v;
                            return next;
                          });
                        }}
                        placeholder="or type"
                        className="order-input order-input--weight"
                        style={{ width: "3.5rem" }}
                      />
                    </span>
                  );
                })}
              </div>
              <span style={{ marginLeft: "0.5rem", fontWeight: 600 }}>
                Total: {sumCaseWeights(addCaseWeights.slice(0, addCasesNum))} lbs
              </span>
            </div>
            {addUnitType === "catch_weight" && addProductId && (
            <div className="form-group" style={{ marginTop: "0.75rem", paddingTop: "0.5rem", borderTop: "1px solid #e2e8f0" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={addUseBoxPicks}
                  onChange={(e) => {
                    setAddUseBoxPicks(e.target.checked);
                    if (!e.target.checked) setAddBoxPicks([]);
                  }}
                />
                Specify boxes (e.g. take 5 lbs from BOX-123, 10 lbs from BOX-456)
              </label>
              {addUseBoxPicks && (
                <div style={{ marginTop: "0.5rem" }}>
                  {addBoxPicks.map((pick, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.35rem", flexWrap: "wrap" }}>
                      <select
                        value={pick.barcode_id}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAddBoxPicks((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], barcode_id: v };
                            return next;
                          });
                        }}
                        style={{ fontSize: "0.85rem", padding: "0.2rem 0.4rem", minWidth: "8rem" }}
                        title="Box (barcode)"
                      >
                        <option value="">Select box…</option>
                        {(availableBoxesByProduct[parseInt(addProductId, 10)] ?? []).map((b) => (
                          <option key={b.barcode_id} value={b.barcode_id}>
                            {b.barcode_id} — {b.exact_weight_lbs.toFixed(2)} lbs
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="lbs"
                        value={pick.weight_lbs}
                        onChange={(e) => {
                          setAddBoxPicks((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], weight_lbs: e.target.value };
                            return next;
                          });
                        }}
                        style={{ width: "4rem", fontSize: "0.85rem" }}
                      />
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: "0.15rem 0.4rem", fontSize: "0.75rem" }}
                        onClick={() => setAddBoxPicks((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}
                    onClick={() => setAddBoxPicks((prev) => [...prev, { barcode_id: "", weight_lbs: "" }])}
                  >
                    + Add box
                  </button>
                  {addBoxPicks.length > 0 && (
                    <span style={{ marginLeft: "0.5rem", fontWeight: 600 }}>
                      Total: {addBoxPicks.reduce((s, p) => s + (parseFloat(p.weight_lbs) || 0), 0).toFixed(2)} lbs
                    </span>
                  )}
                </div>
              )}
            </div>
            )}
            </>
          ) : (
            <div className="form-group" style={{ marginTop: "0.5rem" }}>
              <label htmlFor="add-total-weight">Total weight (lbs)</label>
              <input
                id="add-total-weight"
                type="text"
                inputMode="decimal"
                value={addTotalWeightLbs}
                onChange={(e) => setAddTotalWeightLbs(e.target.value)}
                placeholder="0"
                style={{ width: "6rem" }}
              />
            </div>
          )}
          {error && addLine.isError && <p className="error">{error}</p>}
          <button type="submit" className="btn primary" disabled={addLine.isPending} style={{ marginTop: "0.5rem" }}>
            {addLine.isPending ? "Adding…" : "Add to order"}
          </button>
        </form>
      </section>

      {order.lines?.length > 0 && (
        <div className="table-wrap" style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Current line items</h2>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit</th>
                <th>Qty</th>
                <th>Weight (lbs)</th>
                <th>Price ($/lb or $/cs/pkt)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => {
                const lineUnitType = (line as { unit_type?: string }).unit_type ?? "catch_weight";
                const lineBoxAllocations = (line as { box_allocations?: { barcode_id: string; weight_lbs: number }[] | null }).box_allocations;
                let perCaseWeights: string | null = null;
                if (lineUnitType === "catch_weight" && (line as { case_weights_lbs?: string | null }).case_weights_lbs) {
                  try {
                    const raw = JSON.parse((line as { case_weights_lbs?: string | null }).case_weights_lbs || "[]") as unknown[];
                    const nums = raw
                      .map((w) => {
                        const n = typeof w === "string" ? parseFloat(w) : Number(w);
                        return Number.isFinite(n) ? n.toFixed(2) : null;
                      })
                      .filter((w): w is string => !!w);
                    if (nums.length > 0) perCaseWeights = nums.join(", ");
                  } catch {
                    // ignore parse errors
                  }
                }
                const linePriceOverride = (line as { price_per_lb_override?: string | null }).price_per_lb_override;
                const displayPrice = lineEdits[line.id]?.price ?? defaultPriceForLine({ product_id: line.product_id, price_per_lb_override: linePriceOverride });
                return (
                <tr key={line.id}>
                  <td>{productMap[line.product_id] ? `${productMap[line.product_id].sku} — ${productMap[line.product_id].name}` : `Product #${line.product_id}`}</td>
                  <td>
                    <select
                      value={lineEdits[line.id]?.unit_type ?? lineUnitType}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLineEdits((prev) => ({
                          ...prev,
                          [line.id]: {
                            cases: prev[line.id]?.cases ?? String(line.expected_cases),
                            weight: prev[line.id]?.weight ?? String(line.total_billed_weight_lbs),
                            unit_type: v,
                            price: prev[line.id]?.price,
                          },
                        }));
                      }}
                    >
                      <option value="catch_weight">Catch weight (lbs per case)</option>
                      <option value="packet">Packet</option>
                      <option value="case">Case</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      className="order-input order-input--cases"
                      value={lineEdits[line.id]?.cases ?? String(line.expected_cases)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLineEdits((prev) => ({
                          ...prev,
                          [line.id]: {
                            cases: v,
                            weight: prev[line.id]?.weight ?? String(line.total_billed_weight_lbs),
                            unit_type: prev[line.id]?.unit_type,
                            price: prev[line.id]?.price,
                          },
                        }));
                      }}
                    />
                  </td>
                  <td>
                    {lineUnitType === "catch_weight" ? (
                      <div>
                        <div style={{ marginBottom: "0.35rem" }}>
                          <select
                            value=""
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v) {
                                const casesNum = parseInt(lineEdits[line.id]?.cases ?? String(line.expected_cases), 10) || 0;
                                const total = (parseFloat(v) * Math.max(1, casesNum)).toFixed(2);
                                setLineEdits((prev) => ({
                                  ...prev,
                                  [line.id]: {
                                    cases: prev[line.id]?.cases ?? String(line.expected_cases),
                                    weight: total,
                                    unit_type: prev[line.id]?.unit_type,
                                    price: prev[line.id]?.price,
                                  },
                                }));
                              }
                            }}
                            title="Choose per-case weight from inventory to set total"
                            style={{ fontSize: "0.85rem", padding: "0.2rem 0.4rem" }}
                          >
                            <option value="">Choose or type below</option>
                            {(availableWeightsByProduct[line.product_id] ?? []).map((w) => (
                              <option key={w} value={w}>{w} lbs/case (inventory)</option>
                            ))}
                          </select>
                        </div>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="order-input order-input--weight"
                          value={lineEdits[line.id]?.weight ?? String(line.total_billed_weight_lbs)}
                          onChange={(e) =>
                            setLineEdits((prev) => ({
                              ...prev,
                              [line.id]: {
                                cases: prev[line.id]?.cases ?? String(line.expected_cases),
                                weight: e.target.value,
                                unit_type: prev[line.id]?.unit_type,
                                price: prev[line.id]?.price,
                                perBox: prev[line.id]?.perBox ?? (perCaseWeights ?? ""),
                              },
                            }))
                          }
                          placeholder="Total weight (lbs)"
                          title="Total billed weight (lbs)"
                          style={{ width: "5.5rem" }}
                        />
                        {lineBoxAllocations && lineBoxAllocations.length > 0 && (
                          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                            From boxes: {lineBoxAllocations.map((p) => `${p.barcode_id} ${Number(p.weight_lbs).toFixed(2)} lbs`).join(", ")}
                          </div>
                        )}
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                          Boxes (lbs):{" "}
                          <input
                            type="text"
                            value={lineEdits[line.id]?.perBox ?? (perCaseWeights ?? "")}
                            onChange={(e) =>
                              setLineEdits((prev) => ({
                                ...prev,
                                [line.id]: {
                                  cases: prev[line.id]?.cases ?? String(line.expected_cases),
                                  weight: prev[line.id]?.weight ?? String(line.total_billed_weight_lbs),
                                  unit_type: prev[line.id]?.unit_type,
                                  price: prev[line.id]?.price,
                                  perBox: e.target.value,
                                },
                              }))
                            }
                            placeholder="e.g. 40.2, 39.8, 41.0"
                            style={{ width: "14rem", fontSize: "0.75rem" }}
                          />
                        </div>
                      </div>
                    ) : (
                      <input
                        type="text"
                        inputMode="decimal"
                        className="order-input order-input--weight"
                        value={lineEdits[line.id]?.weight ?? String(line.total_billed_weight_lbs)}
                        onChange={(e) =>
                          setLineEdits((prev) => ({
                            ...prev,
                            [line.id]: {
                              cases: prev[line.id]?.cases ?? String(line.expected_cases),
                              weight: e.target.value,
                              unit_type: prev[line.id]?.unit_type,
                              price: prev[line.id]?.price,
                            },
                          }))
                        }
                        placeholder="Total weight (lbs)"
                        title="Total weight (lbs)"
                        style={{ width: "5.5rem" }}
                      />
                    )}
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="order-input order-input--price"
                      value={displayPrice}
                      onChange={(e) =>
                        setLineEdits((prev) => ({
                          ...prev,
                          [line.id]: {
                            cases: prev[line.id]?.cases ?? String(line.expected_cases),
                            weight: prev[line.id]?.weight ?? String(line.total_billed_weight_lbs),
                            unit_type: prev[line.id]?.unit_type,
                            price: e.target.value,
                          },
                        }))
                      }
                      placeholder={String(priceMap[line.product_id] ?? productMap[line.product_id]?.default_price_per_lb ?? "")}
                      title="Price per lb or per case/packet for this line"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        const current = lineEdits[line.id] ?? {
                          cases: String(line.expected_cases),
                          weight: String(line.total_billed_weight_lbs),
                          unit_type: lineUnitType,
                          price: defaultPriceForLine({ product_id: line.product_id, price_per_lb_override: linePriceOverride }),
                          perBox: perCaseWeights ?? "",
                        };
                        const casesNum = parseInt(current.cases, 10) || 0;
                        const weightStr = current.weight.trim();
                        if (casesNum <= 0 || !weightStr) {
                          setError("Enter qty and weight to update this line.");
                          return;
                        }
                        const priceVal = current.price?.trim() ? parseFloat(current.price) : null;
                        let body: {
                          lineId: number;
                          expected_cases: number;
                          unit_type: string;
                          total_billed_weight_lbs: string;
                          price_per_lb_override: number | null;
                          case_weights?: number[];
                          box_allocations?: { barcode_id: string; weight_lbs: number }[];
                        } = {
                          lineId: line.id,
                          expected_cases: casesNum,
                          unit_type: current.unit_type ?? lineUnitType,
                          total_billed_weight_lbs: weightStr,
                          price_per_lb_override: priceVal != null && !Number.isNaN(priceVal) ? priceVal : null,
                        };
                        if (current.perBox && current.perBox.trim()) {
                          const parts = current.perBox.split(",").map((s) => s.trim()).filter(Boolean);
                          const weights = parts
                            .map((s) => parseFloat(s))
                            .filter((n) => Number.isFinite(n) && n > 0);
                          if (weights.length > 0) {
                            body = {
                              ...body,
                              case_weights: weights,
                              total_billed_weight_lbs: weights.reduce((acc, n) => acc + n, 0).toFixed(2),
                            };
                          }
                        }
                        if (current.boxPicks && current.boxPicks.length > 0) {
                          const picks = current.boxPicks
                            .map((p) => ({ barcode_id: p.barcode_id, weight_lbs: parseFloat(p.weight_lbs) || 0 }))
                            .filter((p) => p.weight_lbs > 0);
                          if (picks.length > 0) {
                            body = {
                              ...body,
                              box_allocations: picks,
                              total_billed_weight_lbs: picks.reduce((s, p) => s + p.weight_lbs, 0).toFixed(2),
                            };
                          }
                        }
                        updateLine.mutate(body);
                      }}
                      disabled={updateLine.isPending}
                    >
                      {updateLine.isPending ? "Saving…" : "Save"}
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
