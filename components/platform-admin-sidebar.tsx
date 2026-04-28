"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
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
import type { AccessibleDestination } from "@/services/auth";
import type { User } from "better-auth";

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

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Tenants",
    url: "/admin/tenants",
    icon: Building2,
  },
  {
    title: "Platform Users",
    url: "/admin/platform-users",
    icon: ShieldCheck,
  },
  {
    title: "Support",
    url: "/admin/support",
    icon: LifeBuoy,
  },
  {
    title: "Stripe catalog",
    url: "/admin/stripe-catalog",
    icon: Layers,
  },
  {
    title: "Subscriptions",
    url: "/admin/subscriptions",
    icon: CreditCard,
  },
];

export function PlatformAdminSidebar({
  destinations = [],
  user,
}: {
  destinations?: AccessibleDestination[];
  user?: User;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();

  const isActive = (url: string) =>
    pathname === url || (url !== "/admin" && pathname.startsWith(url));

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-slate-900 text-white">
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
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => {
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
                      <AvatarImage src={user.image ?? ""} alt={user.name} />
                      <AvatarFallback
                        className={`rounded-lg ${getAvatarColor(user.name)}`}
                      >
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user.name}</span>
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
                        <AvatarImage src={user.image ?? ""} alt={user.name} />
                        <AvatarFallback
                          className={`rounded-lg ${getAvatarColor(user.name)}`}
                        >
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">{user.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/platform-users">
                        <BadgeCheck className="size-4" />
                        Account
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
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
