"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, endpoints, type Lot } from "@/lib/api";
import { ExpirationBadge } from "@/components/expiration-badge";
import { formatDisplayDate } from "@/lib/utils/date";

export default function Lots() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: lots, isLoading, error: loadError } = useQuery({
    queryKey: ["lots"],
    queryFn: () => api.get<Lot[]>(endpoints.lots.list()),
  });

  const deleteLot = useMutation({
    mutationFn: (id: number) => api.delete(endpoints.lots.delete(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lots"] });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleDelete = (lot: Lot) => {
    if (!window.confirm(`Delete lot "${lot.lot_number}"? This may fail if inventory or supplier invoices use this lot.`)) return;
    deleteLot.mutate(lot.id);
  };

  if (isLoading) return <div className="loading">Loading lots…</div>;
  if (loadError) return <div className="error">Failed to load: {(loadError as Error).message}</div>;

  return (
    <>
      <h1>Lots</h1>
      <p className="weight-label">USDA traceability. Sorted by expiration (FEFO).</p>
      {error && <div className="error" role="alert" style={{ marginBottom: "1rem" }}>{error}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Lot number</th>
              <th>Supplier ID</th>
              <th>Receive date</th>
              <th>Expiration</th>
              <th style={{ width: "6rem", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(lots ?? []).map((l) => (
              <tr key={l.id}>
                <td>{l.lot_number}</td>
                <td>{l.supplier_id}</td>
                <td>{formatDisplayDate(l.receive_date)}</td>
                <td><ExpirationBadge expirationDate={l.expiration_date} /></td>
                <td style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleDelete(l)}
                    disabled={deleteLot.isPending}
                    title={`Delete lot ${l.lot_number}`}
                  >
                    {deleteLot.isPending ? "…" : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
