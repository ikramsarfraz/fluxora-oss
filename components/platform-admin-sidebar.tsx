"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  ChevronsUpDown,
  CreditCard,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  ShieldCheck,
  type LucideIcon,
  BadgeCheck,
  LogOut,
} from "lucide-react";
import { PLATFORM_AI_USAGE_ROLES } from "@/modules/core/platform-admin/ai-usage/permissions";
import { PLATFORM_DASHBOARD_ROLES } from "@/modules/core/platform-admin/dashboard/permissions";
import { PLATFORM_USERS_ROLES } from "@/modules/core/platform-admin/platform-users/permissions";
import { PLATFORM_STRIPE_CATALOG_ROLES } from "@/modules/core/platform-admin/stripe-catalog/permissions";
import { PLATFORM_SUBSCRIPTIONS_ROLES } from "@/modules/core/platform-admin/subscriptions/permissions";
import { PLATFORM_SUPPORT_ROLES } from "@/modules/core/platform-admin/support/permissions";
import { PLATFORM_TENANTS_ROLES } from "@/modules/core/platform-admin/tenants/permissions";
import type { AccessibleDestination } from "@/modules/shared/services/auth";
import type { User } from "better-auth";

type PlatformUserRole = "platform_admin" | "support" | "qa";

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

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Roles allowed to see this entry. Pulled from each section's
   *  permissions.ts so the sidebar stays in sync with route enforcement.
   */
  allowedRoles: ReadonlyArray<PlatformUserRole>;
};

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
    allowedRoles: PLATFORM_DASHBOARD_ROLES,
  },
  {
    title: "Tenants",
    url: "/admin/tenants",
    icon: Building2,
    allowedRoles: PLATFORM_TENANTS_ROLES,
  },
  {
    title: "Platform Users",
    url: "/admin/platform-users",
    icon: ShieldCheck,
    allowedRoles: PLATFORM_USERS_ROLES,
  },
  {
    title: "Support",
    url: "/admin/support",
    icon: LifeBuoy,
    allowedRoles: PLATFORM_SUPPORT_ROLES,
  },
  {
    title: "Stripe catalog",
    url: "/admin/stripe-catalog",
    icon: Layers,
    allowedRoles: PLATFORM_STRIPE_CATALOG_ROLES,
  },
  {
    title: "Subscriptions",
    url: "/admin/subscriptions",
    icon: CreditCard,
    allowedRoles: PLATFORM_SUBSCRIPTIONS_ROLES,
  },
  {
    title: "AI usage",
    url: "/admin/ai-usage",
    icon: BarChart3,
    allowedRoles: PLATFORM_AI_USAGE_ROLES,
  },
];

export function PlatformAdminSidebar({
  destinations = [],
  user,
  role,
}: {
  destinations?: AccessibleDestination[];
  user?: User;
  /**
   * Current platform user's role. When omitted, no nav items render —
   * forces the layout to pass it so we never accidentally expose nav
   * entries the user can't reach.
   */
  role?: PlatformUserRole;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();

  const visibleNavItems = role
    ? navItems.filter(item => item.allowedRoles.includes(role))
    : [];

  // The "Account" dropdown link points at /admin/platform-users which
  // is admin-only. Hide it for support/qa rather than letting them
  // click straight into the access-denied error boundary.
  const canManagePlatformUsers = role
    ? (PLATFORM_USERS_ROLES as readonly string[]).includes(role)
    : false;

  const isActive = (url: string) =>
    pathname === url || (url !== "/admin" && pathname.startsWith(url));

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
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-ink-warm text-white">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Pelzer Solutions</span>
                    <span className="truncate text-xs text-muted-foreground">
                      Platform Admin
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64" align="start">
                <DropdownMenuLabel>Switch destination</DropdownMenuLabel>
                {destinations
                  .filter(destination => destination.type === "platform_admin")
                  .map(destination => (
                    <DropdownMenuItem key={destination.id} asChild>
                      <a href={destination.targetUrl}>
                        <ShieldCheck className="size-4" />
                        <div className="grid">
                          <span>Platform Admin</span>
                          <span className="text-xs text-muted-foreground">
                            {destination.role.replaceAll("_", " ")}
                          </span>
                        </div>
                      </a>
                    </DropdownMenuItem>
                  ))}
                {destinations.some(destination => destination.type === "tenant") ? (
                  <>
                    <DropdownMenuSeparator />
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
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-2.5 mt-1.5 mb-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-subtle">
            Platform
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNavItems.map(item => {
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton isActive={isActive(item.url)} asChild tooltip={item.title}>
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
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
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
                      <span className="truncate font-semibold">{userDisplayName}</span>
                      <span className="truncate text-xs text-muted-foreground">
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
                  {canManagePlatformUsers ? (
                    <>
                      <DropdownMenuGroup>
                        <DropdownMenuItem asChild>
                          <Link href="/admin/platform-users">
                            <BadgeCheck className="size-4" />
                            Account
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
                    <LogOut className="size-4" />
                    Sign Out
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
