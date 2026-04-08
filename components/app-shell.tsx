"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { AuthUserMenu } from "@/components/auth-user-menu";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isActive = (path: string) =>
    pathname === path || (path !== "/" && pathname.startsWith(path));

  return (
    <div className="app">
      <nav className="nav" aria-label="Main">
        <div
          style={{
            padding: "0 1rem 0.75rem",
            marginBottom: "0.5rem",
            borderBottom: "1px solid rgba(148, 163, 184, 0.25)",
          }}
        >
          <img
            src="/prime-logo.png"
            alt="Acme Distribution LLC"
            style={{ maxWidth: "150px", height: "auto", display: "block" }}
          />
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Overview</div>
          <Link href="/" className={pathname === "/" ? "active" : ""}>
            Dashboard
          </Link>
          <Link href="/banking" className={isActive("/banking") ? "active" : ""}>
            Banking
          </Link>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Sales &amp; customers</div>
          <Link href="/invoice" className={isActive("/invoice") ? "active" : ""}>
            New sales order / invoice
          </Link>
          <Link href="/orders" className={isActive("/orders") ? "active" : ""}>
            Sales orders &amp; invoices
          </Link>
          <Link href="/customers" className={isActive("/customers") ? "active" : ""}>
            Customers
          </Link>
          <Link href="/price-chart" className={isActive("/price-chart") ? "active" : ""}>
            Price list
          </Link>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Purchases &amp; expenses</div>
          <Link href="/expenses" className={isActive("/expenses") ? "active" : ""}>
            Expenses
          </Link>
          <Link href="/suppliers" className={isActive("/suppliers") ? "active" : ""}>
            Vendors
          </Link>
          <Link href="/supplier-invoices" className={isActive("/supplier-invoices") ? "active" : ""}>
            Bills (supplier invoices)
          </Link>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Inventory &amp; products</div>
          <Link href="/inventory" className={isActive("/inventory") ? "active" : ""}>
            Inventory
          </Link>
          <Link href="/lots" className={isActive("/lots") ? "active" : ""}>
            Lots
          </Link>
          <Link href="/products" className={isActive("/products") ? "active" : ""}>
            Products
          </Link>
          <Link href="/units-of-measure" className={isActive("/units-of-measure") ? "active" : ""}>
            Units of measure
          </Link>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Reports</div>
          <Link href="/monthly-report" className={isActive("/monthly-report") ? "active" : ""}>
            Monthly report
          </Link>
        </div>
      </nav>

      <div className="app-content">
        <header className="app-topbar">
          <span className="app-topbar__brand">Acme Distribution LLC</span>
          <span className="app-topbar__spacer" />
          <Suspense fallback={null}>
            <AuthUserMenu />
          </Suspense>
          <details className="app-new-menu">
            <summary className="app-new-menu__trigger">+ New</summary>
            <div className="app-new-menu__dropdown" role="menu">
              <Link href="/invoice" className="app-new-menu__item" role="menuitem">
                Sales order / Invoice
              </Link>
              <Link href="/expenses" className="app-new-menu__item" role="menuitem">
                Expense
              </Link>
              <Link href="/supplier-invoices" className="app-new-menu__item" role="menuitem">
                Bill
              </Link>
              <div className="app-new-menu__divider" role="separator" />
              <Link href="/customers" className="app-new-menu__item" role="menuitem">
                Customer
              </Link>
              <Link href="/suppliers" className="app-new-menu__item" role="menuitem">
                Vendor
              </Link>
              <Link href="/products" className="app-new-menu__item" role="menuitem">
                Product
              </Link>
              <Link href="/banking" className="app-new-menu__item" role="menuitem">
                Bank account
              </Link>
            </div>
          </details>
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
