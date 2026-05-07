"use client";

import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardSummary } from "@/hooks/use-dashboard";
import type { PortalUserRole } from "@/lib/auth/permissions";
import { isSectionVisible } from "@/lib/dashboard/visibility";

import { MetricCards } from "./metric-cards";
import { SalesSection } from "./sales-section";
import { TenantSetupChecklistCard } from "./tenant-setup-checklist-card";

export function DashboardShell({ role }: { role: PortalUserRole }) {
  const { data, isPending, isError, error } = useDashboardSummary();

  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-3 px-4 lg:px-6 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <div className="px-4 lg:px-6">
          <Skeleton className="h-[300px] w-full rounded-xl" />
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
    <div className="flex flex-col gap-6 pb-10">
      <TenantSetupChecklistCard role={role} />
      <MetricCards metrics={data.metrics} role={role} />
      {isSectionVisible(role, "sales") ? (
        <SalesSection overTime={data.sales.overTime} />
      ) : null}
    </div>
  );
}
