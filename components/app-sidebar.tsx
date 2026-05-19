"use client";

import * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ChevronsUpDown,
  LayoutDashboard,
  Users,
  Package,
  Boxes,
  Truck,
  type LucideIcon,
  ShoppingCart,
  Receipt,
  Wallet,
  CreditCard,
  Shield,
  BadgeCheck,
  CircleDollarSign,
  LifeBuoy,
  LogOut,
  Sparkles,
  TableProperties,
  Activity,
  Settings,
} from "lucide-react";

import { useCurrentPortalUser } from "@/modules/shared/hooks/use-current-portal-user";
import { useTenantLogoUrl } from "@/modules/core/workspace-settings/hooks/use-tenant-branding";
import { Logomark } from "@/components/brand/logomark";
import { can, type Permission } from "@/lib/auth/permissions";
import type { AccessibleDestination } from "@/modules/shared/services/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/lib/auth-client";
import { getAvatarColor } from "@/lib/utils/get-avatar-color";
import { getInitials } from "@/lib/utils/get-initials";
import { formatAuthUserDisplayName } from "@/lib/user-display-name";
import type { User } from "better-auth";

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  permission?: Permission;
};

type NavGroup = {
  title: string;
  hideLabel?: boolean;
  items: NavItem[];
};

const navMain: NavGroup[] = [
  {
    title: "Overview",
    hideLabel: true,
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
        title: "Orders",
        url: "/orders",
        icon: ShoppingCart,
      },
      {
        title: "Customers",
        url: "/customers",
        icon: Users,
      },
      {
        title: "Invoices",
        url: "/invoices",
        icon: Receipt,
      },
      {
        title: "Prices",
        url: "/price-chart",
        icon: TableProperties,
      },
    ],
  },
  {
    title: "Catalog",
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
    ],
  },
  {
    title: "Purchasing",
    items: [
      {
        title: "Bills",
        url: "/supplier-invoices",
        icon: Receipt,
        permission: "view_supplier_invoice",
      },
      {
        title: "Suppliers",
        url: "/suppliers",
        icon: Truck,
      },
      {
        title: "Payments",
        url: "/payments",
        icon: Wallet,
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        title: "Bank feed",
        url: "/bank-activity",
        icon: Activity,
      },
      {
        title: "Expenses",
        url: "/expenses",
        icon: CreditCard,
      },
    ],
  },
];

const navFooter: NavGroup = {
  title: "Settings",
  hideLabel: true,
  items: [
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
    },
  ],
};

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  tenantName?: string;
  tenantSlug?: string;
  destinations?: AccessibleDestination[];
  user?: User;
};

export function AppSidebar({
  tenantName,
  tenantSlug,
  destinations = [],
  user,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
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

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  const userDisplayName = user
    ? formatAuthUserDisplayName(
        user as unknown as Parameters<typeof formatAuthUserDisplayName>[0],
      )
    : "";
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <div className="flex size-8 items-center justify-center overflow-hidden">
                    {tenantLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tenantLogoUrl}
                        alt={`${tenantName ?? "Company"} logo`}
                        className="max-h-7 max-w-7 object-contain"
                      />
                    ) : (
                      <Logomark size={32} />
                    )}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-serif text-[15px] font-medium tracking-[-0.01em] text-ink">
                      {tenantName ?? "Workspace"}
                    </span>
                    <span className="truncate text-[11px] text-subtle">
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
          <SidebarGroup key={group.title} className="py-1">
            {!group.hideLabel && (
              <SidebarGroupLabel className="px-2.5 mt-3 mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                {group.title}
              </SidebarGroupLabel>
            )}
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

        {/* Standalone Settings entry, pinned just above the user card. */}
        <SidebarGroup className="mt-auto border-t border-sidebar-border py-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {navFooter.items.map(item => {
                const Icon = item.icon;
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton isActive={active} asChild tooltip={item.title}>
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
      </SidebarContent>
      {user && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="flex-1 data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user.image ?? ""} alt={userDisplayName} />
                      <AvatarFallback
                        className={`rounded-lg ${getAvatarColor(userDisplayName)}`}
                      >
                        {getInitials(userDisplayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium text-ink">{userDisplayName}</span>
                      <span className="truncate text-[11px] text-subtle">
                        {user.email}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="top"
                  align="start"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage src={user.image ?? ""} alt={userDisplayName} />
                        <AvatarFallback
                          className={`rounded-lg ${getAvatarColor(userDisplayName)}`}
                        >
                          {getInitials(userDisplayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">{userDisplayName}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/account">
                        <BadgeCheck className="size-4" />
                        Account
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/account/billing">
                        <CircleDollarSign className="size-4" />
                        Billing
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/support">
                        <LifeBuoy className="size-4" />
                        Help &amp; support
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/changelog">
                        <Sparkles className="size-4" />
                        What&apos;s new
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
                    <LogOut className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  );
}
