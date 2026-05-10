"use client";

import React, { useMemo, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";

import {
  useDeleteCustomerPrice,
  usePriceChart,
  usePromoteProductVendor,
  useSetCustomerPrice,
} from "@/modules/distribution/price-chart/hooks/use-price-chart";
import { DetailSection } from "@/components/detail-section";
import type { PriceChartData } from "@/modules/distribution/price-chart/services/price-chart";

type Product = PriceChartData["products"][number];
type Vendor = Product["vendors"][number];

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(raw: string | number | undefined | null): string {
  if (raw == null || raw === "") return "";
  const n = Number(raw);
  return Number.isFinite(n) ? n.toFixed(2) : String(raw);
}

function defPrice(cost: string, markup: number) {
  return Number(cost) * (1 + markup / 100);
}

// ── VendorSubRows ─────────────────────────────────────────────────────────────

function VendorSubRows({
  vendors,
  onPromote,
  promoting,
  promotingId,
}: {
  vendors: Vendor[];
  onPromote: (supplierId: string) => void;
  promoting: boolean;
  promotingId: string | null;
}) {
  const primaryCost = Number(
    vendors.find(v => v.is_primary)?.cost_per_lb ?? vendors[0]?.cost_per_lb ?? 0,
  );

  return (
    <>
      {vendors.map(v => {
        const cost = Number(v.cost_per_lb);
        const delta = cost - primaryCost;
        const deltaPct = primaryCost > 0 ? (delta / primaryCost) * 100 : 0;
        const isPromoting = promoting && promotingId === v.supplier_id;

        return (
          <tr
            key={v.supplier_id}
            style={{ background: "oklch(98.5% 0 0)", borderBottom: "1px solid #f5f5f4" }}
          >
            {/* indent */}
            <td style={{ padding: "8px 16px 8px 36px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 3,
                    alignSelf: "stretch",
                    borderRadius: 2,
                    background: v.is_primary ? "oklch(48% 0.16 265)" : "#e7e5e4",
                    flexShrink: 0,
                    marginRight: 4,
                  }}
                />
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "#0c0a09",
                    }}
                  >
                    {v.supplier_name}
                    {v.is_primary && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          color: "oklch(48% 0.16 265)",
                          background: "oklch(96% 0.02 265)",
                          padding: "1px 6px",
                          borderRadius: 100,
                          border: "1px solid oklch(90% 0.04 265)",
                        }}
                      >
                        Primary
                      </span>
                    )}
                  </div>
                  {v.last_received_at && (
                    <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 2 }}>
                      Last received{" "}
                      {new Date(v.last_received_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  )}
                </div>
              </div>
            </td>

            {/* cost */}
            <td style={{ padding: "8px 16px", textAlign: "right", verticalAlign: "middle" }}>
              <span
                style={{
                  fontFamily: "var(--font-geist-mono, monospace)",
                  fontSize: 13,
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: v.is_primary ? 600 : 500,
                  color: v.is_primary ? "#0c0a09" : "#78716c",
                }}
              >
                ${fmt(v.cost_per_lb)}
              </span>
              {!v.is_primary && Math.abs(delta) > 0.001 && (
                <div
                  style={{
                    fontSize: 10.5,
                    fontFamily: "var(--font-geist-mono, monospace)",
                    fontVariantNumeric: "tabular-nums",
                    color: delta > 0 ? "oklch(58% 0.18 25)" : "oklch(58% 0.13 155)",
                    marginTop: 1,
                  }}
                >
                  {delta > 0 ? "+" : ""}${Math.abs(delta).toFixed(2)} ({deltaPct > 0 ? "+" : ""}
                  {deltaPct.toFixed(1)}%)
                </div>
              )}
            </td>

            {/* default / their price / margin — empty */}
            <td /><td /><td />

            {/* make primary */}
            <td style={{ padding: "8px 16px", textAlign: "center" }}>
              {!v.is_primary && (
                <button
                  onClick={() => onPromote(v.supplier_id)}
                  disabled={promoting}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11.5,
                    fontWeight: 500,
                    border: "1px solid #e7e5e4",
                    borderRadius: 5,
                    background: "#fff",
                    color: "#44403c",
                    cursor: promoting ? "not-allowed" : "pointer",
                    opacity: promoting ? 0.6 : 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {isPromoting ? "Promoting…" : "Make primary"}
                </button>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}

// ── ProductRow ────────────────────────────────────────────────────────────────

function ProductRow({
  prod,
  customerId,
  markup,
  priceMap,
  onCommit,
  onReset,
  deleting,
  expanded,
  onToggleExpand,
  onPromote,
  promoting,
  promotingId,
}: {
  prod: Product;
  customerId: string;
  markup: number;
  priceMap: Map<string, string>;
  onCommit: (productId: string, value: string) => void;
  onReset: () => void;
  deleting: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onPromote: (supplierId: string) => void;
  promoting: boolean;
  promotingId: string | null;
}) {
  const key = `${customerId}:${prod.id}`;
  const storedOverride = priceMap.get(key);
  const isOverride = storedOverride !== undefined;
  const def = prod.cost ? defPrice(prod.cost, markup) : null;
  const [inputVal, setInputVal] = useState(storedOverride ?? "");
  const [focused, setFocused] = useState(false);

  const prevKey = useRef(key);
  const prevOverride = useRef(storedOverride);
  if (prevKey.current !== key || prevOverride.current !== storedOverride) {
    prevKey.current = key;
    prevOverride.current = storedOverride;
    setInputVal(storedOverride ?? "");
  }

  const displayMargin =
    def != null
      ? isOverride
        ? ((Number(storedOverride) - Number(prod.cost)) / Number(prod.cost)) * 100
        : ((def - Number(prod.cost)) / Number(prod.cost)) * 100
      : null;

  const marginColor =
    displayMargin == null
      ? "#a8a29e"
      : displayMargin >= 5
        ? "oklch(58% 0.13 155)"
        : displayMargin < 0
          ? "oklch(58% 0.18 25)"
          : "#78716c";

  const multiVendor = prod.vendors.length > 1;
  const primaryVendor = prod.vendors.find(v => v.is_primary) ?? prod.vendors[0] ?? null;

  return (
    <>
      <tr style={{ borderBottom: expanded ? "none" : "1px solid #f5f5f4" }}>
        {/* product */}
        <td style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                fontFamily: "var(--font-geist-mono, monospace)",
                fontSize: 10.5,
                color: "#78716c",
                padding: "2px 6px",
                background: "#f5f5f4",
                borderRadius: 4,
                minWidth: 80,
                textAlign: "center",
                flexShrink: 0,
              }}
            >
              {prod.sku}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{prod.name}</div>
              {multiVendor && primaryVendor && (
                <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 1 }}>
                  {primaryVendor.supplier_name}
                </div>
              )}
            </div>
          </div>
        </td>

        {/* cost */}
        <td style={{ padding: "12px 16px", textAlign: "right", verticalAlign: "middle" }}>
          {prod.cost ? (
            multiVendor ? (
              <button
                onClick={onToggleExpand}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: expanded ? "#f5f5f4" : "transparent",
                  border: "none",
                  borderRadius: 5,
                  padding: "3px 6px 3px 3px",
                  cursor: "pointer",
                }}
              >
                <span style={{ color: "#a8a29e", display: "grid", placeItems: "center" }}>
                  {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-geist-mono, monospace)",
                    fontSize: 13,
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 500,
                    color: "#44403c",
                  }}
                >
                  ${fmt(prod.cost)}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    color: "oklch(48% 0.16 265)",
                    background: "oklch(96% 0.02 265)",
                    padding: "1px 5px",
                    borderRadius: 100,
                    fontWeight: 500,
                  }}
                >
                  of {prod.vendors.length}
                </span>
              </button>
            ) : (
              <>
                <span
                  style={{
                    fontFamily: "var(--font-geist-mono, monospace)",
                    fontSize: 13,
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 500,
                    color: "#44403c",
                  }}
                >
                  ${fmt(prod.cost)}
                </span>
                <span style={{ fontSize: 11, color: "#a8a29e", marginLeft: 2 }}>/lb</span>
              </>
            )
          ) : (
            <span style={{ fontSize: 12, color: "#a8a29e" }}>—</span>
          )}
        </td>

        {/* default */}
        <td style={{ padding: "12px 16px", textAlign: "right", verticalAlign: "middle" }}>
          {def != null ? (
            <span
              style={{
                fontFamily: "var(--font-geist-mono, monospace)",
                fontSize: 13,
                fontVariantNumeric: "tabular-nums",
                color: "#78716c",
                fontWeight: 500,
              }}
            >
              ${def.toFixed(2)}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "#a8a29e" }}>—</span>
          )}
        </td>

        {/* their price */}
        <td style={{ padding: "8px 16px", verticalAlign: "middle" }}>
          {def != null ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                <span
                  style={{
                    position: "absolute",
                    left: 9,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#a8a29e",
                    fontSize: 12,
                    fontFamily: "var(--font-geist-mono, monospace)",
                    pointerEvents: "none",
                  }}
                >
                  $
                </span>
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  value={inputVal}
                  placeholder={def.toFixed(2)}
                  onFocus={() => setFocused(true)}
                  onBlur={e => {
                    setFocused(false);
                    onCommit(prod.id, e.target.value);
                  }}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === "Tab") {
                      (e.target as HTMLInputElement).blur();
                    }
                    if (e.key === "Escape") {
                      setInputVal(storedOverride ?? "");
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  style={{
                    width: 110,
                    padding: "7px 10px 7px 22px",
                    borderRadius: 6,
                    border: focused
                      ? "1px solid oklch(48% 0.16 265)"
                      : isOverride
                        ? "1px solid oklch(92% 0.03 265)"
                        : "1px solid transparent",
                    background: focused
                      ? "#fff"
                      : isOverride
                        ? "oklch(98% 0.015 265)"
                        : "transparent",
                    boxShadow: focused ? "0 0 0 3px oklch(96% 0.02 265)" : "none",
                    fontFamily: "var(--font-geist-mono, monospace)",
                    fontSize: 13,
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: isOverride && !focused ? 600 : 500,
                    color: focused ? "#0c0a09" : isOverride ? "oklch(50% 0.15 265)" : "#78716c",
                    textAlign: "right",
                    outline: "none",
                    transition: "background 0.1s, border-color 0.1s",
                  }}
                />
              </div>
              {isOverride && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "1px 6px",
                    borderRadius: 100,
                    fontSize: 10.5,
                    fontWeight: 500,
                    background: "oklch(98% 0.015 265)",
                    color: "oklch(50% 0.15 265)",
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "oklch(50% 0.15 265)",
                      display: "inline-block",
                    }}
                  />
                  Override
                </span>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 12, color: "#a8a29e" }}>—</span>
          )}
        </td>

        {/* margin */}
        <td style={{ padding: "12px 16px", textAlign: "right", verticalAlign: "middle" }}>
          {displayMargin != null ? (
            <span
              style={{
                fontFamily: "var(--font-geist-mono, monospace)",
                fontSize: 12,
                fontVariantNumeric: "tabular-nums",
                color: marginColor,
              }}
            >
              {displayMargin >= 0 ? "+" : ""}
              {displayMargin.toFixed(1)}%
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "#a8a29e" }}>—</span>
          )}
        </td>

        {/* reset */}
        <td style={{ padding: "12px 16px", textAlign: "center", verticalAlign: "middle" }}>
          {isOverride && (
            <button
              onClick={onReset}
              disabled={deleting}
              title="Reset to default"
              style={{
                width: 24,
                height: 24,
                display: "grid",
                placeItems: "center",
                borderRadius: 4,
                border: "none",
                background: "transparent",
                color: "#78716c",
                cursor: deleting ? "not-allowed" : "pointer",
                opacity: deleting ? 0.5 : 1,
              }}
            >
              <RotateCcw size={13} />
            </button>
          )}
        </td>
      </tr>

      {expanded && prod.vendors.length > 0 && (
        <VendorSubRows
          vendors={prod.vendors}
          onPromote={onPromote}
          promoting={promoting}
          promotingId={promotingId}
        />
      )}
      {expanded && (
        <tr>
          <td colSpan={6} style={{ height: 1, background: "#e7e5e4", padding: 0 }} />
        </tr>
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function CustomerPriceSection({ customerId }: { customerId: string }) {
  const { data, isLoading } = usePriceChart();
  const setPrice = useSetCustomerPrice();
  const deletePrice = useDeleteCustomerPrice();
  const promote = usePromoteProductVendor();
  const onError = useCallback((e: Error) => toast.error(e.message), []);

  const [markup, setMarkup] = useState(7);
  const [editingMarkup, setEditingMarkup] = useState(false);
  const [markupDraft, setMarkupDraft] = useState("7");
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  const products = useMemo(() => data?.products ?? [], [data]);
  const prices = useMemo(() => data?.prices ?? [], [data]);

  const priceMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of prices) {
      m.set(`${p.customer_id}:${p.product_id}`, fmt(p.price_per_lb));
    }
    return m;
  }, [prices]);

  function commitMarkup() {
    const v = parseFloat(markupDraft);
    if (Number.isFinite(v) && v >= 0) setMarkup(v);
    setEditingMarkup(false);
  }

  function handleCommit(productId: string, rawValue: string) {
    const prod = products.find(p => p.id === productId);
    if (!prod?.cost) return;
    const def = defPrice(prod.cost, markup);
    if (!rawValue.trim()) {
      deletePrice.mutate({ customerId, productId }, { onError });
      return;
    }
    const v = parseFloat(rawValue);
    if (!Number.isFinite(v) || v < 0) return;
    if (Math.abs(v - def) < 0.005) {
      deletePrice.mutate({ customerId, productId }, { onError });
      toast.success("Matches default — no override stored");
      return;
    }
    setPrice.mutate({ customerId, productId, pricePerLb: v.toFixed(2) }, { onError });
  }

  function handlePromote(productId: string, supplierId: string, vendorName: string, productName: string) {
    promote.mutate(
      { productId, supplierId },
      {
        onError,
        onSuccess: () => toast.success(`${vendorName} is now primary vendor for ${productName}`),
      },
    );
  }

  const overrideCount = prices.filter(p => p.customer_id === customerId).length;

  const description = isLoading
    ? "Loading prices…"
    : `${products.length} products · ${overrideCount} override${overrideCount !== 1 ? "s" : ""}. Empty = cost × markup. Type a value to override; clear to revert.`;

  return (
    <DetailSection title="Prices" description={description}>
      {isLoading ? null : products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products yet.</p>
      ) : (
        <div style={{ marginTop: 4 }}>
          {/* markup control */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 12,
              fontSize: 12,
              color: "#78716c",
            }}
          >
            <span>Default markup:</span>
            {editingMarkup ? (
              <input
                autoFocus
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={markupDraft}
                onChange={e => setMarkupDraft(e.target.value)}
                onBlur={commitMarkup}
                onKeyDown={e => {
                  if (e.key === "Enter") commitMarkup();
                  if (e.key === "Escape") setEditingMarkup(false);
                }}
                style={{
                  width: 52,
                  padding: "2px 4px",
                  border: "1px solid oklch(48% 0.16 265)",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  outline: "none",
                  boxShadow: "0 0 0 2px oklch(96% 0.02 265)",
                }}
              />
            ) : (
              <button
                onClick={() => {
                  setMarkupDraft(String(markup));
                  setEditingMarkup(true);
                }}
                style={{
                  fontWeight: 600,
                  color: "#0c0a09",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  padding: "0 2px",
                  borderRadius: 3,
                  textDecoration: "underline dotted",
                  textUnderlineOffset: 2,
                }}
              >
                {markup}%
              </button>
            )}
            <span style={{ color: "#a8a29e", fontSize: 11 }}>
              (used to compute Default column · not stored)
            </span>
          </div>

          {/* table */}
          <div
            style={{
              border: "1px solid #e7e5e4",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {(
                    [
                      ["Product", "auto", "left"],
                      ["Cost", 110, "right"],
                      ["Default", 120, "right"],
                      ["Their price", 190, "left"],
                      ["Margin", 90, "right"],
                      ["", 44, "center"],
                    ] as const
                  ).map(([label, w, align], i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: align,
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#78716c",
                        padding: "9px 16px",
                        borderBottom: "1px solid #e7e5e4",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        background: "#fafaf9",
                        width: typeof w === "number" ? w : undefined,
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map(prod => (
                  <ProductRow
                    key={prod.id}
                    prod={prod}
                    customerId={customerId}
                    markup={markup}
                    priceMap={priceMap}
                    onCommit={handleCommit}
                    onReset={() =>
                      deletePrice.mutate({ customerId, productId: prod.id }, { onError })
                    }
                    deleting={
                      deletePrice.isPending &&
                      deletePrice.variables?.productId === prod.id &&
                      deletePrice.variables?.customerId === customerId
                    }
                    expanded={expandedProductId === prod.id}
                    onToggleExpand={() =>
                      setExpandedProductId(id => (id === prod.id ? null : prod.id))
                    }
                    onPromote={supplierId =>
                      handlePromote(
                        prod.id,
                        supplierId,
                        prod.vendors.find(v => v.supplier_id === supplierId)?.supplier_name ?? "",
                        prod.name,
                      )
                    }
                    promoting={promote.isPending}
                    promotingId={promote.isPending ? (promote.variables?.supplierId ?? null) : null}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DetailSection>
  );
}
