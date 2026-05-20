"use client";

import {
  Boxes,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { cn } from "@/lib/utils";

// Lightweight sidebar + header chrome so scenes 2 and 3 read as the real app
// shell. Not pixel-matched to the production sidebar — the actual reel UI is
// the focus, this just frames it.

type NavItem = {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  active?: boolean;
};

const NAV: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Users, label: "Customers", active: true },
  { icon: Truck, label: "Suppliers" },
  { icon: Package, label: "Products" },
  { icon: Boxes, label: "Inventory" },
  { icon: FileText, label: "Orders" },
  { icon: Receipt, label: "Bills" },
  { icon: Wallet, label: "Payments" },
];

export function FakeAppShell({
  crumbs,
  children,
  rightSlot,
}: {
  crumbs: string[];
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full bg-page">
      {/* Sidebar */}
      <aside className="flex w-[200px] shrink-0 flex-col border-r border-border-default bg-surface">
        <div className="flex items-center gap-2 px-4 py-4">
          <Logomark size={22} />
          <span className="font-serif text-[15px] font-medium text-ink">
            Fluxora
          </span>
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {NAV.map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px]",
                active
                  ? "bg-forest-mid/10 text-forest-mid font-medium"
                  : "text-ink-warm",
              )}
            >
              <Icon className="size-3.5" strokeWidth={1.8} />
              <span>{label}</span>
            </div>
          ))}
        </nav>
        <div className="mt-auto px-4 pb-4 text-[10px] text-subtle font-mono uppercase tracking-[0.14em]">
          acme.fluxora.app
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border-default bg-card-warm/60 px-5 py-2.5">
          <nav className="flex items-center gap-1.5 text-[12px]">
            {crumbs.map((crumb, idx) => (
              <span key={crumb} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    idx === crumbs.length - 1
                      ? "font-medium text-ink"
                      : "text-subtle",
                  )}
                >
                  {crumb}
                </span>
                {idx < crumbs.length - 1 ? (
                  <ChevronRight
                    className="size-3 text-subtle"
                    strokeWidth={2}
                  />
                ) : null}
              </span>
            ))}
          </nav>
          {rightSlot}
        </header>

        <main className="flex-1 overflow-hidden bg-page">{children}</main>
      </div>
    </div>
  );
}
