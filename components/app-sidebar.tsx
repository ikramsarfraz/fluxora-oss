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
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

// This is sample data.
const data = {
  navMain: [
    {
      title: "Overview",
      url: "#",
      items: [
        {
          title: "Dashboard",
          url: "/",
          isActive: true,
        },
      ],
    },
    {
      title: "Sales",
      url: "#",
      items: [
        // {
        //   title: "Orders",
        //   url: "/orders",
        //   isActive: false,
        // },
        // {
        //   title: "Invoices",
        //   url: "/invoice",
        //   isActive: false,
        // },
        {
          title: "Customers",
          url: "/customers",
          isActive: false,
        },
      ],
    },
    {
      title: "Inventory",
      url: "#",
      items: [
        // {
        //   title: "Inventory",
        //   url: "/inventory",
        //   isActive: false,
        // },
        // {
        //   title: "Lots",
        //   url: "/lots",
        //   isActive: false,
        // },
        {
          title: "Products",
          url: "/products",
          isActive: false,
        },
        // {
        //   title: "Units of measure",
        //   url: "/units-of-measure",
        //   isActive: false,
        // },
      ],
    },
    {
      title: "Purchasing",
      url: "#",
      items: [
        // {
        //   title: "Supplier Invoices",
        //   url: "/supplier-invoices",
        //   isActive: false,
        // },
        {
          title: "Suppliers",
          url: "/suppliers",
          isActive: false,
        },
      ],
    },
    // {
    //   title: "Finances",
    //   url: "#",
    //   items: [
    //     {
    //       title: "Payments",
    //       url: "/payments",
    //       isActive: false,
    //     },
    //     {
    //       title: "Expenses",
    //       url: "/expenses",
    //       isActive: false,
    //     },
    //   ],
    // },
    // {
    //   title: "Reports",
    //   url: "#",
    //   items: [
    //     {
    //       title: "Monthly Report",
    //       url: "/monthly-report",
    //       isActive: false,
    //     },
    //   ],
    // },
    {
      title: "Admin",
      url: "#",
      items: [
        {
          title: "Users",
          url: "/users",
          isActive: false,
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname() ?? "";
  const isActive = (url: string) =>
    pathname === url || (url !== "/" && pathname.startsWith(url));

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
                <img
                  src="/prime-logo.png"
                  alt="Acme Distribution LLC"
                  className="h-8 w-auto"
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {data.navMain.map(item => (
          <SidebarGroup key={item.title}>
            <SidebarGroupLabel>{item.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {item.items.map(item => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton isActive={isActive(item.url)} asChild>
                      <Link
                        href={item.url}
                        className={cn(
                          "text-sm",
                          item.isActive
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      >
                        {item.title}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
