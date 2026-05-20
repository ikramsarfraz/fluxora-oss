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
import { getCurrentTenantCached } from "@/modules/core/tenants/services/tenants";
import { getAccessibleDestinationsForAuthUser } from "@/modules/shared/services/auth";
import { hasFeature } from "@/modules/core/feature-flags";
import { INBOX_FEATURE } from "@/modules/distribution/inbox";

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

  const inboxEnabled = await hasFeature(tenant.id, INBOX_FEATURE);

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
            inboxEnabled={inboxEnabled}
          />
          <SidebarInset className="min-w-0 overflow-x-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border-default bg-surface px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-vertical:h-4 data-vertical:self-auto"
              />
              <AppBreadcrumb />
              <div className="ml-auto flex items-center">
                {inboxEnabled && <InboxBell />}
              </div>
            </header>
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </BreadcrumbLabelProvider>
    </TooltipProvider>
  );
}
