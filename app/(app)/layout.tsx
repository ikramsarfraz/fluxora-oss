import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { AppSidebar } from "@/components/app-sidebar";
import { BreadcrumbLabelProvider } from "@/components/breadcrumb-label-provider";
import { InboxBell } from "@/components/inbox-bell";
import { PostHogIdentify } from "@/components/posthog-identify";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { buildSessionResetPath } from "@/lib/auth-session-reset";
import { TENANT_ROUTE_PATH_HEADER } from "@/lib/subscription-guard-constants";
import { changelogReleases } from "@/lib/changelog";
import { formatRelativeShort } from "@/lib/utils/date";
import { getCurrentTenantCached } from "@/modules/core/tenants/services/tenants";
import { getAccessibleDestinationsForAuthUser } from "@/modules/shared/services/auth";
import { hasFeature } from "@/modules/core/feature-flags";
import { INBOX_FEATURE } from "@/modules/distribution/inbox";
import { listTenantSupportTickets } from "@/modules/core/platform-admin/support";

import { GlobalShortcuts } from "./_components/global-shortcuts";
import {
  HelpTrigger,
} from "./_components/help-trigger";
import type { HelpSheetTicket } from "./_components/help-sheet";
import { ProductTour } from "./_components/product-tour";

const SUPPORT_ISSUE_TYPE_LABEL: Record<string, string> = {
  billing: "Billing",
  onboarding: "Onboarding",
  reliability: "Reliability",
  bug: "Bug",
  feature_request: "Feature request",
  account: "Account",
  data: "Data",
  other: "Support",
};

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
};

const PRIORITY_PLANS = new Set(["growth", "enterprise"]);

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const session = await auth.api.getSession({
    headers: headerList,
  });

  // Where the user was headed — preserved through the reset so they return here
  // after re-authenticating. Set by `proxy.ts` on every forwarded request.
  const callbackUrl = headerList.get(TENANT_ROUTE_PATH_HEADER);

  // A session cookie present here but with no valid session means the cookie
  // has outlived its session row (the proxy let us through on cookie presence
  // alone). Clear it via the reset route rather than redirecting straight to
  // `/login`, which the proxy would bounce back into an infinite loop.
  if (!session?.user) {
    redirect(buildSessionResetPath(callbackUrl));
  }

  let tenant: Awaited<ReturnType<typeof getCurrentTenantCached>>;
  let destinations: Awaited<ReturnType<typeof getAccessibleDestinationsForAuthUser>>;
  try {
    tenant = await getCurrentTenantCached();
    destinations = await getAccessibleDestinationsForAuthUser(session.user.id);
  } catch {
    // Tenant resolution failed for this host (missing/inactive tenant, or a
    // cross-tenant cookie whose session row was just deleted). Same loop risk —
    // clear the cookie before sending the user to sign in again.
    redirect(buildSessionResetPath(callbackUrl));
  }

  const inboxEnabled = await hasFeature(tenant.id, INBOX_FEATURE);

  const ticketRows = await listTenantSupportTickets().catch(() => []);
  const tickets: HelpSheetTicket[] = ticketRows.slice(0, 3).map((row) => ({
    id: row.id,
    shortId: `TKT-${row.id.slice(0, 8).toUpperCase()}`,
    subject: row.subject,
    status: row.status,
    category: SUPPORT_ISSUE_TYPE_LABEL[row.issueType] ?? row.issueType,
    updatedRelative: formatRelativeShort(row.updatedAt),
  }));
  const planLabel = PLAN_LABEL[tenant.subscriptionPlan] ?? tenant.subscriptionPlan;
  const isPriorityPlan = PRIORITY_PLANS.has(tenant.subscriptionPlan);
  const currentVersion = changelogReleases[0]?.version ?? "0.0.0";

  return (
    <TooltipProvider>
      <PostHogIdentify />
      <BreadcrumbLabelProvider>
        <SidebarProvider>
          <AppSidebar
            id="sidebar"
            tenantName={tenant.name}
            tenantSlug={tenant.slug}
            destinations={destinations}
            user={session.user}
            inboxEnabled={inboxEnabled}
          />
          <SidebarInset className="min-w-0 overflow-x-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border-default bg-surface px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-vertical:h-4 data-vertical:self-auto"
              />
              <div id="topSearch" className="flex min-w-0 flex-1 items-center">
                <AppBreadcrumb />
              </div>
              <div className="ml-auto flex items-center gap-2">
                {inboxEnabled && <InboxBell />}
                <HelpTrigger
                  tenantName={tenant.name}
                  tenantSlug={tenant.slug}
                  planLabel={planLabel}
                  isPriorityPlan={isPriorityPlan}
                  version={currentVersion}
                  tickets={tickets}
                />
              </div>
            </header>
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">{children}</div>
          </SidebarInset>
          <GlobalShortcuts />
          <ProductTour />
        </SidebarProvider>
      </BreadcrumbLabelProvider>
    </TooltipProvider>
  );
}
