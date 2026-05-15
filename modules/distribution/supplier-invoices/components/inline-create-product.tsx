"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createCategoryAction } from "@/modules/distribution/categories/actions";
import { useCategories } from "@/modules/distribution/categories/hooks/use-categories";
import { useUnitsOfMeasure } from "@/modules/distribution/units-of-measure/hooks/use-units-of-measure";
import { createProductAction } from "@/modules/distribution/products/actions";
import { queryKeys } from "@/lib/query/keys";

// ---------------------------------------------------------------------------
// Inline product creation from the bill review surface.
//
// When AI can't match a vendor product to anything in the catalog, the user
// previously had to leave the review, create the product separately in
// /products, and come back. This component lets them do it inline — name +
// category + unit of measure, three required fields, no scrolling to another
// screen.
//
// "Complete enough" means: a catalog product that satisfies the price chart,
// supplier-cost tracking, and order fulfilment readers (all of which expect a
// product with at least one assigned category AND a base unit + one stock
// productUnit row).
// ---------------------------------------------------------------------------

const C = {
  surface: "#ffffff",
  surfaceAlt: "#fafafa",
  ink: "#0c0a09",
  muted: "#78716c",
  mutedSoft: "#a8a29e",
  line: "#e7e5e4",
  lineStrong: "#d4d1c7",
  accent: "#2563eb",
  accentBg: "#eff6ff",
  warn: "#dc2626",
  warnBg: "#fef2f2",
  warnBorder: "#fecaca",
} as const;

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "6px 8px",
  fontSize: 12,
  border: `1px solid ${C.lineStrong}`,
  borderRadius: 6,
  background: C.surface,
  color: C.ink,
  outline: "none",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  color: C.muted,
  display: "block",
  marginBottom: 3,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

// Slugify a name into a SKU. Client-side mint — server-side `createProduct`
// validates uniqueness; on conflict we'll get an error we can surface.
function generateSku(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${slug || "prod"}-${suffix}`;
}

type Props = {
  /** Vendor text from the bill — used to prefill the product name. */
  vendorProductName: string;
  /**
   * Line's unitType from the parser when known. Drives the unit default so
   * the user usually doesn't have to think about it. Optional because the
   * review row doesn't always have the parser's prefill line in scope.
   */
  lineUnitType?: "catch_weight" | "fixed_case";
  /**
   * Resolve the review row with the newly-created product. The form binds
   * line.productId in its `handleVendorNameResolved` callback, so this is
   * the same hook the existing alias-confirm flow uses.
   */
  onCreated: (productId: string) => void;
  /** Hide the inline form (close button / cancel). */
  onCancel: () => void;
};

export function InlineCreateProduct({
  vendorProductName,
  lineUnitType = "catch_weight",
  onCreated,
  onCancel,
}: Props) {
  const queryClient = useQueryClient();
  const categoriesQuery = useCategories();
  const unitsQuery = useUnitsOfMeasure();

  const existingCategories = useMemo(
    () => categoriesQuery.data?.filter(c => !c.archivedAt) ?? [],
    [categoriesQuery.data],
  );
  const availableUnits = useMemo(
    () => (unitsQuery.data ?? []).filter(u => u.isActive),
    [unitsQuery.data],
  );

  // Suggest a unit based on the bill line's pricing model. Catch-weight
  // invoices price per lb, so a Pound base unit is almost always correct;
  // fixed-case invoices price per case.
  const defaultUnitId = useMemo(() => {
    const wanted = lineUnitType === "catch_weight" ? /pound|^lb$|lbs/i : /case|each/i;
    const match = availableUnits.find(u =>
      wanted.test(u.name) || (u.abbreviation && wanted.test(u.abbreviation)),
    );
    return match?.id ?? availableUnits[0]?.id ?? "";
  }, [availableUnits, lineUnitType]);

  // Clean up the vendor text the way first-bill does: strip leading SKU-ish
  // prefixes and title-case the rest. The user can still edit.
  const initialName = useMemo(() => {
    const stripped = vendorProductName.replace(/^[A-Z0-9]{2,6}[-_ ]/i, "").trim();
    return stripped
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  }, [vendorProductName]);

  const [name, setName] = useState(initialName);
  const [categoryMode, setCategoryMode] = useState<"existing" | "new">(
    existingCategories.length > 0 ? "existing" : "new",
  );
  const [categoryId, setCategoryId] = useState<string>("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [unitId, setUnitId] = useState<string>(defaultUnitId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once categories/units load, fill the defaults if the user hasn't
  // touched the controls yet. The setState-in-effect lint rule flags this
  // even though "external data finished loading" is exactly the kind of
  // post-mount sync useEffect exists for.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!unitId && defaultUnitId) setUnitId(defaultUnitId);
  }, [defaultUnitId, unitId]);
  useEffect(() => {
    if (categoryMode === "existing" && !categoryId && existingCategories[0]) {
      setCategoryId(existingCategories[0].id);
    }
  }, [categoryMode, categoryId, existingCategories]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const canSubmit =
    !pending &&
    name.trim().length > 0 &&
    !!unitId &&
    (categoryMode === "existing"
      ? !!categoryId
      : newCategoryName.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      // 1. Resolve a category id (create one inline if the user typed a new name).
      let resolvedCategoryId = categoryId;
      if (categoryMode === "new") {
        const created = await createCategoryAction({
          name: newCategoryName.trim(),
        });
        resolvedCategoryId = created.id;
        await queryClient.invalidateQueries({
          queryKey: queryKeys.categories.all,
        });
      }

      // 2. Create the product with the resolved category + one stock unit.
      //    Using the same unit as the base + a stock productUnit with
      //    conversion=1 means the product is immediately usable for
      //    receiving (which is what the bill review is leading toward).
      const product = await createProductAction({
        sku: generateSku(name.trim()),
        name: name.trim(),
        categoryIds: [resolvedCategoryId],
        baseUnitId: unitId,
        units: [
          {
            unitId,
            purpose: "stock",
            conversionToBase: "1.0000",
            isDefault: true,
            allowsFractional: true,
            sortOrder: 0,
          },
        ],
      });

      await queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success(`Created "${product.name}".`);
      onCreated(product.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 10,
        padding: 12,
        background: C.surfaceAlt,
        border: `1px solid ${C.lineStrong}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.muted,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 8,
        }}
      >
        Create catalog product
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {/* Name */}
        <div>
          <label htmlFor="inline-product-name" style={labelStyle}>
            Name
          </label>
          <input
            id="inline-product-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Halal Lamb Shoulder"
            disabled={pending}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            style={inputStyle}
          />
        </div>

        {/* Category */}
        <div>
          <label style={labelStyle}>
            Category{" "}
            <button
              type="button"
              onClick={() =>
                setCategoryMode(m => (m === "existing" ? "new" : "existing"))
              }
              disabled={pending || existingCategories.length === 0}
              style={{
                marginLeft: 6,
                fontSize: 10.5,
                color: C.accent,
                background: "none",
                border: "none",
                cursor:
                  pending || existingCategories.length === 0
                    ? "not-allowed"
                    : "pointer",
                padding: 0,
                fontFamily: "inherit",
                textTransform: "none",
                letterSpacing: 0,
                fontWeight: 500,
              }}
            >
              {categoryMode === "existing"
                ? "+ New category"
                : "← Use existing"}
            </button>
          </label>
          {categoryMode === "existing" ? (
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              disabled={pending || existingCategories.length === 0}
              style={inputStyle}
            >
              {existingCategories.length === 0 && (
                <option value="">No categories yet — create one</option>
              )}
              {existingCategories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              placeholder="e.g. Meat, Poultry"
              disabled={pending}
              style={inputStyle}
            />
          )}
        </div>

        {/* Unit of measure */}
        <div>
          <label htmlFor="inline-product-unit" style={labelStyle}>
            Stock unit
            <span
              style={{
                color: C.mutedSoft,
                fontWeight: 400,
                marginLeft: 6,
                textTransform: "none",
                letterSpacing: 0,
              }}
            >
              {lineUnitType === "catch_weight"
                ? "(weighed)"
                : "(per case)"}
            </span>
          </label>
          <select
            id="inline-product-unit"
            value={unitId}
            onChange={e => setUnitId(e.target.value)}
            disabled={pending || availableUnits.length === 0}
            style={inputStyle}
          >
            {availableUnits.length === 0 && (
              <option value="">No units configured</option>
            )}
            {availableUnits.map(u => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.abbreviation ? ` (${u.abbreviation})` : ""}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div
            style={{
              padding: "6px 8px",
              background: C.warnBg,
              border: `1px solid ${C.warnBorder}`,
              borderRadius: 6,
              fontSize: 11.5,
              color: C.warn,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 2 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            style={{
              padding: "5px 10px",
              fontSize: 11.5,
              borderRadius: 6,
              border: `1px solid ${C.lineStrong}`,
              background: C.surface,
              color: C.ink,
              cursor: pending ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: "5px 12px",
              fontSize: 11.5,
              fontWeight: 600,
              borderRadius: 6,
              border: "none",
              background: canSubmit ? C.ink : C.mutedSoft,
              color: "#fff",
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}
          >
            {pending ? "Creating…" : "Create & assign"}
          </button>
        </div>
      </div>
    </div>
  );
}
