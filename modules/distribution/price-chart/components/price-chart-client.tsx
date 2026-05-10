"use client";

import React, { useMemo, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, RotateCcw, Search, Truck } from "lucide-react";
import {
  useApplyMarkupToCustomer,
  useDeleteCustomerPrice,
  usePriceChart,
  usePromoteProductVendor,
  useSetCustomerPrice,
  useUpdateCustomerFuelSurcharge,
} from "../hooks/use-price-chart";
import type { PriceChartData } from "../services/price-chart";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";

type Product = PriceChartData["products"][number];
type Vendor = Product["vendors"][number];
type Customer = PriceChartData["customers"][number];

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(raw: string | number | undefined | null): string {
  if (raw == null || raw === "") return "";
  const n = Number(raw);
  return Number.isFinite(n) ? n.toFixed(2) : String(raw);
}

function initials(name: string): string {
  const parts = name.replace(/[^a-zA-Z\s]/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function defaultPrice(cost: string, markup: number): number {
  return Number(cost) * (1 + markup / 100);
}

function overrideCount(prices: PriceChartData["prices"], customerId: string): number {
  return prices.filter(p => p.customer_id === customerId).length;
}

// ── CustomerList ──────────────────────────────────────────────────────────────

function CustomerList({
  customers,
  prices,
  selected,
  onSelect,
}: {
  customers: Customer[];
  prices: PriceChartData["prices"];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = customers.filter(
    c => !search || c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <aside
      style={{
        width: 300,
        flexShrink: 0,
        background: "#fff",
        border: "1px solid #e7e5e4",
        borderRadius: 10,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        position: "sticky",
        top: 80,
        maxHeight: "calc(100vh - 110px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #f5f5f4" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#78716c",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Customers
          </span>
          <span
            style={{
              background: "#f5f5f4",
              color: "#44403c",
              fontSize: 11,
              padding: "1px 7px",
              borderRadius: 100,
            }}
          >
            {filtered.length}
          </span>
        </div>
        <div style={{ position: "relative" }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 9,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#78716c",
              pointerEvents: "none",
            }}
          />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customers…"
            style={{
              width: "100%",
              padding: "7px 10px 7px 30px",
              border: "1px solid #e7e5e4",
              borderRadius: 6,
              background: "#fafaf9",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>
      </div>

      <div style={{ overflowY: "auto", padding: "6px 0" }}>
        {filtered.map(c => {
          const isActive = c.id === selected;
          const ovr = overrideCount(prices, c.id);
          const fuel = c.fuel_surcharge_amount;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "9px 16px",
                width: "100%",
                background: isActive ? "oklch(96% 0.02 265)" : "transparent",
                border: "none",
                borderLeft: isActive ? "3px solid oklch(48% 0.16 265)" : "3px solid transparent",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  flexShrink: 0,
                  borderRadius: 7,
                  background: isActive ? "oklch(48% 0.16 265)" : "#f5f5f4",
                  color: isActive ? "#fff" : "#44403c",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {initials(c.name)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    lineHeight: 1.25,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: "#0c0a09",
                  }}
                >
                  {c.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#78716c",
                    marginTop: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {fuel && Number(fuel) > 0 && (
                    <>
                      <span style={{ color: "#a8a29e" }}>·</span>
                      <span>${fmt(fuel)} fuel</span>
                    </>
                  )}
                  {ovr > 0 && (
                    <>
                      <span style={{ color: "#a8a29e" }}>·</span>
                      <span
                        style={{
                          color: "oklch(50% 0.15 265)",
                          fontWeight: 500,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
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
                        {ovr}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

// ── CustomerCard ──────────────────────────────────────────────────────────────

function CustomerCard({
  customer,
  prices,
  allProducts,
  markup,
  onMarkupChange,
  onApplyMarkup,
  applyingMarkup,
}: {
  customer: Customer;
  prices: PriceChartData["prices"];
  allProducts: Product[];
  markup: number;
  onMarkupChange: (v: number) => void;
  onApplyMarkup: () => void;
  applyingMarkup: boolean;
}) {
  const [editingMarkup, setEditingMarkup] = useState(false);
  const [markupDraft, setMarkupDraft] = useState(String(markup));
  const inputRef = useRef<HTMLInputElement>(null);

  const ovr = overrideCount(prices, customer.id);
  const totalOverrides = prices.length;

  const avgMargin = useMemo(() => {
    if (!allProducts.length) return 0;
    let sum = 0;
    for (const p of allProducts) {
      const custPrice = prices.find(
        pr => pr.customer_id === customer.id && pr.product_id === p.id,
      );
      const price = custPrice ? Number(custPrice.price_per_lb) : defaultPrice(p.cost, markup);
      sum += ((price - Number(p.cost)) / Number(p.cost)) * 100;
    }
    return sum / allProducts.length;
  }, [allProducts, prices, customer.id, markup]);

  function commitMarkup() {
    const v = parseFloat(markupDraft);
    if (Number.isFinite(v) && v >= 0) {
      onMarkupChange(v);
      toast.success(`Default markup set to ${v}%`);
    }
    setEditingMarkup(false);
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e7e5e4",
        borderRadius: 10,
        padding: "18px 20px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        display: "flex",
        alignItems: "center",
        gap: 18,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          flexShrink: 0,
          borderRadius: 10,
          background: "oklch(96% 0.02 265)",
          color: "oklch(48% 0.16 265)",
          display: "grid",
          placeItems: "center",
          fontWeight: 600,
          fontSize: 16,
        }}
      >
        {initials(customer.name)}
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>
          {customer.name}
        </div>
      </div>
      <div style={{ flex: 1 }} />

      {/* stats */}
      <div
        style={{
          display: "flex",
          border: "1px solid #e7e5e4",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => {
            setEditingMarkup(true);
            setMarkupDraft(String(markup));
            setTimeout(() => inputRef.current?.select(), 0);
          }}
          title="Click to edit default markup"
          style={{
            padding: "10px 14px",
            minWidth: 110,
            background: "transparent",
            border: "none",
            borderRight: "1px solid #f5f5f4",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              color: "#78716c",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              fontWeight: 600,
              marginBottom: 2,
            }}
          >
            Markup
          </div>
          {editingMarkup ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <input
                ref={inputRef}
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
                  width: 56,
                  padding: "2px 4px",
                  border: "1px solid oklch(48% 0.16 265)",
                  borderRadius: 4,
                  fontSize: 14,
                  fontWeight: 600,
                  outline: "none",
                  boxShadow: "0 0 0 2px oklch(96% 0.02 265)",
                }}
              />
              <span style={{ fontSize: 12, color: "#78716c", fontWeight: 500 }}>%</span>
            </div>
          ) : (
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>
              {markup}
              <span style={{ fontSize: 12, color: "#78716c", fontWeight: 500, marginLeft: 1 }}>
                %
              </span>
            </div>
          )}
        </button>

        <div
          style={{
            padding: "10px 14px",
            borderRight: "1px solid #f5f5f4",
            minWidth: 130,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              color: "#78716c",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              fontWeight: 600,
              marginBottom: 2,
            }}
          >
            Overrides
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>
            {ovr}
            <span style={{ fontSize: 12, color: "#78716c", fontWeight: 500, marginLeft: 2 }}>
              / {totalOverrides}
            </span>
          </div>
        </div>

        <div
          style={{
            padding: "10px 14px",
            minWidth: 120,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              color: "#78716c",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              fontWeight: 600,
              marginBottom: 2,
            }}
          >
            Avg margin
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>
            {avgMargin >= 0 ? "+" : ""}
            {avgMargin.toFixed(1)}
            <span style={{ fontSize: 12, color: "#78716c", fontWeight: 500, marginLeft: 1 }}>
              %
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={onApplyMarkup}
        disabled={applyingMarkup}
        title={`Set all prices to cost × ${markup}%`}
        style={{
          padding: "7px 12px",
          borderRadius: 6,
          border: "1px solid #e7e5e4",
          background: "#fff",
          fontSize: 12,
          fontWeight: 500,
          color: "#44403c",
          cursor: applyingMarkup ? "not-allowed" : "pointer",
          opacity: applyingMarkup ? 0.6 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {applyingMarkup ? "Applying…" : `Apply ${markup}% markup`}
      </button>
    </div>
  );
}

// ── FuelCard ──────────────────────────────────────────────────────────────────

function FuelCard({
  customer,
  onSave,
  saving,
}: {
  customer: Customer;
  onSave: (amount: string | null) => void;
  saving: boolean;
}) {
  const current =
    customer.fuel_surcharge_amount != null ? fmt(customer.fuel_surcharge_amount) : "0.00";
  const [val, setVal] = useState(current);

  const prevId = useRef(customer.id);
  if (prevId.current !== customer.id) {
    prevId.current = customer.id;
    setVal(
      customer.fuel_surcharge_amount != null ? fmt(customer.fuel_surcharge_amount) : "0.00",
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 16px",
        background: "oklch(98.5% 0.015 70)",
        border: "1px solid oklch(92% 0.04 70)",
        borderRadius: 10,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: 8,
          background: "oklch(94% 0.05 70)",
          color: "oklch(40% 0.13 70)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Truck size={16} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500 }}>Fuel surcharge</div>
        <div style={{ fontSize: 11.5, color: "#78716c", marginTop: 2 }}>
          Flat fee added to every order. Set to 0 to waive.
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "#78716c",
            fontSize: 12,
            fontFamily: "var(--font-geist-mono, monospace)",
            pointerEvents: "none",
          }}
        >
          $
        </span>
        <input
          type="number"
          step={0.5}
          min={0}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => {
            const n = parseFloat(val);
            const amt = Number.isFinite(n) && n > 0 ? n.toFixed(2) : null;
            onSave(amt);
          }}
          onKeyDown={e => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          disabled={saving}
          style={{
            width: 80,
            padding: "6px 10px 6px 22px",
            border: "1px solid #e7e5e4",
            borderRadius: 6,
            background: "#fff",
            fontFamily: "var(--font-geist-mono, monospace)",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 500,
            textAlign: "right",
            fontSize: 13,
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}

// ── VendorSubRows ─────────────────────────────────────────────────────────────

function VendorSubRows({
  prod,
  vendors,
  onPromote,
  promoting,
  promotingId,
}: {
  prod: Product;
  vendors: Vendor[];
  onPromote: (supplierId: string) => void;
  promoting: boolean;
  promotingId: string | null;
}) {
  const primaryCost = Number(vendors.find(v => v.is_primary)?.cost_per_lb ?? vendors[0]?.cost_per_lb ?? 0);

  return (
    <>
      {vendors.map(v => {
        const cost = Number(v.cost_per_lb);
        const isPrimary = v.is_primary;
        const delta = cost - primaryCost;
        const deltaPct = primaryCost > 0 ? (delta / primaryCost) * 100 : 0;
        const isPromoting = promoting && promotingId === v.supplier_id;

        return (
          <tr
            key={v.supplier_id}
            style={{ background: "oklch(98.5% 0 0)", borderBottom: "1px solid #f5f5f4" }}
          >
            {/* indent in product col */}
            <td style={{ padding: "8px 16px 8px 32px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 3,
                    alignSelf: "stretch",
                    borderRadius: 2,
                    background: isPrimary ? "oklch(48% 0.16 265)" : "#e7e5e4",
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
                    {isPrimary && (
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
            <td style={{ padding: "8px 16px", textAlign: "right" }}>
              <span
                style={{
                  fontFamily: "var(--font-geist-mono, monospace)",
                  fontSize: 13,
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: isPrimary ? 600 : 500,
                  color: isPrimary ? "#0c0a09" : "#78716c",
                }}
              >
                ${fmt(v.cost_per_lb)}
              </span>
              {!isPrimary && Math.abs(delta) > 0.001 && (
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

            {/* default — empty for vendor rows */}
            <td />

            {/* their price — empty */}
            <td />

            {/* margin — empty */}
            <td />

            {/* action */}
            <td style={{ padding: "8px 16px", textAlign: "center" }}>
              {!isPrimary && (
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
  customer,
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
  customer: Customer;
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
  const key = `${customer.id}:${prod.id}`;
  const storedOverride = priceMap.get(key);
  const isOverride = storedOverride !== undefined;
  const def = prod.cost ? defaultPrice(prod.cost, markup) : null;
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
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                fontFamily: "var(--font-geist-mono, monospace)",
                fontSize: 10.5,
                color: "#78716c",
                padding: "2px 6px",
                background: "#f5f5f4",
                borderRadius: 4,
                minWidth: 86,
                textAlign: "center",
                letterSpacing: "0.02em",
                flexShrink: 0,
              }}
            >
              {prod.sku}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{prod.name}</div>
              {multiVendor && primaryVendor && (
                <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 2 }}>
                  {primaryVendor.supplier_name}
                </div>
              )}
            </div>
          </div>
        </td>

        {/* cost — clickable when multi-vendor */}
        <td style={{ padding: "12px 16px", textAlign: "right" }}>
          {prod.cost ? (
            multiVendor ? (
              <button
                onClick={onToggleExpand}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: expanded ? "#f5f5f4" : "transparent",
                  border: "none",
                  borderRadius: 5,
                  padding: "3px 6px 3px 3px",
                  cursor: "pointer",
                  textAlign: "right",
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
            <span style={{ fontSize: 12, color: "#a8a29e" }}>No vendors</span>
          )}
        </td>

        {/* default */}
        <td style={{ padding: "12px 16px", textAlign: "right" }}>
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
        <td style={{ padding: "8px 16px" }}>
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
                    color: focused
                      ? "#0c0a09"
                      : isOverride
                        ? "oklch(50% 0.15 265)"
                        : "#78716c",
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
        <td style={{ padding: "12px 16px", textAlign: "right" }}>
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
        <td style={{ padding: "12px 16px", textAlign: "center" }}>
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

      {/* vendor expand rows */}
      {expanded && prod.vendors.length > 0 && (
        <VendorSubRows
          prod={prod}
          vendors={prod.vendors}
          onPromote={onPromote}
          promoting={promoting}
          promotingId={promotingId}
        />
      )}
      {/* separator after vendor rows */}
      {expanded && (
        <tr>
          <td
            colSpan={6}
            style={{ height: 1, background: "#e7e5e4", padding: 0 }}
          />
        </tr>
      )}
    </>
  );
}

// ── SegControl ────────────────────────────────────────────────────────────────

function SegControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 2,
        background: "#f5f5f4",
        borderRadius: 6,
      }}
    >
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            background: value === opt.value ? "#fff" : "transparent",
            border: "none",
            padding: "5px 10px",
            fontSize: 12,
            fontWeight: 500,
            color: value === opt.value ? "#0c0a09" : "#78716c",
            borderRadius: 4,
            cursor: "pointer",
            boxShadow: value === opt.value ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── ProductTable ──────────────────────────────────────────────────────────────

function ProductTable({
  products,
  customer,
  prices,
  markup,
}: {
  products: Product[];
  customer: Customer;
  prices: PriceChartData["prices"];
  markup: number;
}) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState<"all" | "overrides">("all");
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  const setPrice = useSetCustomerPrice();
  const deletePrice = useDeleteCustomerPrice();
  const promote = usePromoteProductVendor();
  const onError = useCallback((e: Error) => toast.error(e.message), []);

  const priceMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of prices) {
      m.set(`${p.customer_id}:${p.product_id}`, fmt(p.price_per_lb));
    }
    return m;
  }, [prices]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const p of products) seen.add(p.category ?? "Other");
    return Array.from(seen).sort();
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p => {
      if (catFilter !== "all" && (p.category ?? "Other") !== catFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
      if (modeFilter === "overrides" && !priceMap.has(`${customer.id}:${p.id}`)) return false;
      return true;
    });
  }, [products, catFilter, search, modeFilter, priceMap, customer.id]);

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of filtered) {
      const cat = p.category ?? "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  function handleCommit(productId: string, rawValue: string) {
    const prod = products.find(p => p.id === productId);
    if (!prod?.cost) return;
    const def = defaultPrice(prod.cost, markup);
    if (!rawValue.trim()) {
      deletePrice.mutate({ customerId: customer.id, productId }, { onError });
      return;
    }
    const v = parseFloat(rawValue);
    if (!Number.isFinite(v) || v < 0) return;
    if (Math.abs(v - def) < 0.005) {
      deletePrice.mutate({ customerId: customer.id, productId }, { onError });
      toast.success(`Matches default — no override stored`);
      return;
    }
    setPrice.mutate({ customerId: customer.id, productId, pricePerLb: v.toFixed(2) }, { onError });
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

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          padding: "12px 16px",
          background: "#fff",
          border: "1px solid #e7e5e4",
          borderBottom: "none",
          borderRadius: "10px 10px 0 0",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ position: "relative", flex: "0 1 280px", minWidth: 200 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#78716c",
              pointerEvents: "none",
            }}
          />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search product or SKU…"
            style={{
              width: "100%",
              padding: "7px 10px 7px 32px",
              border: "1px solid #e7e5e4",
              borderRadius: 6,
              background: "#fff",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>

        <SegControl
          options={[
            { value: "all", label: "All" },
            ...categories.map(c => ({ value: c, label: c })),
          ]}
          value={catFilter}
          onChange={setCatFilter}
        />

        <SegControl
          options={[
            { value: "all", label: "All products" },
            { value: "overrides", label: "Overrides only" },
          ]}
          value={modeFilter}
          onChange={setModeFilter}
        />

        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "#78716c" }}>{filtered.length} products</span>
      </div>

      {/* table */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e7e5e4",
          borderRadius: "0 0 10px 10px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {(
                [
                  ["Product", "38%", "left"],
                  ["Cost", 120, "right"],
                  ["Default", 130, "right"],
                  ["Their price", 200, "left"],
                  ["Margin", 110, "right"],
                  ["", 120, "center"],
                ] as const
              ).map(([label, w, align], i) => (
                <th
                  key={i}
                  style={{
                    textAlign: align,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#78716c",
                    padding: "10px 16px",
                    borderBottom: "1px solid #e7e5e4",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    background: "#fafaf9",
                    width: typeof w === "number" ? w : w,
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: "60px 20px",
                    textAlign: "center",
                    color: "#78716c",
                    fontSize: 13,
                  }}
                >
                  No products match.
                </td>
              </tr>
            )}
            {grouped.map(([cat, prods], gi) => (
              <React.Fragment key={cat}>
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      background: "#fafaf9",
                      padding: "14px 16px 6px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#78716c",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      borderTop: gi > 0 ? "1px solid #e7e5e4" : undefined,
                    }}
                  >
                    {cat}
                    <span style={{ color: "#a8a29e", marginLeft: 8, fontWeight: 500 }}>
                      {prods.length}
                    </span>
                  </td>
                </tr>
                {prods.map(prod => (
                  <ProductRow
                    key={prod.id}
                    prod={prod}
                    customer={customer}
                    markup={markup}
                    priceMap={priceMap}
                    onCommit={handleCommit}
                    onReset={() =>
                      deletePrice.mutate(
                        { customerId: customer.id, productId: prod.id },
                        { onError },
                      )
                    }
                    deleting={
                      deletePrice.isPending &&
                      deletePrice.variables?.productId === prod.id &&
                      deletePrice.variables?.customerId === customer.id
                    }
                    expanded={expandedProductId === prod.id}
                    onToggleExpand={() =>
                      setExpandedProductId(id => (id === prod.id ? null : prod.id))
                    }
                    onPromote={(supplierId) =>
                      handlePromote(prod.id, supplierId, prod.vendors.find(v => v.supplier_id === supplierId)?.supplier_name ?? "", prod.name)
                    }
                    promoting={promote.isPending}
                    promotingId={promote.isPending ? (promote.variables?.supplierId ?? null) : null}
                  />
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PriceChartClient() {
  const { data, isLoading, error } = usePriceChart();
  const updateFuelSurcharge = useUpdateCustomerFuelSurcharge();
  const applyMarkup = useApplyMarkupToCustomer();
  const onError = useCallback((e: Error) => toast.error(e.message), []);

  const customers = useMemo(() => data?.customers ?? [], [data]);
  const products = useMemo(() => data?.products ?? [], [data]);
  const prices = useMemo(() => data?.prices ?? [], [data]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [markup, setMarkup] = useState(7);

  const effectiveSelected = selectedId ?? customers[0]?.id ?? null;
  const customer = customers.find(c => c.id === effectiveSelected) ?? null;

  if (isLoading) return <PageLoading message="Loading price chart…" />;
  if (error) return <PageError message={(error as Error).message} />;
  if (!customer) {
    return (
      <div
        style={{
          padding: "60px 20px",
          textAlign: "center",
          color: "#78716c",
          fontSize: 13,
        }}
      >
        No customers yet. Add a customer to get started.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <CustomerList
        customers={customers}
        prices={prices}
        selected={effectiveSelected}
        onSelect={id => setSelectedId(id)}
      />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        <CustomerCard
          customer={customer}
          prices={prices}
          allProducts={products}
          markup={markup}
          onMarkupChange={setMarkup}
          onApplyMarkup={() => applyMarkup.mutate(customer.id, { onError })}
          applyingMarkup={applyMarkup.isPending && applyMarkup.variables === customer.id}
        />

        <FuelCard
          customer={customer}
          onSave={amount =>
            updateFuelSurcharge.mutate(
              { customerId: customer.id, fuelSurchargeAmount: amount },
              {
                onError,
                onSuccess: () =>
                  toast.success(
                    amount ? `Fuel surcharge set to $${amount}` : "Fuel surcharge waived",
                  ),
              },
            )
          }
          saving={updateFuelSurcharge.isPending}
        />

        <ProductTable
          products={products}
          customer={customer}
          prices={prices}
          markup={markup}
        />
      </div>
    </div>
  );
}
