"use client";

import { useRouter } from "next/navigation";

import Link from "next/link";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, endpoints, type Customer, type Invoice, type InventoryItem, type Product, type SalesOrder } from "@/lib/api";
import { CatchWeightDisplay } from "@/components/catch-weight-display";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import { orderStatusLabel } from "@/lib/utils/status-labels";
import { downloadInvoicePdf, getInvoicePdfBlobUrl } from "@/lib/utils/pdf-invoice";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "sales_order", label: "Sales order" },
  { value: "invoice", label: "Invoice" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export default function Orders() {
  const router = useRouter();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [previewingId, setPreviewingId] = useState<number | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewPdfError, setPreviewPdfError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["salesOrders"],
    queryFn: () => api.get<SalesOrder[]>(endpoints.salesOrders.list()),
  });
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<Customer[]>(endpoints.customers.list()),
  });
  const { data: inventoryItems } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => api.get<InventoryItem[]>(endpoints.inventory.list()),
  });
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>(endpoints.products.list()),
  });

  const filteredOrders = useMemo(() => {
    const list = orders ?? [];
    const custMap = new Map<number, string>();
    (customers ?? []).forEach((c) => custMap.set(c.id, c.name));
    const searchLower = search.trim().toLowerCase();
    return list.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (!searchLower) return true;
      const invNum = (o.order_number ?? "").toLowerCase();
      const custName = (custMap.get(o.customer_id) ?? "").toLowerCase();
      return invNum.includes(searchLower) || custName.includes(searchLower);
    });
  }, [orders, customers, statusFilter, search]);

  const ordersSummary = useMemo(() => {
    const list = filteredOrders;
    let salesOrderCount = 0;
    let invoiceCount = 0;
    let totalOutstanding = 0;
    list.forEach((o) => {
      if (o.status === "sales_order") salesOrderCount += 1;
      if (o.status === "invoice") {
        invoiceCount += 1;
        const out = parseFloat(String(o.outstanding ?? 0));
        if (Number.isFinite(out)) totalOutstanding += out;
      }
    });
    return { salesOrderCount, invoiceCount, totalOutstanding };
  }, [filteredOrders]);

  const ordersByCustomer = useMemo(() => {
    const list = filteredOrders;
    const custMap = new Map<number, string>();
    (customers ?? []).forEach((c) => custMap.set(c.id, c.name));
    const byCustomer = new Map<number, SalesOrder[]>();
    list.forEach((o) => {
      const id = o.customer_id;
      if (!byCustomer.has(id)) byCustomer.set(id, []);
      byCustomer.get(id)!.push(o);
    });
    const customerIds = Array.from(byCustomer.keys()).sort((a, b) =>
      (custMap.get(a) ?? "").localeCompare(custMap.get(b) ?? "")
    );
    return { byCustomer, customerIds, custMap };
  }, [filteredOrders, customers]);

  const productCaseTotals = useMemo(() => {
    const list = inventoryItems ?? [];
    const map: Record<number, { total: number; allocated: number; available: number }> = {};
    for (const i of list) {
      const c = i.cases ?? 0;
      if (c <= 0) continue;
      const pid = i.product_id;
      if (!map[pid]) map[pid] = { total: 0, allocated: 0, available: 0 };
      map[pid].total += c;
    }
    const orderList = orders ?? [];
    for (const o of orderList) {
      if (o.status === "cancelled") continue;
      for (const line of o.lines ?? []) {
        const pid = line.product_id;
        if (!map[pid]) map[pid] = { total: 0, allocated: 0, available: 0 };
        map[pid].allocated += line.expected_cases ?? 0;
      }
    }
    for (const p of Object.keys(map)) {
      const pid = Number(p);
      map[pid].available = map[pid].total - map[pid].allocated;
    }
    return map;
  }, [inventoryItems, orders]);

  const productMap = useMemo(() => {
    const m: Record<number, Product> = {};
    (products ?? []).forEach((p) => { m[p.id] = p; });
    return m;
  }, [products]);

  const productsShort = useMemo(() => {
    const list: { productId: number; casesShort: number }[] = [];
    Object.entries(productCaseTotals).forEach(([pid, v]) => {
      if (v.available < 0) {
        list.push({ productId: Number(pid), casesShort: -v.available });
      }
    });
    return list.sort((a, b) => b.casesShort - a.casesShort);
  }, [productCaseTotals]);

  const handleDownloadPdf = async (orderId: number) => {
    setDownloadingId(orderId);
    try {
      const inv = await api.get<Invoice>(endpoints.salesOrders.invoice(orderId));
      await downloadInvoicePdf(inv);
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreviewPdf = async (orderId: number) => {
    setPreviewingId(orderId);
    setPreviewPdfError(null);
    try {
      const inv = await api.get<Invoice>(endpoints.salesOrders.invoice(orderId));
      const url = await getInvoicePdfBlobUrl(inv);
      setPreviewInvoice(inv);
      setPreviewPdfUrl(url);
    } catch (e) {
      setPreviewPdfError(e instanceof Error ? e.message : "Failed to generate PDF");
    } finally {
      setPreviewingId(null);
    }
  };

  const handleCreateInvoice = async (orderId: number) => {
    setPreviewingId(orderId);
    setPreviewPdfError(null);
    try {
      const inv = await api.post<Invoice>(endpoints.salesOrders.createInvoice(orderId), {});
      const url = await getInvoicePdfBlobUrl(inv);
      setPreviewInvoice(inv);
      setPreviewPdfUrl(url);
      queryClient.refetchQueries({ queryKey: ["salesOrders"] });
    } catch (e) {
      setPreviewPdfError(e instanceof Error ? e.message : "Failed to generate PDF");
    } finally {
      setPreviewingId(null);
    }
  };

  const closePreviewPdf = () => {
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl);
      setPreviewPdfUrl(null);
    }
    setPreviewInvoice(null);
    setPreviewPdfError(null);
  };

  const deleteOrder = useMutation({
    mutationFn: (orderId: number) => api.delete(endpoints.salesOrders.delete(orderId)),
    onSuccess: () => {
      setDeleteError(null);
      queryClient.refetchQueries({ queryKey: ["salesOrders"] });
    },
    onError: (e: Error) => setDeleteError(e.message),
  });

  const handleDeleteOrder = (order: SalesOrder) => {
    const label = order.order_number ?? `#${order.id}`;
    if (!window.confirm(`Delete sales order ${label}? This will release all inventory back to stock and permanently delete the order. This cannot be undone.`)) return;
    deleteOrder.mutate(order.id);
  };

  if (isLoading) return <div className="loading">Loading orders…</div>;
  if (error) return <div className="error">Failed to load: {(error as Error).message}</div>;

  const { byCustomer, customerIds, custMap } = ordersByCustomer;

  return (
    <>
      {previewPdfError && (
        <div className="error" style={{ marginBottom: "1rem", padding: "0.5rem 1rem" }}>
          PDF: {previewPdfError}
          <button type="button" className="btn" style={{ marginLeft: "0.5rem" }} onClick={() => setPreviewPdfError(null)}>Dismiss</button>
        </div>
      )}
      {previewPdfUrl && previewInvoice && (
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
          aria-label="Invoice PDF preview"
        >
          <div style={{ flex: 1, width: "100%", maxWidth: "900px", display: "flex", flexDirection: "column", margin: "1rem", background: "#fff", borderRadius: "8px", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 1rem", borderBottom: "1px solid #eee" }}>
              <strong>{previewInvoice.order_number ? "Invoice preview" : "Sales order preview"} — {previewInvoice.order_number ?? `Order #${previewInvoice.order_id}`}</strong>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button type="button" className="btn" onClick={() => { closePreviewPdf(); router.push(`/orders/${previewInvoice.order_id}/edit`); }} title="Edit this sales order">Edit</button>
                <button type="button" className="btn primary" onClick={async () => { if (previewInvoice) await downloadInvoicePdf(previewInvoice); }}>Download</button>
                <button type="button" className="btn" onClick={closePreviewPdf}>Close</button>
              </div>
            </div>
            <embed
              key={previewPdfUrl}
              src={previewPdfUrl}
              type="application/pdf"
              style={{ flex: 1, width: "100%", minHeight: "70vh", border: "none" }}
              title={previewInvoice.order_number ? "Invoice PDF" : "Sales order PDF"}
            />
          </div>
        </div>
      )}
      <h1>Sales Orders</h1>
      <p className="weight-label">Sales orders are grouped by customer. Create an invoice from an order to get an invoice number; then preview or download the PDF.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <span style={{ fontWeight: 600 }}>
          Open sales orders: {ordersSummary.salesOrderCount} · Invoices: {ordersSummary.invoiceCount}
          {ordersSummary.totalOutstanding > 0 && (
            <> · Outstanding: {formatMoney(ordersSummary.totalOutstanding.toFixed(2))}</>
          )}
        </span>
        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "0.25rem 0.5rem" }}
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          Search
          <input
            type="search"
            placeholder="Invoice # or customer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "0.25rem 0.5rem", minWidth: "10rem" }}
            aria-label="Search by invoice number or customer name"
          />
        </label>
      </div>
      {deleteError && <p className="error" style={{ marginBottom: "1rem" }}>{deleteError}</p>}
      {productsShort.length > 0 && (
        <div className="error inventory-short-alert" style={{ marginBottom: "1rem", padding: "0.75rem 1rem" }} role="alert">
          <p style={{ margin: "0 0 0.5rem 0" }}>
            <strong>Inventory short</strong> — sales orders need more stock. Order more for:
          </p>
          <ul style={{ margin: "0.25rem 0 0 1.25rem", padding: 0 }}>
            {productsShort.map(({ productId, casesShort }) => (
              <li key={productId}>
                {productMap[productId] ? `${productMap[productId].sku} — ${productMap[productId].name}` : `Product #${productId}`}
                {" "}<strong>({casesShort} case{casesShort === 1 ? "" : "s"} short)</strong>
              </li>
            ))}
          </ul>
          <p style={{ margin: "0.5rem 0 0 0" }}>
            <Link href="/inventory">Go to Inventory</Link> to add stock or view details.
          </p>
        </div>
      )}
      {customerIds.length === 0 && (orders ?? []).length === 0 && (
        <p className="empty-state">No orders yet. Create a sales order from the Invoice page, then create an invoice from it.</p>
      )}
      {customerIds.length === 0 && (orders ?? []).length > 0 && (statusFilter || search.trim()) && (
        <p className="empty-state">No orders match your filters. Try changing Status or Search.</p>
      )}
      {customerIds.map((customerId) => {
        const customerOrders = byCustomer.get(customerId) ?? [];
        const customerName = custMap.get(customerId) ?? `Customer #${customerId}`;
        return (
          <section key={customerId} className="table-section" style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>{customerName}</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>ID</th>
                    <th>Order date</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Outstanding</th>
                    <th>Lines (cases · weight)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customerOrders.map((o) => {
                    const total = o.total_amount != null ? parseFloat(String(o.total_amount)) : NaN;
                    const paid = parseFloat(String(o.amount_paid ?? 0));
                    const outstanding = o.outstanding != null ? parseFloat(String(o.outstanding)) : Number.isFinite(total) ? Math.max(0, total - paid) : NaN;
                    const isPaid = Number.isFinite(outstanding) && outstanding <= 0 && Number.isFinite(total) && total > 0;
                    return (
                    <tr key={o.id}>
                      <td><strong>{o.order_number ?? `#${o.id}`}</strong></td>
                      <td>{o.id}</td>
                      <td>{formatDisplayDate(o.order_date)}</td>
                      <td>{orderStatusLabel(o.status)}</td>
                      <td style={{ textAlign: "right" }}>{o.total_amount != null ? formatMoney(o.total_amount) : "—"}</td>
                      <td style={{ textAlign: "right" }}>{formatMoney(String(o.amount_paid ?? 0))}</td>
                      <td style={{ textAlign: "right", color: isPaid ? "var(--success, #059669)" : Number.isFinite(outstanding) && outstanding > 0 ? "var(--error, #dc2626)" : undefined }}>
                        {o.total_amount != null ? (isPaid ? "Paid" : formatMoney(outstanding.toFixed(2))) : "—"}
                      </td>
                      <td>
                        {o.lines?.length
                          ? o.lines.map((line) => {
                              const expected = line.expected_cases ?? 0;
                              const fulfilled = line.fulfilled_cases ?? 0;
                              const needed = Math.max(0, expected - fulfilled);
                              return (
                                <div key={line.id} className="catch-weight">
                                  <CatchWeightDisplay
                                    cases={expected}
                                    weightLbs={line.total_billed_weight_lbs}
                                    label="Billed weight (lbs)"
                                  />
                                  {expected > 0 ? (
                                    needed > 0
                                      ? ` (${fulfilled} fulfilled, ${needed} needed)`
                                      : ` (${fulfilled} fulfilled)`
                                  ) : null}
                                </div>
                              );
                            })
                          : "—"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn primary"
                          onClick={() => handlePreviewPdf(o.id)}
                          disabled={previewingId === o.id}
                          title="Preview order/invoice PDF"
                        >
                          {previewingId === o.id ? "…" : "Preview"}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          style={{ marginLeft: "0.35rem" }}
                          onClick={() => handleDownloadPdf(o.id)}
                          disabled={downloadingId === o.id}
                          title="Download PDF"
                        >
                          {downloadingId === o.id ? "…" : "Download PDF"}
                        </button>
                        {!o.order_number && (
                          <button
                            type="button"
                            className="btn"
                            style={{ marginLeft: "0.35rem" }}
                            onClick={() => handleCreateInvoice(o.id)}
                            disabled={previewingId === o.id}
                            title="Assign invoice number to this order"
                          >
                            {previewingId === o.id ? "…" : "Create invoice"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn"
                          style={{ marginLeft: "0.35rem" }}
                          onClick={() => router.push(`/orders/${o.id}/edit`)}
                          title="Edit this sales order"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ marginLeft: "0.35rem" }}
                          onClick={() => handleDeleteOrder(o)}
                          disabled={deleteOrder.isPending}
                        >
                          {deleteOrder.isPending && deleteOrder.variables === o.id ? "…" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
}
