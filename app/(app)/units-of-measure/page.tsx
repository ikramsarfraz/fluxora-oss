"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, endpoints, type UnitOfMeasure } from "@/lib/api";

export default function UnitsOfMeasurePage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [abbr, setAbbr] = useState("");
  const [notes, setNotes] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: units = [], isLoading, error: loadError } = useQuery({
    queryKey: ["unitsOfMeasure"],
    queryFn: () => api.get<UnitOfMeasure[]>(endpoints.unitsOfMeasure.list()),
  });

  const createU = useMutation({
    mutationFn: () =>
      api.post<UnitOfMeasure>(endpoints.unitsOfMeasure.create(), {
        name: name.trim(),
        abbreviation: abbr.trim() || null,
        notes: notes.trim() || null,
        sort_order: parseInt(sortOrder, 10) || 0,
        is_active: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unitsOfMeasure"] });
      setName("");
      setAbbr("");
      setNotes("");
      setSortOrder("0");
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateU = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api.patch<UnitOfMeasure>(endpoints.unitsOfMeasure.update(id), body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unitsOfMeasure"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setEditingId(null);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteU = useMutation({
    mutationFn: (id: number) => api.delete(endpoints.unitsOfMeasure.delete(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unitsOfMeasure"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div>
      <h1>Units of measure</h1>
      <p className="muted" style={{ marginTop: "-0.5rem", marginBottom: "1.25rem" }}>
        Like QuickBooks: define the units you use for inventory, purchasing, and sales (lb, case, each, etc.).
        Then assign <strong>stock</strong>, <strong>purchase</strong>, and <strong>sales</strong> units on each product on the Products page.
        This app still bills catch-weight lines by weight where applicable — UOM is for clarity and reporting labels.
      </p>

      {(loadError || error) && (
        <div className="error" role="alert">
          {(loadError as Error)?.message ?? error}
        </div>
      )}

      <section className="card-totals" style={{ marginBottom: "1.5rem", maxWidth: "520px" }}>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Add unit</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!name.trim()) {
              setError("Name is required.");
              return;
            }
            createU.mutate();
          }}
          style={{ display: "grid", gap: "0.65rem" }}
        >
          <label>
            Name *
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pallet" />
          </label>
          <label>
            Abbreviation
            <input value={abbr} onChange={(e) => setAbbr(e.target.value)} placeholder="e.g. plt" maxLength={16} />
          </label>
          <label>
            Notes
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <label>
            Sort order
            <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} type="number" />
          </label>
          <button type="submit" className="btn primary" disabled={createU.isPending}>
            Add unit
          </button>
        </form>
      </section>

      {isLoading && <p className="loading">Loading…</p>}

      {!isLoading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Abbr</th>
                <th>Sort</th>
                <th>Active</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {units.map((u) =>
                editingId === u.id ? (
                  <EditRow
                    key={u.id}
                    unit={u}
                    onSave={(body) => updateU.mutate({ id: u.id, body })}
                    onCancel={() => setEditingId(null)}
                    isSaving={updateU.isPending}
                  />
                ) : (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                    </td>
                    <td>{u.abbreviation ?? "—"}</td>
                    <td>{u.sort_order}</td>
                    <td>{u.is_active ? "Yes" : "No"}</td>
                    <td className="muted" style={{ fontSize: "0.8125rem" }}>
                      {u.notes ?? "—"}
                    </td>
                    <td>
                      <button type="button" className="btn" onClick={() => setEditingId(u.id)}>
                        Edit
                      </button>{" "}
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete "${u.name}"? Products using it will have that UOM cleared.`
                            )
                          ) {
                            deleteU.mutate(u.id);
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

      {units.length === 0 && !isLoading && <p className="muted">No units yet. Add one above.</p>}
    </div>
  );
}

function EditRow({
  unit,
  onSave,
  onCancel,
  isSaving,
}: {
  unit: UnitOfMeasure;
  onSave: (body: Record<string, unknown>) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(unit.name);
  const [abbr, setAbbr] = useState(unit.abbreviation ?? "");
  const [notes, setNotes] = useState(unit.notes ?? "");
  const [sortOrder, setSortOrder] = useState(String(unit.sort_order));
  const [active, setActive] = useState(unit.is_active);

  return (
    <tr>
      <td colSpan={6}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
          <label style={{ margin: 0 }}>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label style={{ margin: 0 }}>
            Abbr
            <input value={abbr} onChange={(e) => setAbbr(e.target.value)} maxLength={16} />
          </label>
          <label style={{ margin: 0 }}>
            Sort
            <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} type="number" />
          </label>
          <label style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>
          <label style={{ margin: 0, flex: "1 1 200px" }}>
            Notes
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn primary"
            disabled={isSaving || !name.trim()}
            onClick={() =>
              onSave({
                name: name.trim(),
                abbreviation: abbr.trim() || null,
                notes: notes.trim() || null,
                sort_order: parseInt(sortOrder, 10) || 0,
                is_active: active,
              })
            }
          >
            Save
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}
