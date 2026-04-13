"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  endpoints,
  type Supplier,
  type SupplierPortfolio,
  type SupplierInvoice,
} from "@/lib/api";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return ym;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleString("default", { month: "long", year: "numeric" });
}

const PAYMENT_METHODS = [
  { value: "", label: "—" },
  { value: "cash", label: "Cash" },
  { value: "zelle", label: "Zelle" },
  { value: "check", label: "Check" },
  { value: "credit_card", label: "Credit card" },
] as const;

export default function SupplierProfile() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const supplierId = id ? parseInt(id, 10) : NaN;
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [paymentEdit, setPaymentEdit] = useState<
    Record<
      number,
      { type: "full" | "partial" | ""; amount: string; method: string }
    >
  >({});
  const portfolioLoadedRef = useRef(false);

  const {
    data: supplier,
    isLoading: supplierLoading,
    error: supplierError,
  } = useQuery({
    queryKey: ["supplier", supplierId],
    queryFn: () => api.get<Supplier>(endpoints.suppliers.one(supplierId)),
    enabled: Number.isInteger(supplierId),
  });

  const {
    data: portfolio,
    isLoading: portfolioLoading,
    error: portfolioError,
  } = useQuery({
    queryKey: ["supplierPortfolio", supplierId],
    queryFn: () =>
      api.get<SupplierPortfolio>(endpoints.suppliers.portfolio(supplierId)),
    enabled: Number.isInteger(supplierId),
  });

  const setPayment = useMutation({
    mutationFn: (body: {
      invoiceId: number;
      amount_paid: string;
      payment_method?: string | null;
    }) =>
      api.patch<SupplierInvoice>(
        endpoints.supplierInvoices.update(body.invoiceId),
        {
          amount_paid: body.amount_paid,
          ...(body.payment_method !== undefined && {
            payment_method: body.payment_method || null,
          }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["supplierPortfolio", supplierId],
      });
      queryClient.invalidateQueries({ queryKey: ["supplierInvoices"] });
    },
  });

  useEffect(() => {
    setSelectedMonth("");
  }, [supplierId]);

  useEffect(() => {
    if (!portfolio?.months?.length || portfolioLoadedRef.current) return;
    portfolioLoadedRef.current = true;
    const currentYm = new Date().toISOString().slice(0, 7);
    const hasCurrent = portfolio.months.some(m => m.month === currentYm);
    setSelectedMonth(hasCurrent ? currentYm : portfolio.months[0].month);
  }, [portfolio]);

  if (!Number.isInteger(supplierId)) {
    return (
      <div>
        <h1>Supplier</h1>
        <p className="error">Invalid supplier ID.</p>
        <Link href="/suppliers" className="btn">
          Back to Suppliers
        </Link>
      </div>
    );
  }

  if (supplierLoading || !supplier) {
    return <div className="loading">Loading supplier…</div>;
  }
  if (supplierError) {
    return (
      <div>
        <h1>Supplier</h1>
        <p className="error">
          Failed to load: {(supplierError as Error).message}
        </p>
        <Link href="/suppliers" className="btn">
          Back to Suppliers
        </Link>
      </div>
    );
  }

  const monthsToShow = selectedMonth
    ? (portfolio?.months.filter(m => m.month === selectedMonth) ?? [])
    : (portfolio?.months ?? []);
  const summary = selectedMonth
    ? portfolio?.months.find(m => m.month === selectedMonth)
    : null;
  const displaySpent = summary
    ? summary.total_spent
    : (portfolio?.total_spent ?? "0");
  const displayPaid = summary
    ? summary.total_paid
    : (portfolio?.total_paid ?? "0");
  const displayOutstanding = summary
    ? summary.total_outstanding
    : (portfolio?.total_outstanding ?? "0");

  return (
    <>
      <h1>Supplier: {supplier.name}</h1>

      <section className="card form-card" style={{ marginBottom: "1rem" }}>
        <h2
          id="supplier-portfolio-summary"
          style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}
        >
          Spending & payments
        </h2>
        {portfolioLoading && <p className="weight-label">Loading…</p>}
        {portfolioError && (
          <p className="error" role="alert">
            Could not load portfolio.
          </p>
        )}
        {!portfolioLoading && !portfolioError && portfolio && (
          <>
            <div className="form-group" style={{ marginBottom: "0.75rem" }}>
              <label htmlFor="supplier-month">Month / Year</label>
              <select
                id="supplier-month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                style={{ minWidth: "180px" }}
              >
                <option value="">All time</option>
                {portfolio.months.map(m => (
                  <option key={m.month} value={m.month}>
                    {formatMonthLabel(m.month)}
                  </option>
                ))}
              </select>
            </div>
            <p style={{ fontWeight: 600, margin: 0 }}>
              Total spent: {formatMoney(displaySpent)} · Paid:{" "}
              {formatMoney(displayPaid)} · Outstanding:{" "}
              {formatMoney(displayOutstanding)}
            </p>
          </>
        )}
      </section>

      <section
        className="table-section"
        aria-labelledby="supplier-invoices-heading"
      >
        <h2
          id="supplier-invoices-heading"
          style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}
        >
          Invoices by month
        </h2>
        {portfolioLoading && <p className="weight-label">Loading…</p>}
        {portfolioError && (
          <p className="error" role="alert">
            Could not load invoices.
          </p>
        )}
        {!portfolioLoading &&
          !portfolioError &&
          portfolio &&
          portfolio.months.length === 0 && (
            <p className="empty-state">
              No supplier invoices yet for this supplier.
            </p>
          )}
        {!portfolioLoading &&
          !portfolioError &&
          portfolio &&
          portfolio.months.length > 0 &&
          monthsToShow.map(m => (
            <div key={m.month} style={{ marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
                {formatMonthLabel(m.month)}
              </h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Paid</th>
                      <th>Outstanding</th>
                      <th>Payment</th>
                      <th>Payment method</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.invoices.map(inv => (
                      <tr key={inv.invoice_id}>
                        <td>{inv.invoice_number}</td>
                        <td>{formatDisplayDate(inv.invoice_date)}</td>
                        <td>{formatMoney(inv.total_amount)}</td>
                        <td>{formatMoney(inv.amount_paid)}</td>
                        <td>{formatMoney(inv.outstanding)}</td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "0.35rem",
                              alignItems: "center",
                            }}
                          >
                            <select
                              value={paymentEdit[inv.invoice_id]?.type ?? ""}
                              onChange={e => {
                                const v = e.target.value;
                                if (v === "full")
                                  setPaymentEdit(prev => ({
                                    ...prev,
                                    [inv.invoice_id]: {
                                      type: "full",
                                      amount: "",
                                      method:
                                        prev[inv.invoice_id]?.method ??
                                        inv.payment_method ??
                                        "",
                                    },
                                  }));
                                else if (v === "partial")
                                  setPaymentEdit(prev => ({
                                    ...prev,
                                    [inv.invoice_id]: {
                                      type: "partial",
                                      amount: inv.amount_paid || "",
                                      method:
                                        prev[inv.invoice_id]?.method ??
                                        inv.payment_method ??
                                        "",
                                    },
                                  }));
                                else
                                  setPaymentEdit(prev => {
                                    const next = { ...prev };
                                    delete next[inv.invoice_id];
                                    return next;
                                  });
                              }}
                              style={{ minWidth: "8rem" }}
                            >
                              <option value="">Payment…</option>
                              <option value="full">Full payment</option>
                              <option value="partial">Partial</option>
                            </select>
                            {paymentEdit[inv.invoice_id]?.type ===
                              "partial" && (
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Amount paid ($)"
                                value={paymentEdit[inv.invoice_id].amount}
                                onChange={e =>
                                  setPaymentEdit(prev => ({
                                    ...prev,
                                    [inv.invoice_id]: {
                                      ...prev[inv.invoice_id]!,
                                      amount: e.target.value,
                                    },
                                  }))
                                }
                                style={{ width: "7rem" }}
                              />
                            )}
                            {(paymentEdit[inv.invoice_id]?.type === "full" ||
                              paymentEdit[inv.invoice_id]?.type === "partial" ||
                              (paymentEdit[inv.invoice_id]?.method !==
                                undefined &&
                                paymentEdit[inv.invoice_id]?.method !==
                                  (inv.payment_method ?? ""))) && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                disabled={
                                  setPayment.isPending ||
                                  (paymentEdit[inv.invoice_id]?.type ===
                                    "partial" &&
                                    !paymentEdit[inv.invoice_id]?.amount.trim())
                                }
                                onClick={() => {
                                  const edit = paymentEdit[inv.invoice_id];
                                  if (!edit) return;
                                  const amount =
                                    edit.type === "full"
                                      ? inv.total_amount
                                      : edit.type === "partial"
                                        ? edit.amount.trim() || "0"
                                        : inv.amount_paid;
                                  const method =
                                    edit.method && edit.method !== ""
                                      ? edit.method
                                      : null;
                                  setPayment.mutate(
                                    {
                                      invoiceId: inv.invoice_id,
                                      amount_paid: amount,
                                      payment_method: method,
                                    },
                                    {
                                      onSuccess: () =>
                                        setPaymentEdit(prev => {
                                          const next = { ...prev };
                                          delete next[inv.invoice_id];
                                          return next;
                                        }),
                                    },
                                  );
                                }}
                              >
                                {setPayment.isPending ? "…" : "Apply"}
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <select
                            value={
                              paymentEdit[inv.invoice_id]?.method ??
                              inv.payment_method ??
                              ""
                            }
                            onChange={e => {
                              const v = e.target.value;
                              setPaymentEdit(prev => ({
                                ...prev,
                                [inv.invoice_id]: {
                                  type: prev[inv.invoice_id]?.type ?? "",
                                  amount:
                                    prev[inv.invoice_id]?.amount ??
                                    inv.amount_paid ??
                                    "",
                                  method: v,
                                },
                              }));
                            }}
                            style={{ minWidth: "8rem" }}
                          >
                            {PAYMENT_METHODS.map(opt => (
                              <option key={opt.value || "_"} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <Link
                            href="/supplier-invoices"
                            className="btn btn-secondary"
                          >
                            View invoices
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td
                        colSpan={2}
                        style={{ textAlign: "right", fontWeight: 600 }}
                      >
                        Month totals:
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {formatMoney(m.total_spent)}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {formatMoney(m.total_paid)}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {formatMoney(m.total_outstanding)}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
      </section>
    </>
  );
}
