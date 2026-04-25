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
  Building2,
  ChevronsUpDown,
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
  LifeBuoy,
  Palette,
  Shield,
} from "lucide-react";

import { useCurrentPortalUser } from "@/hooks/use-current-portal-user";
import { useTenantLogoUrl } from "@/hooks/use-tenant-branding";
import { can, type Permission } from "@/lib/auth/permissions";
import type { AccessibleDestination } from "@/services/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    title: "Support",
    items: [
      {
        title: "Report an Issue",
        url: "/support",
        icon: LifeBuoy,
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

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  tenantName?: string;
  tenantSlug?: string;
  destinations?: AccessibleDestination[];
};

export function AppSidebar({
  tenantName,
  tenantSlug,
  destinations = [],
  ...props
}: AppSidebarProps) {
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <div className="flex size-8 items-center justify-center rounded-lg border bg-background">
                    {tenantLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tenantLogoUrl}
                        alt={`${tenantName ?? "Company"} logo`}
                        className="max-h-7 max-w-7 object-contain"
                      />
                    ) : (
                      <Building2 className="size-4" />
                    )}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {tenantName ?? "Workspace"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {tenantSlug ? `${tenantSlug} workspace` : "Company workspace"}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64" align="start">
                <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
                {destinations
                  .filter(destination => destination.type === "tenant")
                  .map(destination => (
                    <DropdownMenuItem key={destination.id} asChild>
                      <a href={destination.targetUrl}>
                        <Building2 className="size-4" />
                        <div className="grid">
                          <span>{destination.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {destination.slug} · {destination.role}
                          </span>
                        </div>
                      </a>
                    </DropdownMenuItem>
                  ))}
                {destinations.some(
                  destination => destination.type === "platform_admin",
                ) ? (
                  <>
                    <DropdownMenuSeparator />
                    {destinations
                      .filter(destination => destination.type === "platform_admin")
                      .map(destination => (
                        <DropdownMenuItem key={destination.id} asChild>
                          <a href={destination.targetUrl}>
                            <Shield className="size-4" />
                            <div className="grid">
                              <span>Platform Admin</span>
                              <span className="text-xs text-muted-foreground">
                                {destination.role.replaceAll("_", " ")}
                              </span>
                            </div>
                          </a>
                        </DropdownMenuItem>
                      ))}
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/signup">
                    <Building2 className="size-4" />
                    Create new workspace
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
