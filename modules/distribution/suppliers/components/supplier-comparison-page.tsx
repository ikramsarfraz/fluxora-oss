"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type {
  SupplierComparisonData,
  PriceCell,
  ComparisonOpportunity,
  ComparisonRisk,
} from "../services/supplier-comparison";
import { switchPrimarySupplierAction } from "../actions";

// ── Design tokens ────────────────────────────────────────────────────────────
const c = {
  bg: "var(--color-surface)",
  card: "var(--color-card)",
  border: "var(--color-border-default)",
  borderStrong: "var(--color-border-default)",
  text: "var(--color-ink)",
  text2: "var(--color-subtle)",
  text3: "var(--color-muted)",
  accent: "var(--color-ink)",
  green: "var(--color-success-fg)",
  greenBg: "var(--color-success-bg)",
  greenBorder: "var(--color-success-border)",
  amber: "#d97706",
  amberBg: "#fffbeb",
  amberBorder: "#fde68a",
  red: "#dc2626",
  redBg: "#fef2f2",
  redBorder: "#fecaca",
  blue: "var(--color-forest-mid)",
  blueBg: "#eff6ff",
  blueBorder: "#bfdbfe",
  purple: "#7c3aed",
  purpleBg: "#f5f3ff",
  teal: "#0d9488",
  tealBg: "#f0fdfa",
  tealBorder: "#99f6e4",
  mono: "var(--font-mono, 'JetBrains Mono', ui-monospace, monospace)",
} as const;

// ── Formatting helpers ────────────────────────────────────────────────────────
function fmtMoney(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtPct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(0)}%`;
}
function fmtPrice(n: number) {
  return `$${n.toFixed(2)}`;
}
function daysSinceLabel(days: number | null) {
  if (days === null) return "never";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

// ── Pill ────────────────────────────────────────────────────────────────────
function Pill({ color, children }: { color: "blue" | "green" | "amber" | "gray" | "red"; children: React.ReactNode }) {
  const colors = {
    blue: { bg: c.blueBg, text: c.blue },
    green: { bg: c.greenBg, text: c.green },
    amber: { bg: c.amberBg, text: c.amber },
    red: { bg: c.redBg, text: c.red },
    gray: { bg: "var(--color-divider)", text: c.text2 },
  };
  const col = colors[color];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "1px 6px", borderRadius: 4,
      fontSize: 10.5, fontWeight: 600,
      background: col.bg, color: col.text,
    }}>{children}</span>
  );
}

// ── Engagement donut ────────────────────────────────────────────────────────
// Shows a 0-100 "how active is this relationship" score (recency + invoice
// volume). NOT a reliability/quality score — we don't track delivery
// timeliness, weight accuracy, or defects yet. See GH issue #157.
function EngagementDot({ score, label = true }: { score: number; label?: boolean }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 85 ? c.green : pct >= 70 ? c.amber : c.red;
  const circumference = 2 * Math.PI * 16;
  const dash = (pct / 100) * circumference;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
      <div style={{ position: "relative", width: 40, height: 40 }}>
        <svg width={40} height={40} viewBox="0 0 40 40" style={{ transform: "rotate(-90deg)" }}>
          <circle cx={20} cy={20} r={16} fill="none" stroke="#e5e7eb" strokeWidth={4} />
          <circle cx={20} cy={20} r={16} fill="none" stroke={color} strokeWidth={4}
            strokeDasharray={`${dash} ${circumference - dash}`} strokeLinecap="round" />
        </svg>
        <span style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: c.text,
        }}>{score}</span>
      </div>
      {label ? (
        <span
          title="Combines recency of the last invoice with invoice volume. Not a quality/reliability score."
          style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: c.text3 }}
        >
          Engagement
        </span>
      ) : null}
    </div>
  );
}

// ── Price cell renderer ──────────────────────────────────────────────────────
function PriceCellView({ cell, isAggregate }: { cell: PriceCell | null; isAggregate?: boolean }) {
  if (!cell) {
    return (
      <td style={{
        border: `1px solid ${c.border}`,
        backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 8px,rgba(0,0,0,0.025) 8px,rgba(0,0,0,0.025) 16px)",
        background: "var(--color-page)",
        padding: "12px 14px",
        verticalAlign: "top",
        minWidth: 140,
      }}>
        <span style={{ color: c.text3, fontSize: 18 }}>—</span>
        <div style={{ fontSize: 10.5, color: c.text3, marginTop: 3, fontStyle: "italic" }}>not carried</div>
      </td>
    );
  }

  const { price, lastDate, isBest, vsMedian, status } = cell;
  const bgColors = { best: "#ecfdf5", competitive: c.card, above: "#fffaf0", "way-above": "#fff5f5", "only-source": "#ecfdf5" };
  const priceColors = { best: c.green, competitive: c.text, above: c.amber, "way-above": c.red, "only-source": c.green };
  const bg = bgColors[status] ?? c.card;
  const textColor = priceColors[status] ?? c.text;

  const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
  const lastLabel = `last ${daysSinceLabel(days)}`;

  return (
    <td style={{
      background: bg,
      border: `1px solid ${c.border}`,
      padding: "12px 14px",
      verticalAlign: "top",
      minWidth: 140,
      cursor: "pointer",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <div>
          <span style={{ fontFamily: c.mono, fontWeight: 700, fontSize: 15, color: textColor }}>{fmtPrice(price)}</span>
          <span style={{ fontSize: 10, color: c.text3, fontWeight: 500, marginLeft: 2 }}>/lb</span>
        </div>
        {status === "best" && (
          <span style={{ width: 16, height: 16, borderRadius: "50%", background: c.green, color: "var(--color-card)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>✓</span>
        )}
        {status === "above" && (
          <span style={{ width: 16, height: 16, borderRadius: "50%", background: c.amber, color: "var(--color-card)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>!</span>
        )}
        {status === "way-above" && (
          <span style={{ width: 16, height: 16, borderRadius: "50%", background: c.red, color: "var(--color-card)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>↑</span>
        )}
      </div>
      <div style={{ fontSize: 10.5, color: c.text3, display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
        {(status === "above" || status === "way-above") && (
          <span style={{ fontFamily: c.mono, fontWeight: 600, color: status === "way-above" ? c.red : c.amber }}>
            {fmtPct(vsMedian)} vs best ·{" "}
          </span>
        )}
        {(status === "best" || status === "competitive") && !isBest && vsMedian !== 0 && (
          <span style={{ fontFamily: c.mono, fontWeight: 600, color: c.green }}>{fmtPct(vsMedian)} vs best · </span>
        )}
        {status === "only-source" && <span>only source · </span>}
        {isBest && status !== "only-source" && <span>best · 6mo stable · </span>}
        {lastLabel}
      </div>
    </td>
  );
}

// ── Insight card ────────────────────────────────────────────────────────────
function InsightCard({
  title, count, countColor, children,
}: { title: string; count?: number; countColor?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{
        padding: "11px 14px", borderBottom: `1px solid ${c.border}`, background: "var(--color-page)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <h4 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: c.text2 }}>
          {title}
        </h4>
        {count !== undefined && (
          <span style={{
            background: countColor ?? c.accent, color: "var(--color-card)",
            fontSize: 10, padding: "1px 6px", borderRadius: 4,
            fontFamily: c.mono, fontWeight: 700,
          }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Opportunity / Risk item ──────────────────────────────────────────────────
function OpportunityItem({ opp }: { opp: ComparisonOpportunity }) {
  return (
    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${c.border}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 6 }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: c.greenBg, color: c.green, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
          {opp.type === "add_supplier" ? "+" : "↑"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>{opp.title}</div>
          <div style={{ fontSize: 11.5, color: c.text2, marginTop: 3, lineHeight: 1.5 }}>
            {opp.description}
            {opp.savingsPerYear > 0 && (
              <span style={{ color: c.green, fontWeight: 600, fontFamily: c.mono }}>
                {" "}Save ${Math.round(opp.savingsPerYear).toLocaleString()}/yr
              </span>
            )}
          </div>
          <div style={{ marginTop: 9, display: "flex", gap: 6 }}>
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px",
              background: c.accent, color: "var(--color-card)", border: "none",
              borderRadius: 5, fontSize: 11.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
            }}>
              {opp.type === "switch_primary" ? "Apply" : opp.type === "add_supplier" ? "Request quote" : "Explore"}
            </button>
            {opp.type === "switch_primary" && (
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px",
                background: c.card, color: c.text, border: `1px solid ${c.borderStrong}`,
                borderRadius: 5, fontSize: 11.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}>See math</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskItem({ risk }: { risk: ComparisonRisk }) {
  const iconColors = {
    concentration: { bg: c.amberBg, color: c.amber },
    single_source: { bg: c.redBg, color: c.red },
    stale_supplier: { bg: c.amberBg, color: c.amber },
  };
  const icon = { concentration: "△", single_source: "⚠", stale_supplier: "○" };
  const col = iconColors[risk.type];
  return (
    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${c.border}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: col.bg, color: col.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, fontSize: 11 }}>
          {icon[risk.type]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>{risk.title}</div>
          <div style={{ fontSize: 11.5, color: c.text2, marginTop: 3, lineHeight: 1.5 }}>{risk.description}</div>
          {risk.type === "single_source" && (
            <div style={{ marginTop: 9 }}>
              <button style={{
                display: "inline-flex", alignItems: "center", padding: "3px 8px",
                background: c.card, color: c.text, border: `1px solid ${c.borderStrong}`,
                borderRadius: 5, fontSize: 11.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}>Send RFQ for all</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Supplier scorecard ──────────────────────────────────────────────────────
function SupplierScorecard({
  supplier, aggregate, totalSpend, isPrimary, onPromote, promoting,
}: {
  supplier: SupplierComparisonData["suppliers"][number];
  aggregate: { avgPrice: number; skusWon: number; skusCarried: number };
  totalSpend: number;
  isPrimary: boolean;
  onPromote: () => void;
  promoting: boolean;
}) {
  const spendPct = totalSpend > 0 ? (supplier.totalSpend / totalSpend) * 100 : 0;
  const initial = supplier.name.charAt(0).toUpperCase();
  const cardColors = ["var(--color-forest-mid)", "#7c3aed", "#0d9488", "#d97706", "#dc2626"];
  const colorIdx = supplier.name.charCodeAt(0) % cardColors.length;
  const badgeColor = cardColors[colorIdx]!;
  return (
    <div style={{
      background: c.card,
      border: isPrimary ? `2px solid ${c.blueBorder}` : `1px solid ${c.border}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${c.border}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: badgeColor, color: "var(--color-card)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
            {initial}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              {supplier.name}
              {isPrimary && <Pill color="blue">Primary</Pill>}
              {aggregate.skusWon >= aggregate.skusCarried && aggregate.skusCarried > 0 && !isPrimary && <Pill color="green">Best price</Pill>}
              {supplier.daysSinceLast !== null && supplier.daysSinceLast > 21 && <Pill color="amber">Going stale</Pill>}
            </div>
            <div style={{ fontSize: 11.5, color: c.text2, marginTop: 2 }}>
              {supplier.invoiceCount} invoices · last {daysSinceLabel(supplier.daysSinceLast)}
            </div>
          </div>
        </div>
        <EngagementDot score={supplier.engagement} />
      </div>

      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: c.text3, marginBottom: 2 }}>12mo spend</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: c.mono }}>${supplier.totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div style={{ fontSize: 10, color: c.text3, marginTop: 1 }}>{Math.round(spendPct)}% of category</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: c.text3, marginBottom: 2 }}>Coverage</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: c.mono }}>{aggregate.skusCarried > 0 ? `${aggregate.skusWon}/${aggregate.skusCarried}` : "—"}</div>
            <div style={{ fontSize: 10, color: c.text3, marginTop: 1 }}>SKUs in category</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: c.text3, marginBottom: 2 }}>Avg $/lb</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: c.mono, color: aggregate.avgPrice > 0 ? c.text : c.text3 }}>
              {aggregate.avgPrice > 0 ? fmtPrice(aggregate.avgPrice) : "—"}
            </div>
            <div style={{ fontSize: 10, color: c.text3, marginTop: 1 }}>carried SKUs</div>
          </div>
        </div>

      </div>

      <div style={{ padding: "11px 16px", background: "var(--color-page)", borderTop: `1px solid ${c.border}`, display: "flex", gap: 6 }}>
        <Link href={`/suppliers/${supplier.id}`} style={{
          display: "inline-flex", alignItems: "center", padding: "3px 8px",
          background: c.card, color: c.text, border: `1px solid ${c.borderStrong}`,
          borderRadius: 5, fontSize: 11.5, fontWeight: 500, textDecoration: "none",
        }}>View profile</Link>
        {!isPrimary && aggregate.avgPrice > 0 && (
          <button
            onClick={onPromote}
            disabled={promoting}
            style={{
              display: "inline-flex", alignItems: "center", padding: "3px 8px",
              background: promoting ? "var(--color-subtle)" : c.accent, color: "var(--color-card)", border: "none",
              borderRadius: 5, fontSize: 11.5, fontWeight: 500,
              cursor: promoting ? "not-allowed" : "pointer",
              fontFamily: "inherit", marginLeft: "auto", opacity: promoting ? 0.7 : 1,
            }}
          >{promoting ? "Switching…" : "Promote to primary →"}</button>
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export function SupplierComparisonPage({
  data,
  selectedCategoryId,
  embedded = false,
}: {
  data: SupplierComparisonData;
  selectedCategoryId: string | null;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [promotingId, setPromotingId] = React.useState<string | null>(null);
  const { suppliers, products, priceMatrix, aggregateBySupplier, opportunities, risks, summary, categories } = data;
  const categoryName = categories.find(c => c.id === selectedCategoryId)?.name ?? "all categories";
  const totalSpend = summary.categorySpend12mo;
  const allProductIds = products.map(p => p.id);

  function onCategoryClick(catId: string) {
    const params = new URLSearchParams();
    params.set("view", "compare");
    params.set("category", catId);
    router.push(`/suppliers?${params.toString()}`);
  }

  function handlePromote(supplierId: string, supplierName: string, productIds: string[]) {
    setPromotingId(supplierId);
    startTransition(async () => {
      try {
        await switchPrimarySupplierAction(supplierId, productIds);
        toast.success(`${supplierName} set as primary supplier.`);
        router.refresh();
      } catch {
        toast.error("Failed to switch primary supplier.");
      } finally {
        setPromotingId(null);
      }
    });
  }

  return (
    <div style={{ background: c.bg, minHeight: embedded ? undefined : "100vh", padding: embedded ? "0 0 80px" : "24px 32px 80px" }}>

      {!embedded && (
        <>
          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <Link href="/suppliers" style={{ color: c.text3, textDecoration: "none" }}>Suppliers</Link>
              <span style={{ color: c.text3 }}>/</span>
              <span style={{ color: c.text, fontWeight: 500 }}>Compare</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px",
                borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                border: `1px solid ${c.borderStrong}`, background: c.card, color: c.text,
                cursor: "pointer", fontFamily: "inherit",
              }}>↑ Export</button>
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px",
                borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                background: c.accent, color: "var(--color-card)", border: "none",
                cursor: "pointer", fontFamily: "inherit",
              }}>→ Send RFQ</button>
            </div>
          </div>
        </>
      )}

      {/* Page header + category tabs */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        {!embedded && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.015em", margin: "0 0 6px" }}>
              Who should you buy {categoryName} from?
            </h1>
            <div style={{ color: c.text2, fontSize: 13.5 }}>
              {suppliers.length} active supplier{suppliers.length !== 1 ? "s" : ""} · {products.length} SKU{products.length !== 1 ? "s" : ""} in category · 12 months of price history
            </div>
          </div>
        )}
        {embedded && (
          <div style={{ color: c.text2, fontSize: 13.5 }}>
            {suppliers.length} active supplier{suppliers.length !== 1 ? "s" : ""} · {products.length} SKU{products.length !== 1 ? "s" : ""} in category · 12 months of price history
          </div>
        )}
        {categories.length > 0 && (
          <div style={{
            display: "flex", gap: 4, padding: 4, background: "var(--color-divider)", borderRadius: 9,
          }}>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => onCategoryClick(cat.id)} style={{
                padding: "6px 14px", fontSize: 13, fontWeight: cat.id === selectedCategoryId ? 600 : 500,
                color: cat.id === selectedCategoryId ? c.text : c.text2,
                border: "none", background: cat.id === selectedCategoryId ? c.card : "transparent",
                borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                boxShadow: cat.id === selectedCategoryId ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                {cat.name}
                <span style={{ fontSize: 11, color: cat.id === selectedCategoryId ? c.text2 : c.text3, fontFamily: c.mono }}>
                  {cat.skuCount}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Empty state */}
      {suppliers.length === 0 && (
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: "48px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No supplier data yet</div>
          <div style={{ color: c.text2, fontSize: 14 }}>Upload a few supplier invoices to start comparing prices.</div>
          <Link href="/supplier-invoices/new" style={{
            display: "inline-flex", marginTop: 16, padding: "8px 16px",
            background: c.accent, color: "var(--color-card)", borderRadius: 7,
            textDecoration: "none", fontSize: 13, fontWeight: 500,
          }}>Add first invoice →</Link>
        </div>
      )}

      {suppliers.length > 0 && (
        <>
          {/* Summary strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 18 }}>
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: c.text3, marginBottom: 4 }}>Category spend · 12mo</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", fontFamily: c.mono }}>{fmtMoney(totalSpend)}</div>
              <div style={{ fontSize: 11, color: c.text2, marginTop: 3 }}>{products.length} active SKUs</div>
            </div>
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: c.text3, marginBottom: 4 }}>Active suppliers</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>{summary.activeSupplierCount}</div>
              <div style={{ fontSize: 11, color: c.text2, marginTop: 3 }}>{suppliers.length - summary.activeSupplierCount} dormant past 90d</div>
            </div>
            <div style={{
              background: summary.vsMarketAvgPct !== null && summary.vsMarketAvgPct > 5 ? "#fffaf0" : c.card,
              border: `1px solid ${summary.vsMarketAvgPct !== null && summary.vsMarketAvgPct > 5 ? c.amberBorder : c.border}`,
              borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: c.text3, marginBottom: 4 }}>vs market avg</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: summary.vsMarketAvgPct !== null && summary.vsMarketAvgPct > 5 ? c.amber : c.green }}>
                {summary.vsMarketAvgPct !== null ? fmtPct(summary.vsMarketAvgPct) : "—"}
              </div>
              <div style={{ fontSize: 11, color: c.text2, marginTop: 3 }}>
                {summary.vsMarketAvgPct !== null && summary.vsMarketAvgPct > 5 ? "above the best available" : "tracking well"}
              </div>
            </div>
            <div style={{
              background: summary.concentrationPct !== null && summary.concentrationPct > 50 ? "#fff5f5" : c.card,
              border: `1px solid ${summary.concentrationPct !== null && summary.concentrationPct > 50 ? c.redBorder : c.border}`,
              borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: c.text3, marginBottom: 4 }}>Concentration risk</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: summary.concentrationPct !== null && summary.concentrationPct > 50 ? c.red : c.text }}>
                {summary.concentrationPct !== null ? `${Math.round(summary.concentrationPct)}%` : "—"}
              </div>
              <div style={{ fontSize: 11, color: c.text2, marginTop: 3 }}>
                {summary.concentrationSupplierName ? `of spend → ${summary.concentrationSupplierName.split(" ")[0]}` : "diversified"}
              </div>
            </div>
            <div style={{
              background: summary.singleSourcedCount > 0 ? "#fffaf0" : c.card,
              border: `1px solid ${summary.singleSourcedCount > 0 ? c.amberBorder : c.border}`,
              borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: c.text3, marginBottom: 4 }}>Single-sourced</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: summary.singleSourcedCount > 0 ? c.amber : c.text }}>
                {summary.singleSourcedCount} SKU{summary.singleSourcedCount !== 1 ? "s" : ""}
              </div>
              <div style={{ fontSize: 11, color: c.text2, marginTop: 3 }}>
                {summary.singleSourcedCount > 0 ? "no backup supplier" : "all have backups"}
              </div>
            </div>
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: c.text3, marginBottom: 4 }}>Identified savings</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: c.green }}>
                {summary.identifiedSavings > 0 ? fmtMoney(summary.identifiedSavings) : "$0"}
              </div>
              <div style={{ fontSize: 11, color: c.text2, marginTop: 3 }}>/yr if applied</div>
            </div>
          </div>

          {/* Action banner — top opportunity */}
          {opportunities.length > 0 && opportunities[0]!.savingsPerYear > 0 && (
            <div style={{
              background: "linear-gradient(135deg,#18181b 0%,#27272a 100%)",
              color: "var(--color-card)", borderRadius: 14, padding: "18px 22px", marginBottom: 22,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20,
              position: "relative", overflow: "hidden",
            }}>
              <div style={{
                content: "''", position: "absolute", inset: 0,
                background: "radial-gradient(circle at 80% 20%,rgba(22,163,74,.18) 0%,transparent 50%),radial-gradient(circle at 20% 80%,rgba(37,99,235,.1) 0%,transparent 50%)",
              }} />
              <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 11,
                  background: "rgba(22,163,74,.2)", color: "#4ade80",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  fontSize: 20,
                }}>↑</div>
                <div>
                  <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.55)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 3 }}>Top opportunity</div>
                  <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 4 }}>{opportunities[0]!.title}</div>
                  <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.7)" }}>
                    {opportunities[0]!.description}
                  </div>
                </div>
              </div>
              <div style={{ position: "relative", display: "flex", gap: 8 }}>
                <button style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px",
                  background: "rgba(255,255,255,.1)", color: "var(--color-card)",
                  border: "1px solid rgba(255,255,255,.2)", borderRadius: 7,
                  fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                }}>See math</button>
                <button
                  onClick={() => {
                    const opp = opportunities[0]!;
                    if (opp.toSupplierId && opp.toSupplierName) {
                      handlePromote(opp.toSupplierId, opp.toSupplierName, [opp.productId]);
                    }
                  }}
                  disabled={promotingId !== null}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px",
                    background: promotingId !== null ? "rgba(255,255,255,.7)" : "var(--color-card)",
                    color: c.text, border: "none", borderRadius: 7,
                    fontSize: 12.5, fontWeight: 500,
                    cursor: promotingId !== null ? "not-allowed" : "pointer",
                    fontFamily: "inherit", opacity: promotingId !== null ? 0.7 : 1,
                  }}
                >{promotingId !== null ? "Switching…" : "Apply & switch primary →"}</button>
              </div>
            </div>
          )}

          {/* Main grid: matrix + side panel */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18, marginBottom: 32, alignItems: "start" }}>

            {/* Price matrix */}
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{
                padding: "13px 18px", borderBottom: `1px solid ${c.border}`,
                background: "var(--color-page)", display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: c.text2, display: "flex", alignItems: "center", gap: 10 }}>
                  Price matrix · {products.length} SKU{products.length !== 1 ? "s" : ""} × {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""}
                  <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 6px", background: "var(--color-divider)", color: c.text2, borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>last 12 months</span>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ width: 240, padding: "12px 14px", background: c.card, textAlign: "left", borderBottom: `1px solid ${c.border}`, verticalAlign: "middle" }}>
                        <span style={{ fontSize: 11, color: c.text3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>SKU</span>
                      </th>
                      {suppliers.map((supplier, idx) => {
                        const initial = supplier.name.charAt(0).toUpperCase();
                        const cardColors = ["var(--color-forest-mid)", "#7c3aed", "#0d9488", "#d97706", "#dc2626"];
                        const badgeColor = cardColors[supplier.name.charCodeAt(0) % cardColors.length]!;
                        const agg = aggregateBySupplier[supplier.id];
                        return (
                          <th key={supplier.id} style={{
                            borderLeft: `1px solid ${c.border}`, padding: "12px 14px",
                            background: c.card, textAlign: "left",
                            borderBottom: `1px solid ${c.border}`, verticalAlign: "top", minWidth: 170,
                          }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 24, height: 24, borderRadius: 6, background: badgeColor, color: "var(--color-card)", fontWeight: 700, fontSize: 11.5, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initial}</div>
                                <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                                  {supplier.name}
                                  {idx === 0 && <span style={{ marginLeft: 6 }}><Pill color="blue">Primary</Pill></span>}
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <EngagementDot score={supplier.engagement} label={false} />
                                <div>
                                  <div style={{ fontSize: 10.5, color: c.text2 }}>
                                    <span style={{ color: c.text, fontFamily: c.mono, fontWeight: 600 }}>${(supplier.totalSpend / 1000).toFixed(0)}K</span> 12mo
                                  </div>
                                  <div style={{ fontSize: 10.5, color: c.text3, marginTop: 1 }}>
                                    Last: {daysSinceLabel(supplier.daysSinceLast)} · {agg?.skusCarried ?? 0}/{products.length} SKUs
                                  </div>
                                </div>
                              </div>
                            </div>
                          </th>
                        );
                      })}
                      <th style={{
                        width: 140, background: "var(--color-page)",
                        borderLeft: `1px dashed ${c.borderStrong}`,
                        padding: "12px 14px", textAlign: "left",
                        borderBottom: `1px solid ${c.border}`, verticalAlign: "top",
                      }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                          <button style={{
                            padding: "6px 10px", background: c.card,
                            border: `1px dashed ${c.borderStrong}`, borderRadius: 6,
                            color: c.text2, cursor: "pointer", fontSize: 11.5, fontWeight: 500,
                            display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit",
                          }}>+ Add supplier</button>
                          <div style={{ fontSize: 10.5, color: c.text3, lineHeight: 1.4 }}>Track quotes from a new supplier</div>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(product => (
                      <tr key={product.id}>
                        <td style={{ background: "var(--color-page)", padding: "12px 14px", borderBottom: `1px solid ${c.border}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}>
                                {product.name}
                                {product.isSingleSourced && <Pill color="amber">Single source</Pill>}
                              </div>
                              <div style={{ fontSize: 10.5, color: c.text3, fontFamily: c.mono, marginTop: 1 }}>{product.sku}</div>
                              <div style={{ fontSize: 11, color: c.text2, marginTop: 3 }}>
                                <span style={{ fontWeight: 600, color: c.text }}>
                                  ${product.annualSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>/yr · {Math.round(product.annualWeightLbs)} lb
                              </div>
                            </div>
                          </div>
                        </td>
                        {suppliers.map(supplier => (
                          <PriceCellView key={supplier.id} cell={priceMatrix[product.id]?.[supplier.id] ?? null} />
                        ))}
                        <td style={{ background: "var(--color-page)", borderLeft: `1px dashed ${c.borderStrong}`, borderBottom: `1px solid ${c.border}` }}>
                          {product.isSingleSourced ? (
                            <div style={{ padding: "14px", textAlign: "center", fontSize: 11.5, color: c.amber, fontWeight: 500 }}>
                              Request quote for backup
                            </div>
                          ) : (
                            <div style={{ padding: "14px", textAlign: "center", fontSize: 11.5, color: c.text3 }}>—</div>
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* Aggregate row */}
                    <tr>
                      <td style={{ background: "var(--color-page)", padding: "12px 14px", borderTop: `2px solid ${c.borderStrong}` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: c.text2 }}>Category aggregate</div>
                        <div style={{ fontSize: 11, color: c.text3, marginTop: 4, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>avg $/lb · best-of-row wins</div>
                      </td>
                      {suppliers.map(supplier => {
                        const agg = aggregateBySupplier[supplier.id];
                        return (
                          <td key={supplier.id} style={{ background: "var(--color-page)", padding: "12px 14px", borderTop: `2px solid ${c.borderStrong}`, borderLeft: `1px solid ${c.border}` }}>
                            {agg && agg.avgPrice > 0 ? (
                              <>
                                <div style={{ fontFamily: c.mono, fontWeight: 700, fontSize: 14 }}>{fmtPrice(agg.avgPrice)}</div>
                                <div style={{ fontSize: 10.5, color: agg.skusWon > 0 ? c.green : c.amber, fontWeight: 600, marginTop: 2 }}>
                                  won {agg.skusWon} of {agg.skusCarried} SKUs
                                </div>
                              </>
                            ) : <span style={{ color: c.text3, fontSize: 12 }}>—</span>}
                          </td>
                        );
                      })}
                      <td style={{ background: "var(--color-page)", borderTop: `2px solid ${c.borderStrong}`, borderLeft: `1px dashed ${c.borderStrong}`, padding: "12px 14px" }}>
                        <div style={{ fontSize: 10.5, color: c.text3 }}>add to compare</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "11px 18px", background: "var(--color-page)", borderTop: `1px solid ${c.border}`, fontSize: 11, color: c.text2 }}>
                {[{ color: c.green, label: "Best price" }, { color: c.amber, label: "+5–15% above best" }, { color: c.red, label: ">15% above best" }].map(item => (
                  <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: item.color, display: "inline-block" }} />
                    {item.label}
                  </span>
                ))}
                <span style={{ marginLeft: "auto", color: c.text3 }}>Click any cell to see history</span>
              </div>
            </div>

            {/* Side panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <InsightCard title="Opportunities" count={opportunities.filter(o => o.savingsPerYear > 0).length}>
                {opportunities.length === 0 ? (
                  <div style={{ padding: "20px 14px", textAlign: "center", color: c.text3, fontSize: 12.5 }}>No actionable opportunities yet.</div>
                ) : (
                  opportunities.map((opp, i) => <OpportunityItem key={i} opp={opp} />)
                )}
              </InsightCard>

              <InsightCard title="Risks" count={risks.length} countColor={risks.length > 0 ? c.amber : undefined}>
                {risks.length === 0 ? (
                  <div style={{ padding: "20px 14px", textAlign: "center", color: c.text3, fontSize: 12.5 }}>No risks identified.</div>
                ) : (
                  risks.map((risk, i) => <RiskItem key={i} risk={risk} />)
                )}
              </InsightCard>
            </div>
          </div>

          {/* Supplier scorecards */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>Suppliers at a glance</h2>
              <span style={{ fontSize: 13, color: c.text2 }}>Engagement reflects invoice cadence — not delivery quality</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(3, suppliers.length)}, 1fr)`, gap: 14 }}>
              {suppliers.map((supplier, idx) => (
                <SupplierScorecard
                  key={supplier.id}
                  supplier={supplier}
                  aggregate={aggregateBySupplier[supplier.id] ?? { avgPrice: 0, skusWon: 0, skusCarried: 0 }}
                  totalSpend={totalSpend}
                  isPrimary={idx === 0}
                  promoting={promotingId === supplier.id}
                  onPromote={() => handlePromote(supplier.id, supplier.name, allProductIds)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
