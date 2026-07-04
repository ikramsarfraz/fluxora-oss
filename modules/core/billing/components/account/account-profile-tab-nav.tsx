"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const tabs = [
  { href: "/account", label: "Account" },
  { href: "/account/billing", label: "Billing" },
];

export function AccountProfileTabNav() {
  const pathname = usePathname() ?? "";
  const norm = pathname.replace(/\/$/, "") || "/";

  function isActive(href: string) {
    const h = href.replace(/\/$/, "") || "/";
    if (h === "/account/billing") {
      return (
        norm === "/account/billing" ||
        norm.startsWith("/account/billing/") ||
        norm === "/admin/billing" ||
        norm.startsWith("/admin/billing/")
      );
    }
    return norm === "/account";
  }

  return (
    <nav
      aria-label="Account sections"
      className="flex w-full max-w-2xl gap-1 border-b border-border"
    >
      {tabs.map(t => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px inline-flex border-b-2 px-4 py-3 text-sm font-medium transition-colors outline-none",
            isActive(t.href)
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
