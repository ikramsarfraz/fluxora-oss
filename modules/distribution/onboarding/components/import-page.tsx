"use client";

import Link from "next/link";
import { Package, Truck, Users } from "lucide-react";

const c = {
  bg: "#f7f7f8",
  card: "#ffffff",
  border: "#e7e7ea",
  borderStrong: "#d4d4d8",
  text: "#18181b",
  text2: "#52525b",
  text3: "#a1a1aa",
} as const;

const ENTITIES = [
  {
    icon: Package,
    title: "Products / SKUs",
    description: "Bring your existing catalog. Required: SKU, name, category.",
    href: "/products?import=true",
    cta: "Import products →",
  },
  {
    icon: Truck,
    title: "Suppliers",
    description: "Required: name, AP email. Optional: terms, default tax rate.",
    href: "/suppliers?import=true",
    cta: "Import suppliers →",
  },
  {
    icon: Users,
    title: "Customers / buyers",
    description: "Critical for markdown outreach. Required: name, phone or email.",
    href: "/customers?import=true",
    cta: "Import customers →",
  },
] as const;

export function ImportPage() {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px 80px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.015em", margin: "0 0 6px" }}>
          Bulk import
        </h1>
        <p style={{ color: c.text2, fontSize: 14, margin: 0 }}>
          Pick what you'd like to import. You can also start an import from any of these pages directly.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
        {ENTITIES.map(({ icon: Icon, title, description, href, cta }) => (
          <div key={href} style={{
            background: c.card, border: `1px solid ${c.border}`,
            borderRadius: 14, overflow: "hidden",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: "20px 22px", flex: 1 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: "#f4f4f5",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 14,
              }}>
                <Icon size={20} style={{ color: c.text2 }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 12.5, color: c.text2, lineHeight: 1.5 }}>{description}</div>
            </div>
            <div style={{ padding: "14px 22px", borderTop: `1px solid ${c.border}`, background: "#fafafa" }}>
              <Link href={href} style={{
                display: "inline-flex", alignItems: "center",
                fontSize: 13, fontWeight: 500, color: c.text, textDecoration: "none",
              }}>
                {cta}
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        padding: "12px 16px", background: "#fffbeb",
        border: "1px solid #fde68a", borderRadius: 8,
        fontSize: 12.5, color: "#d97706",
      }}>
        <strong>Not here yet:</strong> QuickBooks, Restaurant365, and MarginEdge integrations are planned.
        For now, export a CSV from your existing tool and import it here.
      </div>
    </div>
  );
}
