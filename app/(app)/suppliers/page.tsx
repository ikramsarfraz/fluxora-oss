"use client";

import Link from "next/link";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, endpoints, type Supplier } from "@/lib/api";

export default function Suppliers() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const { data: suppliers, isLoading, error: loadError } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.get<Supplier[]>(endpoints.suppliers.list()),
  });

  const createSupplier = useMutation({
    mutationFn: (body: { name: string }) => api.post<Supplier>(endpoints.suppliers.create(), body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setName("");
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateSupplier = useMutation({
    mutationFn: ({ id, name: n }: { id: number; name: string }) =>
      api.patch<Supplier>(endpoints.suppliers.update(id), { name: n }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setEditingId(null);
      setEditName("");
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteSupplier = useMutation({
    mutationFn: (id: number) => api.delete(endpoints.suppliers.delete(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      if (editingId != null) setEditingId(null);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a supplier name.");
      return;
    }
    createSupplier.mutate({ name: trimmed });
  };

  const startEdit = (s: Supplier) => {
    setEditingId(s.id);
    setEditName(s.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setError(null);
  };

  const saveEdit = () => {
    if (editingId == null) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setError("Supplier name cannot be empty.");
      return;
    }
    updateSupplier.mutate({ id: editingId, name: trimmed });
  };

  const handleDelete = (s: Supplier) => {
    if (!window.confirm(`Delete supplier "${s.name}"? This may affect lots and supplier invoices that reference them.`)) return;
    deleteSupplier.mutate(s.id);
  };

  if (isLoading) return <div className="loading">Loading suppliers…</div>;
  if (loadError) return <div className="error">Failed to load: {(loadError as Error).message}</div>;

  return (
    <>
      <h1>Suppliers</h1>
      <p className="weight-label">Add and view suppliers for lots and supplier invoices.</p>

      <section className="card form-card" aria-labelledby="add-supplier-heading">
        <h2 id="add-supplier-heading" style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Add supplier</h2>
        <form onSubmit={handleCreate}>
          <div className="form-group" style={{ maxWidth: "320px" }}>
            <label htmlFor="supplier-name">Supplier name *</label>
            <input
              id="supplier-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ABC Meat Co."
              required
            />
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          <button type="submit" className="btn primary" disabled={createSupplier.isPending}>
            {createSupplier.isPending ? "Adding…" : "Add supplier"}
          </button>
        </form>
      </section>

      <section className="table-section" aria-labelledby="suppliers-table-heading">
        <h2 id="suppliers-table-heading" style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>All suppliers</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th style={{ width: "16rem", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(suppliers ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>
                    {editingId === s.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Supplier name"
                        style={{ width: "100%", maxWidth: "280px" }}
                        autoFocus
                        aria-label="Edit supplier name"
                      />
                    ) : (
                      <Link href={`/suppliers/${s.id}`}>{s.name}</Link>
                    )}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {editingId === s.id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={saveEdit}
                          disabled={updateSupplier.isPending || !editName.trim()}
                        >
                          {updateSupplier.isPending ? "Saving…" : "Save"}
                        </button>{" "}
                        <button type="button" className="btn btn-secondary" onClick={cancelEdit} disabled={updateSupplier.isPending}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <Link href={`/suppliers/${s.id}`}
                          className="btn btn-secondary"
                          style={{ marginRight: "0.25rem" }}
                          title="Spending & payments by month"
                        >
                          Portfolio
                        </Link>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => startEdit(s)}
                          disabled={deleteSupplier.isPending}
                        >
                          Edit
                        </button>{" "}
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleDelete(s)}
                          disabled={deleteSupplier.isPending}
                          title={`Delete ${s.name}`}
                        >
                          {deleteSupplier.isPending ? "…" : "Delete"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(suppliers ?? []).length === 0 && (
          <p className="empty-state">No suppliers yet. Add one above.</p>
        )}
      </section>
    </>
  );
}
