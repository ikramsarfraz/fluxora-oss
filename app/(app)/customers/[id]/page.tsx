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
import { DetailPageHeader } from "@/components/detail-page-header";
import { DetailSection, DetailField, DetailGrid } from "@/components/detail-section";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    return <PageError message="Invalid customer ID." />;
  }
  if (customerLoading) {
    return <PageLoading message="Loading customer..." />;
  }
  if (customerError) {
    return <PageError message={(customerError as Error).message} />;
  }
  if (!customer) return null;

  const addressParts = [
    customer.street,
    [customer.city, customer.state, customer.zip].filter(Boolean).join(", "),
  ].filter(Boolean);
  const addressLine = addressParts.join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={customer.name}
        description="Set contract prices and view invoice history and profit."
      />

      {/* Contact Information */}
      {(addressLine || customer.phone_number) && (
        <DetailSection title="Contact Information" description="Customer address and contact details.">
          <DetailGrid>
            {addressLine && (
              <DetailField label="Address">{addressLine}</DetailField>
            )}
            {customer.phone_number && (
              <DetailField label="Phone">{customer.phone_number}</DetailField>
            )}
          </DetailGrid>
        </DetailSection>
      )}

      {/* Fuel surcharge (contract) */}
      <DetailSection
        title="Fuel Surcharge"
        description="Optional amount added to each order when fuel surcharge is enabled."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder={customer.fuel_surcharge_amount ?? "0"}
            value={fuelSurcharge}
            onChange={e => setFuelSurcharge(e.target.value)}
            className="w-24"
          />
          <Button
            type="button"
            onClick={() => {
              const v = fuelSurcharge.trim();
              updateCustomer.mutate({
                fuel_surcharge_amount:
                  v === "" || Number.isNaN(parseFloat(v)) ? null : v,
              });
            }}
            disabled={updateCustomer.isPending}
          >
            {updateCustomer.isPending ? "Saving..." : "Save"}
          </Button>
          {customer.fuel_surcharge_amount != null &&
            customer.fuel_surcharge_amount !== "" && (
              <Badge variant="secondary">
                Current: {formatMoney(customer.fuel_surcharge_amount)} per order
              </Badge>
            )}
        </div>
      </DetailSection>

      {/* Invoice abbreviation / prefix for invoice numbers */}
      <DetailSection
        title="Invoice Prefix"
        description="Optional short code to prepend to invoice numbers (e.g. ABC → ABC-INV-2026-00001)."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="text"
            maxLength={32}
            placeholder="e.g. ABC"
            value={invoicePrefix}
            onChange={e => setInvoicePrefix(e.target.value)}
            className="w-28 uppercase"
          />
          <Button
            type="button"
            onClick={() => {
              const v = invoicePrefix.trim();
              updateCustomer.mutate({
                invoice_prefix: v === "" ? null : v.toUpperCase(),
              });
            }}
            disabled={updateCustomer.isPending}
          >
            {updateCustomer.isPending ? "Saving..." : "Save"}
          </Button>
          {customer.invoice_prefix && (
            <Badge variant="secondary">
              Sample: {customer.invoice_prefix.trim().toUpperCase()}-INV-2026-00001
            </Badge>
          )}
        </div>
      </DetailSection>

      {/* Portfolio summary — always show section */}
      <DetailSection
        title="Portfolio Summary"
        description="Revenue, cost, and profit overview."
      >
        {portfolioLoading && <p className="text-sm text-muted-foreground">Loading portfolio...</p>}
        {portfolioError && (
          <p className="text-sm text-destructive" role="alert">
            Could not load portfolio: {(portfolioError as Error).message}
          </p>
        )}
        {!portfolioLoading && !portfolioError && portfolio && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="portfolio-month" className="text-sm font-medium">Period:</label>
              <Select value={selectedMonth || "__all__"} onValueChange={v => setSelectedMonth(v === "__all__" ? "" : v)}>
                <SelectTrigger id="portfolio-month" className="w-48">
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All time</SelectItem>
                  {(portfolio.months ?? []).map(m => (
                    <SelectItem key={m.month} value={m.month}>
                      {formatMonthLabel(m.month)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedMonth ? (
              (() => {
                const monthData = portfolio.months.find(m => m.month === selectedMonth);
                if (!monthData) return null;
                return (
                  <DetailGrid className="sm:grid-cols-4">
                    <DetailField label={`Revenue (${formatMonthLabel(selectedMonth)})`}>
                      {formatMoney(monthData.total_revenue)}
                    </DetailField>
                    <DetailField label="Cost">
                      {formatMoney(monthData.total_cost)}
                    </DetailField>
                    <DetailField label="Profit">
                      {formatMoney(monthData.total_profit)}
                    </DetailField>
                    <DetailField label="Outstanding">
                      {formatMoney(monthData.total_outstanding)}
                    </DetailField>
                  </DetailGrid>
                );
              })()
            ) : (
              <DetailGrid className="sm:grid-cols-4">
                <DetailField label="Total Revenue">
                  {formatMoney(portfolio.total_revenue)}
                </DetailField>
                <DetailField label="Total Cost">
                  {formatMoney(portfolio.total_cost)}
                </DetailField>
                <DetailField label="Total Profit">
                  {formatMoney(portfolio.total_profit)}
                </DetailField>
                <DetailField label="Total Outstanding">
                  {formatMoney(portfolio.total_outstanding)}
                </DetailField>
              </DetailGrid>
            )}
          </div>
        )}
      </DetailSection>

      {/* Set price form */}
      <DetailSection
        title="Set Product Price"
        description="Define contract prices for specific products."
      >
        <form onSubmit={handleSetPrice} className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1.5 min-w-48 flex-1">
              <label htmlFor="profile-product" className="text-sm font-medium">Product</label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger id="profile-product">
                  <SelectValue placeholder="Select product..." />
                </SelectTrigger>
                <SelectContent>
                  {(products ?? []).map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.sku} — {p.name} (default {formatMoney(p.default_price_per_lb)}/lb)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 w-32">
              <label htmlFor="profile-price" className="text-sm font-medium">Price per lb ($)</label>
              <Input
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
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div>
            <Button type="submit" disabled={setPrice.isPending}>
              {setPrice.isPending ? "Saving..." : "Set Price"}
            </Button>
          </div>
        </form>
      </DetailSection>

      {/* Current prices */}
      <DetailSection
        title="Contract Prices"
        description="Current pricing agreements for this customer."
      >
        {pricesLoading ? (
          <p className="text-sm text-muted-foreground">Loading prices...</p>
        ) : (prices ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No contract prices set. Use the form above to set prices per product.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Product (SKU)</th>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Price/lb</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(prices ?? []).map(p => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{p.product_sku ?? p.product_id}</td>
                    <td className="px-4 py-3">{p.product_name ?? "—"}</td>
                    <td className="px-4 py-3 font-medium">{formatMoney(p.price_per_lb)}/lb</td>
                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePrice.mutate(p.product_id)}
                        disabled={deletePrice.isPending}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DetailSection>

      {/* Monthly invoices — filtered by selected month */}
      <DetailSection
        title="Invoices by Month"
        description="Track invoice history and outstanding payments."
      >
        {!portfolioLoading && !portfolioError && portfolio && portfolio.months.length > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <label htmlFor="portfolio-month-invoices" className="text-sm font-medium">Filter:</label>
            <Select value={selectedMonth || "__all__"} onValueChange={v => setSelectedMonth(v === "__all__" ? "" : v)}>
              <SelectTrigger id="portfolio-month-invoices" className="w-48">
                <SelectValue placeholder="All time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All time</SelectItem>
                {portfolio.months.map(m => (
                  <SelectItem key={m.month} value={m.month}>
                    {formatMonthLabel(m.month)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {portfolioLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {portfolioError && (
          <p className="text-sm text-destructive" role="alert">
            Could not load invoices.
          </p>
        )}
        {!portfolioLoading &&
          !portfolioError &&
          portfolio &&
          portfolio.months.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No invoices yet for this customer. Invoices appear here once you create a sales order.
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
                <div key={m.month} className="mb-6">
                  <h3 className="mb-3 text-base font-medium">{formatMonthLabel(m.month)}</h3>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Invoice #</th>
                          <th className="px-3 py-2 text-left font-medium">Date</th>
                          <th className="px-3 py-2 text-left font-medium">Status</th>
                          <th className="px-3 py-2 text-left font-medium">Revenue</th>
                          <th className="px-3 py-2 text-left font-medium">Cost</th>
                          <th className="px-3 py-2 text-left font-medium">Profit</th>
                          <th className="px-3 py-2 text-left font-medium">Paid</th>
                          <th className="px-3 py-2 text-left font-medium">Outstanding</th>
                          <th className="px-3 py-2 text-left font-medium"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {m.invoices.map(
                          (
                            inv: CustomerPortfolio["months"][number]["invoices"][number],
                          ) => (
                            <tr key={inv.order_id} className="hover:bg-muted/30">
                              <td className="px-3 py-2 font-mono text-xs">
                                {inv.order_number ?? `Order #${inv.order_id}`}
                              </td>
                              <td className="px-3 py-2">{formatDisplayDate(inv.order_date)}</td>
                              <td className="px-3 py-2">
                                <Badge variant="outline" className="text-xs">
                                  {orderStatusLabel(inv.status)}
                                </Badge>
                              </td>
                              <td className="px-3 py-2">{formatMoney(inv.total_revenue)}</td>
                              <td className="px-3 py-2">{formatMoney(inv.total_cost)}</td>
                              <td className="px-3 py-2">{formatMoney(inv.total_profit)}</td>
                              <td className="px-3 py-2">{formatMoney(inv.amount_paid)}</td>
                              <td className="px-3 py-2 font-medium">{formatMoney(inv.outstanding_amount)}</td>
                              <td className="px-3 py-2">
                                <div className="flex flex-col gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <select
                                      value={paymentEdit[inv.order_id]?.type ?? ""}
                                      onChange={e => {
                                        const v = e.target.value;
                                        if (v === "full")
                                          setPaymentEdit(prev => ({
                                            ...prev,
                                            [inv.order_id]: {
                                              type: "full",
                                              amount: "",
                                              method: inv.payment_method ?? "",
                                              checkNumber: inv.check_number ?? "",
                                            },
                                          }));
                                        else if (v === "partial")
                                          setPaymentEdit(prev => ({
                                            ...prev,
                                            [inv.order_id]: {
                                              type: "partial",
                                              amount: inv.amount_paid || "",
                                              method: inv.payment_method ?? "",
                                              checkNumber: inv.check_number ?? "",
                                            },
                                          }));
                                        else
                                          setPaymentEdit(prev => {
                                            const next = { ...prev };
                                            delete next[inv.order_id];
                                            return next;
                                          });
                                      }}
                                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                                    >
                                      <option value="">Payment...</option>
                                      <option value="full">Full payment</option>
                                      <option value="partial">Partial</option>
                                    </select>
                                    {paymentEdit[inv.order_id]?.type === "partial" && (
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="Amount ($)"
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
                                        className="h-8 w-24 text-xs"
                                      />
                                    )}
                                    {(paymentEdit[inv.order_id]?.type === "full" ||
                                      paymentEdit[inv.order_id]?.type === "partial") && (
                                      <>
                                        <select
                                          value={paymentEdit[inv.order_id]?.method ?? ""}
                                          onChange={e =>
                                            setPaymentEdit(prev => ({
                                              ...prev,
                                              [inv.order_id]: {
                                                ...prev[inv.order_id]!,
                                                method: e.target.value,
                                              },
                                            }))
                                          }
                                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                                          title="Payment method"
                                        >
                                          <option value="">Method...</option>
                                          <option value="zelle">Zelle</option>
                                          <option value="cash">Cash</option>
                                          <option value="check">Check</option>
                                          <option value="credit_card">Credit card</option>
                                        </select>
                                        {paymentEdit[inv.order_id]?.method === "check" && (
                                          <Input
                                            type="text"
                                            placeholder="Check #"
                                            value={paymentEdit[inv.order_id].checkNumber}
                                            onChange={e =>
                                              setPaymentEdit(prev => ({
                                                ...prev,
                                                [inv.order_id]: {
                                                  ...prev[inv.order_id]!,
                                                  checkNumber: e.target.value,
                                                },
                                              }))
                                            }
                                            className="h-8 w-24 text-xs"
                                            required
                                          />
                                        )}
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          size="sm"
                                          disabled={
                                            setPayment.isPending ||
                                            (paymentEdit[inv.order_id]?.type === "partial" &&
                                              !paymentEdit[inv.order_id]?.amount.trim()) ||
                                            (paymentEdit[inv.order_id]?.method === "check" &&
                                              !paymentEdit[inv.order_id]?.checkNumber.trim())
                                          }
                                          onClick={() => {
                                            const edit = paymentEdit[inv.order_id];
                                            if (!edit) return;
                                            const amount =
                                              edit.type === "full"
                                                ? inv.total_revenue
                                                : edit.amount.trim() || "0";
                                            if (edit.method === "check" && !edit.checkNumber.trim())
                                              return;
                                            setPayment.mutate(
                                              {
                                                orderId: inv.order_id,
                                                amount_paid: amount,
                                                payment_method: edit.method || undefined,
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
                                          {setPayment.isPending ? "..." : "Apply"}
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                  <Button
                                    type="button"
                                    variant={
                                      parseFloat(String(inv.outstanding_amount ?? 0)) > 0
                                        ? "default"
                                        : "outline"
                                    }
                                    size="sm"
                                    onClick={() => router.push(`/orders/${inv.order_id}/edit`)}
                                  >
                                    {parseFloat(String(inv.outstanding_amount ?? 0)) > 0
                                      ? "Pay"
                                      : "Edit order"}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                      <tfoot className="border-t bg-muted/30">
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-right font-semibold">
                            Month totals:
                          </td>
                          <td className="px-3 py-2 font-semibold">{formatMoney(m.total_revenue)}</td>
                          <td className="px-3 py-2 font-semibold">{formatMoney(m.total_cost)}</td>
                          <td className="px-3 py-2 font-semibold">{formatMoney(m.total_profit)}</td>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2 font-semibold">{formatMoney(m.total_outstanding)}</td>
                          <td className="px-3 py-2"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ),
            );
          })()}
      </DetailSection>
    </div>
  );
}
