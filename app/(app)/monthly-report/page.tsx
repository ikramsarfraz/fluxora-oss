"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, endpoints, type MonthlyReport } from "@/lib/api";
import { formatMoney } from "@/lib/utils/currency";
import { downloadMonthlyReportPdf, getMonthlyReportPdfBlobUrl } from "@/lib/utils/pdf-monthly-report";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    fleet_maintenance: "Fleet maintenance",
    gas: "Gas",
    rent: "Rent",
    insurance: "Insurance",
    utilities: "Utilities",
    supplies: "Supplies",
    other: "Other",
  };
  return map[category] ?? category;
}

function paymentMethodLabel(method: string | null): string {
  if (!method) return "—";
  const map: Record<string, string> = {
    cash: "Cash",
    zelle: "Zelle",
    check: "Check",
    credit_card: "Credit card",
  };
  return map[method] ?? method;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MonthlyReport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: report, isLoading, error } = useQuery({
    queryKey: ["monthly-report", year, month],
    queryFn: () => api.get<MonthlyReport>(endpoints.monthlyReport.get(year, month)),
  });

  const yearOptions = Array.from({ length: 11 }, (_, i) => now.getFullYear() - 5 + i);

  // Revoke the blob URL when it changes or the component unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Switching month/year invalidates the current preview (it was generated
  // for a different report). Clear it via the event handlers rather than a
  // syncing effect to avoid cascading renders.
  const clearPreview = () => {
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handleMonthChange = (next: number) => {
    if (next === month) return;
    clearPreview();
    setMonth(next);
  };
  const handleYearChange = (next: number) => {
    if (next === year) return;
    clearPreview();
    setYear(next);
  };

  const openPreview = () => {
    if (!report) return;
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return getMonthlyReportPdfBlobUrl(report);
    });
  };
  const closePreview = () => {
    clearPreview();
  };

  return (
    <>
      <h1>Monthly Report</h1>
      <p className="report-intro">
        View expenses, sales (customer invoices), and purchases (supplier invoices) for any month.
      </p>

      <section className="card form-card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Select month</h2>
        <div className="form-row" style={{ flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
          <div className="form-group">
            <label htmlFor="report-month">Month</label>
            <select
              id="report-month"
              value={month}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
            >
              {MONTHS.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="report-year">Year</label>
            <select
              id="report-year"
              value={year}
              onChange={(e) => handleYearChange(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {isLoading && <p className="loading">Loading report…</p>}
      {error && (
        <div className="error" role="alert">
          Could not load report: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && report && (
        <div className="monthly-report">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            <p style={{ fontWeight: 600, margin: 0 }}>
              Report for {MONTHS[report.month - 1]} {report.year}
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openPreview}
            >
              Preview
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => downloadMonthlyReportPdf(report)}
            >
              Download (PDF)
            </button>
          </div>
          {previewUrl && (
            <section className="card report-preview-wrap" style={{ marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span className="report-section-title" style={{ margin: 0 }}>Report preview</span>
                <button type="button" className="btn btn-secondary" onClick={closePreview}>
                  Close preview
                </button>
              </div>
              <iframe
                title="Monthly report preview"
                src={previewUrl}
                style={{ width: "100%", height: "70vh", minHeight: "400px", border: "1px solid #e2e8f0", borderRadius: "4px" }}
              />
            </section>
          )}

          <section className="card report-section" style={{ marginBottom: "1.25rem" }}>
            <h2 className="report-section-title">Expenses</h2>
            <p className="report-total">
              Total: <strong>{formatMoney(report.expenses.total_amount)}</strong>
              {" "}({report.expenses.count} entr{report.expenses.count === 1 ? "y" : "ies"})
            </p>
            {report.expenses.by_category.length > 0 && (
              <div className="table-wrap" style={{ marginBottom: "1rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                      <th style={{ textAlign: "right" }}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.expenses.by_category.map((row) => (
                      <tr key={row.category}>
                        <td>{categoryLabel(row.category)}</td>
                        <td style={{ textAlign: "right" }}>{formatMoney(row.total_amount)}</td>
                        <td style={{ textAlign: "right" }}>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>All expenses (detail)</h3>
            {report.expenses.detail.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                      <th>Note</th>
                      <th>Payment method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.expenses.detail.map((row, i) => (
                      <tr key={`${row.expense_date}-${row.category}-${i}`}>
                        <td>{formatDate(row.expense_date)}</td>
                        <td>{categoryLabel(row.category)}</td>
                        <td style={{ textAlign: "right" }}>{formatMoney(row.amount)}</td>
                        <td>{row.note ?? "—"}</td>
                        <td>{paymentMethodLabel(row.payment_method)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No expenses recorded for this month.</p>
            )}
          </section>

          <section className="card report-section" style={{ marginBottom: "1.25rem" }}>
            <h2 className="report-section-title">Sales</h2>
            <p className="report-total">
              Total revenue: <strong>{formatMoney(report.sales.total_revenue)}</strong>
              {" "}({report.sales.count} invoice{report.sales.count === 1 ? "" : "s"})
            </p>
            {report.sales.detail.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                      <th style={{ textAlign: "right" }}>Amount paid</th>
                      <th>Payment method</th>
                      <th>Check #</th>
                      <th>Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.sales.detail.map((row) => (
                      <tr key={row.order_id}>
                        <td>{row.order_number ?? `#${row.order_id}`}</td>
                        <td>{formatDate(row.order_date)}</td>
                        <td>{row.customer_name}</td>
                        <td style={{ textAlign: "right" }}>{formatMoney(row.total_amount)}</td>
                        <td style={{ textAlign: "right" }}>{formatMoney(row.amount_paid)}</td>
                        <td>{paymentMethodLabel(row.payment_method)}</td>
                        <td>{row.check_number ?? "—"}</td>
                        <td>{row.paid ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No customer invoices in this month.</p>
            )}
          </section>

          <section className="card report-section" style={{ marginBottom: "1.25rem" }}>
            <h2 className="report-section-title">Purchases</h2>
            <p className="report-total">
              Total: <strong>{formatMoney(report.purchases.total_amount)}</strong>
              {" "}({report.purchases.count} supplier invoice{report.purchases.count === 1 ? "" : "s"})
            </p>
            {report.purchases.detail.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      <th>Invoice #</th>
                      <th>Date</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                      <th style={{ textAlign: "right" }}>Amount paid</th>
                      <th>Payment method</th>
                      <th style={{ textAlign: "right" }}>Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.purchases.detail.map((row) => (
                      <tr key={row.invoice_id}>
                        <td>{row.supplier_name}</td>
                        <td>{row.invoice_number}</td>
                        <td>{formatDate(row.invoice_date)}</td>
                        <td style={{ textAlign: "right" }}>{formatMoney(row.total_amount)}</td>
                        <td style={{ textAlign: "right" }}>{formatMoney(row.amount_paid)}</td>
                        <td>{paymentMethodLabel(row.payment_method)}</td>
                        <td style={{ textAlign: "right" }}>{formatMoney(row.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No supplier invoices in this month.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
