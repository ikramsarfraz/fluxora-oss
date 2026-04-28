import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthUserMenu } from "@/components/auth-user-menu";
import { BreadcrumbLabelProvider } from "@/components/breadcrumb-label-provider";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { auth } from "@/lib/auth";
import {
  getTenantSubscriptionHealth,
  isSubscriptionAccessExemptPath,
  shouldBlockTenantAccess,
} from "@/lib/tenant-subscription-health";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentTenant } from "@/services/tenants";
import { getAccessibleDestinationsForAuthUser } from "@/services/auth";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const session = await auth.api.getSession({
    headers: headerList,
  });

  if (!session?.user) {
    redirect("/login");
  }

  let tenant: Awaited<ReturnType<typeof getCurrentTenant>>;
  let destinations: Awaited<ReturnType<typeof getAccessibleDestinationsForAuthUser>>;
  try {
    tenant = await getCurrentTenant();
    destinations = await getAccessibleDestinationsForAuthUser(session.user.id);
  } catch {
    redirect("/login");
  }

  const pathnameFromProxy = headerList.get("x-internal-pathname")?.trim() ?? "";

  /** When `proxy.ts` did not annotate the pathname (unsupported deploy), subscription blocking is skipped. */
  const blockTenantAppRoutes =
    pathnameFromProxy !== "" &&
    shouldBlockTenantAccess(
      getTenantSubscriptionHealth({
        subscriptionPlan: tenant.subscriptionPlan,
        subscriptionStatus: tenant.subscriptionStatus,
        trialEndsAt: tenant.trialEndsAt,
        currentPeriodEndsAt: tenant.currentPeriodEndsAt,
      }),
    ) &&
    !isSubscriptionAccessExemptPath(pathnameFromProxy);

  if (blockTenantAppRoutes) {
    redirect("/billing-blocked");
  }

  return (
    <TooltipProvider>
      <BreadcrumbLabelProvider>
        <SidebarProvider>
          <AppSidebar
            tenantName={tenant.name}
            tenantSlug={tenant.slug}
            destinations={destinations}
          />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-vertical:h-4 data-vertical:self-auto"
              />
              <AppBreadcrumb />
              <div className="ml-auto">
                <AuthUserMenu user={session.user} />
              </div>
            </header>
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </BreadcrumbLabelProvider>
    </TooltipProvider>
  );
}
