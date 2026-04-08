"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  endpoints,
  type Customer,
  type CustomerPrice,
  type Invoice,
  type Product,
  type SalesOrder,
  type InventoryItem,
} from "@/lib/api";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import { downloadInvoicePdf, getInvoicePdfBlobUrl } from "@/lib/utils/pdf-invoice";

type UnitType = "catch_weight" | "packet" | "case";
type LineRow = {
  product_id: string;
  unit_type: UnitType;
  expected_cases: string;
  case_weights: string[];
  per_unit_weight_lbs: string; // weight per case/packet
  price_per_lb: string; // $/lb or $/case/packet; empty = use customer/default
  useBoxPicks?: boolean;
  boxPicks?: { barcode_id: string; weight_lbs: string }[];
};

const today = new Date().toISOString().slice(0, 10);
function nextDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
const defaultDueDate = nextDay(today);

function sumCaseWeights(case_weights: string[]): string {
  const total = case_weights.reduce((acc, w) => acc + (parseFloat(w) || 0), 0);
  return total.toFixed(2);
}

export default function Invoice() {
  const queryClient = useQueryClient();
  const draftKey = "invoiceDraftV1";
  const [customerId, setCustomerId] = useState("");
  const [orderDate, setOrderDate] = useState(today);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [adjustmentKind, setAdjustmentKind] = useState<"" | "discount" | "credit">("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [creditType, setCreditType] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [addFuelSurcharge, setAddFuelSurcharge] = useState(true);
  const [lines, setLines] = useState<LineRow[]>([
    { product_id: "", unit_type: "catch_weight", expected_cases: "", case_weights: ["0"], per_unit_weight_lbs: "", price_per_lb: "", useBoxPicks: false, boxPicks: [] },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfLoading, setPreviewPdfLoading] = useState(false);
  const [previewPdfError, setPreviewPdfError] = useState<string | null>(null);

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<Customer[]>(endpoints.customers.list()),
  });
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>(endpoints.products.list()),
  });
  const { data: inventoryItems } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => api.get<InventoryItem[]>(endpoints.inventory.list()),
  });
  const { data: customerPrices } = useQuery({
    queryKey: ["customerPrices", customerId],
    queryFn: () => api.get<CustomerPrice[]>(endpoints.customers.prices(parseInt(customerId, 10))),
    enabled: !!customerId,
  });
  const { data: createdInvoice } = useQuery({
    queryKey: ["invoice", createdOrderId],
    queryFn: () => api.get<Invoice>(endpoints.salesOrders.invoice(createdOrderId!)),
    enabled: createdOrderId != null,
  });

  // --- Draft auto-save: load on mount, save on changes ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        customerId?: string;
        orderDate?: string;
        dueDate?: string;
        adjustmentKind?: "" | "discount" | "credit";
        discountAmount?: string;
        creditType?: string;
        creditAmount?: string;
        addFuelSurcharge?: boolean;
        lines?: LineRow[];
      };
      if (!createdOrderId) {
        if (draft.customerId) setCustomerId(draft.customerId);
        if (draft.orderDate) setOrderDate(draft.orderDate);
        if (draft.dueDate) setDueDate(draft.dueDate);
        if (draft.adjustmentKind !== undefined) setAdjustmentKind(draft.adjustmentKind);
        if (draft.discountAmount !== undefined) setDiscountAmount(draft.discountAmount);
        if (draft.creditType !== undefined) setCreditType(draft.creditType);
        if (draft.creditAmount !== undefined) setCreditAmount(draft.creditAmount);
        if (draft.addFuelSurcharge !== undefined) setAddFuelSurcharge(draft.addFuelSurcharge);
        if (draft.lines && draft.lines.length > 0) setLines(draft.lines);
      }
    } catch {
      // ignore bad drafts
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      customerId,
      orderDate,
      dueDate,
      adjustmentKind,
      discountAmount,
      creditType,
      creditAmount,
      addFuelSurcharge,
      lines,
    };
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(payload));
    } catch {
      // ignore quota errors
    }
  }, [customerId, orderDate, dueDate, adjustmentKind, discountAmount, creditType, creditAmount, addFuelSurcharge, lines]);

  const createOrder = useMutation({
    mutationFn: (body: {
      customer_id: number;
      order_date: string;
      due_date?: string;
      status: string;
      discount_amount?: number;
      credit_type?: string | null;
      credit_amount?: number;
      add_fuel_surcharge?: boolean;
      lines: {
        product_id: number;
        expected_cases: number;
        unit_type?: string;
        total_billed_weight_lbs: string;
        case_weights?: number[];
        box_allocations?: { barcode_id: string; weight_lbs: number }[];
      }[];
    }) => api.post<SalesOrder>(endpoints.salesOrders.create(), body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["salesOrders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setCreatedOrderId(data.id);
      setCustomerId("");
      setOrderDate(today);
      setDueDate(nextDay(today));
      setAdjustmentKind("");
      setDiscountAmount("");
      setCreditType("");
      setCreditAmount("");
      setAddFuelSurcharge(true);
      setLines([{ product_id: "", unit_type: "catch_weight", expected_cases: "", case_weights: ["0"], per_unit_weight_lbs: "", price_per_lb: "", useBoxPicks: false, boxPicks: [] }]);
      setError(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(draftKey);
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  const createInvoiceFromOrder = useMutation({
    mutationFn: (orderId: number) => api.post<Invoice>(endpoints.salesOrders.createInvoice(orderId), {}),
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: ["invoice", orderId] });
      queryClient.invalidateQueries({ queryKey: ["salesOrders"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const priceMap = useMemo(() => {
    const m: Record<number, number> = {};
    (customerPrices ?? []).forEach((cp) => { m[cp.product_id] = parseFloat(cp.price_per_lb); });
    return m;
  }, [customerPrices]);
  const productMap = useMemo(() => {
    const m: Record<number, Product> = {};
    (products ?? []).forEach((p) => { m[p.id] = p; });
    return m;
  }, [products]);

  /** For catch weight: one weight per in-stock box (duplicates ok). Used so each dropdown choice removes that weight from later boxes. */
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

  /** Remaining weights for box index c: pool minus weights already chosen for boxes 0..c-1. Returns unique options for dropdown. */
  const getRemainingWeightOptions = (pool: string[], chosenSoFar: string[]): string[] => {
    const remaining = pool.slice();
    for (const w of chosenSoFar) {
      const idx = remaining.indexOf(w);
      if (idx >= 0) remaining.splice(idx, 1);
    }
    return [...new Set(remaining)].sort((a, b) => parseFloat(a) - parseFloat(b));
  };

  /** In-stock boxes per product for "specify boxes" picker. */
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

  const defaultPriceForProduct = (pid: number): number => {
    return priceMap[pid] ?? (productMap[pid] ? parseFloat(productMap[pid].default_price_per_lb) : 0);
  };

  const selectedCustomer = useMemo(
    () => (customers ?? []).find((c) => String(c.id) === customerId),
    [customers, customerId]
  );
  const customerFuelSurcharge = selectedCustomer?.fuel_surcharge_amount != null && selectedCustomer.fuel_surcharge_amount !== ""
    ? parseFloat(selectedCustomer.fuel_surcharge_amount)
    : 0;
  const hasFuelSurcharge = Number.isFinite(customerFuelSurcharge) && customerFuelSurcharge > 0;

  const previewTotal = useMemo(() => {
    let total = 0;
    lines.forEach((line) => {
      if (!line.product_id) return;
      const pid = parseInt(line.product_id, 10);
      const priceRaw = line.price_per_lb.trim() ? parseFloat(line.price_per_lb) : defaultPriceForProduct(pid);
      const price = Number.isNaN(priceRaw) ? defaultPriceForProduct(pid) : priceRaw;
      if (line.unit_type === "packet" || line.unit_type === "case") {
        const qty = parseInt(line.expected_cases, 10) || 0;
        total += qty * price;
      } else {
        let weight = 0;
        if (line.unit_type === "catch_weight") {
          if (line.useBoxPicks && line.boxPicks?.length) {
            weight = (line.boxPicks ?? []).reduce((s, p) => s + (parseFloat(p.weight_lbs) || 0), 0);
          } else {
            weight = parseFloat(sumCaseWeights(line.case_weights)) || 0;
          }
        }
        total += weight * price;
      }
    });
    if (addFuelSurcharge && hasFuelSurcharge) {
      total += customerFuelSurcharge;
    }
    return total.toFixed(2);
  }, [lines, priceMap, productMap, addFuelSurcharge, hasFuelSurcharge, customerFuelSurcharge]);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { product_id: "", unit_type: "catch_weight", expected_cases: "", case_weights: ["0"], per_unit_weight_lbs: "", price_per_lb: "", useBoxPicks: false, boxPicks: [] },
    ]);
  };
  const setLineBoxPicks = (lineIdx: number, useBoxPicks: boolean, boxPicks: { barcode_id: string; weight_lbs: string }[]) => {
    setLines((prev) => {
      const next = [...prev];
      next[lineIdx] = { ...next[lineIdx], useBoxPicks, boxPicks };
      return next;
    });
  };
  const setLineBoxPick = (lineIdx: number, pickIdx: number, field: "barcode_id" | "weight_lbs", value: string) => {
    setLines((prev) => {
      const next = [...prev];
      const row = next[lineIdx];
      const picks = [...(row.boxPicks ?? [])];
      if (!picks[pickIdx]) picks[pickIdx] = { barcode_id: "", weight_lbs: "" };
      picks[pickIdx] = { ...picks[pickIdx], [field]: value };
      next[lineIdx] = { ...row, boxPicks: picks };
      return next;
    });
  };
  const removeLine = (i: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  };
  const defaultWeightForProduct = (productId: string): string => {
    if (!productId) return "0";
    const pid = parseInt(productId, 10);
    const inv = (inventoryItems ?? []).find((it) => it.product_id === pid && it.status === "in_stock");
    if (inv) {
      const per = (parseFloat(inv.exact_weight_lbs) || 0) / (inv.cases || 1);
      if (per > 0) return per.toFixed(2);
    }
    const product = productMap[pid];
    return product?.species === "Chicken" ? "40" : "0";
  };

  const updateLine = (i: number, field: keyof LineRow, value: string | string[]) => {
    setLines((prev) => {
      const next = [...prev];
      if (field === "expected_cases") {
        const cases = Math.max(0, parseInt(String(value), 10) || 0);
        const prevWeights = next[i].case_weights;
        const defaultW = defaultWeightForProduct(next[i].product_id);
        const newWeights: string[] = [];
        for (let c = 0; c < Math.max(1, cases); c++) {
          newWeights.push(prevWeights[c] ?? defaultW);
        }
        next[i] = { ...next[i], expected_cases: String(value), case_weights: newWeights };
      } else if (field === "product_id" && typeof value === "string") {
        const defaultW = defaultWeightForProduct(value);
        const len = Math.max(1, next[i].case_weights?.length ?? 1);
        const pid = parseInt(value, 10);
        const defaultP = value ? String(defaultPriceForProduct(pid)) : "";
        next[i] = {
          ...next[i],
          product_id: value,
          case_weights: Array.from({ length: len }, () => defaultW),
          per_unit_weight_lbs: defaultW,
          price_per_lb: defaultP,
        };
      } else if (field === "case_weights" && Array.isArray(value)) {
        next[i] = { ...next[i], case_weights: value };
      } else if (field === "unit_type" && typeof value === "string") {
        next[i] = { ...next[i], unit_type: value as UnitType };
      } else if (typeof value === "string") {
        next[i] = { ...next[i], [field]: value };
      }
      return next;
    });
  };
  const setCaseWeight = (lineIdx: number, caseIdx: number, value: string) => {
    setLines((prev) => {
      const next = [...prev];
      const w = [...(next[lineIdx].case_weights || ["0"])];
      w[caseIdx] = value;
      next[lineIdx] = { ...next[lineIdx], case_weights: w };
      return next;
    });
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cid = parseInt(customerId, 10);
    if (Number.isNaN(cid) || !customerId) {
      setError("Select a customer.");
      return;
    }
    const linePayload = lines
      .filter((l) => l.product_id.trim() !== "")
      .map((l) => {
        const priceOverride = l.price_per_lb.trim() ? parseFloat(l.price_per_lb) : undefined;
        if (l.unit_type === "catch_weight" && l.useBoxPicks && l.boxPicks?.length) {
          const picks = l.boxPicks
            .map((p) => ({ barcode_id: p.barcode_id, weight_lbs: parseFloat(p.weight_lbs) || 0 }))
            .filter((p) => p.weight_lbs > 0);
          if (picks.length > 0) {
            const totalLbs = picks.reduce((s, p) => s + p.weight_lbs, 0).toFixed(2);
            return {
              product_id: parseInt(l.product_id, 10),
              expected_cases: 0, // partial box: do not count as ordered cases
              unit_type: l.unit_type,
              total_billed_weight_lbs: totalLbs,
              box_allocations: picks,
              ...(priceOverride != null && !Number.isNaN(priceOverride) ? { price_per_lb_override: priceOverride } : {}),
            };
          }
        }
        const qty = Math.max(1, Math.max(0, parseInt(l.expected_cases, 10) || 0));
        const weights = l.case_weights ?? ["0"];
        const case_weights =
          l.unit_type === "catch_weight"
            ? Array.from({ length: qty }, (_, c) => parseFloat(weights[c]) || 0)
            : undefined;
        let totalLbs: string;
        if (l.unit_type === "catch_weight") {
          totalLbs = sumCaseWeights(weights);
        } else {
          const per = parseFloat(l.per_unit_weight_lbs);
          const total = (qty * (Number.isNaN(per) ? 0 : per)).toFixed(2);
          totalLbs = total;
        }
        return {
          product_id: parseInt(l.product_id, 10),
          expected_cases: qty,
          unit_type: l.unit_type,
          total_billed_weight_lbs: totalLbs,
          case_weights,
          ...(priceOverride != null && !Number.isNaN(priceOverride) ? { price_per_lb_override: priceOverride } : {}),
        };
      });
    if (linePayload.some((l) => Number.isNaN(l.product_id))) {
      setError("Select a product for each line.");
      return;
    }
    const discount = adjustmentKind === "discount" && discountAmount.trim() ? parseFloat(discountAmount) : 0;
    const credit = adjustmentKind === "credit" && creditAmount.trim() ? parseFloat(creditAmount) : 0;
    createOrder.mutate({
      customer_id: cid,
      order_date: orderDate,
      ...(dueDate.trim() ? { due_date: dueDate.trim() } : { due_date: defaultDueDate }),
      status: "sales_order",
      discount_amount: adjustmentKind === "discount" && !Number.isNaN(discount) ? discount : 0,
      credit_type: adjustmentKind === "credit" ? (creditType.trim() || null) : null,
      credit_amount: adjustmentKind === "credit" && !Number.isNaN(credit) ? credit : 0,
      add_fuel_surcharge: addFuelSurcharge,
      lines: linePayload,
    });
  };

  const handlePreviewPdf = async () => {
    if (!createdInvoice) return;
    setPreviewPdfLoading(true);
    setPreviewPdfError(null);
    try {
      const url = await getInvoicePdfBlobUrl(createdInvoice);
      setPreviewPdfUrl(url);
    } catch (e) {
      setPreviewPdfError(e instanceof Error ? e.message : "Failed to generate PDF");
    } finally {
      setPreviewPdfLoading(false);
    }
  };
  const closePreviewPdf = () => {
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl);
      setPreviewPdfUrl(null);
    }
    setPreviewPdfError(null);
  };
  const handleDownloadPdf = async () => {
    if (createdInvoice) await downloadInvoicePdf(createdInvoice);
  };

  return (
    <>
      {previewPdfUrl && createdInvoice && (
        <div
          className="card"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "rgba(0,0,0,0.7)",
            alignItems: "center",
            justifyContent: "center",
          }}
          role="dialog"
          aria-modal="true"
          aria-label={createdInvoice.order_number ? "Invoice preview" : "Sales order preview"}
        >
          <div style={{ flex: 1, width: "100%", maxWidth: "900px", display: "flex", flexDirection: "column", margin: "1rem", background: "#fff", borderRadius: "8px", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 1rem", borderBottom: "1px solid #eee" }}>
              <strong>{createdInvoice.order_number ? "Invoice preview" : "Sales order preview"} — {createdInvoice.order_number ?? `Order #${createdInvoice.order_id}`}</strong>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button type="button" className="btn primary" onClick={() => handleDownloadPdf()}>Download</button>
                <button type="button" className="btn" onClick={closePreviewPdf}>Close</button>
              </div>
            </div>
            <embed
              key={previewPdfUrl}
              src={previewPdfUrl}
              type="application/pdf"
              style={{ flex: 1, width: "100%", minHeight: "70vh", border: "none" }}
              title={createdInvoice.order_number ? "Invoice PDF" : "Sales order PDF"}
            />
          </div>
        </div>
      )}
      <h1>Sales order &amp; invoice</h1>
      <p className="weight-label">Create a sales order first (customer, date, line items with catch weight). Then create an invoice from it to get an invoice number and preview or download the PDF. Chicken items default to 40 lbs per case.</p>

      {createdOrderId != null && createdInvoice && (
        <div className="card form-card" style={{ background: "#dcfce7", marginBottom: "1rem" }}>
          <strong>
            {createdInvoice.order_number
              ? `Invoice created: ${createdInvoice.order_number}`
              : "Sales order created"}
          </strong>
          {" "}— {createdInvoice.customer_name}, {formatDisplayDate(createdInvoice.order_date)}
          {createdInvoice.due_date ? ` · Due: ${formatDisplayDate(createdInvoice.due_date)}` : ""}.
          {!createdInvoice.order_number && (
            <p style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}>Create an invoice to get an invoice number and preview or download the PDF.</p>
          )}
          <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
              <table>
                <thead>
                  <tr>
                  <th>Product</th>
                  <th>Unit</th>
                  <th>Cs / Pkt</th>
                  <th>Weight (lbs)</th>
                  <th>Total (lbs)</th>
                  <th>Rate/lb/cs/pkt</th>
                  <th>Line total</th>
                  </tr>
                </thead>
              <tbody>
                {createdInvoice.lines.map((line) => (
                  <tr key={line.product_id}>
                    <td>{line.product_sku} — {line.product_name}</td>
                    <td>
                      {line.unit_type === "catch_weight"
                        ? "Catch weight (lbs/case)"
                        : line.unit_type === "packet"
                          ? "Packet"
                          : line.unit_type === "case"
                            ? "Case"
                            : "Catch weight"}
                    </td>
                    <td>{line.expected_cases}</td>
                    <td>{line.total_billed_weight_lbs}</td>
                    <td>{formatMoney(line.price_per_lb)}</td>
                    <td>{formatMoney(line.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="totals-card">
            <p style={{ margin: 0 }}>
              {(createdInvoice.subtotal != null && (parseFloat(String(createdInvoice.discount_amount ?? 0)) > 0 || parseFloat(String(createdInvoice.credit_amount ?? 0)) > 0)) ? (
                <>
                  Subtotal: {formatMoney(createdInvoice.subtotal)}
                  {parseFloat(String(createdInvoice.discount_amount ?? 0)) > 0 && <> · Discount: -{formatMoney(createdInvoice.discount_amount)}</>}
                  {parseFloat(String(createdInvoice.credit_amount ?? 0)) > 0 && <> · Credit{createdInvoice.credit_type ? ` (${createdInvoice.credit_type.replace(/_/g, " ")})` : ""}: -{formatMoney(createdInvoice.credit_amount)}</>}
                  {" "}· <strong>Total: {formatMoney(createdInvoice.total_amount)}</strong>
                </>
              ) : (
                <strong>Total: {formatMoney(createdInvoice.total_amount)}</strong>
              )}
            </p>
            {(createdInvoice.cogs_total != null || createdInvoice.gross_profit != null) && (
              <p style={{ marginTop: "0.35rem", marginBottom: 0, fontSize: "0.9rem", color: "var(--muted)" }}>
                COGS: {formatMoney(createdInvoice.cogs_total ?? "0")}
                {createdInvoice.gross_profit != null && <> · Gross profit: {formatMoney(createdInvoice.gross_profit)}</>}
                {createdInvoice.gross_margin_pct != null && createdInvoice.gross_margin_pct !== "" && <> · Margin: {Number(createdInvoice.gross_margin_pct).toFixed(1)}%</>}
              </p>
            )}
          </div>
          <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <button type="button" className="btn primary" onClick={handlePreviewPdf} title="Preview PDF" disabled={previewPdfLoading}>
              {previewPdfLoading ? "Generating…" : "Preview PDF"}
            </button>
            {previewPdfError && <span className="error" style={{ marginLeft: "0.5rem" }}>{previewPdfError}</span>}
            <button type="button" className="btn" onClick={handleDownloadPdf} title="Download PDF">Download PDF</button>
            {!createdInvoice.order_number && (
              <button
                type="button"
                className="btn"
                onClick={() => createInvoiceFromOrder.mutate(createdOrderId)}
                disabled={createInvoiceFromOrder.isPending}
                title="Assign invoice number to this order"
              >
                {createInvoiceFromOrder.isPending ? "Creating…" : "Create invoice (assign number)"}
              </button>
            )}
            <button type="button" className="btn" onClick={() => setCreatedOrderId(null)}>Dismiss</button>
          </div>
        </div>
      )}

      <section className="card form-card" aria-labelledby="invoice-heading">
        <h2 id="invoice-heading" style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>New sales order</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="invoice-customer">Customer *</label>
              <select
                id="invoice-customer"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
              >
                <option value="">Select customer…</option>
                {(customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="invoice-date">Order date *</label>
              <input
                id="invoice-date"
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="invoice-due-date">Due date</label>
              <input
                id="invoice-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                title="Payment due date (shown on invoice)"
              />
            </div>
            <div className="form-group">
              <label htmlFor="invoice-adjustment">Credit or discount</label>
              <select
                id="invoice-adjustment"
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
                <label htmlFor="invoice-discount">Discount amount ($)</label>
                <input
                  id="invoice-discount"
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
            {hasFuelSurcharge && (
              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  id="invoice-add-fuel-surcharge"
                  type="checkbox"
                  checked={addFuelSurcharge}
                  onChange={(e) => setAddFuelSurcharge(e.target.checked)}
                />
                <label htmlFor="invoice-add-fuel-surcharge" style={{ marginBottom: 0 }}>
                  Add fuel surcharge ({formatMoney(String(customerFuelSurcharge))})
                </label>
              </div>
            )}
            {adjustmentKind === "credit" && (
              <>
                <div className="form-group">
                  <label htmlFor="invoice-credit-type">Type of credit</label>
                  <select
                    id="invoice-credit-type"
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
                  <label htmlFor="invoice-credit-amount">Credit amount ($)</label>
                  <input
                    id="invoice-credit-amount"
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

          <div style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <label>Line items</label>
              <button type="button" className="btn" onClick={addLine}>Add line</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Unit</th>
                    <th>Cs / Pkt</th>
                    <th>Weight (lbs)</th>
                    <th>Total (lbs)</th>
                    <th>Price ($/lb or $/cs/pkt)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => {
                    const cases = Math.max(1, parseInt(line.expected_cases, 10) || 0);
                    const weights = line.case_weights ?? ["0"];
                    let totalLbs: string;
                    if (line.unit_type === "catch_weight" && line.useBoxPicks && (line.boxPicks ?? []).length > 0) {
                      totalLbs = (line.boxPicks ?? []).reduce((s, p) => s + (parseFloat(p.weight_lbs) || 0), 0).toFixed(2);
                    } else if (line.unit_type === "catch_weight") {
                      totalLbs = sumCaseWeights(weights);
                    } else {
                      totalLbs = ((cases * (parseFloat(line.per_unit_weight_lbs) || 0)) || 0).toFixed(2);
                    }
                    return (
                      <tr key={i}>
                        <td>
                          <select
                            value={line.product_id}
                            onChange={(e) => updateLine(i, "product_id", e.target.value)}
                          >
                            <option value="">Select product…</option>
                            {(products ?? []).map((p) => (
                              <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            value={line.unit_type}
                            onChange={(e) => updateLine(i, "unit_type", e.target.value)}
                            title="Unit type for this line"
                          >
                            <option value="catch_weight">Catch weight (lbs per case)</option>
                            <option value="packet">Packet</option>
                            <option value="case">Case</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            value={line.expected_cases}
                            onChange={(e) => updateLine(i, "expected_cases", e.target.value)}
                            className="order-input order-input--cases"
                            placeholder={line.unit_type === "catch_weight" ? "Cases" : "Qty"}
                          />
                        </td>
                        <td>
                          {line.unit_type === "catch_weight" ? (
                            <div>
                              {!line.useBoxPicks ? (
                                <div className="order-case-weights" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                                  {Array.from({ length: cases }, (_, c) => {
                                    const pid = parseInt(line.product_id, 10);
                                    const pool = availableWeightsByProduct[pid] ?? [];
                                    const chosenSoFar = weights.slice(0, c).filter((w) => w !== "" && w !== "0");
                                    const options = getRemainingWeightOptions(pool, chosenSoFar);
                                    return (
                                      <span key={c} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                        <label style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>C{c + 1}</label>
                                        <select
                                          value={(weights[c] ?? "") && options.includes(weights[c] ?? "") ? (weights[c] ?? "") : ""}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            if (v) setCaseWeight(i, c, v);
                                          }}
                                          title={`Box ${c + 1}: choose from inventory (chosen in previous boxes: ${chosenSoFar.join(", ") || "none"})`}
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
                                          value={(weights[c] ?? "") && !options.includes(weights[c] ?? "") ? (weights[c] ?? "") : ""}
                                          onChange={(e) => setCaseWeight(i, c, e.target.value)}
                                          placeholder="or type"
                                          className="order-input order-input--weight"
                                          style={{ width: "3.5rem" }}
                                          title="Or enter weight manually"
                                        />
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : null}
                              {line.product_id && (
                                <div style={{ marginTop: "0.35rem", paddingTop: "0.35rem", borderTop: "1px solid #e2e8f0" }}>
                                  <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", fontSize: "0.8rem" }}>
                                    <input
                                      type="checkbox"
                                      checked={!!line.useBoxPicks}
                                      onChange={(e) => {
                                        const use = e.target.checked;
                                        setLineBoxPicks(i, use, use ? [{ barcode_id: "", weight_lbs: "" }] : []);
                                      }}
                                    />
                                    Specify boxes (e.g. 5 lbs from BOX-123, 10 from BOX-456)
                                  </label>
                                  {line.useBoxPicks && (
                                    <div style={{ marginTop: "0.35rem" }}>
                                      {(line.boxPicks ?? []).map((pick, pidx) => (
                                        <div key={pidx} style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                                          <select
                                            value={pick.barcode_id}
                                            onChange={(e) => setLineBoxPick(i, pidx, "barcode_id", e.target.value)}
                                            style={{ fontSize: "0.8rem", padding: "0.15rem 0.3rem", minWidth: "7rem" }}
                                          >
                                            <option value="">Select box…</option>
                                            {(availableBoxesByProduct[parseInt(line.product_id, 10)] ?? []).map((b) => (
                                              <option key={b.barcode_id} value={b.barcode_id}>{b.barcode_id} — {b.exact_weight_lbs.toFixed(2)} lbs</option>
                                            ))}
                                          </select>
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="lbs"
                                            value={pick.weight_lbs}
                                            onChange={(e) => setLineBoxPick(i, pidx, "weight_lbs", e.target.value)}
                                            style={{ width: "3.5rem", fontSize: "0.8rem" }}
                                          />
                                          <button type="button" className="btn" style={{ padding: "0.1rem 0.3rem", fontSize: "0.7rem" }} onClick={() => setLineBoxPicks(i, true, (line.boxPicks ?? []).filter((_, idx) => idx !== pidx))}>Remove</button>
                                        </div>
                                      ))}
                                      <button type="button" className="btn btn-secondary" style={{ fontSize: "0.8rem" }} onClick={() => setLineBoxPicks(i, true, [...(line.boxPicks ?? []), { barcode_id: "", weight_lbs: "" }])}>+ Add box</button>
                                      {(line.boxPicks ?? []).length > 0 && (
                                        <span style={{ marginLeft: "0.35rem", fontWeight: 600, fontSize: "0.8rem" }}>
                                          Total: {(line.boxPicks ?? []).reduce((s, p) => s + (parseFloat(p.weight_lbs) || 0), 0).toFixed(2)} lbs
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={line.per_unit_weight_lbs}
                              onChange={(e) => updateLine(i, "per_unit_weight_lbs", e.target.value)}
                              placeholder={line.unit_type === "packet" ? "Per packet" : "Per case"}
                              className="order-input order-input--weight"
                            />
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {Number.isFinite(parseFloat(totalLbs)) ? parseFloat(totalLbs).toFixed(2) : totalLbs}
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={line.price_per_lb}
                            onChange={(e) => updateLine(i, "price_per_lb", e.target.value)}
                            placeholder={line.product_id ? String(defaultPriceForProduct(parseInt(line.product_id, 10))) : "—"}
                            className="order-input order-input--price"
                            title="Price per lb (catch weight) or per case/packet. Leave as default or enter special price."
                          />
                        </td>
                        <td>
                          <button type="button" className="btn" onClick={() => removeLine(i)} disabled={lines.length <= 1}>Remove</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {customerId && (
              <p style={{ marginTop: "0.5rem", fontWeight: 600 }}>Estimated total: {formatMoney(previewTotal)}</p>
            )}
          </div>

          {error && <div className="error" role="alert">{error}</div>}
          <button type="submit" className="btn primary" disabled={createOrder.isPending} style={{ marginTop: "1rem" }}>
            {createOrder.isPending ? "Creating…" : "Create sales order"}
          </button>
        </form>
      </section>
    </>
  );
}
