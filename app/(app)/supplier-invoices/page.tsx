"use client";

import Link from "next/link";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  endpoints,
  type InventoryItem,
  type PriceChartData,
  type Product,
  type Supplier,
  type SupplierInvoice,
  type SupplierInvoiceLine,
} from "@/lib/api";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";

type UnitType = "catch_weight" | "packet" | "case";

function sumCaseWeights(weights: string[]): string {
  const total = weights.reduce((acc, w) => acc + (parseFloat(w) || 0), 0);
  return total.toFixed(2);
}

type LineRow = {
  product_id: string;
  unit_type: UnitType;
  quantity_cases: string;
  weight_lbs: string;
  case_weights: string[]; // per-case weights for catch_weight; total = sum(case_weights)
  unit_price: string;
};

const today = new Date().toISOString().slice(0, 10);

export default function SupplierInvoices() {
  const queryClient = useQueryClient();
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [totalAmount, setTotalAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [supplierFuelCharge, setSupplierFuelCharge] = useState("");
  const [editInvoiceId, setEditInvoiceId] = useState<number | null>(null);
  const [editInvoiceNumber, setEditInvoiceNumber] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editTotal, setEditTotal] = useState("");
  const [editLinesId, setEditLinesId] = useState<number | null>(null);
  const [lines, setLines] = useState<LineRow[]>([
    { product_id: "", unit_type: "catch_weight", quantity_cases: "0", weight_lbs: "0", case_weights: ["0"], unit_price: "0" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: supplierInvoices, isLoading, error: listError, refetch: refetchInvoices } = useQuery({
    queryKey: ["supplierInvoices"],
    queryFn: () => api.get<SupplierInvoice[]>(endpoints.supplierInvoices.list()),
  });
  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.get<Supplier[]>(endpoints.suppliers.list()),
  });
  const supplierList = suppliers ?? [];
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>(endpoints.products.list()),
  });
  const { data: priceChartData } = useQuery({
    queryKey: ["price-chart"],
    queryFn: () => api.get<PriceChartData>(endpoints.priceChart.get()),
  });
  const { data: inventoryItems } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => api.get<InventoryItem[]>(endpoints.inventory.list()),
  });

  const productMap = useMemo(() => {
    const m: Record<number, Product> = {};
    (products ?? []).forEach((p) => { m[p.id] = p; });
    return m;
  }, [products]);

  const defaultWeightForProduct = (productId: string): string => {
    if (!productId) return "";
    const p = productMap[parseInt(productId, 10)];
    if (!p) return "";
    return (p.species || "").toLowerCase() === "chicken" ? "40" : "";
  };

  /** One weight per in-stock box (duplicates ok). Each dropdown choice removes that weight from later boxes. */
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

  const getCostForProductAndSupplier = (productId: number, supplierId: number): string | null => {
    if (!priceChartData?.products) return null;
    const prod = priceChartData.products.find((p) => p.id === productId);
    if (!prod) return null;
    const fromStored = prod.costs_by_supplier?.find((c) => c.supplier_id === supplierId);
    if (fromStored?.cost_per_lb != null) return fromStored.cost_per_lb;
    const fromInvoice = prod.costs_from_invoices?.find((c) => c.supplier_id === supplierId);
    if (fromInvoice?.cost_per_lb != null) return fromInvoice.cost_per_lb;
    return null;
  };

  useEffect(() => {
    if (!supplierId) return;
    const sid = parseInt(supplierId, 10);
    if (!Number.isFinite(sid)) return;
    setLines((prev) =>
      prev.map((line) => {
        if (!line.product_id) return line;
        const productId = parseInt(line.product_id, 10);
        if (!Number.isFinite(productId)) return line;
        const vendorCost = getCostForProductAndSupplier(productId, sid);
        const p = productMap[productId];
        const costToUse =
          vendorCost ??
          (p?.default_price_per_lb != null && p.default_price_per_lb !== "" ? String(p.default_price_per_lb) : null);
        if (costToUse == null) return line;
        const cost = parseFloat(costToUse);
        return { ...line, unit_price: Number.isFinite(cost) ? cost.toFixed(2) : costToUse };
      })
    );
  }, [supplierId, priceChartData, productMap]);

  const createInvoice = useMutation({
    mutationFn: (body: {
      supplier_id: number;
      invoice_number: string;
      invoice_date: string;
      total_amount: string;
      notes: string | null;
      lines: {
        product_id: number;
        quantity_cases: number;
        weight_lbs: string;
        unit_type: UnitType;
        case_weights?: number[];
        unit_price: string;
        line_total: string;
      }[];
    }) => api.post<SupplierInvoice>(endpoints.supplierInvoices.create(), body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["supplierInvoices"] }),
        queryClient.refetchQueries({ queryKey: ["lots"] }),
        queryClient.refetchQueries({ queryKey: ["inventory"] }),
      ]);
      setSupplierId("");
      setInvoiceNumber("");
      setInvoiceDate(today);
      setTotalAmount("");
      setNotes("");
      setCreditAmount("");
      setSupplierFuelCharge("");
      setLines([{ product_id: "", unit_type: "catch_weight", quantity_cases: "0", weight_lbs: "0", case_weights: ["0"], unit_price: "0" }]);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const replaceInvoiceLines = useMutation({
    mutationFn: (input: {
      id: number;
      lines: {
        product_id: number;
        quantity_cases: number;
        weight_lbs: string;
        unit_type: UnitType;
        case_weights?: number[];
        unit_price: string;
        line_total: string;
      }[];
    }) =>
      api.patch<SupplierInvoice>(endpoints.supplierInvoices.updateLines(input.id), {
        invoice_date: invoiceDate,
        extra_amount: supplierFuelCharge.trim() || undefined,
        lines: input.lines,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["supplierInvoices"] }),
        queryClient.refetchQueries({ queryKey: ["lots"] }),
        queryClient.refetchQueries({ queryKey: ["inventory"] }),
      ]);
      setEditLinesId(null);
      setSupplierId("");
      setInvoiceNumber("");
      setInvoiceDate(today);
      setTotalAmount("");
      setNotes("");
      setLines([{ product_id: "", unit_type: "catch_weight", quantity_cases: "0", weight_lbs: "0", case_weights: ["0"], unit_price: "0" }]);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteInvoice = useMutation({
    mutationFn: (id: number) => api.delete(endpoints.supplierInvoices.delete(id)),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["supplierInvoices"] });
    },
  });

  const updateInvoice = useMutation({
    mutationFn: (input: { id: number; invoice_number?: string; notes?: string | null; total_amount?: string }) =>
      api.patch<SupplierInvoice>(endpoints.supplierInvoices.update(input.id), {
        ...(input.invoice_number !== undefined ? { invoice_number: input.invoice_number } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.total_amount !== undefined ? { total_amount: input.total_amount } : {}),
      }),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["supplierInvoices"] });
      setEditInvoiceId(null);
      setEditInvoiceNumber("");
      setEditNotes("");
      setEditTotal("");
    },
    onError: (e: Error) => setError(e.message),
  });

  const createSupplier = useMutation({
    mutationFn: (body: { name: string }) => api.post<Supplier>(endpoints.suppliers.create(), body),
    onSuccess: async (data) => {
      await queryClient.refetchQueries({ queryKey: ["suppliers"] });
      setSupplierId(String(data.id));
      setNewSupplierName("");
      setSupplierError(null);
    },
    onError: (e: Error) => setSupplierError(e.message),
  });

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    setSupplierError(null);
    const name = newSupplierName.trim();
    if (!name) {
      setSupplierError("Enter a supplier name.");
      return;
    }
    createSupplier.mutate({ name });
  };

  const uploadInvoice = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.upload<SupplierInvoice>(endpoints.supplierInvoices.upload(), form);
    },
    onSuccess: async () => {
      setUploadError(null);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["supplierInvoices"] }),
        queryClient.refetchQueries({ queryKey: ["inventory"] }),
        queryClient.refetchQueries({ queryKey: ["lots"] }),
      ]);
    },
    onError: (e: Error) => setUploadError(e.message),
  });

  const handleFile = (file: File | null) => {
    if (!file) return;
    setUploadError(null);
    const name = (file.name || "").toLowerCase();
    const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";
    const isCsv = name.endsWith(".csv") || file.type === "text/csv" || file.type === "application/csv";
    if (!isPdf && !isCsv) {
      setUploadError("Please drop or choose a PDF or CSV file.");
      return;
    }
    uploadInvoice.mutate(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    handleFile(f ?? null);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { product_id: "", unit_type: "catch_weight", quantity_cases: "0", weight_lbs: "0", case_weights: ["0"], unit_price: "0" },
    ]);
  };
  const removeLine = (i: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateLine = (i: number, field: keyof LineRow, value: string) => {
    setLines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === "quantity_cases" && next[i].unit_type === "catch_weight") {
        const count = Math.max(1, parseInt(value, 10) || 0);
        const defaultW = defaultWeightForProduct(next[i].product_id) || "";
        const prevWeights = next[i].case_weights ?? ["0"];
        const newWeights = prevWeights.slice(0, count).map((w) => ((w === "" || w === "0") && defaultW ? defaultW : w));
        while (newWeights.length < count) {
          newWeights.push(defaultW || prevWeights[prevWeights.length - 1] || "0");
        }
        next[i] = { ...next[i], case_weights: newWeights };
      }
      if (field === "product_id") {
        const productId = parseInt(value, 10);
        const sid = parseInt(supplierId, 10);
        const vendorCost = supplierId && Number.isFinite(sid) ? getCostForProductAndSupplier(productId, sid) : null;
        const p = productMap[productId];
        const costToUse = vendorCost ?? (p?.default_price_per_lb != null && p.default_price_per_lb !== "" ? String(p.default_price_per_lb) : null);
        if (costToUse != null) {
          const cost = parseFloat(costToUse);
          next[i] = { ...next[i], unit_price: Number.isFinite(cost) ? cost.toFixed(2) : costToUse };
        }
        if (next[i].unit_type === "catch_weight") {
          const defaultW = defaultWeightForProduct(value) || "";
          const weights = next[i].case_weights ?? ["0"];
          const filled = weights.map((w) => ((w === "" || w === "0") && defaultW ? defaultW : w));
          next[i] = { ...next[i], case_weights: filled };
        }
      }
      return next;
    });
  };

  const updateLineCaseWeight = (lineIdx: number, caseIdx: number, value: string) => {
    setLines((prev) => {
      const next = [...prev];
      const w = [...(next[lineIdx].case_weights ?? ["0"])];
      w[caseIdx] = value;
      next[lineIdx] = { ...next[lineIdx], case_weights: w };
      return next;
    });
  };


  const updateLineUnitType = (i: number, value: UnitType) => {
    setLines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], unit_type: value };
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const sid = parseInt(supplierId, 10);
    if (Number.isNaN(sid) || !supplierId) {
      setError("Select a supplier.");
      return;
    }
    if (!invoiceNumber.trim()) {
      setError("Enter invoice number.");
      return;
    }
    const invoiceLines = lines
      .filter((l) => l.product_id)
      .map((l) => {
        const qty = parseInt(l.quantity_cases, 10) || 0;
        const unitPrice = parseFloat(l.unit_price) || 0;
        let weight = 0;
        let case_weights: number[] | undefined;
        if (l.unit_type === "catch_weight" && l.case_weights?.length) {
          case_weights = l.case_weights.map((w) => parseFloat(w) || 0);
          weight = case_weights.reduce((a, b) => a + b, 0);
        } else {
          weight = parseFloat(l.weight_lbs) || 0;
        }
        const lineTotal =
          l.unit_type === "catch_weight"
            ? (weight * unitPrice).toFixed(2)
            : (qty * unitPrice).toFixed(2);
        return {
          product_id: parseInt(l.product_id, 10),
          quantity_cases: qty,
          weight_lbs: String(weight),
          unit_type: l.unit_type,
          ...(case_weights != null && { case_weights }),
          unit_price: l.unit_price,
          line_total: lineTotal,
        };
      });
    const baseTotalStr = totalAmount.trim() ? totalAmount : (() => {
      let t = 0;
      invoiceLines.forEach((l) => { t += parseFloat(l.line_total); });
      return t.toFixed(2);
    })();
    let totalNum = parseFloat(baseTotalStr) || 0;
    const fuelNum = supplierFuelCharge.trim() ? parseFloat(supplierFuelCharge) || 0 : 0;
    if (fuelNum) totalNum += fuelNum;
    const total = totalNum.toFixed(2);
    const creditNote = creditAmount.trim()
      ? `Credit from supplier: $${parseFloat(creditAmount).toFixed(2)}`
      : "";
    const fuelNote = supplierFuelCharge.trim()
      ? `Fuel charge from supplier: $${parseFloat(supplierFuelCharge).toFixed(2)}`
      : "";
    const combinedNotes =
      [notes.trim(), creditNote, fuelNote].filter(Boolean).join(" · ") || null;

    if (editLinesId != null) {
      // Edit mode: replace lines for existing invoice (and rebuild inventory)
      replaceInvoiceLines.mutate({
        id: editLinesId,
        lines: invoiceLines,
      });
    } else {
      // Create new invoice
      createInvoice.mutate({
        supplier_id: sid,
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        total_amount: total,
        notes: combinedNotes,
        lines: invoiceLines,
      });
    }
  };

  if (isLoading) return <div className="loading">Loading supplier invoices…</div>;
  if (listError) return <div className="error">Failed to load: {(listError as Error).message}</div>;

  return (
    <>
      <h1>Supplier Invoices</h1>
            <p className="weight-label">
        Add supplier invoices (purchase side). Your invoices list below updates when you add, edit, or remove them.
      </p>

      <section
        className="card form-card"
        style={{
          marginBottom: "1.5rem",
          border: dragOver ? "2px dashed var(--primary, #0a7ea4)" : "2px dashed #ccc",
          backgroundColor: dragOver ? "rgba(10, 126, 164, 0.06)" : undefined,
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Drop supplier invoice (PDF)</h2>
        <p style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
          Drop a PDF invoice here to create the supplier invoice and update inventory. When configured, Google Gemini (or OpenAI) reads the invoice and fills supplier, number, date, and line items; otherwise heuristic parsing is used. The PDF should have readable text.
        </p>
        <input
          type="file"
          accept=".pdf,application/pdf,.csv,text/csv"
          id="supplier-invoice-file"
          style={{ display: "none" }}
          onChange={(e) => {
            handleFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <label
          htmlFor="supplier-invoice-file"
          style={{
            display: "inline-block",
            padding: "0.75rem 1.25rem",
            background: "var(--bg-secondary, #f5f5f5)",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          {uploadInvoice.isPending ? "Uploading…" : "Choose PDF file"}
        </label>
        {uploadError && <p className="error" style={{ marginTop: "0.5rem" }}>{uploadError}</p>}
        {uploadInvoice.isSuccess && (
          <p style={{ marginTop: "0.5rem", color: "var(--success, green)" }}>Invoice created and inventory updated.</p>
        )}
      </section>

      <section className="card form-card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>New supplier invoice</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label htmlFor="sup-inv-supplier">Supplier *</label>
            <span style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <select
                id="sup-inv-supplier"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
                disabled={suppliersLoading}
              >
                <option value="">
                  {suppliersLoading ? "Loading suppliers…" : supplierList.length === 0 ? "No suppliers yet — add one below" : "— Select supplier —"}
                </option>
                {supplierList.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.9rem" }}>Or add one:</span>
                <form onSubmit={handleAddSupplier} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type="text"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    placeholder="Supplier name"
                    style={{ minWidth: "140px" }}
                  />
                  <button type="submit" className="btn btn-secondary" disabled={createSupplier.isPending}>
                    {createSupplier.isPending ? "Adding…" : "Add supplier"}
                  </button>
                </form>
              </div>
              {supplierError && <span className="error" style={{ fontSize: "0.9rem" }}>{supplierError}</span>}
              {!suppliersLoading && supplierList.length === 0 && (
                <Link href="/suppliers" style={{ fontSize: "0.9rem" }}>Go to Suppliers page</Link>
              )}
            </span>
          </div>
          <div className="form-row">
            <label htmlFor="sup-inv-number">Invoice number *</label>
            <input
              id="sup-inv-number"
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Supplier's reference #"
            />
          </div>
          <div className="form-row">
            <label htmlFor="sup-inv-date">Invoice date *</label>
            <input
              id="sup-inv-date"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label htmlFor="sup-inv-total">Total amount</label>
            <input
              id="sup-inv-total"
              type="text"
              inputMode="decimal"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="Auto from lines if empty"
            />
          </div>
          <div className="form-row">
            <label htmlFor="sup-inv-credit">Credit / discount from supplier ($)</label>
            <input
              id="sup-inv-credit"
              type="text"
              inputMode="decimal"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="form-row">
            <label htmlFor="sup-inv-fuel">Fuel charge from supplier ($)</label>
            <input
              id="sup-inv-fuel"
              type="text"
              inputMode="decimal"
              value={supplierFuelCharge}
              onChange={(e) => setSupplierFuelCharge(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="form-row">
            <label htmlFor="sup-inv-notes">Notes</label>
            <input
              id="sup-inv-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <strong>Lines</strong>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0.25rem 0 0.5rem 0" }}>
              Catch weight: enter weight per case (each case can differ). Chicken species default to 40 lbs per case.
            </p>
            {/* Column headers */}
            <div className="form-row" style={{ alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem", paddingRight: "4rem" }}>
              <span style={{ width: "10rem", fontWeight: 600, fontSize: "0.85rem" }}>Product</span>
              <span style={{ width: "11rem", fontWeight: 600, fontSize: "0.85rem" }}>Unit type</span>
              <span style={{ width: "5rem", fontWeight: 600, fontSize: "0.85rem" }}>Cases / Qty</span>
              <span style={{ minWidth: "8rem", fontWeight: 600, fontSize: "0.85rem" }}>Weight (lbs)</span>
              <span style={{ width: "6rem", fontWeight: 600, fontSize: "0.85rem" }}>Price</span>
            </div>
            {lines.map((line, i) => {
              const casesNum = Math.max(1, parseInt(line.quantity_cases, 10) || 0);
              const weights = line.case_weights ?? ["0"];
              const totalLbs = sumCaseWeights(weights.slice(0, casesNum));
              return (
                <div key={i} style={{ marginBottom: "0.75rem" }}>
                  <div className="form-row" style={{ alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <select
                      value={line.product_id}
                      onChange={(e) => updateLine(i, "product_id", e.target.value)}
                      style={{ width: "10rem" }}
                    >
                      <option value="">— Product —</option>
                      {(products ?? []).map((p) => (
                        <option key={p.id} value={String(p.id)}>{p.sku} – {p.name}</option>
                      ))}
                    </select>
                    <select
                      value={line.unit_type}
                      onChange={(e) => updateLineUnitType(i, e.target.value as UnitType)}
                      style={{ width: "11rem" }}
                      title="Unit type"
                    >
                      <option value="catch_weight">Catch weight (lbs per case)</option>
                      <option value="packet">Packet</option>
                      <option value="case">Case</option>
                    </select>
                    {line.unit_type === "catch_weight" ? (
                      <input
                        type="number"
                        min={1}
                        placeholder="Cases"
                        value={line.quantity_cases}
                        onChange={(e) => updateLine(i, "quantity_cases", e.target.value)}
                        style={{ width: "5rem" }}
                      />
                    ) : (
                      <input
                        type="number"
                        min={0}
                        placeholder={line.unit_type === "packet" ? "Qty" : "Qty"}
                        value={line.quantity_cases}
                        onChange={(e) => updateLine(i, "quantity_cases", e.target.value)}
                        style={{ width: "5rem" }}
                      />
                    )}
                    {line.unit_type === "catch_weight" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                        {Array.from({ length: casesNum }, (_, c) => {
                          const pid = line.product_id ? parseInt(line.product_id, 10) : 0;
                          const pool = availableWeightsByProduct[pid] ?? [];
                          const chosenSoFar = weights.slice(0, c).filter((w) => w !== "" && w !== "0");
                          const options = getRemainingWeightOptions(pool, chosenSoFar);
                          const current = weights[c] ?? "";
                          return (
                            <span key={c} style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                              <label htmlFor={`line-${i}-case-${c}`} style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>C{c + 1}</label>
                              <select
                                value={current && options.includes(current) ? current : ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v) updateLineCaseWeight(i, c, v);
                                }}
                                title={`Box ${c + 1}: chosen in previous: ${chosenSoFar.join(", ") || "none"}`}
                                style={{ fontSize: "0.8rem", padding: "0.15rem 0.3rem", width: "4rem" }}
                              >
                                <option value="">—</option>
                                {options.map((w) => (
                                  <option key={w} value={w}>{w}</option>
                                ))}
                              </select>
                              <input
                                id={`line-${i}-case-${c}`}
                                type="text"
                                inputMode="decimal"
                                value={current && !options.includes(current) ? current : ""}
                                onChange={(e) => updateLineCaseWeight(i, c, e.target.value)}
                                placeholder="or type"
                                style={{ width: "3rem" }}
                              />
                            </span>
                          );
                        })}
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, marginLeft: "0.25rem" }}>Total: {totalLbs} lbs</span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Weight (lbs)"
                        value={line.weight_lbs}
                        onChange={(e) => updateLine(i, "weight_lbs", e.target.value)}
                        style={{ width: "6rem" }}
                        title="Weight (lbs) – optional for packet/case"
                      />
                    )}
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={line.unit_price}
                      onChange={(e) => updateLine(i, "unit_price", e.target.value)}
                      style={{ width: "6rem" }}
                      title={line.unit_type === "catch_weight" ? "Price per lb" : line.unit_type === "packet" ? "Price per packet" : "Price per case"}
                    />
                    {lines.length > 1 && (
                      <button type="button" onClick={() => removeLine(i)} className="btn btn-secondary">Remove</button>
                    )}
                  </div>
                </div>
              );
            })}
            <button type="button" onClick={addLine} className="btn btn-secondary" style={{ marginTop: "0.5rem" }}>
              Add line
            </button>
          </div>
          {error && <p className="error" style={{ marginTop: "0.5rem" }}>{error}</p>}
          <button type="submit" className="btn" style={{ marginTop: "1rem" }} disabled={createInvoice.isPending}>
            {createInvoice.isPending ? "Adding…" : "Add supplier invoice"}
          </button>
        </form>
      </section>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Your supplier invoices</h2>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => refetchInvoices()}
          disabled={isLoading}
        >
          {isLoading ? "Loading…" : "Refresh list"}
        </button>
      </div>
      {listError && (
        <p className="error" style={{ marginBottom: "0.5rem" }}>
          Could not load invoices: {(listError as Error).message}
        </p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Supplier</th>
              <th>Date</th>
              <th>Total</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(supplierInvoices ?? []).map((inv) => (
              <tr key={inv.id}>
                <td>
                  {editInvoiceId === inv.id ? (
                    <input
                      type="text"
                      value={editInvoiceNumber}
                      onChange={(e) => setEditInvoiceNumber(e.target.value)}
                      style={{ width: "8rem" }}
                    />
                  ) : (
                    <span>{inv.invoice_number}</span>
                  )}
                </td>
                <td>{inv.supplier_name}</td>
                <td>{formatDisplayDate(inv.invoice_date)}</td>
                <td>
                  {editInvoiceId === inv.id ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editTotal}
                      onChange={(e) => setEditTotal(e.target.value)}
                      style={{ width: "6rem" }}
                    />
                  ) : (
                    <span>{formatMoney(inv.total_amount)}</span>
                  )}
                </td>
                <td>
                  {editInvoiceId === inv.id ? (
                    <input
                      type="text"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      style={{ width: "12rem" }}
                    />
                  ) : (
                    <span>{inv.notes}</span>
                  )}
                </td>
                <td>
                  {editInvoiceId === inv.id ? (
                    <>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => {
                          const trimmedTotal = editTotal.trim();
                          updateInvoice.mutate({
                            id: inv.id,
                            invoice_number: editInvoiceNumber.trim() || inv.invoice_number,
                            notes: editNotes.trim(),
                            ...(trimmedTotal ? { total_amount: trimmedTotal } : {}),
                          });
                        }}
                        disabled={updateInvoice.isPending}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setEditInvoiceId(null);
                          setEditInvoiceNumber("");
                          setEditNotes("");
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setEditInvoiceId(inv.id);
                          setEditInvoiceNumber(inv.invoice_number ?? "");
                          setEditNotes(inv.notes ?? "");
                          setEditTotal(String(inv.total_amount ?? ""));
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ marginLeft: "0.5rem" }}
                        onClick={() => {
                          // Load this invoice's lines into the form for editing
                          setEditLinesId(inv.id);
                          setSupplierId(String(inv.supplier_id));
                          setInvoiceNumber(inv.invoice_number ?? "");
                          setInvoiceDate(inv.invoice_date);
                          setTotalAmount(String(inv.total_amount ?? ""));
                          setNotes(inv.notes ?? "");
                          const mappedLines: LineRow[] = (inv.lines as SupplierInvoiceLine[]).map((ln) => ({
                            product_id: String(ln.product_id),
                            unit_type: (ln.unit_type as UnitType) ?? "catch_weight",
                            quantity_cases: String(ln.quantity_cases ?? 0),
                            weight_lbs: String(ln.weight_lbs ?? ""),
                            case_weights: (ln.case_weights ?? []).map((w) => String(w)),
                            unit_price: String(ln.unit_price ?? ""),
                          }));
                          setLines(mappedLines.length > 0 ? mappedLines : [
                            { product_id: "", unit_type: "catch_weight", quantity_cases: "0", weight_lbs: "0", case_weights: ["0"], unit_price: "0" },
                          ]);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Edit lines
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => deleteInvoice.mutate(inv.id)}
                        disabled={deleteInvoice.isPending}
                        style={{ marginLeft: "0.5rem" }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(!supplierInvoices || supplierInvoices.length === 0) && (
        <p style={{ color: "var(--muted)" }}>No supplier invoices yet. Add one above.</p>
      )}
    </>
  );
}
