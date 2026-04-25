"use client";

import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardSummary } from "@/hooks/use-dashboard";
import type { PortalUserRole } from "@/lib/auth/permissions";
import { isSectionVisible } from "@/lib/dashboard/visibility";

import { ApAgingSection } from "./ap-aging-section";
import { ArAgingSection } from "./ar-aging-section";
import { InventorySection } from "./inventory-section";
import { MetricCards } from "./metric-cards";
import { PurchasingSection } from "./purchasing-section";
import { SalesSection } from "./sales-section";
import { TenantSetupChecklistCard } from "./tenant-setup-checklist-card";

export function DashboardShell({ role }: { role: PortalUserRole }) {
  const { data, isPending, isError, error } = useDashboardSummary();

  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
        <div className="px-4 lg:px-6">
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </div>
        <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @3xl/main:grid-cols-2">
          <Skeleton className="h-[280px] w-full rounded-xl" />
          <Skeleton className="h-[280px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-4 lg:px-6">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Could not load dashboard</AlertTitle>
          <AlertDescription>
            {error instanceof Error
              ? error.message
              : "An unexpected error occurred."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-10">
      <TenantSetupChecklistCard role={role} />
      <MetricCards metrics={data.metrics} role={role} />
      {isSectionVisible(role, "sales") ? (
        <SalesSection sales={data.sales} />
      ) : null}
      {isSectionVisible(role, "arAging") ? <ArAgingSection /> : null}
      {isSectionVisible(role, "purchasing") ? (
        <PurchasingSection purchasing={data.purchasing} />
      ) : null}
      {isSectionVisible(role, "apAging") ? <ApAgingSection /> : null}
      {isSectionVisible(role, "inventory") ? (
        <InventorySection inventory={data.inventory} />
      ) : null}
    </div>
  );
}
