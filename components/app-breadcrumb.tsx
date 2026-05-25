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
import { useBreadcrumbLabels } from "@/components/breadcrumb-label-provider";
import { cn } from "@/lib/utils";

/** Known path segments -> short labels (sidebar-aligned where possible). */
const SEGMENT_LABELS: Record<string, string> = {
  account: "Account",
  billing: "Billing",
  customers: "Customers",
  users: "Users",
  prices: "Prices",
  // Legacy /price-chart URL redirects to /prices; the segment is still
  // referenced from old links / external sources in the wild.
  "price-chart": "Prices",
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
    if (prevSegment === "units-of-measure") return "New unit";
    if (prevSegment === "products") return "New product";
    if (prevSegment === "supplier-invoices") return "New invoice";
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
  const { labels } = useBreadcrumbLabels();

  /** On small screens, show only the parent + current (last two) when the trail is longer. */
  const hideCrumbOnMobile = (i: number) =>
    crumbs.length >= 2 && i < crumbs.length - 2;

  const hideSeparatorAfterOnMobile = (i: number) =>
    crumbs.length >= 2 && i < crumbs.length - 2;

  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList>
        {crumbs.map((crumb, i) => (
          <Fragment key={`${crumb.href}-${i}`}>
            <BreadcrumbItem
              className={cn(hideCrumbOnMobile(i) && "hidden md:inline-flex")}
            >
              {crumb.isCurrent ? (
                <BreadcrumbPage>
                  {labels[crumb.href] ?? crumb.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>
                    {labels[crumb.href] ?? crumb.label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {i < crumbs.length - 1 ? (
              <BreadcrumbSeparator
                className={cn(
                  hideSeparatorAfterOnMobile(i) && "hidden md:flex",
                )}
              />
            ) : null}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
