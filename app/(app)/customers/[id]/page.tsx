"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  endpoints,
  type Customer,
  type CustomerPrice,
  type Product,
  type CustomerPortfolio,
  type SalesOrder,
} from "@/lib/api";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import { orderStatusLabel } from "@/lib/utils/status-labels";
import { useCustomer } from "@/hooks/use-customer";

/** Format "YYYY-MM" to "Month YYYY" e.g. "March 2025" */
function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return ym;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleString("default", { month: "long", year: "numeric" });
}

export default function CustomerProfile() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const customerId = id ? parseInt(id, 10) : NaN;
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState("");
  const [pricePerLb, setPricePerLb] = useState("");
  const [fuelSurcharge, setFuelSurcharge] = useState("");
  const [invoicePrefix, setInvoicePrefix] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(""); // "" = All time, "YYYY-MM" = that month
  const [, setPaymentError] = useState<string | null>(null);
  const [paymentEdit, setPaymentEdit] = useState<
    Record<
      number,
      {
        type: "full" | "partial";
        amount: string;
        method: string;
        checkNumber: string;
      }
    >
  >({});
  const portfolioLoadedRef = useRef(false);

  const {
    data: customer,
    isLoading: customerLoading,
    error: customerError,
  } = useCustomer(customerId);

  const { data: prices, isLoading: pricesLoading } = useQuery({
    queryKey: ["customerPrices", customerId],
    queryFn: () =>
      api.get<CustomerPrice[]>(endpoints.customers.prices(customerId)),
    enabled: Number.isInteger(customerId),
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>(endpoints.products.list()),
  });

  const {
    data: portfolio,
    isLoading: portfolioLoading,
    error: portfolioError,
  } = useQuery({
    queryKey: ["customerPortfolio", customerId],
    queryFn: () =>
      api.get<CustomerPortfolio>(endpoints.customers.portfolio(customerId)),
    enabled: Number.isInteger(customerId),
  });

  const setPayment = useMutation({
    mutationFn: (body: {
      orderId: number;
      amount_paid: string;
      payment_method?: string;
      check_number?: string;
    }) =>
      api.patch<SalesOrder>(endpoints.salesOrders.update(body.orderId), {
        amount_paid: body.amount_paid,
        ...(body.payment_method != null && body.payment_method !== ""
          ? { payment_method: body.payment_method }
          : {}),
        ...(body.check_number != null && body.check_number !== ""
          ? { check_number: body.check_number }
          : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["customerPortfolio", customerId],
      });
      setPaymentError(null);
    },
    onError: (e: Error) => setPaymentError(e.message),
  });

  // Reset when switching customers
  useEffect(() => {
    portfolioLoadedRef.current = false;
    setSelectedMonth("");
  }, [customerId]);

  // Default to current month when portfolio first loads (if it has data for current month)
  useEffect(() => {
    if (!portfolio?.months?.length || portfolioLoadedRef.current) return;
    portfolioLoadedRef.current = true;
    const currentYm = new Date().toISOString().slice(0, 7);
    const hasCurrent = portfolio.months.some(m => m.month === currentYm);
    setSelectedMonth(hasCurrent ? currentYm : portfolio.months[0].month);
  }, [portfolio]);

  // Sync fuel surcharge input when customer loads (must be before any conditional return)
  useEffect(() => {
    if (
      customer?.fuel_surcharge_amount != null &&
      customer.fuel_surcharge_amount !== ""
    ) {
      setFuelSurcharge(String(customer.fuel_surcharge_amount));
    } else {
      setFuelSurcharge("");
    }
  }, [customer?.id, customer?.fuel_surcharge_amount]);

  // Sync invoice prefix when customer loads
  useEffect(() => {
    if (customer?.invoice_prefix != null) {
      setInvoicePrefix(customer.invoice_prefix);
    } else {
      setInvoicePrefix("");
    }
  }, [customer?.id, customer?.invoice_prefix]);

  const setPrice = useMutation({
    mutationFn: (body: { product_id: number; price_per_lb: string }) =>
      api.post<CustomerPrice>(endpoints.customers.setPrice(customerId), body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["customerPrices", customerId],
      });
      setProductId("");
      setPricePerLb("");
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deletePrice = useMutation({
    mutationFn: (productId: number) =>
      api.delete(endpoints.customers.deletePrice(customerId, productId)),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["customerPrices", customerId],
      });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateCustomer = useMutation({
    mutationFn: (body: {
      fuel_surcharge_amount?: string | null;
      invoice_prefix?: string | null;
    }) => api.patch<Customer>(endpoints.customers.update(customerId), body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["price-chart"] });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSetPrice = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const pid = parseInt(productId, 10);
    const price = parseFloat(pricePerLb);
    if (Number.isNaN(pid) || !productId || pid < 1) {
      setError("Choose a product.");
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      setError("Enter a valid price per lb.");
      return;
    }
    setPrice.mutate({ product_id: pid, price_per_lb: pricePerLb });
  };

  if (!Number.isInteger(customerId)) {
    return <div className="error">Invalid customer ID.</div>;
  }
  if (customerLoading || customerError) {
    if (customerError)
      return (
        <div className="error">
          Failed to load customer: {(customerError as Error).message}
        </div>
      );
    return <div className="loading">Loading customer…</div>;
  }
  if (!customer) return null;

  return (
    <>
      <nav style={{ marginBottom: "1rem" }}>
        <Link href="/customers">← Customers</Link>
      </nav>
      <h1>{customer.name}</h1>
      {(customer.street ||
        customer.city ||
        customer.state ||
        customer.zip ||
        customer.phone_number) && (
        <p className="weight-label" style={{ marginBottom: "0.5rem" }}>
          {[
            customer.street,
            [customer.city, customer.state, customer.zip]
              .filter(Boolean)
              .join(", "),
          ]
            .filter(Boolean)
            .join(" · ")}
          {(customer.street ||
            customer.city ||
            customer.state ||
            customer.zip) &&
            customer.phone_number &&
            " · "}
          {customer.phone_number && <span>Phone: {customer.phone_number}</span>}
        </p>
      )}
      <p className="weight-label">
        Customer profile — set contract prices and view invoice history and
        profit.
      </p>

      {/* Fuel surcharge (contract) */}
      <section className="card form-card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
          Fuel surcharge (per order)
        </h2>
        <p className="weight-label" style={{ marginBottom: "0.5rem" }}>
          Optional amount added to each order when &quot;Add fuel
          surcharge&quot; is checked. Set in Price chart or here.
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder={customer.fuel_surcharge_amount ?? "0"}
            value={fuelSurcharge}
            onChange={e => setFuelSurcharge(e.target.value)}
            style={{ width: "6rem" }}
          />
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              const v = fuelSurcharge.trim();
              updateCustomer.mutate({
                fuel_surcharge_amount:
                  v === "" || Number.isNaN(parseFloat(v)) ? null : v,
              });
            }}
            disabled={updateCustomer.isPending}
          >
            {updateCustomer.isPending ? "Saving…" : "Save"}
          </button>
          {customer.fuel_surcharge_amount != null &&
            customer.fuel_surcharge_amount !== "" && (
              <span className="weight-label">
                Current: {formatMoney(customer.fuel_surcharge_amount)} per order
              </span>
            )}
        </div>
      </section>

      {/* Invoice abbreviation / prefix for invoice numbers */}
      <section className="card form-card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
          Invoice abbreviation (prefix)
        </h2>
        <p className="weight-label" style={{ marginBottom: "0.5rem" }}>
          Optional short code to prepend to invoice numbers for this customer,
          e.g. <strong>ABC</strong> → <code>ABC-INV-2026-00001</code>.
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            maxLength={32}
            placeholder="e.g. ABC"
            value={invoicePrefix}
            onChange={e => setInvoicePrefix(e.target.value)}
            style={{ width: "8rem", textTransform: "uppercase" }}
          />
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              const v = invoicePrefix.trim();
              updateCustomer.mutate({
                invoice_prefix: v === "" ? null : v.toUpperCase(),
              });
            }}
            disabled={updateCustomer.isPending}
          >
            {updateCustomer.isPending ? "Saving…" : "Save"}
          </button>
          {customer.invoice_prefix && (
            <span className="weight-label">
              Current sample: {customer.invoice_prefix.trim().toUpperCase()}
              -INV-2026-00001
            </span>
          )}
        </div>
      </section>

      {/* Portfolio summary — always show section */}
      <section
        className="card form-card"
        aria-labelledby="portfolio-summary-heading"
        style={{ marginBottom: "1rem" }}
      >
        <h2
          id="portfolio-summary-heading"
          style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}
        >
          Portfolio summary
        </h2>
        {portfolioLoading && <p className="weight-label">Loading portfolio…</p>}
        {portfolioError && (
          <p className="error" role="alert">
            Could not load portfolio: {(portfolioError as Error).message}
          </p>
        )}
        {!portfolioLoading && !portfolioError && portfolio && (
          <>
            <div className="form-group" style={{ marginBottom: "0.75rem" }}>
              <label htmlFor="portfolio-month">Month / Year</label>
              <select
                id="portfolio-month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                style={{ minWidth: "180px" }}
              >
                <option value="">All time</option>
                {(portfolio.months ?? []).map(m => (
                  <option key={m.month} value={m.month}>
                    {formatMonthLabel(m.month)}
                  </option>
                ))}
              </select>
            </div>
            {selectedMonth ? (
              (() => {
                const monthData = portfolio.months.find(
                  m => m.month === selectedMonth,
                );
                if (!monthData) return null;
                return (
                  <>
                    <p style={{ marginBottom: "0.25rem" }}>
                      <strong>
                        Revenue ({formatMonthLabel(selectedMonth)}):
                      </strong>{" "}
                      {formatMoney(monthData.total_revenue)}
                    </p>
                    <p style={{ marginBottom: "0.25rem" }}>
                      <strong>Cost:</strong> {formatMoney(monthData.total_cost)}
                    </p>
                    <p style={{ marginBottom: 0 }}>
                      <strong>Profit:</strong>{" "}
                      {formatMoney(monthData.total_profit)}
                    </p>
                    <p style={{ marginBottom: 0 }}>
                      <strong>Outstanding:</strong>{" "}
                      {formatMoney(monthData.total_outstanding)}
                    </p>
                  </>
                );
              })()
            ) : (
              <>
                <p style={{ marginBottom: "0.25rem" }}>
                  <strong>Total revenue:</strong>{" "}
                  {formatMoney(portfolio.total_revenue)}
                </p>
                <p style={{ marginBottom: "0.25rem" }}>
                  <strong>Total cost:</strong>{" "}
                  {formatMoney(portfolio.total_cost)}
                </p>
                <p style={{ marginBottom: 0 }}>
                  <strong>Total profit:</strong>{" "}
                  {formatMoney(portfolio.total_profit)}
                </p>
                <p style={{ marginBottom: 0 }}>
                  <strong>Total outstanding:</strong>{" "}
                  {formatMoney(portfolio.total_outstanding)}
                </p>
              </>
            )}
          </>
        )}
      </section>

      {/* Set price form */}
      <section className="card form-card" aria-labelledby="set-price-heading">
        <h2
          id="set-price-heading"
          style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}
        >
          Set price for a product
        </h2>
        <form onSubmit={handleSetPrice}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="profile-product">Product</label>
              <select
                id="profile-product"
                value={productId}
                onChange={e => setProductId(e.target.value)}
              >
                <option value="">Select product…</option>
                {(products ?? []).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name} (default{" "}
                    {formatMoney(p.default_price_per_lb)}/lb)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="profile-price">Price per lb ($)</label>
              <input
                id="profile-price"
                type="text"
                inputMode="decimal"
                value={pricePerLb}
                onChange={e => setPricePerLb(e.target.value)}
                placeholder="e.g. 4.25"
              />
            </div>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="btn primary"
            disabled={setPrice.isPending}
          >
            {setPrice.isPending ? "Saving…" : "Set price"}
          </button>
        </form>
      </section>

      {/* Current prices */}
      <section className="table-section" aria-labelledby="prices-table-heading">
        <h2
          id="prices-table-heading"
          style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}
        >
          Contract prices
        </h2>
        {pricesLoading ? (
          <div className="loading">Loading prices…</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product (SKU)</th>
                    <th>Name</th>
                    <th>Price/lb</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(prices ?? []).map(p => (
                    <tr key={p.id}>
                      <td>{p.product_sku ?? p.product_id}</td>
                      <td>{p.product_name ?? "—"}</td>
                      <td className="catch-weight">
                        {formatMoney(p.price_per_lb)}/lb
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => deletePrice.mutate(p.product_id)}
                          disabled={deletePrice.isPending}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(prices ?? []).length === 0 && (
              <p className="empty-state">
                No contract prices set. Use the form above to set prices per
                product.
              </p>
            )}
          </>
        )}
      </section>

      {/* Monthly invoices — filtered by selected month */}
      <section
        className="table-section"
        aria-labelledby="portfolio-months-heading"
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          <h2
            id="portfolio-months-heading"
            style={{ fontSize: "1.1rem", margin: 0 }}
          >
            Invoices by month
          </h2>
          {!portfolioLoading &&
            !portfolioError &&
            portfolio &&
            portfolio.months.length > 0 && (
              <div className="form-group" style={{ margin: 0 }}>
                <label
                  htmlFor="portfolio-month-invoices"
                  style={{ marginRight: "0.35rem" }}
                >
                  Month:
                </label>
                <select
                  id="portfolio-month-invoices"
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
            )}
        </div>
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
              No invoices yet for this customer. Invoices appear here once you
              create a sales order and mark it as &quot;Invoice&quot;.
            </p>
          )}
        {!portfolioLoading &&
          !portfolioError &&
          portfolio &&
          portfolio.months.length > 0 &&
          (() => {
            const monthsToShow = selectedMonth
              ? portfolio.months.filter(m => m.month === selectedMonth)
              : portfolio.months;
            return monthsToShow.map(
              (m: CustomerPortfolio["months"][number]) => (
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
                          <th>Status</th>
                          <th>Revenue</th>
                          <th>Cost</th>
                          <th>Profit</th>
                          <th>Paid</th>
                          <th>Outstanding</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.invoices.map(
                          (
                            inv: CustomerPortfolio["months"][number]["invoices"][number],
                          ) => (
                            <tr key={inv.order_id}>
                              <td>
                                {inv.order_number ?? `Order #${inv.order_id}`}
                              </td>
                              <td>{formatDisplayDate(inv.order_date)}</td>
                              <td>{orderStatusLabel(inv.status)}</td>
                              <td>{formatMoney(inv.total_revenue)}</td>
                              <td>{formatMoney(inv.total_cost)}</td>
                              <td>{formatMoney(inv.total_profit)}</td>
                              <td>{formatMoney(inv.amount_paid)}</td>
                              <td>{formatMoney(inv.outstanding_amount)}</td>
                              <td>
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.35rem",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: "0.35rem",
                                      alignItems: "center",
                                    }}
                                  >
                                    <select
                                      value={
                                        paymentEdit[inv.order_id]?.type ?? ""
                                      }
                                      onChange={e => {
                                        const v = e.target.value;
                                        if (v === "full")
                                          setPaymentEdit(prev => ({
                                            ...prev,
                                            [inv.order_id]: {
                                              type: "full",
                                              amount: "",
                                              method: inv.payment_method ?? "",
                                              checkNumber:
                                                inv.check_number ?? "",
                                            },
                                          }));
                                        else if (v === "partial")
                                          setPaymentEdit(prev => ({
                                            ...prev,
                                            [inv.order_id]: {
                                              type: "partial",
                                              amount: inv.amount_paid || "",
                                              method: inv.payment_method ?? "",
                                              checkNumber:
                                                inv.check_number ?? "",
                                            },
                                          }));
                                        else
                                          setPaymentEdit(prev => {
                                            const next = { ...prev };
                                            delete next[inv.order_id];
                                            return next;
                                          });
                                      }}
                                      style={{ minWidth: "8rem" }}
                                    >
                                      <option value="">Payment…</option>
                                      <option value="full">Full payment</option>
                                      <option value="partial">Partial</option>
                                    </select>
                                    {paymentEdit[inv.order_id]?.type ===
                                      "partial" && (
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="Amount received ($)"
                                        value={paymentEdit[inv.order_id].amount}
                                        onChange={e =>
                                          setPaymentEdit(prev => ({
                                            ...prev,
                                            [inv.order_id]: {
                                              ...prev[inv.order_id]!,
                                              amount: e.target.value,
                                            },
                                          }))
                                        }
                                        style={{ width: "7rem" }}
                                      />
                                    )}
                                    {(paymentEdit[inv.order_id]?.type ===
                                      "full" ||
                                      paymentEdit[inv.order_id]?.type ===
                                        "partial") && (
                                      <>
                                        <select
                                          value={
                                            paymentEdit[inv.order_id]?.method ??
                                            ""
                                          }
                                          onChange={e =>
                                            setPaymentEdit(prev => ({
                                              ...prev,
                                              [inv.order_id]: {
                                                ...prev[inv.order_id]!,
                                                method: e.target.value,
                                              },
                                            }))
                                          }
                                          style={{ minWidth: "8rem" }}
                                          title="Payment method"
                                        >
                                          <option value="">Method…</option>
                                          <option value="zelle">Zelle</option>
                                          <option value="cash">Cash</option>
                                          <option value="check">Check</option>
                                          <option value="credit_card">
                                            Credit card
                                          </option>
                                        </select>
                                        {paymentEdit[inv.order_id]?.method ===
                                          "check" && (
                                          <input
                                            type="text"
                                            placeholder="Check number *"
                                            value={
                                              paymentEdit[inv.order_id]
                                                .checkNumber
                                            }
                                            onChange={e =>
                                              setPaymentEdit(prev => ({
                                                ...prev,
                                                [inv.order_id]: {
                                                  ...prev[inv.order_id]!,
                                                  checkNumber: e.target.value,
                                                },
                                              }))
                                            }
                                            style={{ width: "8rem" }}
                                            required
                                          />
                                        )}
                                        <button
                                          type="button"
                                          className="btn btn-secondary"
                                          disabled={
                                            setPayment.isPending ||
                                            (paymentEdit[inv.order_id]?.type ===
                                              "partial" &&
                                              !paymentEdit[
                                                inv.order_id
                                              ]?.amount.trim()) ||
                                            (paymentEdit[inv.order_id]
                                              ?.method === "check" &&
                                              !paymentEdit[
                                                inv.order_id
                                              ]?.checkNumber.trim())
                                          }
                                          onClick={() => {
                                            const edit =
                                              paymentEdit[inv.order_id];
                                            if (!edit) return;
                                            const amount =
                                              edit.type === "full"
                                                ? inv.total_revenue
                                                : edit.amount.trim() || "0";
                                            if (
                                              edit.method === "check" &&
                                              !edit.checkNumber.trim()
                                            )
                                              return;
                                            setPayment.mutate(
                                              {
                                                orderId: inv.order_id,
                                                amount_paid: amount,
                                                payment_method:
                                                  edit.method || undefined,
                                                check_number:
                                                  edit.method === "check"
                                                    ? edit.checkNumber.trim()
                                                    : undefined,
                                              },
                                              {
                                                onSuccess: () =>
                                                  setPaymentEdit(prev => {
                                                    const next = { ...prev };
                                                    delete next[inv.order_id];
                                                    return next;
                                                  }),
                                              },
                                            );
                                          }}
                                        >
                                          {setPayment.isPending ? "…" : "Apply"}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    className={
                                      parseFloat(
                                        String(inv.outstanding_amount ?? 0),
                                      ) > 0
                                        ? "btn primary"
                                        : "btn btn-secondary"
                                    }
                                    style={{ alignSelf: "flex-start" }}
                                    title={
                                      parseFloat(
                                        String(inv.outstanding_amount ?? 0),
                                      ) > 0
                                        ? "Record payment or edit order"
                                        : "View or edit order"
                                    }
                                    onClick={() =>
                                      router.push(
                                        `/orders/${inv.order_id}/edit`,
                                      )
                                    }
                                  >
                                    {parseFloat(
                                      String(inv.outstanding_amount ?? 0),
                                    ) > 0
                                      ? "Pay"
                                      : "Edit order"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td
                            colSpan={3}
                            style={{ textAlign: "right", fontWeight: 600 }}
                          >
                            Month totals:
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {formatMoney(m.total_revenue)}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {formatMoney(m.total_cost)}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {formatMoney(m.total_profit)}
                          </td>
                          <td></td>
                          <td style={{ fontWeight: 600 }}>
                            {formatMoney(m.total_outstanding)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ),
            );
          })()}
      </section>
    </>
  );
}
