"use client";

import Link from "next/link";

const c = {
  card: "var(--color-card)",
  text: "var(--color-ink)",
  text2: "var(--color-subtle)",
} as const;

export function ViewSwitcher({ activeView }: { activeView: "list" | "compare" }) {
  return (
    <div style={{
      display: "flex", gap: 4, padding: 4,
      background: "var(--color-divider)", borderRadius: 9,
      width: "fit-content", marginBottom: 20,
    }}>
      <Link href="/suppliers?view=list" style={{
        padding: "6px 14px", fontSize: 13,
        fontWeight: activeView === "list" ? 600 : 500,
        color: activeView === "list" ? c.text : c.text2,
        background: activeView === "list" ? c.card : "transparent",
        borderRadius: 6, textDecoration: "none",
        boxShadow: activeView === "list" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
        display: "inline-flex", alignItems: "center",
      }}>
        All suppliers
      </Link>
      <Link href="/suppliers?view=compare" style={{
        padding: "6px 14px", fontSize: 13,
        fontWeight: activeView === "compare" ? 600 : 500,
        color: activeView === "compare" ? c.text : c.text2,
        background: activeView === "compare" ? c.card : "transparent",
        borderRadius: 6, textDecoration: "none",
        boxShadow: activeView === "compare" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
        display: "inline-flex", alignItems: "center",
      }}>
        Compare
      </Link>
    </div>
  );
}
