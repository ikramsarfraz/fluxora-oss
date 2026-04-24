"use client";

import * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  Boxes,
  Truck,
  ShieldCheck,
  Ruler,
  type LucideIcon,
  ListChecks,
  ShoppingCart,
  Layers,
  Receipt,
  Wallet,
  CreditCard,
  Palette,
  Shield,
} from "lucide-react";

import { useCurrentPortalUser } from "@/hooks/use-current-portal-user";
import { useTenantLogoUrl } from "@/hooks/use-tenant-branding";
import { can, type Permission } from "@/lib/auth/permissions";

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  permission?: Permission;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navMain: NavGroup[] = [
  {
    title: "Overview",
    items: [
      {
        title: "Dashboard",
        url: "/",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Sales",
    items: [
      {
        title: "Customers",
        url: "/customers",
        icon: Users,
      },
      {
        title: "Orders",
        url: "/orders",
        icon: ShoppingCart,
      },
      {
        title: "Invoices",
        url: "/invoices",
        icon: Receipt,
      },
    ],
  },
  {
    title: "Inventory",
    items: [
      {
        title: "Products",
        url: "/products",
        icon: Package,
      },
      {
        title: "Inventory",
        url: "/inventory",
        icon: Boxes,
      },
      {
        title: "Lots",
        url: "/lots",
        icon: Layers,
      },
      {
        title: "Categories",
        url: "/categories",
        icon: ListChecks,
      },
      {
        title: "Units of Measure",
        url: "/units-of-measure",
        icon: Ruler,
      },
    ],
  },
  {
    title: "Purchasing",
    items: [
      {
        title: "Suppliers",
        url: "/suppliers",
        icon: Truck,
      },
      {
        title: "Supplier Invoices",
        url: "/supplier-invoices",
        icon: Receipt,
        permission: "view_supplier_invoice",
      },
    ],
  },
  {
    title: "Financials",
    items: [
      {
        title: "Payments",
        url: "/payments",
        icon: Wallet,
      },
      {
        title: "Expenses",
        url: "/expenses",
        icon: CreditCard,
      },
    ],
  },
  {
    title: "Admin",
    items: [
      {
        title: "Users",
        url: "/users",
        icon: ShieldCheck,
      },
      {
        title: "Roles & Permissions",
        url: "/admin/roles",
        icon: Shield,
      },
      {
        title: "Branding",
        url: "/admin/branding",
        icon: Palette,
      },
    ],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname() ?? "";
  const isActive = (url: string) =>
    pathname === url || (url !== "/" && pathname.startsWith(url));

  const { data: currentUser } = useCurrentPortalUser();
  const role = currentUser?.role ?? null;
  const { data: tenantLogoUrl } = useTenantLogoUrl();

  const visibleGroups = navMain
    .map(group => ({
      ...group,
      items: group.items.filter(
        item => !item.permission || can(role, item.permission),
      ),
    }))
    .filter(group => group.items.length > 0);

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link
                href="/"
                className="flex items-center gap-2"
                aria-label="Home"
                title="Home"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tenantLogoUrl ?? "/prime-logo.png"}
                  alt="Company logo"
                  className="h-8 w-auto object-contain"
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {visibleGroups.map(group => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        isActive={active}
                        asChild
                        tooltip={item.title}
                      >
                        <Link href={item.url}>
                          <Icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
