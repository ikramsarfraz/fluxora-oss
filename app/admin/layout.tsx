import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PlatformAdminSidebar } from "@/components/platform-admin-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { auth } from "@/lib/auth";
import { buildRootAppUrl, getRequestTenantHostContext } from "@/lib/tenant-host";
import { getAccessibleDestinationsForAuthUser } from "@/services/auth";
import { requirePlatformUser } from "@/services/platform-users";

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hostContext = await getRequestTenantHostContext();

  if (!hostContext.isPlatformAdminHost) {
    redirect(
      buildRootAppUrl({
        pathname: "/",
        context: hostContext,
      }),
    );
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  const platformUser = await requirePlatformUser().catch(() => null);

  if (!platformUser) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center p-6">
        <div className="w-full rounded-2xl border bg-card p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-blue-700">Platform Admin</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Access denied
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This host is reserved for active Pelzer Solutions platform users.
            Portal users and tenant members cannot access the internal admin surface.
          </p>
        </div>
      </main>
    );
  }
  const destinations = await getAccessibleDestinationsForAuthUser(session.user.id);

  return (
    <TooltipProvider>
      <SidebarProvider>
        <PlatformAdminSidebar destinations={destinations} user={session.user} />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            <div>
              <p className="text-sm font-medium text-slate-900">Platform Admin</p>
              <p className="text-xs text-muted-foreground">{platformUser.role}</p>
            </div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
