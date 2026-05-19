"use client";

import {
  Activity,
  Bell,
  Boxes,
  ChevronsUpDown,
  CreditCard,
  LayoutDashboard,
  type LucideIcon,
  Package,
  PanelLeft,
  Receipt,
  Settings,
  ShoppingCart,
  TableProperties,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { cn } from "@/lib/utils";

type NavItem = { title: string; url: string; icon: LucideIcon };
type NavGroup = { title: string; hideLabel?: boolean; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: "Overview",
    hideLabel: true,
    items: [{ title: "Dashboard", url: "/", icon: LayoutDashboard }],
  },
  {
    title: "Sales",
    items: [
      { title: "Orders", url: "/orders", icon: ShoppingCart },
      { title: "Customers", url: "/customers", icon: Users },
      { title: "Invoices", url: "/invoices", icon: Receipt },
      { title: "Prices", url: "/price-chart", icon: TableProperties },
    ],
  },
  {
    title: "Catalog",
    items: [
      { title: "Products", url: "/products", icon: Package },
      { title: "Inventory", url: "/inventory", icon: Boxes },
    ],
  },
  {
    title: "Purchasing",
    items: [
      { title: "Bills", url: "/supplier-invoices", icon: Receipt },
      { title: "Suppliers", url: "/suppliers", icon: Truck },
      { title: "Payments", url: "/payments", icon: Wallet },
    ],
  },
  {
    title: "Finance",
    items: [
      { title: "Bank feed", url: "/bank-activity", icon: Activity },
      { title: "Expenses", url: "/expenses", icon: CreditCard },
    ],
  },
];

const FOOTER: NavItem[] = [
  { title: "Settings", url: "/settings", icon: Settings },
];

export function FakeSidebar({
  activeUrl = "/supplier-invoices",
  collapsed = false,
}: {
  activeUrl?: string;
  collapsed?: boolean;
}) {
  if (collapsed) {
    return <CollapsedSidebar activeUrl={activeUrl} />;
  }

  return (
    <aside className="flex w-[16rem] shrink-0 flex-col gap-2 border-r border-sidebar-border bg-sidebar p-2 text-sidebar-foreground">
      <div className="flex items-center gap-2 rounded-md p-2">
        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden">
          <Logomark size={32} />
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-serif text-[15px] font-medium tracking-[-0.01em] text-ink">
            Hollow Reed Foods
          </span>
          <span className="truncate text-[11px] text-subtle">
            hollow-reed workspace
          </span>
        </div>
        <ChevronsUpDown className="size-3.5 text-subtle" />
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-hidden">
        {NAV.map((group) => (
          <div key={group.title} className="flex flex-col">
            {!group.hideLabel && (
              <div className="px-2 pt-1 pb-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-subtle">
                {group.title}
              </div>
            )}
            <ul className="flex flex-col">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.url === activeUrl;
                return (
                  <li key={item.url}>
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 pt-2">
        {FOOTER.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.url}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/80"
            >
              <Icon className="size-4 shrink-0" />
              <span>{item.title}</span>
            </div>
          );
        })}
        <div className="mt-1 flex items-center gap-2 rounded-md p-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gold text-[11px] font-medium text-card-warm">
            HR
          </div>
          <div className="grid flex-1 text-left leading-tight">
            <span className="truncate text-[12.5px] font-medium text-ink">
              Hollow Reed
            </span>
            <span className="truncate text-[10.5px] text-subtle">
              owner@hollow-reed.co
            </span>
          </div>
          <ChevronsUpDown className="size-3 text-subtle" />
        </div>
      </div>
    </aside>
  );
}

function CollapsedSidebar({ activeUrl }: { activeUrl: string }) {
  // Mirrors the production Sidebar `collapsible="icon"` width — 3rem rail
  // with just the logomark + icon-only nav. Active item gets the same
  // sidebar-accent treatment as the full sidebar.
  const flat = NAV.flatMap((g) => g.items);
  return (
    <aside className="flex w-[3rem] shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-2 text-sidebar-foreground">
      <div className="flex size-8 items-center justify-center">
        <Logomark size={28} />
      </div>
      <div className="my-1 h-px w-6 bg-sidebar-border" />
      <ul className="flex flex-col items-center gap-0.5">
        {flat.map((item) => {
          const Icon = item.icon;
          const active = item.url === activeUrl;
          return (
            <li
              key={item.url}
              title={item.title}
              className={cn(
                "flex size-8 items-center justify-center rounded-md",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80",
              )}
            >
              <Icon className="size-4 shrink-0" />
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex flex-col items-center gap-1">
        {FOOTER.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.url}
              className="flex size-8 items-center justify-center rounded-md text-sidebar-foreground/80"
            >
              <Icon className="size-4 shrink-0" />
            </div>
          );
        })}
        <div className="flex size-7 items-center justify-center rounded-md bg-gold text-[10px] font-medium text-card-warm">
          HR
        </div>
      </div>
    </aside>
  );
}

export function FakeHeader({ crumbs }: { crumbs: string[] }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border-default bg-surface px-4">
      <PanelLeft className="size-4 text-subtle" />
      <span className="h-4 w-px bg-border-default" />
      <nav className="flex items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span
              className={cn(
                i === crumbs.length - 1 ? "text-ink-warm" : "text-subtle",
              )}
            >
              {c}
            </span>
            {i < crumbs.length - 1 && (
              <span className="text-subtle">/</span>
            )}
          </span>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2 text-subtle">
        <div className="relative">
          <Bell className="size-4" />
          <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-forest-mid" />
        </div>
      </div>
    </header>
  );
}
