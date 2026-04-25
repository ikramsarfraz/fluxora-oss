"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

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

export function PlatformAdminSidebar() {
  const pathname = usePathname() ?? "";

  const isActive = (url: string) =>
    pathname === url || (url !== "/admin" && pathname.startsWith(url));

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin" className="flex items-center gap-2" aria-label="Platform admin home">
                <div className="flex size-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <ShieldCheck className="size-4" />
                </div>
                <div className="grid text-left">
                  <span className="text-sm font-semibold">Pelzer Solutions</span>
                  <span className="text-xs text-muted-foreground">Platform Admin</span>
                </div>
              </Link>
            </SidebarMenuButton>
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
