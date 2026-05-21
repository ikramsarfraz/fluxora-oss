"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  Heart,
  MessageCircle,
  TrendingDown,
  RefreshCw,
  ChevronDown,
  X,
} from "lucide-react";
import { useLot } from "../hooks/use-lots";
import { useApplyMarkdown, useApplyDonate, useCreateDisposition } from "../hooks/use-disposition";
import { useDataReadiness } from "@/hooks/use-data-readiness";
import {
  computeBreakEvenDiscountPct,
  computeMarkdownExpectation,
  computeDonateExpectation,
  computeOutreachExpectation,
  computeRepurposeExpectation,
  computeSellThroughProjection,
  computeVelocity,
  recommendDisposition,
  type OptionExpectation,
} from "../services/disposition-analytics";
import { getLotPrimaryProduct, getLotTotals } from "./lot-view-helpers";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
import { PageError } from "@/components/page-error";

// ── Design tokens (inline, same pattern as inbox-shell) ───────────────────
const c = {
  bg: "var(--color-surface)",
  card: "var(--color-card)",
  border: "var(--color-border-default)",
  borderStrong: "var(--color-border-default)",
  text: "var(--color-ink)",
  text2: "var(--color-subtle)",
  text3: "var(--color-muted)",
  green: "var(--color-success-fg)",
  greenBg: "var(--color-success-bg)",
  greenBorder: "var(--color-success-border)",
  amber: "var(--color-warning-fg)",
  amberBg: "var(--color-warning-bg)",
  amberBorder: "var(--color-warning-border)",
  red: "var(--color-danger-fg)",
  redBg: "var(--color-danger-bg)",
  redBorder: "var(--color-danger-border)",
  blue: "var(--color-forest-mid)",
  blueBg: "#eff6ff",
  blueBorder: "#bfdbfe",
  purple: "#7c3aed",
  purpleBg: "#f5f3ff",
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtUsd(n: number) {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "−";
  return `${sign}$${abs.toFixed(2)}`;
}

function fmtPct(n: number) {
  return `${n.toFixed(0)}%`;
}

function netColor(n: number) {
  return n >= 0 ? c.green : c.red;
}

type OptionKey = "markdown" | "outreach" | "donate" | "repurpose";

const OPTION_META: Record<
  OptionKey,
  { label: string; tagline: string; iconColor: string; iconBg: string }
> = {
  markdown: {
    label: "Markdown",
    tagline: "Drop price to clearance buyers via channels you've used before.",
    iconColor: c.green,
    iconBg: c.greenBg,
  },
  outreach: {
    label: "Targeted outreach",
    tagline: "Text specific buyers who recently bought this product at any price.",
    iconColor: c.blue,
    iconBg: c.blueBg,
  },
  donate: {
    label: "Donate",
    tagline: "Food bank pickup. Tax-deductible at cost — zero unsold risk.",
    iconColor: c.purple,
    iconBg: c.purpleBg,
  },
  repurpose: {
    label: "Repurpose",
    tagline: "Process into an alternative SKU that moves faster.",
    iconColor: c.amber,
    iconBg: c.amberBg,
  },
};

// ── Sub-components ────────────────────────────────────────────────────────

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "amber" | "blue" | "gray";
}) {
  const colors = {
    green: { bg: c.greenBg, color: c.green, border: c.greenBorder },
    amber: { bg: c.amberBg, color: c.amber, border: c.amberBorder },
    blue: { bg: c.blueBg, color: c.blue, border: c.blueBorder },
    gray: { bg: "var(--color-divider)", color: c.text2, border: c.border },
  }[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "2px 8px",
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 600,
        background: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
      }}
    >
      {children}
    </span>
  );
}

function Btn({
  children,
  onClick,
  variant = "default",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost" | "green";
  disabled?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: {
      background: "var(--color-card)",
      color: c.text,
      border: `1px solid ${c.borderStrong}`,
    },
    primary: {
      background: c.text,
      color: "var(--color-card)",
      border: `1px solid ${c.text}`,
    },
    ghost: {
      background: "transparent",
      color: c.text2,
      border: "1px solid transparent",
    },
    green: {
      background: c.green,
      color: "var(--color-card)",
      border: `1px solid ${c.green}`,
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 13px",
        borderRadius: 7,
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all .12s",
        fontFamily: "inherit",
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

// ── Option card ───────────────────────────────────────────────────────────

function OptionCard({
  optKey,
  expectation,
  selected,
  recommended,
  onClick,
}: {
  optKey: OptionKey;
  expectation: OptionExpectation;
  selected: boolean;
  recommended: boolean;
  onClick: () => void;
}) {
  const meta = OPTION_META[optKey];
  const netVal = expectation.expectedNet;

  const IconMap = {
    markdown: TrendingDown,
    outreach: MessageCircle,
    donate: Heart,
    repurpose: RefreshCw,
  };
  const Icon = IconMap[optKey];

  return (
    <div
      onClick={onClick}
      style={{
        background: c.card,
        border: `1px solid ${selected ? c.text : c.border}`,
        borderRadius: 12,
        padding: 16,
        cursor: "pointer",
        position: "relative",
        boxShadow: selected ? `0 0 0 3px rgba(24,24,27,0.08)` : undefined,
        transition: "all .15s",
      }}
    >
      {recommended && (
        <div
          style={{
            position: "absolute",
            top: -8,
            right: 12,
            background: c.green,
            color: "var(--color-card)",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.05em",
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          RECOMMENDED
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: meta.iconBg,
            color: meta.iconColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={15} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{meta.label}</span>
      </div>

      <div
        style={{
          fontSize: 11.5,
          color: c.text2,
          marginBottom: 14,
          minHeight: 30,
          lineHeight: 1.4,
        }}
      >
        {meta.tagline}
      </div>

      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: c.text3,
        }}
      >
        Expected net
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          fontFamily: "ui-monospace,monospace",
          color: netColor(netVal),
          lineHeight: 1.1,
          marginTop: 2,
        }}
      >
        {fmtUsd(netVal)}
      </div>
      <div style={{ fontSize: 10.5, color: c.text3, marginTop: 4, fontFamily: "ui-monospace,monospace" }}>
        {fmtUsd(expectation.lowEnd)} to {fmtUsd(expectation.highEnd)} · {fmtPct(expectation.confidence * 100)} confidence
      </div>

      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px dashed ${c.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: c.text2,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Clock size={11} />
          {expectation.timeToSetUp}
        </span>
        <Pill tone={expectation.riskLevel === "zero" ? "green" : expectation.riskLevel === "low" ? "green" : "amber"}>
          {expectation.riskLevel === "zero" ? "Zero risk" : expectation.riskLevel === "low" ? "Low risk" : "Variable"}
        </Pill>
      </div>
    </div>
  );
}

// ── Markdown slider + detail panel ────────────────────────────────────────

const SNAP_POINTS = [0, 10, 20, 30, 40, 50];

function MarkdownDetailPanel({
  qtyLbs,
  landedCostPerLb,
  currentPricePerLb,
  priorAvgSellThrough,
  onNetChange,
}: {
  qtyLbs: number;
  landedCostPerLb: number;
  currentPricePerLb: number;
  priorAvgSellThrough: number;
  onNetChange: (net: number, config: { discountPct: number; newPrice: number; predictedNet: number }) => void;
}) {
  const breakEvenPct = computeBreakEvenDiscountPct(landedCostPerLb, currentPricePerLb);
  const [discountPct, setDiscountPct] = useState(30);
  const [channels, setChannels] = useState<string[]>(["clearance_list", "food_trucks"]);
  const [notifMethods, setNotifMethods] = useState<string[]>(["sms", "email"]);

  const newPrice = currentPricePerLb * (1 - discountPct / 100);
  const pastBreakEven = discountPct > breakEvenPct;

  const projection = useMemo(
    () =>
      computeSellThroughProjection(
        qtyLbs,
        newPrice,
        landedCostPerLb,
        priorAvgSellThrough,
        0.75,
      ),
    [qtyLbs, newPrice, landedCostPerLb, priorAvgSellThrough],
  );

  // Notify parent when values change
  const handleDiscount = useCallback(
    (pct: number) => {
      setDiscountPct(pct);
      const np = currentPricePerLb * (1 - pct / 100);
      const proj = computeSellThroughProjection(qtyLbs, np, landedCostPerLb, priorAvgSellThrough, 0.75);
      onNetChange(proj.expectedNet, { discountPct: pct, newPrice: np, predictedNet: proj.expectedNet });
    },
    [currentPricePerLb, qtyLbs, landedCostPerLb, priorAvgSellThrough, onNetChange],
  );

  // Financial breakdown (right column)
  const grossRevenue = newPrice * qtyLbs * projection.expectedSellThroughPct;
  const totalCost = landedCostPerLb * qtyLbs;
  const notifLabor = 5; // $5 fixed labor
  const channelFees = channels.includes("marketplace") ? grossRevenue * 0.08 : 0;
  const net100 = newPrice * qtyLbs - totalCost;

  const allSnapPoints = [...new Set([...SNAP_POINTS, Math.round(breakEvenPct)])].sort(
    (a, b) => a - b,
  );

  const toggleChannel = (ch: string) => {
    setChannels(prev => (prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]));
  };

  const toggleNotif = (n: string) => {
    setNotifMethods(prev => (prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]));
  };

  const CHANNELS = [
    { id: "clearance_list", label: "Clearance list", meta: "buyers · text + email" },
    { id: "food_trucks", label: "Food trucks", meta: "active accounts" },
    { id: "recent_buyers", label: "Recent buyers", meta: "90d" },
    { id: "walk_in", label: "Walk-in counter", meta: "in-store" },
    {
      id: "marketplace",
      label: "Public marketplace",
      meta: "broader reach · 2h delay",
    },
  ];

  const NOTIFS = [
    { id: "sms", label: "SMS", meta: "highest open rate" },
    { id: "email", label: "Email", meta: "with photos & pickup info" },
    { id: "in_app", label: "In-app + portal", meta: "always on · free" },
  ];

  // Slider gradient
  const sliderGradient = pastBreakEven
    ? `linear-gradient(to right, ${c.green} 0%, ${c.amber} ${breakEvenPct}%, ${c.red} ${breakEvenPct}%, ${c.red} 100%)`
    : `linear-gradient(to right, ${c.green} 0%, ${c.amber} ${breakEvenPct}%, ${c.amber} 100%)`;

  return (
    <div
      style={{
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 18,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${c.border}`,
          background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: c.green,
              color: "var(--color-card)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TrendingDown size={20} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Configure markdown</div>
            <div style={{ fontSize: 12.5, color: c.text2, marginTop: 1 }}>
              Sliding the price recomputes <strong style={{ color: c.text }}>everything below</strong> in real time.
            </div>
          </div>
        </div>
        <Pill tone={pastBreakEven ? "amber" : "green"}>
          {pastBreakEven ? "Below break-even" : "Margin positive"}
        </Pill>
      </div>

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr" }}>
        {/* Left: controls */}
        <div style={{ padding: "20px 22px", borderRight: `1px solid ${c.border}` }}>
          {/* Slider */}
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>Discount amount</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span
                  style={{
                    fontSize: 38,
                    fontWeight: 700,
                    fontFamily: "ui-monospace,monospace",
                    color: pastBreakEven ? c.red : c.green,
                    lineHeight: 1,
                  }}
                >
                  {discountPct}%
                </span>
                <span style={{ fontSize: 14, color: c.text3, margin: "0 4px" }}>→</span>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: c.text3,
                    }}
                  >
                    New price
                  </span>
                  <span
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      fontFamily: "ui-monospace,monospace",
                      color: c.text,
                    }}
                  >
                    ${newPrice.toFixed(2)}/lb
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      color: c.text3,
                      textDecoration: "line-through",
                      fontFamily: "ui-monospace,monospace",
                    }}
                  >
                    ${currentPricePerLb.toFixed(2)}/lb
                  </span>
                </div>
              </div>
            </div>

            {/* Slider track */}
            <div style={{ position: "relative", marginBottom: 8 }}>
              <div
                style={{
                  position: "relative",
                  height: 8,
                  borderRadius: 4,
                  background: sliderGradient,
                  marginBottom: 4,
                }}
              >
                {/* Break-even marker */}
                <div
                  style={{
                    position: "absolute",
                    left: `${breakEvenPct}%`,
                    top: -6,
                    bottom: -6,
                    width: 2,
                    background: c.text2,
                    borderRadius: 1,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: `${breakEvenPct}%`,
                    top: -20,
                    transform: "translateX(-50%)",
                    fontSize: 9,
                    fontWeight: 600,
                    color: c.text2,
                    whiteSpace: "nowrap",
                  }}
                >
                  break-even
                </div>
              </div>

              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={discountPct}
                onChange={e => handleDiscount(Number(e.target.value))}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  width: "100%",
                  height: 8,
                  opacity: 0,
                  cursor: "pointer",
                  margin: 0,
                }}
              />
            </div>

            {/* Snap points */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {allSnapPoints.map(pt => (
                <button
                  key={pt}
                  onClick={() => handleDiscount(pt)}
                  style={{
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    border: `1px solid ${pt === discountPct ? c.green : c.border}`,
                    background: pt === discountPct ? c.greenBg : "var(--color-card)",
                    color: pt === discountPct ? c.green : c.text2,
                    cursor: "pointer",
                    fontFamily: "ui-monospace,monospace",
                  }}
                >
                  {pt === Math.round(breakEvenPct) ? `${pt}% ← break-even` : `${pt}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Channels */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Notify via channel</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {CHANNELS.map(ch => (
                <label
                  key={ch.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 7,
                    border: `1px solid ${channels.includes(ch.id) ? c.blue : c.border}`,
                    background: channels.includes(ch.id) ? c.blueBg : "var(--color-card)",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={channels.includes(ch.id)}
                    onChange={() => toggleChannel(ch.id)}
                    style={{ width: 14, height: 14, cursor: "pointer" }}
                  />
                  <span style={{ fontWeight: 500 }}>{ch.label}</span>
                  <span style={{ fontSize: 11, color: c.text3, marginLeft: "auto" }}>{ch.meta}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notification methods */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
              Notification methods
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {NOTIFS.map(n => (
                <label
                  key={n.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 7,
                    border: `1px solid ${notifMethods.includes(n.id) ? c.blue : c.border}`,
                    background: notifMethods.includes(n.id) ? c.blueBg : "var(--color-card)",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={notifMethods.includes(n.id)}
                    onChange={() => toggleNotif(n.id)}
                    style={{ width: 14, height: 14, cursor: "pointer" }}
                  />
                  <span style={{ fontWeight: 500 }}>{n.label}</span>
                  <span style={{ fontSize: 11, color: c.text3, marginLeft: "auto" }}>
                    {n.meta}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right: live financial outcome */}
        <div style={{ padding: "20px 22px", background: "var(--color-page)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            Live financial outcome
          </div>

          {/* Itemized math */}
          <div
            style={{
              background: "var(--color-card)",
              border: `1px solid ${c.border}`,
              borderRadius: 10,
              overflow: "hidden",
              marginBottom: 16,
            }}
          >
            {[
              { label: "Gross revenue", value: grossRevenue, note: `${fmtPct(projection.expectedSellThroughPct * 100)} sell-through` },
              { label: "Less landed cost", value: -totalCost, note: null },
              { label: "Less notif. labor", value: -notifLabor, note: "~10 min" },
              { label: "Less channel fees", value: -channelFees, note: channels.includes("marketplace") ? "8% marketplace" : "none" },
            ].map(row => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderBottom: `1px solid ${c.border}`,
                  fontSize: 12.5,
                }}
              >
                <span style={{ color: c.text2 }}>{row.label}</span>
                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      fontFamily: "ui-monospace,monospace",
                      fontWeight: 500,
                      color: row.value >= 0 ? c.text : c.red,
                    }}
                  >
                    {row.value >= 0 ? `$${row.value.toFixed(2)}` : `−$${Math.abs(row.value).toFixed(2)}`}
                  </span>
                  {row.note && (
                    <div style={{ fontSize: 10.5, color: c.text3 }}>{row.note}</div>
                  )}
                </div>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                background: c.greenBg,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span>Net if 100% sells</span>
              <span
                style={{
                  fontFamily: "ui-monospace,monospace",
                  color: net100 >= 0 ? c.green : c.red,
                }}
              >
                {fmtUsd(net100)}
              </span>
            </div>
          </div>

          {/* Sell-through projection */}
          <div
            style={{
              background: "var(--color-card)",
              border: `1px solid ${c.border}`,
              borderRadius: 10,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
              Sell-through projection
            </div>

            {/* Bar */}
            <div
              style={{
                height: 12,
                borderRadius: 6,
                overflow: "hidden",
                display: "flex",
                marginBottom: 8,
                background: c.redBg,
              }}
            >
              <div
                style={{
                  width: `${projection.likelyPct * 100}%`,
                  background: c.green,
                  transition: "width .1s",
                }}
              />
              <div
                style={{
                  width: `${projection.maybePct * 100}%`,
                  background: c.amber,
                  transition: "width .1s",
                }}
              />
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 12, fontSize: 11, marginBottom: 10 }}>
              {[
                { color: c.green, label: "Likely" },
                { color: c.amber, label: "Maybe" },
                { color: c.redBg, label: "Won't clear", border: c.redBorder },
              ].map(l => (
                <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: l.color,
                      border: l.border ? `1px solid ${l.border}` : undefined,
                      display: "inline-block",
                    }}
                  />
                  {l.label}
                </span>
              ))}
            </div>

            {/* Stats */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: c.text2 }}>Expected sell-through</span>
                <span style={{ fontFamily: "ui-monospace,monospace", fontWeight: 600 }}>
                  {fmtPct(projection.expectedSellThroughPct * 100)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: c.text2 }}>Expected revenue</span>
                <span style={{ fontFamily: "ui-monospace,monospace" }}>
                  ${projection.expectedRevenue.toFixed(2)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: c.text2 }}>Residual unsold</span>
                <span style={{ fontFamily: "ui-monospace,monospace", color: c.amber }}>
                  ~{projection.residualQtyLbs.toFixed(1)} lb
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: 8,
                  borderTop: `1px solid ${c.border}`,
                  fontWeight: 600,
                }}
              >
                <span>Expected net</span>
                <span
                  style={{
                    fontFamily: "ui-monospace,monospace",
                    color: netColor(projection.expectedNet),
                  }}
                >
                  {fmtUsd(projection.expectedNet)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main LotDecisionPage ──────────────────────────────────────────────────

export function LotDecisionPage({ lotId }: { lotId: string }) {
  const router = useRouter();
  const { data: lot, isLoading, error } = useLot(lotId);
  const [selectedOption, setSelectedOption] = useState<OptionKey>("markdown");
  const [currentMarkdownConfig, setCurrentMarkdownConfig] = useState<{
    discountPct: number;
    newPrice: number;
    predictedNet: number;
  }>({ discountPct: 30, newPrice: 0, predictedNet: 0 });
  const [showDiscard, setShowDiscard] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const { ready: predictionsReady, current: priorCount } = useDataReadiness(
    "markdown_predictions_ready",
    { category: "beef" },
  );

  const applyMarkdown = useApplyMarkdown();
  const applyDonate = useApplyDonate();
  const createDecision = useCreateDisposition();

  if (isLoading) return <DetailPageSkeleton />;
  if (!lot) return <PageError message="Lot not found." />;

  const product = getLotPrimaryProduct(lot);
  const totals = getLotTotals(lot);
  const productName = product?.name ?? "Unknown Product";
  // totalWeight = current in-stock weight; compute received as all items summed
  const qtyLbs = totals.totalWeight;
  const receivedLbs = lot.inventoryItems.reduce((s, i) => s + Number(i.exactWeightLbs ?? 0), 0);

  // Compute cost + price from lot receipts
  const landedCostPerLb = (() => {
    if (!lot.lotReceipts.length) return 2.0;
    const line = lot.lotReceipts[0]?.supplierInvoiceLine;
    return line ? Number(line.unitPrice ?? 0) : 2.0;
  })();
  const currentPricePerLb = landedCostPerLb * 2.7; // fallback: 2.7x markup

  // Hours remaining until expiration
  const hoursRemaining = (() => {
    const now = new Date();
    const exp = new Date(lot.expirationDate);
    return Math.max(0, (exp.getTime() - now.getTime()) / (1000 * 60 * 60));
  })();

  const decisionDeadline = (() => {
    const exp = new Date(lot.expirationDate);
    exp.setHours(exp.getHours() - 4);
    return exp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  })();

  // Compute daily avg sold (simplified — using weeks as proxy)
  const dailyAvgSoldLbs = qtyLbs > 0 ? qtyLbs * 0.15 : 5;

  const velocity = computeVelocity(dailyAvgSoldLbs, hoursRemaining, qtyLbs);

  const velBarSellPct = qtyLbs > 0 ? Math.min(1, velocity.projectedSellLbs / qtyLbs) : 0;

  // Prior sell-through (cold-start safe: default to 0.65)
  const priorAvgSellThrough = predictionsReady ? 0.84 : 0;

  // Compute expectations for all options
  const expectations: Record<OptionKey, OptionExpectation> = {
    markdown: computeMarkdownExpectation(
      qtyLbs,
      landedCostPerLb,
      currentPricePerLb,
      currentMarkdownConfig.discountPct || 30,
      priorAvgSellThrough,
    ),
    outreach: computeOutreachExpectation(qtyLbs, landedCostPerLb, currentPricePerLb, 6),
    donate: computeDonateExpectation(qtyLbs, landedCostPerLb),
    repurpose: computeRepurposeExpectation(qtyLbs, landedCostPerLb),
  };

  const recommendation = recommendDisposition(
    Object.values(expectations),
    priorCount,
    priorAvgSellThrough,
  );

  const recommendedOption =
    !recommendation.hidden ? (recommendation.option.option as OptionKey) : null;

  const currentExpectation = expectations[selectedOption];

  async function handleApply() {
    setIsApplying(true);
    try {
      const decision = await createDecision.mutateAsync({
        lotId,
        option: selectedOption,
        expectedNet: currentExpectation.expectedNet,
        config:
          selectedOption === "markdown"
            ? {
                discountPercent: currentMarkdownConfig.discountPct,
                newPrice: currentMarkdownConfig.newPrice,
                channels: ["clearance_list", "food_trucks"],
                notificationMethods: ["sms", "email"],
                predictedSellThrough: priorAvgSellThrough || 0.65,
                predictedNet: currentMarkdownConfig.predictedNet,
              }
            : selectedOption === "donate"
            ? {
                recipientName: "Local Food Bank",
                pickupAt: new Date().toISOString(),
                taxDeduction: expectations.donate.expectedNet + landedCostPerLb * qtyLbs,
                documentationGenerated: false,
              }
            : { processingNote: selectedOption, targetProductId: "" },
      });

      if (selectedOption === "markdown") {
        await applyMarkdown.mutateAsync({
          decisionId: decision.id,
          lotId,
          config: {
            discountPercent: currentMarkdownConfig.discountPct,
            newPrice: currentMarkdownConfig.newPrice,
            channels: ["clearance_list", "food_trucks"],
            notificationMethods: ["sms", "email"],
            predictedSellThrough: priorAvgSellThrough || 0.65,
            predictedNet: currentMarkdownConfig.predictedNet,
          },
          expectedNet: currentExpectation.expectedNet,
        });
      } else if (selectedOption === "donate") {
        await applyDonate.mutateAsync({
          decisionId: decision.id,
          lotId,
          config: {
            recipientName: "Local Food Bank",
            pickupAt: new Date().toISOString(),
            taxDeduction: expectations.donate.expectedNet + landedCostPerLb * qtyLbs,
            documentationGenerated: false,
          },
        });
      }

      router.push(`/lots/${lotId}`);
    } finally {
      setIsApplying(false);
    }
  }

  const primaryCTA =
    selectedOption === "markdown"
      ? "Apply markdown & notify"
      : selectedOption === "donate"
      ? "Schedule donation"
      : selectedOption === "outreach"
      ? "Send outreach"
      : "Confirm repurpose";

  return (
    <div style={{ background: c.bg, minHeight: "100vh", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 32px 120px" }}>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: c.text3 }}>
            <Link href="/inbox" style={{ color: c.text3, textDecoration: "none" }}>Inbox</Link>
            <span>/</span>
            <Link href="/inbox" style={{ color: c.text3, textDecoration: "none" }}>Decisions</Link>
            <span>/</span>
            <span style={{ color: c.text, fontWeight: 500 }}>Markdown — {productName}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn>Save draft</Btn>
            <Btn onClick={() => router.back()}>Cancel</Btn>
          </div>
        </div>

        {/* Page head + countdown */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 24,
            gap: 20,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "-0.015em",
                margin: "0 0 6px",
                color: c.text,
              }}
            >
              What should we do with {qtyLbs.toFixed(0)} lb of {productName}?
            </h1>
            <p style={{ margin: 0, color: c.text2, fontSize: 14 }}>
              This lot expires before normal sales will clear it. Pick a path; system will compute the net.
            </p>
          </div>

          {/* Countdown card */}
          <div
            style={{
              background: c.amberBg,
              border: `1px solid ${c.amberBorder}`,
              borderRadius: 12,
              padding: "12px 18px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: c.amber,
                animation: "pulse 1.5s infinite",
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: c.text3, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Expires in
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "ui-monospace,monospace", color: c.amber, lineHeight: 1.1 }}>
                {Math.floor(hoursRemaining)}h {Math.floor((hoursRemaining % 1) * 60)}m
              </div>
            </div>
            <div style={{ width: 1, height: 28, background: c.amberBorder }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: c.text3, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Decision by
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.text, lineHeight: 1.2 }}>
                {decisionDeadline}
              </div>
              <div style={{ fontSize: 11, color: c.text2 }}>today</div>
            </div>
          </div>
        </div>

        {/* Lot context strip */}
        <div
          style={{
            background: c.card,
            border: `1px solid ${c.border}`,
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "48px repeat(5, 1fr) 1.5fr",
              alignItems: "start",
              gap: 16,
            }}
          >
            {/* Thumb */}
            <div style={{ fontSize: 32, lineHeight: 1, paddingTop: 4 }}>🥩</div>

            {[
              { label: "Product", value: productName, meta: product?.sku },
              { label: "Lot", value: lot.lotNumber, meta: lot.supplier.name },
              { label: "Quantity left", value: `${qtyLbs.toFixed(2)} lb`, meta: `of ${receivedLbs.toFixed(0)} lb received` },
              { label: "Landed cost", value: `$${(landedCostPerLb * qtyLbs).toFixed(2)}`, meta: `$${landedCostPerLb.toFixed(4)}/lb` },
              { label: "Current price", value: `$${currentPricePerLb.toFixed(2)}/lb`, meta: `$${(currentPricePerLb * qtyLbs).toFixed(2)} if all sold` },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: c.text3, marginBottom: 2 }}>
                  {f.label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: f.label.includes("cost") || f.label.includes("price") || f.label === "Lot" ? "ui-monospace,monospace" : "inherit" }}>
                  {f.value}
                </div>
                {f.meta && <div style={{ fontSize: 11, color: c.text3, marginTop: 2 }}>{f.meta}</div>}
              </div>
            ))}

            {/* Velocity inset */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: c.text3, marginBottom: 6 }}>
                Will it clear in time?
              </div>
              <div style={{ position: "relative", height: 10, background: c.amberBg, borderRadius: 5, overflow: "hidden", border: `1px solid ${c.amberBorder}`, marginBottom: 4 }}>
                <div
                  style={{
                    width: `${velBarSellPct * 100}%`,
                    height: "100%",
                    background: c.green,
                    borderRadius: 5,
                    transition: "width .3s",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: c.text3 }}>
                <span>0 lb</span>
                <span style={{ color: c.amber, fontWeight: 700 }}>~{velocity.projectedSellLbs.toFixed(0)} lb will sell</span>
                <span>{qtyLbs.toFixed(0)} lb</span>
              </div>
              <div style={{ fontSize: 11, color: c.text2, marginTop: 4 }}>
                At <strong style={{ color: c.text }}>{dailyAvgSoldLbs.toFixed(0)} lb/day</strong> velocity ·{" "}
                <strong>{velocity.shortfallLbs.toFixed(0)} lb shortfall</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendation banner */}
        {!recommendation.hidden ? (
          <div
            style={{
              background: "linear-gradient(135deg, #18181b 0%, #27272a 100%)",
              borderRadius: 14,
              padding: "18px 22px",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(22,163,74,0.2)",
                  border: "1px solid rgba(22,163,74,0.4)",
                  color: "#4ade80",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                  System recommends
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-card)" }}>
                  {OPTION_META[recommendation.option.option as OptionKey].label} · {fmtUsd(recommendation.option.expectedNet)} expected net
                </div>
                <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)", marginTop: 3 }}>
                  {recommendation.priorCount} similar markdowns in past 90 days averaged{" "}
                  {fmtPct(recommendation.priorAvgSellThrough * 100)} sell-through
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <Btn variant="ghost">
                <span style={{ color: "rgba(255,255,255,0.7)" }}>See full reasoning</span>
              </Btn>
              <button
                onClick={() => setSelectedOption(recommendation.option.option as OptionKey)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 500,
                  background: "var(--color-card)",
                  color: c.text,
                  border: "1px solid #fff",
                  cursor: "pointer",
                }}
              >
                Apply recommendation →
              </button>
            </div>
          </div>
        ) : (
          !predictionsReady && (
            <div
              style={{
                background: c.amberBg,
                border: `1px solid ${c.amberBorder}`,
                borderRadius: 10,
                padding: "12px 16px",
                marginBottom: 20,
                fontSize: 13,
                color: c.amber,
              }}
            >
              No prior markdowns to predict from. Recommendation badge hidden until we've seen 3+ markdowns in this category.
            </div>
          )
        )}

        {/* Option cards */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: c.text3,
            marginBottom: 10,
          }}
        >
          Compare options · pick one to configure below
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 28,
          }}
        >
          {(Object.keys(OPTION_META) as OptionKey[]).map(key => (
            <OptionCard
              key={key}
              optKey={key}
              expectation={expectations[key]}
              selected={selectedOption === key}
              recommended={recommendedOption === key}
              onClick={() => setSelectedOption(key)}
            />
          ))}
        </div>

        {/* Discard link */}
        <div style={{ marginBottom: 20, marginTop: -16 }}>
          <button
            onClick={() => setShowDiscard(v => !v)}
            style={{
              background: "none",
              border: "none",
              color: c.text3,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <ChevronDown size={12} style={{ transform: showDiscard ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
            More options (discard — always negative net)
          </button>
          {showDiscard && (
            <div
              style={{
                marginTop: 10,
                padding: "12px 16px",
                background: c.redBg,
                border: `1px solid ${c.redBorder}`,
                borderRadius: 10,
                fontSize: 13,
                color: c.red,
              }}
            >
              <strong>Discard:</strong> Write off entire lot. No revenue, full cost loss (−${(landedCostPerLb * qtyLbs).toFixed(2)}). Use only when all other options are exhausted.
            </div>
          )}
        </div>

        {/* Detail panel — Markdown */}
        {selectedOption === "markdown" && (
          <MarkdownDetailPanel
            qtyLbs={qtyLbs}
            landedCostPerLb={landedCostPerLb}
            currentPricePerLb={currentPricePerLb}
            priorAvgSellThrough={priorAvgSellThrough}
            onNetChange={(_, config) => setCurrentMarkdownConfig(config)}
          />
        )}

        {/* Detail panel — Donate */}
        {selectedOption === "donate" && (
          <div
            style={{
              background: c.card,
              border: `1px solid ${c.border}`,
              borderRadius: 14,
              padding: "20px 22px",
              marginBottom: 18,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
              Configure donation
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 16,
                marginTop: 16,
              }}
            >
              {[
                { label: "Recipient", value: "City Food Bank", meta: "3.2 mi · pickup tomorrow 9AM" },
                { label: "Tax deduction", value: `$${(landedCostPerLb * qtyLbs).toFixed(2)}`, meta: "at cost · effective benefit at 30% tax rate" },
                { label: "Documentation", value: "Auto-generated", meta: "COA + weight cert + receipt" },
              ].map(f => (
                <div key={f.label} style={{ padding: "12px 14px", background: "var(--color-page)", borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: c.text3, marginBottom: 4 }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{f.value}</div>
                  <div style={{ fontSize: 11, color: c.text2, marginTop: 2 }}>{f.meta}</div>
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: `1px dashed ${c.border}`,
                fontSize: 12.5,
                color: c.text2,
              }}
            >
              vs Markdown · trades{" "}
              <strong style={{ color: c.text }}>
                {fmtUsd(expectations.markdown.expectedNet - expectations.donate.expectedNet)} lower net
              </strong>{" "}
              for zero variance and ~5 min less time
            </div>
          </div>
        )}

        {/* Donate alternative strip (when markdown is selected) */}
        {selectedOption === "markdown" && (
          <div
            style={{
              background: c.card,
              border: `1px solid ${c.border}`,
              borderRadius: 12,
              padding: "14px 18px",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>
                Alternative · Donate to food bank
              </div>
              <div style={{ fontSize: 12, color: c.text2, marginTop: 2 }}>
                {fmtUsd(expectations.donate.expectedNet - expectations.markdown.expectedNet)} vs markdown · zero variance · zero unsold risk
              </div>
            </div>
            <Btn onClick={() => setSelectedOption("donate")}>Configure donate instead →</Btn>
          </div>
        )}

        {/* Sticky action footer */}
        <div
          style={{
            position: "sticky",
            bottom: 16,
            background: "var(--color-card)",
            border: `1px solid ${c.borderStrong}`,
            borderRadius: 14,
            padding: "14px 20px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {[
              { label: "Selected option", value: OPTION_META[selectedOption].label },
              {
                label: "Expected net",
                value: fmtUsd(currentExpectation.expectedNet),
                valueColor: netColor(currentExpectation.expectedNet),
              },
              { label: "Time to set up", value: currentExpectation.timeToSetUp },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: c.text3 }}>
                  {s.label}
                </span>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    fontFamily: s.valueColor ? "ui-monospace,monospace" : "inherit",
                    color: s.valueColor ?? c.text,
                    marginTop: 1,
                  }}
                >
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Btn>Save as draft</Btn>
            <Btn>Schedule for later</Btn>
            <button
              onClick={handleApply}
              disabled={isApplying}
              style={{
                padding: "9px 18px",
                borderRadius: 9,
                fontSize: 14,
                fontWeight: 600,
                background: c.green,
                color: "var(--color-card)",
                border: `1px solid ${c.green}`,
                cursor: isApplying ? "not-allowed" : "pointer",
                opacity: isApplying ? 0.7 : 1,
              }}
            >
              {isApplying ? "Applying…" : primaryCTA}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
