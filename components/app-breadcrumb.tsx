"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/** Known path segments -> short labels (sidebar-aligned where possible). */
const SEGMENT_LABELS: Record<string, string> = {
  account: "Account",
  customers: "Customers",
  users: "Users",
  "price-chart": "Price list",
  expenses: "Expenses",
  suppliers: "Suppliers",
  orders: "Sales orders",
  invoice: "New sales order",
  inventory: "Inventory",
  products: "Products",
  lots: "Lots",
  payments: "Payments",
  "monthly-report": "Monthly report",
  "supplier-invoices": "Supplier invoices",
  "units-of-measure": "Units of measure",
  edit: "Edit",
};

function humanizeSegment(segment: string): string {
  return segment
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function labelForSegment(
  segment: string,
  prevSegment: string | undefined,
): string {
  if (/^\d+$/.test(segment)) {
    if (prevSegment === "customers") return `Customer ${segment}`;
    if (prevSegment === "orders") return `Order ${segment}`;
    if (prevSegment === "suppliers") return `Supplier ${segment}`;
    if (prevSegment === "users") return `User ${segment}`;
    return `#${segment}`;
  }
  if (segment === "new") {
    if (prevSegment === "customers") return "New customer";
    if (prevSegment === "suppliers") return "New supplier";
    if (prevSegment === "users") return "Invite user";
  }
  return SEGMENT_LABELS[segment] ?? humanizeSegment(segment);
}

type Crumb = { href: string; label: string; isCurrent: boolean };

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [{ href: "/", label: "Dashboard", isCurrent: true }];
  }

  const crumbs: Crumb[] = [];
  let path = "";
  for (let i = 0; i < segments.length; i++) {
    path += `/${segments[i]}`;
    const prev = segments[i - 1];
    const label = labelForSegment(segments[i], prev);
    const isCurrent = i === segments.length - 1;
    crumbs.push({ href: path, label, isCurrent });
  }

  return crumbs;
}

export function AppBreadcrumb() {
  const pathname = usePathname() ?? "/";
  const crumbs = buildCrumbs(pathname);

  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList>
        {crumbs.map((crumb, i) => (
          <Fragment key={`${crumb.href}-${i}`}>
            <BreadcrumbItem
              className={
                i === 0 && crumbs.length > 1 ? "hidden md:inline-flex" : ""
              }
            >
              {crumb.isCurrent ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {i < crumbs.length - 1 ? (
              <BreadcrumbSeparator
                className={
                  i === 0 && crumbs.length > 1 ? "hidden md:flex" : undefined
                }
              />
            ) : null}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
