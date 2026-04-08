"use client";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { api, endpoints, type DashboardSummary } from "@/lib/api";
import { formatMoney } from "@/lib/utils/currency";

export default function Home() {
  const { data: summary, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardSummary>(endpoints.dashboard.get()),
  });

  return (
    <div className="home-page">
      <header className="home-hero">
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "0.35rem" }}>
          <img
            src="/prime-logo.png"
            alt="Acme Distribution"
            style={{ maxHeight: "40px", width: "auto", opacity: 0.92 }}
          />
          <div>
            <h1 className="home-title" style={{ marginBottom: "0.2rem" }}>
              Dashboard
            </h1>
            <p className="home-tagline" style={{ margin: 0 }}>
              Here’s how your business looks today — open balances, sales, and inventory at a glance.
            </p>
          </div>
        </div>
      </header>

      {isLoading && <p className="loading">Loading dashboard…</p>}
      {error && (
        <div className="error" role="alert">
          Could not load dashboard: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && summary && (
        <section className="home-stats" aria-label="Business summary">
          <div className="home-dashboard-section">
            <h2 className="home-dashboard-section__title">Money</h2>
            <div className="home-stat-cards">
              <div className="home-card home-card--outstanding">
                <span className="home-card__value">{formatMoney(summary.total_outstanding)}</span>
                <span className="home-card__label">Open balance (A/R — all customers)</span>
              </div>
              <div className="home-card home-card--profit-week">
                <span className="home-card__value">{formatMoney(summary.profit_this_week)}</span>
                <span className="home-card__label">Net profit this week</span>
              </div>
              <div className="home-card home-card--profit-month">
                <span className="home-card__value">{formatMoney(summary.profit_this_month)}</span>
                <span className="home-card__label">Net profit this month</span>
              </div>
              <Link href="/banking" className="home-card home-card--bank">
                <span className="home-card__value">{formatMoney(summary.total_bank_balance ?? "0")}</span>
                <span className="home-card__label">Bank &amp; card balances (active accounts)</span>
              </Link>
            </div>
          </div>

          <div className="home-dashboard-section">
            <h2 className="home-dashboard-section__title">Sales</h2>
            <div className="home-stat-cards">
              <Link href="/orders" className="home-card home-card--orders">
                <span className="home-card__value">{summary.sales_orders_pending}</span>
                <span className="home-card__label">Open sales orders</span>
              </Link>
              <Link href="/orders" className="home-card home-card--invoices">
                <span className="home-card__value">{summary.invoices_count}</span>
                <span className="home-card__label">Invoices on file</span>
              </Link>
            </div>
          </div>

          <div className="home-dashboard-section">
            <h2 className="home-dashboard-section__title">Lists</h2>
            <div className="home-stat-cards">
              <Link href="/customers" className="home-card home-card--customers">
                <span className="home-card__value">{summary.total_customers}</span>
                <span className="home-card__label">Customers</span>
              </Link>
              <Link href="/products" className="home-card home-card--products">
                <span className="home-card__value">{summary.total_products}</span>
                <span className="home-card__label">Products (items)</span>
              </Link>
            </div>
          </div>

          <div className="home-dashboard-section">
            <h2 className="home-dashboard-section__title">Inventory by category</h2>
            <div className="home-stat-cards">
              <Link href="/inventory" className="home-card home-card--inventory home-card--inventory-chicken">
                <span className="home-card__value">{summary.inventory_chicken}</span>
                <span className="home-card__label">Chicken (cases)</span>
              </Link>
              <Link href="/inventory" className="home-card home-card--inventory home-card--inventory-beef">
                <span className="home-card__value">{summary.inventory_beef}</span>
                <span className="home-card__label">Beef (cases)</span>
              </Link>
              <Link href="/inventory" className="home-card home-card--inventory home-card--inventory-processed">
                <span className="home-card__value">{summary.inventory_processed_food}</span>
                <span className="home-card__label">Processed food (cases)</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="home-actions" aria-label="Shortcuts">
        <h2 className="home-section-title">Shortcuts</h2>
        <ul className="home-links">
          <li>
            <Link href="/invoice">New sales order / invoice</Link>
            <span className="home-link-desc">Create with auto order number</span>
          </li>
          <li>
            <Link href="/orders">Sales orders &amp; invoices</Link>
            <span className="home-link-desc">Open, paid, and shipped</span>
          </li>
          <li>
            <Link href="/customers">Customers</Link>
            <span className="home-link-desc">Balances and payment history</span>
          </li>
          <li>
            <Link href="/banking">Banking</Link>
            <span className="home-link-desc">Bank accounts and cash register (manual)</span>
          </li>
          <li>
            <Link href="/expenses">Expenses</Link>
            <span className="home-link-desc">Record and review spending</span>
          </li>
          <li>
            <Link href="/supplier-invoices">Bills</Link>
            <span className="home-link-desc">Supplier invoices; updates inventory</span>
          </li>
          <li>
            <Link href="/inventory">Inventory</Link>
            <span className="home-link-desc">Cases, weight, lot, status</span>
          </li>
          <li>
            <Link href="/price-chart">Price list</Link>
            <span className="home-link-desc">Cost and sell price by product</span>
          </li>
          <li>
            <Link href="/products">Products</Link>
            <span className="home-link-desc">SKUs, default price/lb, species</span>
          </li>
          <li>
            <Link href="/units-of-measure">Units of measure</Link>
            <span className="home-link-desc">lb, case, each — like QuickBooks U of M</span>
          </li>
          <li>
            <Link href="/lots">Lots</Link>
            <span className="home-link-desc">Traceability, receive &amp; expiration (FEFO)</span>
          </li>
          <li>
            <Link href="/suppliers">Vendors</Link>
            <span className="home-link-desc">Suppliers for lots and bills</span>
          </li>
          <li>
            <Link href="/monthly-report">Monthly report</Link>
            <span className="home-link-desc">P&amp;L-style summary</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
