"use client";

import { motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  Boxes,
  ChevronRight,
  FileText,
  Landmark,
  LayoutDashboard,
  Package,
  Receipt,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { cn } from "@/lib/utils";

// Hand-crafted "marketing-scale" Fluxora app shell. Used to wrap every
// product moment so each one shows real app context — sidebar, header,
// breadcrumb — not just an isolated card.
//
// Sized for marketing density, not in-app density:
// - Sidebar: 220px wide (vs 200px in app), 13px nav text (vs 12px)
// - Header / breadcrumb: 13.5px (vs 12px)
// - Main content area gets generous padding so the focal animation has room
//
// Re-runs the focal animation on a loop while in view (same pattern as the
// previous MomentFrame). Paused offscreen so visitors don't pay for
// animations they can't see.

const DEFAULT_LOOP_MS = 7000;

type NavKey =
  | "dashboard"
  | "customers"
  | "suppliers"
  | "products"
  | "inventory"
  | "orders"
  | "invoices"
  | "payments"
  | "bills"
  | "banking";

type NavItem = {
  key: NavKey;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "customers", label: "Customers", icon: Users },
  { key: "suppliers", label: "Suppliers", icon: Truck },
  { key: "products", label: "Products", icon: Package },
  { key: "inventory", label: "Inventory", icon: Boxes },
  { key: "orders", label: "Orders", icon: FileText },
  { key: "invoices", label: "Invoices", icon: Receipt },
  { key: "payments", label: "Payments", icon: Wallet },
  { key: "bills", label: "Bills", icon: Receipt },
  { key: "banking", label: "Banking", icon: Landmark },
];

export type AppShellTone = "forest" | "success" | "warning" | "info";

export function MarketingAppShell({
  activeNav,
  crumbs,
  rightSlot,
  children,
  label,
  tone = "forest",
  loopMs = DEFAULT_LOOP_MS,
  /** Visible vertical space the main area should occupy. Default is ~500px. */
  bodyHeight = "min-h-[460px]",
}: {
  activeNav: NavKey;
  crumbs: string[];
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  label?: string;
  tone?: AppShellTone;
  loopMs?: number;
  bodyHeight?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  const [loopKey, setLoopKey] = useState(0);
  const hasBeenSeen = useRef(false);

  useEffect(() => {
    if (!inView) return;
    // Replay on re-entry (after being scrolled past) — but not on initial
    // mount, since motion's `initial → animate` already plays once.
    if (hasBeenSeen.current) {
      setLoopKey((k) => k + 1);
    }
    hasBeenSeen.current = true;
    const id = setInterval(() => setLoopKey((k) => k + 1), loopMs);
    return () => clearInterval(id);
  }, [inView, loopMs]);

  const tabTone =
    tone === "success"
      ? "bg-success-bg text-success-fg border-success-border/60"
      : tone === "warning"
        ? "bg-warning-bg text-warning-fg border-warning-border/60"
        : tone === "info"
          ? "bg-info-bg text-info-fg border-info-border/60"
          : "bg-forest-tint text-forest-mid border-forest-tint-deep/60";

  return (
    <div
      ref={ref}
      className="relative"
      // Disable browser scroll-anchoring on the wrapper. Without this, the
      // looping main-area key bump can cause the browser to "anchor" scroll
      // to the changing element and yank the visitor's position.
      style={{ overflowAnchor: "none" }}
    >
      {label ? (
        <div
          className={cn(
            "absolute left-6 -top-3 z-10 inline-flex items-center gap-1.5 rounded-full border bg-card-warm px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] shadow-sm",
            tabTone,
          )}
        >
          <span className="size-1 rounded-full bg-current" />
          {label}
        </div>
      ) : null}

      {/* The shell itself */}
      <div className="overflow-hidden rounded-2xl border border-border-default bg-card-warm shadow-[0_22px_50px_-30px_rgba(31,58,46,0.35)]">
        <div className="grid grid-cols-[220px_1fr]">
          {/* Sidebar */}
          <aside className="flex flex-col border-r border-border-default bg-surface">
            <div className="flex items-center gap-2 px-4 py-4">
              <Logomark size={22} />
              <span className="font-serif text-[16px] font-medium text-ink">
                Fluxora
              </span>
            </div>
            <nav className="flex flex-col gap-0.5 px-2 pb-3">
              {NAV.map(({ key, label: navLabel, icon: Icon }) => {
                const active = key === activeNav;
                return (
                  <div
                    key={key}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px]",
                      active
                        ? "bg-forest-mid/10 font-medium text-forest-mid"
                        : "text-ink-warm",
                    )}
                  >
                    <Icon className="size-3.5" strokeWidth={1.8} />
                    <span>{navLabel}</span>
                  </div>
                );
              })}
            </nav>
            <div className="mt-auto border-t border-border-default px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                Workspace
              </div>
              <div className="mt-1 text-[12px] font-medium text-ink-warm">
                pacificwharf
              </div>
            </div>
          </aside>

          {/* Main column */}
          <div className="flex min-w-0 flex-col">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-border-default bg-card-warm/80 px-5 py-3 backdrop-blur">
              <nav className="flex items-center gap-1.5 text-[13.5px]">
                {crumbs.map((crumb, idx) => {
                  const last = idx === crumbs.length - 1;
                  return (
                    <span key={crumb} className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          last
                            ? "font-medium text-ink"
                            : "text-subtle hover:text-ink-warm",
                        )}
                      >
                        {crumb}
                      </span>
                      {!last ? (
                        <ChevronRight
                          className="size-3 text-subtle"
                          strokeWidth={2}
                        />
                      ) : null}
                    </span>
                  );
                })}
              </nav>
              {rightSlot ? (
                <div className="flex items-center gap-2">{rightSlot}</div>
              ) : null}
            </header>

            {/* Looping main area */}
            <main className={cn("flex flex-1 flex-col bg-page", bodyHeight)}>
              {/* Key bump on each loopMs remounts the focal-animation
                  subtree, replaying motion variants. Sidebar + header stay
                  stable so the shell never blinks. */}
              <div key={loopKey} className="flex flex-1 flex-col">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

// Small floating pulse — used for "live" indicators inside scenes.
export function PulseDot({
  tone = "forest",
}: {
  tone?: "forest" | "warning" | "success";
}) {
  const dot =
    tone === "warning"
      ? "bg-warning-fg"
      : tone === "success"
        ? "bg-success-fg"
        : "bg-forest-mid";
  return (
    <span className="relative flex size-1.5">
      <motion.span
        className={cn("absolute inset-0 rounded-full", dot)}
        animate={{ opacity: [0.35, 0, 0.35], scale: [1, 2, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className={cn("relative size-1.5 rounded-full", dot)} />
    </span>
  );
}
