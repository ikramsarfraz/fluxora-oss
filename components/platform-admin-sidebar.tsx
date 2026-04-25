"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronsUpDown,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { AccessibleDestination } from "@/services/auth";

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
    title: "Subscriptions",
    url: "/admin/subscriptions",
    icon: CreditCard,
  },
];

export function PlatformAdminSidebar({
  destinations = [],
}: {
  destinations?: AccessibleDestination[];
}) {
  const pathname = usePathname() ?? "";

  const isActive = (url: string) =>
    pathname === url || (url !== "/admin" && pathname.startsWith(url));

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
      <SidebarRail />
    </Sidebar>
  );
}
