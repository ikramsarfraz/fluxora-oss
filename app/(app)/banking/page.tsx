"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, endpoints, type BankAccount, type BankRegisterRow } from "@/lib/api";
import { formatMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";

const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "money_market", label: "Money market" },
  { value: "credit_card", label: "Credit card" },
  { value: "other", label: "Other" },
];

function accountTypeLabel(t: string) {
  return ACCOUNT_TYPES.find((x) => x.value === t)?.label ?? t;
}

function todayISODate() {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function parseAmountInput(s: string): number | null {
  const t = s.trim().replace(/[$,]/g, "");
  if (t === "" || t === "-") return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export default function Banking() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [editAccountId, setEditAccountId] = useState<number | null>(null);

  const [newName, setNewName] = useState("");
  const [newInstitution, setNewInstitution] = useState("");
  const [newType, setNewType] = useState("checking");
  const [newLastFour, setNewLastFour] = useState("");
  const [newOpening, setNewOpening] = useState("0");
  const [newOpeningDate, setNewOpeningDate] = useState(todayISODate);
  const [newNotes, setNewNotes] = useState("");

  const [txnDate, setTxnDate] = useState(todayISODate);
  const [txnDesc, setTxnDesc] = useState("");
  const [txnAmount, setTxnAmount] = useState("");
  const [txnMemo, setTxnMemo] = useState("");

  const [editTxn, setEditTxn] = useState<{
    id: number;
    txn_date: string;
    description: string;
    amount: string;
    memo: string;
  } | null>(null);

  const { data: accounts = [], isLoading, error } = useQuery({
    queryKey: ["bankAccounts"],
    queryFn: () => api.get<BankAccount[]>(endpoints.banking.accounts.list()),
  });

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedId(null);
      return;
    }
    if (selectedId == null || !accounts.some((a) => a.id === selectedId)) {
      setSelectedId(accounts[0].id);
    }
  }, [accounts, selectedId]);

  const { data: register = [], isLoading: regLoading } = useQuery({
    queryKey: ["bankRegister", selectedId],
    queryFn: () => api.get<BankRegisterRow[]>(endpoints.banking.accounts.register(selectedId!)),
    enabled: selectedId != null,
  });

  const selected = useMemo(
    () => accounts.find((a) => a.id === selectedId) ?? null,
    [accounts, selectedId]
  );

  const createAccount = useMutation({
    mutationFn: () =>
      api.post<BankAccount>(endpoints.banking.accounts.create(), {
        name: newName.trim(),
        institution_name: newInstitution.trim() || null,
        account_type: newType,
        last_four: newLastFour.trim() || null,
        opening_balance: String(parseAmountInput(newOpening) ?? 0),
        opening_balance_date: newOpeningDate,
        notes: newNotes.trim() || null,
        is_active: true,
      }),
    onSuccess: (acc) => {
      queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSelectedId(acc.id);
      setShowNewAccount(false);
      setNewName("");
      setNewInstitution("");
      setNewType("checking");
      setNewLastFour("");
      setNewOpening("0");
      setNewOpeningDate(todayISODate());
      setNewNotes("");
    },
  });

  const updateAccount = useMutation({
    mutationFn: (body: {
      id: number;
      patch: Partial<{
        name: string;
        institution_name: string | null;
        account_type: string;
        last_four: string | null;
        opening_balance: string;
        opening_balance_date: string;
        notes: string | null;
        is_active: boolean;
      }>;
    }) => api.patch<BankAccount>(endpoints.banking.accounts.update(body.id), body.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["bankRegister"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditAccountId(null);
    },
  });

  const deleteAccount = useMutation({
    mutationFn: (id: number) => api.delete(endpoints.banking.accounts.delete(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["bankRegister"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSelectedId(null);
      setEditAccountId(null);
    },
  });

  const addTxn = useMutation({
    mutationFn: () =>
      api.post(endpoints.banking.accounts.addTransaction(selectedId!), {
        txn_date: txnDate,
        description: txnDesc.trim(),
        amount: String(parseAmountInput(txnAmount) ?? 0),
        memo: txnMemo.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bankRegister", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setTxnDesc("");
      setTxnAmount("");
      setTxnMemo("");
      setTxnDate(todayISODate());
    },
  });

  const saveTxnEdit = useMutation({
    mutationFn: () =>
      api.patch(endpoints.banking.transactions.update(editTxn!.id), {
        txn_date: editTxn!.txn_date,
        description: editTxn!.description.trim(),
        amount: String(parseAmountInput(editTxn!.amount) ?? 0),
        memo: editTxn!.memo.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bankRegister", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditTxn(null);
    },
  });

  const deleteTxn = useMutation({
    mutationFn: (id: number) => api.delete(endpoints.banking.transactions.delete(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bankRegister", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const editingAccount = editAccountId != null ? accounts.find((a) => a.id === editAccountId) : null;

  return (
    <div>
      <h1>Banking</h1>
      <p className="muted" style={{ marginTop: "-0.5rem", marginBottom: "1.25rem" }}>
        Track bank and card balances like QuickBooks: add your accounts, set a starting balance, then record deposits
        and payments in the register. This does not connect to your bank — entries are manual.
      </p>

      {error && (
        <div className="error" role="alert">
          {(error as Error).message}
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <button type="button" className="btn primary" onClick={() => setShowNewAccount((s) => !s)}>
          {showNewAccount ? "Cancel" : "Add bank account"}
        </button>
      </div>

      {showNewAccount && (
        <div className="card-totals" style={{ marginBottom: "1.5rem", maxWidth: "520px" }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>New account</h2>
          <div style={{ display: "grid", gap: "0.65rem" }}>
            <label>
              Display name
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Operating — Chase" />
            </label>
            <label>
              Bank / institution (optional)
              <input value={newInstitution} onChange={(e) => setNewInstitution(e.target.value)} />
            </label>
            <label>
              Account type
              <select value={newType} onChange={(e) => setNewType(e.target.value)}>
                {ACCOUNT_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Last 4 digits (optional)
              <input
                value={newLastFour}
                onChange={(e) => setNewLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
                maxLength={4}
              />
            </label>
            <label>
              Starting balance
              <input value={newOpening} onChange={(e) => setNewOpening(e.target.value)} placeholder="0.00" />
            </label>
            <label>
              As of date
              <input type="date" value={newOpeningDate} onChange={(e) => setNewOpeningDate(e.target.value)} />
            </label>
            <label>
              Notes (optional)
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                rows={2}
                style={{ width: "100%", maxWidth: "100%", font: "inherit" }}
              />
            </label>
            <button
              type="button"
              className="btn primary"
              disabled={!newName.trim() || createAccount.isPending}
              onClick={() => createAccount.mutate()}
            >
              Save account
            </button>
            {createAccount.isError && (
              <span className="error" style={{ fontSize: "0.875rem" }}>
                {(createAccount.error as Error).message}
              </span>
            )}
          </div>
        </div>
      )}

      {isLoading && <p className="loading">Loading accounts…</p>}

      {!isLoading && accounts.length === 0 && !showNewAccount && (
        <p className="muted">No bank accounts yet. Use &quot;Add bank account&quot; to create one.</p>
      )}

      {accounts.length > 0 && (
        <div className="table-wrap" style={{ marginBottom: "1.5rem" }}>
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th className="table-numeric">Ledger balance</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr
                  key={a.id}
                  style={{
                    background: a.id === selectedId ? "#f0f9ff" : undefined,
                    cursor: "pointer",
                  }}
                  onClick={() => setSelectedId(a.id)}
                >
                  <td>
                    <strong>{a.name}</strong>
                    {a.institution_name && (
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {a.institution_name}
                        {a.last_four ? ` · ···${a.last_four}` : ""}
                      </div>
                    )}
                  </td>
                  <td>{accountTypeLabel(a.account_type)}</td>
                  <td className="table-numeric">
                    <strong>{formatMoney(a.ledger_balance)}</strong>
                  </td>
                  <td>{a.is_active ? "Active" : "Inactive"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditAccountId(a.id);
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingAccount && (
        <EditAccountForm
          key={editAccountId}
          account={editingAccount}
          onClose={() => setEditAccountId(null)}
          onSave={(patch) => updateAccount.mutate({ id: editingAccount.id, patch })}
          onDelete={() => {
            if (
              window.confirm(
                `Delete "${editingAccount.name}" and all register lines? This cannot be undone.`
              )
            ) {
              deleteAccount.mutate(editingAccount.id);
            }
          }}
          isSaving={updateAccount.isPending}
          isDeleting={deleteAccount.isPending}
          error={updateAccount.error as Error | null}
        />
      )}

      {selected && (
        <>
          <h2 style={{ fontSize: "1.15rem", marginBottom: "0.5rem" }}>
            Register — {selected.name}{" "}
            <span className="muted" style={{ fontWeight: 400 }}>
              ({formatMoney(selected.ledger_balance)})
            </span>
          </h2>
          <p className="muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
            Positive amount = deposit or money in. Negative = payment or withdrawal. Running balance includes your
            starting balance plus all lines below in date order.
          </p>

          <div className="card-totals" style={{ marginBottom: "1rem" }}>
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>Add register line</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
              <label style={{ margin: 0 }}>
                Date
                <input type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} />
              </label>
              <label style={{ margin: 0, minWidth: "160px" }}>
                Description
                <input value={txnDesc} onChange={(e) => setTxnDesc(e.target.value)} placeholder="e.g. Customer deposit" />
              </label>
              <label style={{ margin: 0 }}>
                Amount (+ / −)
                <input value={txnAmount} onChange={(e) => setTxnAmount(e.target.value)} placeholder="-250.00" />
              </label>
              <label style={{ margin: 0, flex: "1 1 180px" }}>
                Memo
                <input value={txnMemo} onChange={(e) => setTxnMemo(e.target.value)} />
              </label>
              <button
                type="button"
                className="btn primary"
                disabled={!txnDesc.trim() || addTxn.isPending}
                onClick={() => addTxn.mutate()}
              >
                Add
              </button>
            </div>
            {addTxn.isError && (
              <p className="error" style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>
                {(addTxn.error as Error).message}
              </p>
            )}
          </div>

          {regLoading && <p className="loading">Loading register…</p>}

          {!regLoading && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th className="table-numeric">Amount</th>
                    <th>Memo</th>
                    <th className="table-numeric">Running balance</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: "#f8fafc" }}>
                    <td>{formatDisplayDate(selected.opening_balance_date)}</td>
                    <td>
                      <em>Starting balance</em>
                    </td>
                    <td className="table-numeric">—</td>
                    <td />
                    <td className="table-numeric">
                      <strong>{formatMoney(selected.opening_balance)}</strong>
                    </td>
                    <td />
                  </tr>
                  {register.map((row) =>
                    editTxn?.id === row.id ? (
                      <tr key={row.id}>
                        <td>
                          <input
                            type="date"
                            value={editTxn.txn_date}
                            onChange={(e) => setEditTxn({ ...editTxn, txn_date: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            value={editTxn.description}
                            onChange={(e) => setEditTxn({ ...editTxn, description: e.target.value })}
                          />
                        </td>
                        <td className="table-numeric">
                          <input
                            value={editTxn.amount}
                            onChange={(e) => setEditTxn({ ...editTxn, amount: e.target.value })}
                            style={{ textAlign: "right" }}
                          />
                        </td>
                        <td>
                          <input value={editTxn.memo} onChange={(e) => setEditTxn({ ...editTxn, memo: e.target.value })} />
                        </td>
                        <td className="table-numeric">{formatMoney(row.running_balance)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn primary"
                            disabled={saveTxnEdit.isPending}
                            onClick={() => saveTxnEdit.mutate()}
                          >
                            Save
                          </button>{" "}
                          <button type="button" className="btn" onClick={() => setEditTxn(null)}>
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={row.id}>
                        <td>{formatDisplayDate(row.txn_date)}</td>
                        <td>{row.description}</td>
                        <td
                          className="table-numeric"
                          style={{
                            color: parseFloat(row.amount) < 0 ? "#b91c1c" : parseFloat(row.amount) > 0 ? "#047857" : undefined,
                            fontWeight: 600,
                          }}
                        >
                          {formatMoney(row.amount)}
                        </td>
                        <td className="muted" style={{ fontSize: "0.8125rem" }}>
                          {row.memo ?? "—"}
                        </td>
                        <td className="table-numeric">
                          <strong>{formatMoney(row.running_balance)}</strong>
                        </td>
                        <td>
                          <button type="button" className="btn" onClick={() => setEditTxn({ ...row, memo: row.memo ?? "" })}>
                            Edit
                          </button>{" "}
                          <button
                            type="button"
                            className="btn"
                            onClick={() => {
                              if (window.confirm("Remove this line from the register?")) {
                                deleteTxn.mutate(row.id);
                              }
                            }}
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
          )}

          {saveTxnEdit.isError && (
            <p className="error" style={{ marginTop: "0.5rem" }}>
              {(saveTxnEdit.error as Error).message}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function EditAccountForm({
  account,
  onClose,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
  error,
}: {
  account: BankAccount;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
  error: Error | null;
}) {
  const [name, setName] = useState(account.name);
  const [institution, setInstitution] = useState(account.institution_name ?? "");
  const [type, setType] = useState(account.account_type);
  const [lastFour, setLastFour] = useState(account.last_four ?? "");
  const [opening, setOpening] = useState(account.opening_balance);
  const [openingDate, setOpeningDate] = useState(account.opening_balance_date.slice(0, 10));
  const [notes, setNotes] = useState(account.notes ?? "");
  const [active, setActive] = useState(account.is_active);

  return (
    <div className="card-totals" style={{ marginBottom: "1.5rem", maxWidth: "520px" }}>
      <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Edit account</h2>
      <div style={{ display: "grid", gap: "0.65rem" }}>
        <label>
          Display name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Bank / institution
          <input value={institution} onChange={(e) => setInstitution(e.target.value)} />
        </label>
        <label>
          Account type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {ACCOUNT_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Last 4 digits
          <input value={lastFour} onChange={(e) => setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </label>
        <label>
          Starting balance
          <input value={opening} onChange={(e) => setOpening(e.target.value)} />
        </label>
        <label>
          Starting balance as of
          <input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
        </label>
        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ width: "100%", font: "inherit" }} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active (included in dashboard total)
        </label>
        {error && (
          <span className="error" style={{ fontSize: "0.875rem" }}>
            {error.message}
          </span>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button
            type="button"
            className="btn primary"
            disabled={!name.trim() || isSaving}
            onClick={() =>
              onSave({
                name: name.trim(),
                institution_name: institution.trim() || null,
                account_type: type,
                last_four: lastFour.trim() || null,
                opening_balance: String(parseAmountInput(opening) ?? 0),
                opening_balance_date: openingDate,
                notes: notes.trim() || null,
                is_active: active,
              })
            }
          >
            Save changes
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn" style={{ marginLeft: "auto", color: "#b91c1c", borderColor: "#fecaca" }} disabled={isDeleting} onClick={onDelete}>
            Delete account
          </button>
        </div>
      </div>
    </div>
  );
}
