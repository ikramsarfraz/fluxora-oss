"use client";

import Link from "next/link";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, endpoints, type SupplierInvoice, type Supplier, type Expense } from "@/lib/api";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";

function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  const map: Record<string, string> = {
    cash: "Cash",
    zelle: "Zelle",
    check: "Check",
    credit_card: "Credit card",
  };
  return map[method] ?? method;
}

const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: "fleet_maintenance", label: "Fleet maintenance" },
  { value: "gas", label: "Gas" },
  { value: "rent", label: "Rent" },
  { value: "insurance", label: "Insurance" },
  { value: "utilities", label: "Utilities" },
  { value: "supplies", label: "Supplies" },
  { value: "other", label: "Other" },
];

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "zelle", label: "Zelle" },
  { value: "check", label: "Check" },
  { value: "credit_card", label: "Credit card" },
];

function categoryLabel(value: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function getMonthKey(dateStr: string): string {
  return String(dateStr).slice(0, 7);
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return ym;
  return new Date(y, m - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });
}

function isDateInFilter(
  dateStr: string,
  mode: "month" | "range",
  selectedMonth: string,
  fromDate: string,
  toDate: string
): boolean {
  const d = String(dateStr).slice(0, 10);
  if (mode === "month") {
    if (!selectedMonth) return true;
    return getMonthKey(d) === selectedMonth;
  }
  if (!fromDate && !toDate) return true;
  if (fromDate && d < fromDate) return false;
  if (toDate && d > toDate) return false;
  return true;
}

type Tab = "supplier" | "other";
type DateFilterMode = "month" | "range";

export default function Expenses() {
  const [tab, setTab] = useState<Tab>("supplier");
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("month");
  // Default to showing all data until user picks a month or date range.
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

  const queryClient = useQueryClient();
  const { data: invoices, isLoading: invoicesLoading, error: invoicesError } = useQuery({
    queryKey: ["supplierInvoices"],
    queryFn: () => api.get<SupplierInvoice[]>(endpoints.supplierInvoices.list()),
  });
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.get<Supplier[]>(endpoints.suppliers.list()),
  });
  const { data: expenses = [], isLoading: expensesLoading, error: expensesError } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => api.get<Expense[]>(endpoints.expenses.list()),
  });

  const createExpense = useMutation({
    mutationFn: (body: { expense_date: string; category: string; amount: string; note?: string; payment_method?: string }) =>
      api.post(endpoints.expenses.create(), body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });
  const updateExpense = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<{ expense_date: string; category: string; amount: string; note: string; payment_method: string }> }) =>
      api.patch(endpoints.expenses.update(id), body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });
  const deleteExpense = useMutation({
    mutationFn: (id: number) => api.delete(endpoints.expenses.delete(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const { filtered, filteredOtherExpenses, totals, otherExpensesTotal, monthOptions, supplierOptions } = useMemo(() => {
    const list = invoices ?? [];
    const dateInFilter = (d: string) =>
      isDateInFilter(d, dateFilterMode, selectedMonth, fromDate, toDate);
    const filtered = list.filter((inv) => {
      if (!dateInFilter(inv.invoice_date)) return false;
      if (selectedSupplierId && String(inv.supplier_id) !== selectedSupplierId) return false;
      return true;
    });
    let totalSpent = 0;
    let totalPaid = 0;
    filtered.forEach((inv) => {
      totalSpent += parseFloat(inv.total_amount) || 0;
      totalPaid += parseFloat(inv.amount_paid ?? "0") || 0;
    });
    const totalOutstanding = totalSpent - totalPaid;
    const monthSet = new Set<string>();
    list.forEach((inv) => monthSet.add(getMonthKey(inv.invoice_date)));
    (expenses ?? []).forEach((e) => monthSet.add(getMonthKey(e.expense_date)));
    const monthOptions = Array.from(monthSet).sort().reverse();
    const supplierMap = new Map<number, string>();
    (suppliers ?? []).forEach((s) => supplierMap.set(s.id, s.name));
    const supplierOptions = Array.from(supplierMap.entries()).map(([id, name]) => ({ id, name }));

    const otherList = expenses ?? [];
    const filteredOtherExpenses = otherList.filter((e) => dateInFilter(e.expense_date));
    const otherExpensesTotal = filteredOtherExpenses.reduce(
      (sum, e) => sum + (parseFloat(e.amount) || 0),
      0
    );

    return {
      filtered: filtered.sort(
        (a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
      ),
      filteredOtherExpenses: filteredOtherExpenses.sort(
        (a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()
      ),
      totals: { totalSpent, totalPaid, totalOutstanding: totalOutstanding > 0 ? totalOutstanding : 0 },
      otherExpensesTotal,
      monthOptions,
      supplierOptions,
    };
  }, [invoices, expenses, suppliers, dateFilterMode, selectedMonth, fromDate, toDate, selectedSupplierId]);

  const isLoading = tab === "supplier" ? invoicesLoading : invoicesLoading || expensesLoading;
  const error = tab === "supplier" ? invoicesError : invoicesError ?? expensesError;

  if (isLoading) return <div className="loading">Loading expenses…</div>;
  if (error) return <div className="error">Failed to load: {(error as Error).message}</div>;

  return (
    <div className="expenses-page">
      <header className="expenses-hero">
        <h1 className="expenses-title">Expenses</h1>
        <p className="expenses-tagline">Supplier invoices and other expenses. Track what you&apos;ve spent and what&apos;s outstanding.</p>
      </header>

      <section className="expenses-summary" aria-label="Summary">
        <div className="expenses-cards">
          <div className="expenses-card expenses-card--spent">
            <span className="expenses-card__value">{formatMoney(totals.totalSpent)}</span>
            <span className="expenses-card__label">Supplier spent</span>
          </div>
          <div className="expenses-card expenses-card--paid">
            <span className="expenses-card__value">{formatMoney(totals.totalPaid)}</span>
            <span className="expenses-card__label">Supplier paid</span>
          </div>
          <div className="expenses-card expenses-card--outstanding">
            <span className="expenses-card__value">{formatMoney(totals.totalOutstanding)}</span>
            <span className="expenses-card__label">Outstanding</span>
          </div>
          <div className="expenses-card expenses-card--other">
            <span className="expenses-card__value">{formatMoney(otherExpensesTotal)}</span>
            <span className="expenses-card__label">Other expenses</span>
          </div>
        </div>
      </section>

      <section className="expenses-date-filter" aria-label="Date filter">
        <div className="form-row" style={{ marginBottom: 0, alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div className="expenses-date-filter-mode">
            <label className="expenses-radio">
              <input
                type="radio"
                name="dateFilterMode"
                checked={dateFilterMode === "month"}
                onChange={() => setDateFilterMode("month")}
              />
              <span>By month</span>
            </label>
            <label className="expenses-radio">
              <input
                type="radio"
                name="dateFilterMode"
                checked={dateFilterMode === "range"}
                onChange={() => setDateFilterMode("range")}
              />
              <span>Date range</span>
            </label>
          </div>
          {dateFilterMode === "month" ? (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="expenses-month">Month</label>
              <select
                id="expenses-month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ minWidth: "180px" }}
              >
                <option value="">All months</option>
                {monthOptions.map((ym) => (
                  <option key={ym} value={ym}>
                    {formatMonthLabel(ym)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="expenses-from">From</label>
                <input
                  id="expenses-from"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="expenses-to">To</label>
                <input
                  id="expenses-to"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      </section>

      <div className="expenses-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "supplier"}
          className={tab === "supplier" ? "expenses-tab expenses-tab--active" : "expenses-tab"}
          onClick={() => setTab("supplier")}
        >
          Supplier invoices
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "other"}
          className={tab === "other" ? "expenses-tab expenses-tab--active" : "expenses-tab"}
          onClick={() => setTab("other")}
        >
          Other expenses
        </button>
      </div>

      {tab === "supplier" && (
        <>
          <section className="expenses-filters">
            <div className="form-row" style={{ marginBottom: 0, alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="expenses-supplier">Supplier</label>
                <select
                  id="expenses-supplier"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  style={{ minWidth: "180px" }}
                >
                  <option value="">All suppliers</option>
                  {supplierOptions.map(({ id, name }) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="expenses-table-section">
            <h2 className="expenses-section-title">Supplier invoice list</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>Invoice #</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Outstanding</th>
                    <th>Payment method</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => {
                    const total = parseFloat(inv.total_amount) || 0;
                    const paid = parseFloat(inv.amount_paid ?? "0") || 0;
                    const outstanding = Math.max(0, total - paid);
                    return (
                      <tr key={inv.id}>
                        <td>{formatDisplayDate(inv.invoice_date)}</td>
                        <td>
                          <Link href={`/suppliers/${inv.supplier_id}`}>{inv.supplier_name}</Link>
                        </td>
                        <td>{inv.invoice_number}</td>
                        <td className="catch-weight">{formatMoney(inv.total_amount)}</td>
                        <td>{formatMoney(inv.amount_paid ?? "0")}</td>
                        <td>{formatMoney(outstanding)}</td>
                        <td>
                          <span className="expenses-payment-badge">
                            {paymentMethodLabel(inv.payment_method)}
                          </span>
                        </td>
                        <td>
                          <Link href={`/suppliers/${inv.supplier_id}`} className="btn btn-secondary" style={{ padding: "0.35rem 0.6rem", fontSize: "0.8125rem" }}>
                            Portfolio
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <p className="empty-state">
                {selectedMonth || selectedSupplierId
                  ? "No expenses match the selected filters."
                  : "No supplier invoices yet. Add them from Supplier Invoices."}
              </p>
            )}
          </section>

          <p className="weight-label" style={{ marginTop: "1rem" }}>
            <Link href="/supplier-invoices">Add or upload supplier invoices</Link>
            {" · "}
            <Link href="/suppliers">Suppliers</Link>
          </p>
        </>
      )}

      {tab === "other" && (
        <OtherExpensesSection
          expenses={filteredOtherExpenses}
          createExpense={createExpense}
          updateExpense={updateExpense}
          deleteExpense={deleteExpense}
          categoryLabel={categoryLabel}
          paymentMethodLabel={paymentMethodLabel}
          formatMoney={formatMoney}
        />
      )}
    </div>
  );
}

type OtherExpensesSectionProps = {
  expenses: Expense[];
  createExpense: {
    mutate: (variables: { expense_date: string; category: string; amount: string; note?: string; payment_method?: string }, options?: { onSuccess?: () => void }) => void;
    isPending: boolean;
  };
  updateExpense: {
    mutate: (variables: { id: number; body: Partial<{ expense_date: string; category: string; amount: string; note: string; payment_method: string }> }) => void;
    isPending: boolean;
  };
  deleteExpense: {
    mutate: (id: number) => void;
    isPending: boolean;
  };
  categoryLabel: (v: string) => string;
  paymentMethodLabel: (v: string | null | undefined) => string;
  formatMoney: (s: string | number) => string;
};

function OtherExpensesSection({
  expenses,
  createExpense,
  updateExpense,
  deleteExpense,
  categoryLabel,
  paymentMethodLabel,
  formatMoney,
}: OtherExpensesSectionProps) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("other");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editCategory, setEditCategory] = useState("other");
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState("");

  const sortedExpenses = useMemo(
    () => [...expenses].sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()),
    [expenses]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = amount.trim();
    if (!amt || Number.isNaN(parseFloat(amt))) return;
    createExpense.mutate(
      {
        expense_date: date,
        category,
        amount: amt,
        note: note.trim() || undefined,
        payment_method: paymentMethod || undefined,
      },
      {
        onSuccess: () => {
          setAmount("");
          setNote("");
        },
      }
    );
  };

  const startEdit = (e: Expense) => {
    setEditingId(e.id);
    setEditDate(e.expense_date);
    setEditCategory(e.category);
    setEditAmount(e.amount);
    setEditNote(e.note ?? "");
    setEditPaymentMethod(e.payment_method ?? "");
  };

  const saveEdit = () => {
    if (editingId == null) return;
    const amt = editAmount.trim();
    if (!amt || Number.isNaN(parseFloat(amt))) return;
    updateExpense.mutate({
      id: editingId,
      body: {
        expense_date: editDate,
        category: editCategory,
        amount: amt,
        note: editNote || undefined,
        payment_method: editPaymentMethod || undefined,
      },
    });
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  return (
    <section className="expenses-other">
      <h2 className="expenses-section-title">Add other expense</h2>
      <form onSubmit={handleSubmit} className="expenses-other-form form-row" style={{ flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="exp-date">Date</label>
          <input
            id="exp-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="exp-category">Category</label>
          <select id="exp-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="exp-amount">Amount ($)</label>
          <input
            id="exp-amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="exp-payment">Payment method</label>
          <select id="exp-payment" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="">—</option>
            {PAYMENT_METHODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0, flex: "1 1 200px" }}>
          <label htmlFor="exp-note">Note</label>
          <input
            id="exp-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0, alignSelf: "flex-end" }}>
          <button type="submit" className="btn btn-primary" disabled={createExpense.isPending}>
            {createExpense.isPending ? "Adding…" : "Add expense"}
          </button>
        </div>
      </form>

      <h2 className="expenses-section-title">Other expenses</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Note</th>
              <th>Payment method</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedExpenses.map((e) =>
              editingId === e.id ? (
                <tr key={e.id}>
                  <td>
                    <input type="date" value={editDate} onChange={(ev) => setEditDate(ev.target.value)} style={{ width: "100%" }} />
                  </td>
                  <td>
                    <select value={editCategory} onChange={(ev) => setEditCategory(ev.target.value)} style={{ width: "100%" }}>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editAmount}
                      onChange={(ev) => setEditAmount(ev.target.value)}
                      style={{ width: "100%" }}
                    />
                  </td>
                  <td>
                    <input type="text" value={editNote} onChange={(ev) => setEditNote(ev.target.value)} style={{ width: "100%" }} placeholder="Note" />
                  </td>
                  <td>
                    <select value={editPaymentMethod} onChange={(ev) => setEditPaymentMethod(ev.target.value)} style={{ width: "100%" }}>
                      <option value="">—</option>
                      {PAYMENT_METHODS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button type="button" className="btn btn-primary" style={{ marginRight: "0.25rem" }} onClick={saveEdit} disabled={updateExpense.isPending}>
                      Save
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={e.id}>
                  <td>{formatDisplayDate(e.expense_date)}</td>
                  <td>{categoryLabel(e.category)}</td>
                  <td className="catch-weight">{formatMoney(e.amount)}</td>
                  <td>{e.note ?? "—"}</td>
                  <td>
                    <span className="expenses-payment-badge">{paymentMethodLabel(e.payment_method)}</span>
                  </td>
                  <td>
                    <button type="button" className="btn btn-secondary" style={{ marginRight: "0.25rem", padding: "0.35rem 0.6rem", fontSize: "0.8125rem" }} onClick={() => startEdit(e)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: "0.35rem 0.6rem", fontSize: "0.8125rem" }}
                      onClick={() => window.confirm("Delete this expense?") && deleteExpense.mutate(e.id)}
                      disabled={deleteExpense.isPending}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      {sortedExpenses.length === 0 && <p className="empty-state">No other expenses yet. Add one above.</p>}
    </section>
  );
}
