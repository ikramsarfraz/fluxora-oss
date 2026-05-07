"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { TenantBrandingCard } from "@/components/tenant-admin/tenant-branding-card";
import Categories from "@/app/(app)/(subscription-guard)/categories/components/categories-page";
import UnitsOfMeasure from "@/app/(app)/(subscription-guard)/units-of-measure/components/units-of-measure-page";

const TABS = [
  { key: "branding", label: "Branding" },
  { key: "categories", label: "Categories" },
  { key: "units", label: "Units of Measure" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default function ConfigurationTabs() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? "/configuration";

  const activeTab = (searchParams.get("tab") as Tab | null) ?? "branding";

  const setTab = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuration"
        description="Manage workspace branding, product categories, and units of measure."
      />
      <nav className="flex gap-1 border-b border-border" aria-label="Configuration sections">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px inline-flex border-b-2 px-4 py-3 text-sm font-medium transition-colors outline-none",
              activeTab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {activeTab === "branding" && <TenantBrandingCard />}
      {activeTab === "categories" && <Categories />}
      {activeTab === "units" && <UnitsOfMeasure />}
    </div>
  );
}
