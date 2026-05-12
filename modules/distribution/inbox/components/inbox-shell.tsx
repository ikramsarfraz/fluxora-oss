"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CashFlowSummary, InboxData, InboxItem, ExpiringLotEntry, PriceMover, ReauthBanner, TodayScheduleEntry } from "../types";
import { InboxEmptyState, PriceAlertsEmptyState } from "@/modules/distribution/components/empty-states";

// ── Design tokens (mockup exact values) ───────────────────────────────────
const C = {
  bg: "#f7f7f8",
  card: "#ffffff",
  border: "#e7e7ea",
  borderStrong: "#d4d4d8",
  text: "#18181b",
  text2: "#52525b",
  text3: "#a1a1aa",
  green: "#16a34a",
  greenBg: "#f0fdf4",
  greenBorder: "#bbf7d0",
  amber: "#d97706",
  amberBg: "#fffbeb",
  amberBorder: "#fde68a",
  red: "#dc2626",
  redBg: "#fef2f2",
  redBorder: "#fecaca",
  blue: "#2563eb",
  blueBg: "#eff6ff",
  blueBorder: "#bfdbfe",
  purple: "#7c3aed",
  purpleBg: "#f5f3ff",
  teal: "#0d9488",
  tealBg: "#f0fdfa",
  mono: "var(--font-geist-mono, 'JetBrains Mono', ui-monospace, monospace)",
} as const;

// ── Greeting helper ───────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ── Pill component ────────────────────────────────────────────────────────

type PillTone = "red" | "amber" | "blue" | "green" | "gray" | "purple" | "teal";

function Pill({ label, tone = "gray" }: { label: string; tone?: PillTone }) {
  const styles: Record<PillTone, { bg: string; color: string }> = {
    red: { bg: C.redBg, color: C.red },
    amber: { bg: C.amberBg, color: C.amber },
    blue: { bg: C.blueBg, color: C.blue },
    green: { bg: C.greenBg, color: C.green },
    gray: { bg: "#f4f4f5", color: C.text2 },
    purple: { bg: C.purpleBg, color: C.purple },
    teal: { bg: C.tealBg, color: C.teal },
  };
  const s = styles[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 10.5,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

// ── Card container ────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardHead({
  left,
  right,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "13px 16px",
        borderBottom: `1px solid ${C.border}`,
        background: "#fafafa",
      }}
    >
      {left}
      {right && <div>{right}</div>}
    </div>
  );
}

function CardTitle({ title, count, countTone = "default" }: { title: string; count?: number | string; countTone?: "default" | "red" | "amber" | "green" }) {
  const countBg = countTone === "red" ? C.red : countTone === "amber" ? C.amber : countTone === "green" ? C.green : C.text;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: C.text2 }}>
        {title}
      </span>
      {count !== undefined && (
        <span
          style={{
            background: countBg,
            color: "#fff",
            fontSize: 10.5,
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: 4,
            fontFamily: C.mono,
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

// ── Btn helper ────────────────────────────────────────────────────────────

function Btn({
  children,
  onClick,
  variant = "default",
  size = "sm",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost";
  size?: "sm" | "default";
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: size === "sm" ? "3px 8px" : "6px 11px",
        borderRadius: size === "sm" ? 5 : 7,
        fontSize: size === "sm" ? 11.5 : 12.5,
        fontWeight: 500,
        border: variant === "primary" ? "none" : variant === "ghost" ? "none" : `1px solid ${C.borderStrong}`,
        background: variant === "primary" ? C.text : variant === "ghost" ? "transparent" : "#fff",
        color: variant === "primary" ? "#fff" : C.text,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

// ── Pulsing dot ───────────────────────────────────────────────────────────

function PulseDot({ color = "red" }: { color?: "red" | "green" | "amber" | "blue" }) {
  const colors = { red: C.red, green: C.green, amber: C.amber, blue: C.blue };
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: colors[color],
        animation: `loading-pulse-dot 1.6s infinite`,
        flexShrink: 0,
      }}
    />
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────

function FilterTabs({
  tabs,
  active,
  onSelect,
}: {
  tabs: { label: string; value: string; count?: number }[];
  active: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 2, padding: "0 4px" }}>
      {tabs.map(tab => (
        <button
          key={tab.value}
          onClick={() => onSelect(tab.value)}
          style={{
            padding: "4px 10px",
            borderRadius: 5,
            fontSize: 11.5,
            fontWeight: 500,
            color: active === tab.value ? "#fff" : C.text2,
            cursor: "pointer",
            border: "none",
            background: active === tab.value ? C.text : "transparent",
            fontFamily: "inherit",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              style={{
                background: active === tab.value ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.08)",
                color: active === tab.value ? "#fff" : C.text2,
                fontSize: 10,
                padding: "0 5px",
                borderRadius: 3,
                fontWeight: 600,
              }}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Action item ───────────────────────────────────────────────────────────

function ActionItem({ item, onSnooze, onDismiss }: { item: InboxItem; onSnooze?: (id: string) => void; onDismiss?: (id: string) => void }) {
  const router = useRouter();
  const iconColor: Record<string, { bg: string; color: string }> = {
    blocking_others: { bg: C.redBg, color: C.red },
    today: { bg: C.amberBg, color: C.amber },
    this_week: { bg: C.blueBg, color: C.blue },
    informational: { bg: C.tealBg, color: C.teal },
  };
  const ic = iconColor[item.urgency] ?? iconColor.today;

  const categoryIcons: Record<string, React.ReactNode> = {
    held_receiving: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    overdue_memo: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    ),
    expiring_lot: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    price_spike: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
    new_bill: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
    memo_acknowledged: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
    alias_learned: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr auto",
        gap: 14,
        padding: "14px 16px",
        borderBottom: `1px solid ${C.border}`,
        cursor: "pointer",
        alignItems: "flex-start",
      }}
      onClick={() => {
        const route = item.actions.find(a => a.route)?.route;
        if (route) router.push(route);
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 36, height: 36,
          borderRadius: 9,
          background: ic.bg,
          color: ic.color,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {categoryIcons[item.category]}
      </div>

      {/* Content */}
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
          {item.title}
          {item.pills?.map((p, i) => <Pill key={i} label={p.label} tone={p.tone} />)}
        </div>
        <div style={{ fontSize: 12, color: C.text2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {item.meta}
        </div>
        {item.detail && (
          <div
            style={{
              fontSize: 12,
              color: C.text2,
              marginTop: 6,
              padding: "8px 10px",
              background: item.detailTone === "red" ? C.redBg : item.detailTone === "amber" ? C.amberBg : "#fafafa",
              borderRadius: 6,
              borderLeft: `3px solid ${item.detailTone === "red" ? C.red : item.detailTone === "amber" ? C.amber : C.borderStrong}`,
            }}
          >
            {item.detail}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, alignItems: "flex-start", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        {item.actions.map((action, i) => (
          <Btn
            key={i}
            variant={action.kind === "primary" ? "primary" : action.kind === "ghost" ? "ghost" : "default"}
            size="sm"
            onClick={() => action.route && router.push(action.route)}
          >
            {action.label}
          </Btn>
        ))}
      </div>
    </div>
  );
}

// ── Expiring lot entry ─────────────────────────────────────────────────────

function ExpiringItem({ lot }: { lot: ExpiringLotEntry }) {
  const thumbStyles: Record<string, string> = {
    beef: "linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)",
    chicken: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
    lamb: "linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)",
    other: "linear-gradient(135deg, #f4f4f5 0%, #e7e7ea 100%)",
  };
  const emojis: Record<string, string> = { beef: "🥩", chicken: "🍗", lamb: "🍖", other: "📦" };
  const deadlineColor = lot.hoursRemaining < 24 ? C.red : lot.hoursRemaining < 72 ? C.amber : C.text3;
  const deadlineLabel = lot.hoursRemaining < 24 ? `${lot.hoursRemaining}h` : `${Math.ceil(lot.hoursRemaining / 24)}d`;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "32px 1fr auto",
        gap: 10,
        padding: "10px 14px",
        borderBottom: `1px solid ${C.border}`,
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 28, height: 28,
          borderRadius: 6,
          background: thumbStyles[lot.category] ?? thumbStyles.other,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14,
        }}
      >
        {emojis[lot.category]}
      </div>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{lot.productName} · {lot.weightLbs.toFixed(0)} lb</div>
        <div style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>
          <span style={{ fontFamily: C.mono }}>{lot.lotNumber}</span>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 11, fontWeight: 600, fontFamily: C.mono, color: deadlineColor }}>
          {deadlineLabel}
        </div>
      </div>
    </div>
  );
}

// ── Price mover row ────────────────────────────────────────────────────────

function PriceMoverRow({ mover }: { mover: PriceMover }) {
  const isUp = mover.deltaPct > 0;
  const strokeColor = isUp ? C.red : C.green;
  const data = mover.sparkData;
  // Normalize to 0-18 range for SVG
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 60;
    const y = isUp
      ? 16 - ((v - min) / range) * 14
      : 2 + ((v - min) / range) * 14;
    return `${x} ${y}`;
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        gap: 10,
        padding: "9px 14px",
        borderBottom: `1px solid ${C.border}`,
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{mover.productName}</div>
        <div style={{ fontSize: 10.5, color: C.text3, fontFamily: C.mono, marginTop: 1 }}>
          {mover.supplierName}
        </div>
      </div>
      <svg width="60" height="18" viewBox="0 0 60 18" preserveAspectRatio="none">
        <path
          d={`M${points.join(" L")}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
        />
        {data.length > 0 && (
          <circle
            cx={60}
            cy={parseFloat(points[points.length - 1].split(" ")[1])}
            r="2"
            fill={strokeColor}
          />
        )}
      </svg>
      <span
        style={{
          fontFamily: C.mono,
          fontSize: 11.5,
          fontWeight: 700,
          padding: "2px 6px",
          borderRadius: 4,
          background: isUp ? C.redBg : C.greenBg,
          color: isUp ? C.red : C.green,
        }}
      >
        {isUp ? "+" : ""}{mover.deltaPct.toFixed(0)}%
      </span>
    </div>
  );
}

// ── Today's schedule card ─────────────────────────────────────────────────

function TodayScheduleCard({ entries }: { entries: TodayScheduleEntry[] }) {
  const router = useRouter();
  const bills = entries.filter(e => e.type === "bill_due");
  const orders = entries.filter(e => e.type === "order_to_ship");

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <Card>
      <CardHead
        left={
          <CardTitle
            title="Today's schedule"
            count={entries.length || undefined}
            countTone={bills.some(b => b.daysOverdue > 0) ? "red" : "default"}
          />
        }
      />
      {entries.length === 0 ? (
        <div style={{ padding: "12px 16px", fontSize: 13, color: C.text3, textAlign: "center" }}>
          No deliveries or bills due today
        </div>
      ) : (
        <>
          {bills.length > 0 && (
            <div>
              <div style={{ padding: "6px 14px 2px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C.text3 }}>
                Bills due
              </div>
              {bills.map(entry => (
                <div
                  key={entry.id}
                  onClick={() => router.push(entry.route)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 10,
                    padding: "8px 14px",
                    borderBottom: `1px solid ${C.border}`,
                    cursor: "pointer",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{entry.entityLabel}</div>
                    <div style={{ fontSize: 11, color: C.text3, fontFamily: C.mono }}>{entry.reference}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, fontFamily: C.mono }}>{fmt(entry.amount)}</div>
                    {entry.daysOverdue > 0 ? (
                      <div style={{ fontSize: 10.5, color: C.red, fontWeight: 600 }}>{entry.daysOverdue}d overdue</div>
                    ) : (
                      <div style={{ fontSize: 10.5, color: C.amber, fontWeight: 600 }}>Due today</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {orders.length > 0 && (
            <div>
              <div style={{ padding: "6px 14px 2px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C.text3 }}>
                Orders to ship
              </div>
              {orders.map(entry => (
                <div
                  key={entry.id}
                  onClick={() => router.push(entry.route)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 10,
                    padding: "8px 14px",
                    borderBottom: `1px solid ${C.border}`,
                    cursor: "pointer",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{entry.entityLabel}</div>
                    <div style={{ fontSize: 11, color: C.text3, fontFamily: C.mono }}>{entry.reference}</div>
                  </div>
                  <Pill label="Ship today" tone="blue" />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ── Main InboxShell ───────────────────────────────────────────────────────

interface InboxShellProps {
  data: InboxData;
  firstName: string;
}

export function InboxShell({ data, firstName }: InboxShellProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "urgent" | "can_wait">("all");
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());

  const allItems = [...data.blockingItems, ...data.actionItems];
  const visibleItems = allItems.filter(item => {
    if (snoozed.has(item.id)) return false;
    if (filter === "urgent") return item.urgency === "blocking_others" || item.urgency === "today";
    if (filter === "can_wait") return item.urgency === "this_week";
    return true;
  });

  function handleSnooze(id: string) {
    setSnoozed(prev => new Set([...prev, id]));
  }

  const hasPriorityBanner = data.blockingItems.length > 0;
  const stats = data.stats;

  if (data.billCount === 0) {
    return (
      <div style={{ padding: "28px 32px 80px", maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.015em", margin: "0 0 2px" }}>
            {greeting()}, {firstName}
          </h1>
          <div style={{ fontSize: 13, color: C.text2 }}>{formatDate()}</div>
        </div>
        <InboxEmptyState />
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 32px 80px", maxWidth: 1440, margin: "0 auto" }}>

      {/* ── Re-auth banners ─────────────────────────────────────────────── */}
      {data.reauthBanners.map(banner => (
        <ReauthBannerComponent key={banner.connectionId} banner={banner} />
      ))}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.015em", margin: "0 0 2px" }}>
            {greeting()}, {firstName}
          </h1>
          <div style={{ fontSize: 13, color: C.text2, display: "flex", alignItems: "center", gap: 10 }}>
            <span>{formatDate()} · {formatTime()}</span>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.text3, display: "inline-block" }} />
            <span>
              {stats.billsToReview > 0 ? `${stats.billsToReview} bill${stats.billsToReview > 1 ? "s" : ""} awaiting review` : "No bills awaiting review"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Live sync status */}
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 10px",
              background: "#fff",
              border: `1px solid ${C.border}`,
              borderRadius: 999,
              fontSize: 11.5,
              color: C.text2,
            }}
          >
            <span
              style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "loading-pulse 1.6s infinite" }}
            />
            Live · synced just now
          </div>
          <Btn>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Search
          </Btn>
          <div
            style={{
              width: 34, height: 34,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #18181b, #52525b)",
              color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {firstName.substring(0, 2).toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── Priority banner ─────────────────────────────────────────────── */}
      {hasPriorityBanner ? (
        <div
          style={{
            background: "linear-gradient(135deg, #18181b 0%, #27272a 100%)",
            color: "#fff",
            borderRadius: 14,
            padding: "20px 24px",
            marginBottom: 22,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Radial highlights */}
          <div
            style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(circle at 80% 30%, rgba(220,38,38,0.15) 0%, transparent 50%), radial-gradient(circle at 20% 70%, rgba(217,119,6,0.10) 0%, transparent 50%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.5)", fontWeight: 600, marginBottom: 4 }}>
              Top of inbox · needs your decision today
            </div>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
              <PulseDot color="red" />
              {data.blockingItems.length} thing{data.blockingItems.length !== 1 ? "s" : ""} blocking other people&apos;s work
            </div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {data.blockingItems.slice(0, 3).map(item => (
                <span
                  key={item.id}
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    padding: "2px 7px",
                    borderRadius: 4,
                    color: "#fff",
                    fontWeight: 500,
                  }}
                >
                  {item.title.split("·")[0].trim()}
                </span>
              ))}
            </div>
          </div>
          <div style={{ position: "relative", display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              style={{
                padding: "6px 11px", borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                background: "rgba(255,255,255,0.1)", color: "#fff",
                border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Snooze all
            </button>
            <button
              style={{
                padding: "6px 11px", borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                background: "#fff", color: C.text,
                border: "none", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Walk me through them →
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: C.greenBg,
            border: `1px solid ${C.greenBorder}`,
            borderRadius: 14,
            padding: "16px 24px",
            marginBottom: 22,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 13,
            color: C.green,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <strong>You&apos;re caught up.</strong>{" "}
          <span style={{ color: C.text2, fontWeight: 400 }}>Nothing is blocking anyone&apos;s work right now.</span>
        </div>
      )}

      {/* ── Stat strip ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 10,
          marginBottom: 22,
        }}
      >
        {[
          {
            label: "Bills to review",
            value: stats.billsToReview,
            color: stats.billsToReview > 0 ? C.amber : C.text,
            delta: stats.billsToReview > 0 ? `${stats.billsToReview} draft${stats.billsToReview > 1 ? "s" : ""}` : "All clear",
            alert: stats.billsToReview > 0,
            route: "/supplier-invoices?status=draft",
          },
          {
            label: "Receiving now",
            value: stats.receivingNow,
            color: stats.receivingNow > 0 ? C.green : C.text,
            delta: stats.receivingNow > 0 ? "Active session" : "Nothing active",
            alert: false,
            route: "/supplier-invoices",
          },
          {
            label: "Expected today",
            value: stats.expectedToday,
            color: C.text,
            delta: stats.expectedToday > 0 ? "Scheduled deliveries" : "Calendar clear",
            alert: false,
            route: "/supplier-invoices",
            mono: true,
          },
          {
            label: "Credits open",
            value: stats.creditsOpenAmount > 0 ? `$${stats.creditsOpenAmount.toFixed(0)}` : "—",
            color: stats.creditsOpenAmount > 0 ? C.amber : C.text,
            delta: `${stats.creditsOpenCount} memo${stats.creditsOpenCount !== 1 ? "s" : ""}${stats.creditsOverdue > 0 ? ` · ${stats.creditsOverdue} overdue` : ""}`,
            alert: stats.creditsOverdue > 0,
            mono: true,
            route: "/supplier-invoices",
          },
          {
            label: "Week spend",
            value: `$${(stats.weekSpend / 1000).toFixed(1)}K`,
            color: C.text,
            delta: stats.weekSpendDeltaPct !== 0 ? `${stats.weekSpendDeltaPct > 0 ? "+" : ""}${stats.weekSpendDeltaPct.toFixed(1)}% vs avg` : "vs avg",
            deltaColor: stats.weekSpendDeltaPct > 5 ? C.red : stats.weekSpendDeltaPct < -5 ? C.green : C.text2,
            alert: false,
            mono: true,
            route: "/supplier-invoices",
          },
          {
            label: "Price alerts",
            value: stats.priceAlerts,
            color: stats.priceAlerts > 0 ? C.red : C.text,
            delta: stats.priceAlerts > 0 ? "Fired overnight" : "No spikes",
            deltaColor: stats.priceAlerts > 0 ? C.red : C.text2,
            alert: stats.priceAlerts > 0,
            route: "/price-chart",
          },
        ].map((stat, i) => (
          <div
            key={i}
            onClick={() => stat.route && router.push(stat.route)}
            style={{
              background: "#fff",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: "12px 14px",
              cursor: "pointer",
              position: "relative",
            }}
          >
            {stat.alert && (
              <span
                style={{
                  position: "absolute",
                  top: 8, right: 8,
                  width: 6, height: 6,
                  borderRadius: "50%",
                  background: C.red,
                  animation: "loading-pulse-dot 1.6s infinite",
                }}
              />
            )}
            <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: C.text3, marginBottom: 4 }}>
              {stat.label}
            </div>
            <div
              style={{
                fontSize: stat.mono ? 18 : 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                fontVariantNumeric: "tabular-nums",
                color: stat.color,
                fontFamily: stat.mono ? C.mono : undefined,
              }}
            >
              {String(stat.value)}
            </div>
            <div style={{ fontSize: 11, color: (stat as { deltaColor?: string }).deltaColor ?? C.text2, marginTop: 2 }}>
              {stat.delta}
            </div>
          </div>
        ))}
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 22, alignItems: "start" }}>

        {/* ── LEFT COLUMN ────────────────────────────────────────────────── */}
        <div>

          {/* Card 1: Needs your decision today */}
          <Card>
            <CardHead
              left={
                <CardTitle
                  title="Needs your decision today"
                  count={visibleItems.length}
                  countTone={visibleItems.some(i => i.urgency === "blocking_others") ? "red" : "default"}
                />
              }
              right={
                <FilterTabs
                  active={filter}
                  onSelect={v => setFilter(v as typeof filter)}
                  tabs={[
                    { label: "All", value: "all", count: allItems.length },
                    { label: "Urgent", value: "urgent", count: allItems.filter(i => i.urgency === "blocking_others" || i.urgency === "today").length },
                    { label: "Can wait", value: "can_wait", count: allItems.filter(i => i.urgency === "this_week").length },
                  ]}
                />
              }
            />
            {visibleItems.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: C.text3, fontSize: 13 }}>
                Nothing needs your attention right now
              </div>
            ) : (
              visibleItems.map(item => (
                <ActionItem
                  key={item.id}
                  item={item}
                  onSnooze={handleSnooze}
                />
              ))
            )}
          </Card>

          {/* Card 2: Active right now */}
          {data.activeSessions.length > 0 && (
            <Card>
              <CardHead
                left={
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CardTitle title="Active right now" count={data.activeSessions.length} countTone="green" />
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, color: C.green, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "loading-pulse 1.6s infinite", display: "inline-block" }} />
                      live
                    </span>
                  </div>
                }
                right={<Btn variant="ghost" size="sm">View all sessions</Btn>}
              />
              <div style={{ padding: 12 }}>
                {data.activeSessions.map(session => {
                  const isGreen = session.type === "receiving";
                  const isBlue = session.type === "ingestion";
                  const borderCol = isGreen ? C.greenBorder : isBlue ? C.blueBorder : C.amberBorder;
                  const bgCol = isGreen ? C.greenBg : isBlue ? C.blueBg : C.amberBg;
                  const accentCol = isGreen ? C.green : isBlue ? C.blue : C.amber;
                  const fillCol = isGreen ? C.green : isBlue ? C.blue : C.amber;
                  return (
                    <div
                      key={session.id}
                      style={{
                        border: `1px solid ${borderCol}`,
                        background: bgCol,
                        borderRadius: 10,
                        padding: "14px 16px",
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 28, height: 28, background: accentCol, color: "#fff", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              {isGreen ? <><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/></> : <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>}
                            </svg>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{session.detail}</div>
                          </div>
                        </div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, color: accentCol, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: accentCol, animation: "loading-pulse 1.6s infinite", display: "inline-block" }} />
                          {session.type === "receiving" ? "Receiving" : session.type === "ingestion" ? "Parsing" : "Background"}
                        </div>
                      </div>
                      <div style={{ height: 5, background: "rgba(255,255,255,0.6)", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                        <div style={{ height: "100%", width: `${session.progress}%`, background: fillCol, borderRadius: 3 }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, color: C.text2 }}>
                        <span>{session.blockingUser ? "Waiting on you" : "Won't block anything"}</span>
                        {session.eta && (
                          <span style={{ fontFamily: C.mono }}>~{session.eta.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Card 3: For your information */}
          {data.informationalItems.length > 0 && (
            <Card>
              <CardHead
                left={<CardTitle title="For your information" count={data.informationalItems.length} />}
                right={<Btn variant="ghost" size="sm">Mark all read</Btn>}
              />
              {data.informationalItems.slice(0, 3).map(item => (
                <ActionItem key={item.id} item={item} onDismiss={id => setSnoozed(prev => new Set([...prev, id]))} />
              ))}
              {data.informationalItems.length > 3 && (
                <div style={{ textAlign: "center", padding: 10, fontSize: 11.5, color: C.text3 }}>
                  + {data.informationalItems.length - 3} more ·{" "}
                  <button style={{ color: C.blue, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
                    show all
                  </button>
                </div>
              )}
            </Card>
          )}

          {/* Closing digest */}
          <div
            style={{
              padding: "18px 22px",
              background: "#fff",
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 24,
              gap: 16,
            }}
          >
            <div style={{ fontSize: 13, color: C.text2, maxWidth: 720, lineHeight: 1.55 }}>
              <strong style={{ color: C.text }}>End of inbox.</strong>{" "}
              You&apos;ve reviewed {allItems.length} decision{allItems.length !== 1 ? "s" : ""} and {data.activeSessions.length} active process{data.activeSessions.length !== 1 ? "es" : ""}.
              {data.expiringLots.length > 0
                ? ` Your next must-do is the ${data.expiringLots[0].productName} markdown by end of day.`
                : " Nothing else needs you today — focus time is yours."}
            </div>
            <button
              style={{ padding: "6px 11px", borderRadius: 7, fontSize: 12.5, fontWeight: 500, border: "none", background: C.text, color: "#fff", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
              onClick={() => router.push("/inbox/guided")}
            >
              Walk me through priorities →
            </button>
          </div>
        </div>

        {/* ── RIGHT COLUMN ───────────────────────────────────────────────── */}
        <div>

          {/* Cash flow card (Plaid) */}
          {data.cashFlow !== null ? (
            <CashFlowCard cashFlow={data.cashFlow} />
          ) : (
            <ConnectBankPromptCard />
          )}

          {/* Today's schedule */}
          <TodayScheduleCard entries={data.todaySchedule} />

          {/* Expiring this week */}
          {data.expiringLots.length > 0 && (
            <Card>
              <CardHead
                left={<CardTitle title="Expiring this week" count={data.expiringLots.length} countTone="amber" />}
                right={<Btn variant="ghost" size="sm">FIFO →</Btn>}
              />
              {data.expiringLots.slice(0, 5).map(lot => (
                <ExpiringItem key={lot.lotId} lot={lot} />
              ))}
            </Card>
          )}

          {/* Top price movers — graduates to full list once 30d of history exists */}
          {data.priceMovers.length > 0 ? (
            <Card>
              <CardHead
                left={<CardTitle title="Top price movers · 7d" count={data.priceMovers.length} />}
                right={<Btn variant="ghost" size="sm">See all</Btn>}
              />
              {data.priceMovers.map(mover => (
                <PriceMoverRow key={mover.productId} mover={mover} />
              ))}
            </Card>
          ) : data.billCount > 0 && data.dayCount < 30 ? (
            <Card>
              <CardHead left={<CardTitle title="Price alerts" />} />
              <div style={{ padding: "12px 16px" }}>
                <PriceAlertsEmptyState dayCount={data.dayCount} />
              </div>
            </Card>
          ) : null}

          {/* This week recap */}
          <Card>
            <CardHead
              left={<CardTitle title="This week" />}
              right={<span style={{ fontSize: 11, color: C.text3 }}>vs prior 4-wk avg</span>}
            />
            <div style={{ padding: "14px 16px" }}>
              {[
                {
                  label: "Spend",
                  value: `$${(stats.weekSpend / 1000).toFixed(1)}K`,
                  delta: stats.weekSpendDeltaPct,
                  pct: Math.min(100, (stats.weekSpend / 20000) * 100),
                  markerPct: 67,
                  color: C.green,
                },
              ].map(item => (
                <div key={item.label} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, marginBottom: 5 }}>
                    <span style={{ color: C.text2 }}>{item.label}</span>
                    <span style={{ fontWeight: 600, fontFamily: C.mono }}>
                      {item.value}
                      {" "}
                      <span style={{ color: item.delta < 0 ? C.green : item.delta > 0 ? C.red : C.text2, fontWeight: 500 }}>
                        {item.delta < 0 ? "↓" : item.delta > 0 ? "↑" : ""}{Math.abs(item.delta).toFixed(1)}%
                      </span>
                    </span>
                  </div>
                  <div style={{ height: 6, background: "#f4f4f5", borderRadius: 3, overflow: "visible", position: "relative" }}>
                    <div style={{ height: "100%", width: `${item.pct}%`, background: item.color, borderRadius: 3 }} />
                    <div style={{ position: "absolute", top: -2, left: `${item.markerPct}%`, width: 2, height: 10, background: C.text, borderRadius: 1 }} />
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 11, color: C.text3, textAlign: "center", marginTop: 8 }}>
                <button
                  onClick={() => router.push("/dashboard")}
                  style={{ background: "none", border: "none", color: C.blue, cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}
                >
                  Full dashboard →
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Cash flow card (Plaid) ─────────────────────────────────────────────────

function CashFlowCard({ cashFlow }: { cashFlow: CashFlowSummary }) {
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #1c1917 0%, #292524 100%)",
        borderRadius: 12,
        padding: "18px 20px",
        marginBottom: 14,
        color: "#fff",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
        Cash position
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: C.mono, marginBottom: 12 }}>
        {fmt(cashFlow.totalBalance)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { label: "Last 7d out", value: `-${fmt(cashFlow.last7dOut)}`, color: "#f87171" },
          { label: "Last 7d in", value: `+${fmt(cashFlow.last7dIn)}`, color: "#4ade80" },
          { label: "Next 7d due", value: fmt(cashFlow.next7dScheduled), color: "#fbbf24" },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: "#78716c", marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color, fontFamily: C.mono }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectBankPromptCard() {
  return (
    <div
      style={{
        border: "1px dashed #e7e7ea",
        borderRadius: 12,
        padding: "16px",
        marginBottom: 14,
        textAlign: "center",
        color: C.text3,
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600, color: C.text2, marginBottom: 4 }}>Live cash position</div>
      <div style={{ marginBottom: 10 }}>Connect your bank to see real balances here.</div>
      <a
        href="/settings/banks"
        style={{ fontSize: 12, color: "#2563eb", textDecoration: "none", fontWeight: 500 }}
      >
        Connect your bank →
      </a>
    </div>
  );
}

// ── Re-auth banner ─────────────────────────────────────────────────────────

function ReauthBannerComponent({ banner }: { banner: ReauthBanner }) {
  const daysSince = banner.lastSyncAt
    ? Math.floor((Date.now() - new Date(banner.lastSyncAt).getTime()) / 86_400_000)
    : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: 10,
        marginBottom: 14,
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ fontSize: 13, color: "#92400e", flex: 1 }}>
        <strong>{banner.institutionName ?? "Bank"} connection needs re-authentication</strong>
        {daysSince !== null && (
          <>
            {" · "}Last successful sync: {daysSince} day{daysSince !== 1 ? "s" : ""} ago
          </>
        )}
        {" · "}Bills paid in the meantime aren&apos;t auto-matched yet. Takes about 30 seconds.
      </div>
      <a
        href="/settings/banks"
        style={{
          flexShrink: 0,
          padding: "6px 14px",
          background: "#d97706",
          color: "#fff",
          borderRadius: 7,
          fontSize: 12,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Reconnect {banner.institutionName ?? "bank"}
      </a>
    </div>
  );
}
