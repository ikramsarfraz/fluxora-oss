import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { AppSidebar } from "@/components/app-sidebar";
import { BreadcrumbLabelProvider } from "@/components/breadcrumb-label-provider";
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
import { resolveTenantAppPathname } from "@/lib/subscription-guard-pathname";
import { getCurrentTenantCached } from "@/modules/core/tenants/services/tenants";
import { getAccessibleDestinationsForAuthUser } from "@/modules/shared/services/auth";

/**
 * Routes that render full-screen without the tenant sidebar — onboarding
 * screens that the subscription-guard layout forces users onto. Letting the
 * sidebar render here lets users click links the guard immediately redirects
 * back to /get-started, which Next.js prefetching turns into a tight loop.
 */
const SIDEBAR_HIDDEN_PATHS: ReadonlySet<string> = new Set(["/get-started"]);

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

  let tenant: Awaited<ReturnType<typeof getCurrentTenantCached>>;
  let destinations: Awaited<ReturnType<typeof getAccessibleDestinationsForAuthUser>>;
  try {
    tenant = await getCurrentTenantCached();
    destinations = await getAccessibleDestinationsForAuthUser(session.user.id);
  } catch {
    redirect("/login");
  }

  const pathname = resolveTenantAppPathname(headerList);
  if (SIDEBAR_HIDDEN_PATHS.has(pathname)) {
    return (
      <TooltipProvider>
        <PostHogIdentify />
        {children}
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <PostHogIdentify />
      <BreadcrumbLabelProvider>
        <SidebarProvider>
          <AppSidebar
            tenantName={tenant.name}
            tenantSlug={tenant.slug}
            destinations={destinations}
            user={session.user}
          />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-card px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-vertical:h-4 data-vertical:self-auto"
              />
              <AppBreadcrumb />
            </header>
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </BreadcrumbLabelProvider>
    </TooltipProvider>
  );
}
