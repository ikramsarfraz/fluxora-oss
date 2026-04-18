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
import { DetailPageHeader } from "@/components/detail-page-header";
import { DetailSection, DetailField, DetailGrid } from "@/components/detail-section";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    return <PageError message="Invalid supplier ID." />;
  }

  if (supplierLoading || !supplier) {
    return <PageLoading message="Loading supplier..." />;
  }
  if (supplierError) {
    return <PageError message={(supplierError as Error).message} />;
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
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        backHref="/suppliers"
        backLabel="Suppliers"
        title={supplier.name}
        description="Track spending, payments, and invoice history for this supplier."
      />

      <DetailSection
        title="Spending & Payments"
        description="Financial overview for this supplier."
      >
        {portfolioLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {portfolioError && (
          <p className="text-sm text-destructive" role="alert">
            Could not load portfolio.
          </p>
        )}
        {!portfolioLoading && !portfolioError && portfolio && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="supplier-month" className="text-sm font-medium">Period:</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger id="supplier-month" className="w-48">
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All time</SelectItem>
                  {portfolio.months.map(m => (
                    <SelectItem key={m.month} value={m.month}>
                      {formatMonthLabel(m.month)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DetailGrid className="sm:grid-cols-3">
              <DetailField label="Total Spent">{formatMoney(displaySpent)}</DetailField>
              <DetailField label="Paid">{formatMoney(displayPaid)}</DetailField>
              <DetailField label="Outstanding">{formatMoney(displayOutstanding)}</DetailField>
            </DetailGrid>
          </div>
        )}
      </DetailSection>

      <DetailSection
        title="Invoices by Month"
        description="Track invoice history and outstanding payments."
      >
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
              No supplier invoices yet for this supplier.
            </p>
          )}
        {!portfolioLoading &&
          !portfolioError &&
          portfolio &&
          portfolio.months.length > 0 &&
          monthsToShow.map(m => (
            <div key={m.month} className="mb-6">
              <h3 className="mb-3 text-base font-medium">{formatMonthLabel(m.month)}</h3>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Invoice #</th>
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-left font-medium">Total</th>
                      <th className="px-3 py-2 text-left font-medium">Paid</th>
                      <th className="px-3 py-2 text-left font-medium">Outstanding</th>
                      <th className="px-3 py-2 text-left font-medium">Payment</th>
                      <th className="px-3 py-2 text-left font-medium">Method</th>
                      <th className="px-3 py-2 text-left font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {m.invoices.map(inv => (
                      <tr key={inv.invoice_id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono text-xs">{inv.invoice_number}</td>
                        <td className="px-3 py-2">{formatDisplayDate(inv.invoice_date)}</td>
                        <td className="px-3 py-2">{formatMoney(inv.total_amount)}</td>
                        <td className="px-3 py-2">{formatMoney(inv.amount_paid)}</td>
                        <td className="px-3 py-2 font-medium">{formatMoney(inv.outstanding)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
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
                                      method: prev[inv.invoice_id]?.method ?? inv.payment_method ?? "",
                                    },
                                  }));
                                else if (v === "partial")
                                  setPaymentEdit(prev => ({
                                    ...prev,
                                    [inv.invoice_id]: {
                                      type: "partial",
                                      amount: inv.amount_paid || "",
                                      method: prev[inv.invoice_id]?.method ?? inv.payment_method ?? "",
                                    },
                                  }));
                                else
                                  setPaymentEdit(prev => {
                                    const next = { ...prev };
                                    delete next[inv.invoice_id];
                                    return next;
                                  });
                              }}
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                            >
                              <option value="">Payment...</option>
                              <option value="full">Full payment</option>
                              <option value="partial">Partial</option>
                            </select>
                            {paymentEdit[inv.invoice_id]?.type === "partial" && (
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="Amount ($)"
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
                                className="h-8 w-24 text-xs"
                              />
                            )}
                            {(paymentEdit[inv.invoice_id]?.type === "full" ||
                              paymentEdit[inv.invoice_id]?.type === "partial" ||
                              (paymentEdit[inv.invoice_id]?.method !== undefined &&
                                paymentEdit[inv.invoice_id]?.method !== (inv.payment_method ?? ""))) && (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={
                                  setPayment.isPending ||
                                  (paymentEdit[inv.invoice_id]?.type === "partial" &&
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
                                  const method = edit.method && edit.method !== "" ? edit.method : null;
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
                                {setPayment.isPending ? "..." : "Apply"}
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={paymentEdit[inv.invoice_id]?.method ?? inv.payment_method ?? ""}
                            onChange={e => {
                              const v = e.target.value;
                              setPaymentEdit(prev => ({
                                ...prev,
                                [inv.invoice_id]: {
                                  type: prev[inv.invoice_id]?.type ?? "",
                                  amount: prev[inv.invoice_id]?.amount ?? inv.amount_paid ?? "",
                                  method: v,
                                },
                              }));
                            }}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          >
                            {PAYMENT_METHODS.map(opt => (
                              <option key={opt.value || "_"} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href="/supplier-invoices">View</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/30">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-right font-semibold">
                        Month totals:
                      </td>
                      <td className="px-3 py-2 font-semibold">{formatMoney(m.total_spent)}</td>
                      <td className="px-3 py-2 font-semibold">{formatMoney(m.total_paid)}</td>
                      <td className="px-3 py-2 font-semibold">{formatMoney(m.total_outstanding)}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
      </DetailSection>
    </div>
  );
}
